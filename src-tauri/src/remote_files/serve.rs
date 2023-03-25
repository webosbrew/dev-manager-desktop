use crossbeam_channel::{select, unbounded, Receiver, Sender};
use std::ffi::OsStr;
use std::fs::File;
use std::io::{BufRead, BufReader, BufWriter, ErrorKind, Read, Seek, Write};
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpStream};
use std::ops::Deref;
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::sync::mpsc::channel;
use std::sync::{Arc, Condvar, Mutex};
use std::thread;
use std::time::Duration;

use dialog::Choice::No;
use httparse::Status;
use libssh_rs::Channel;
use path_slash::PathBufExt;
use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime, State};
use tokio::net::TcpListener;

use crate::conn_pool::DeviceConnectionPool;
use crate::device_manager::Device;
use crate::error::Error;
use crate::event_channel::{EventChannel, EventHandler};
use crate::remote_files::path::escape_path;
use crate::session_manager::spawned::Spawned;
use crate::session_manager::{Proc, SessionManager, SpawnedCallback};
use crate::spawn_manager::SpawnManager;

pub(crate) async fn exec<R: Runtime>(
    app: AppHandle<R>,
    device: Device,
    path: String,
) -> Result<String, Error> {
    let channel = EventChannel::new(app.clone(), "");
    let handler = ServeChannelHandler {
        started_lock: Arc::new((Mutex::new(false), Condvar::new())),
        closed_lock: Mutex::new(false),
    };
    channel.listen(handler);
    let token = channel.token();
    tokio::spawn(async move {
        tokio::task::spawn_blocking(move || serve_worker(app, device, channel, path))
            .await
            .unwrap()
            .unwrap_or(());
    });
    return Ok(token);
}

fn serve_worker<R: Runtime>(
    app: AppHandle<R>,
    device: Device,
    channel: EventChannel<R, ServeChannelHandler>,
    path: String,
) -> Result<(), Error> {
    log::debug!("Serve is waiting for start.");
    if let Some(h) = channel.handler.lock().unwrap().as_ref() {
        h.wait();
    }
    let sessions = app.state::<SessionManager>();
    let pool = sessions.pool(device);
    let mut conn = pool.get()?;
    let remote_port = conn.listen_forward(Some("127.0.0.1"), 0)?;
    log::debug!("Serve is available on http://127.0.0.1:{remote_port}/, hosting {path}");
    channel.rx(&ServeReady {
        host: format!("http://127.0.0.1:{remote_port}/"),
    });

    conn.set_blocking(false);

    let mut result: Result<(), Error> = Ok(());
    loop {
        if let Some(h) = channel.handler.lock().unwrap().as_ref() {
            if h.closed() {
                break;
            }
        }
        let (_, ch) = match conn.accept_forward(Duration::from_millis(100)) {
            Ok(res) => res,
            Err(e) => continue,
        };
        serve_handler(&path, ch)?;
    }

    channel.closed(None::<String>);
    return result;
}

fn serve_handler(path: &String, mut ch: Channel) -> Result<(), Error> {
    let mut req_data = Vec::<u8>::new();
    let mut method: String;
    let mut url: String;
    let mut out = ch.stdin();
    loop {
        let mut buf: [u8; 8192] = [0; 8192];
        let mut headers_buf = [httparse::EMPTY_HEADER; 64];
        let mut req = httparse::Request::new(&mut headers_buf);
        let buf_len = ch.stdout().read(&mut buf)?;
        req_data.extend_from_slice(&buf[..buf_len]);
        match req.parse(&req_data) {
            Ok(Status::Partial) => {
                continue;
            }
            Ok(Status::Complete(size)) => {
                url = req.path.unwrap().to_string();
                method = req.method.unwrap().to_string();
                break;
            }
            Err(e) => {
                return Ok(());
            }
        }
    }
    match method.as_str() {
        "GET" | "HEAD" => {}
        _ => {
            out.write_all(b"HTTP/1.1 405\r\nAllow: GET,HEAD\r\n\r\nMethod not supported\n")?;
            return Ok(());
        }
    }
    let mut path = PathBuf::from(path);
    if url != "/" {
        path = path.join(PathBuf::from_slash(&url[1..]));
    }
    log::debug!("Serve {} => {:?}", url, path);
    let mut file = match File::open(path) {
        Ok(file) => file,
        Err(e) => {
            out.write_all(b"HTTP/1.1 404\r\n\r\nFile not found\n")?;
            return Ok(());
        }
    };
    let meta = file.metadata().unwrap();
    let file_len = meta.len();
    out.write(b"HTTP/1.1 200\r\n")?;
    out.write(b"Content-Type: application/octet-stream\r\n")?;
    out.write(format!("Content-Length: {}\r\n", file_len).as_bytes())?;
    if &method == "GET" {
        out.write(b"\r\n")?;
        let mut buf: [u8; 8192] = [0; 8192];
        loop {
            let buf_length = file.read(&mut buf)?;
            if buf_length == 0 {
                break;
            }
            out.write_all(&buf[..buf_length])?;
        }
    }
    return Ok(());
}

#[derive(Serialize)]
struct ServeReady {
    host: String,
}

struct ServeChannelHandler {
    started_lock: Arc<(Mutex<bool>, Condvar)>,
    closed_lock: Mutex<bool>,
}

impl EventHandler for ServeChannelHandler {
    fn tx(&self, _payload: Option<&str>) {
        self.start();
    }

    fn close(&self, _payload: Option<&str>) {
        *self.closed_lock.lock().unwrap() = true;
        log::debug!("Serve requested to stop");
    }
}

impl ServeChannelHandler {
    fn wait(&self) {
        let (lock, cvar) = &*self.started_lock;
        let mut started = lock.lock().unwrap();
        while !*started {
            started = cvar.wait(started).unwrap();
        }
    }
    fn start(&self) {
        let (lock, cvar) = &*self.started_lock;
        *lock.lock().unwrap() = true;
        cvar.notify_one();
    }

    fn closed(&self) -> bool {
        return self.closed_lock.lock().unwrap().clone();
    }
}
