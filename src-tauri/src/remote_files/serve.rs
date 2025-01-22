use std::fs::File;
use std::io::{copy, Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Condvar, Mutex};
use std::time::Duration;

use httparse::Status;
use libssh_rs::Channel;
use path_slash::PathBufExt;
use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};

use crate::conn_pool::ManagedDeviceConnection;
use crate::device_manager::Device;
use crate::error::Error;
use crate::event_channel::{EventChannel, EventHandler};
use crate::session_manager::SessionManager;

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
    tauri::async_runtime::spawn(async move {
        tauri::async_runtime::spawn_blocking(move || serve_worker(app, device, channel, path))
            .await
            .unwrap()
            .unwrap_or(());
    });
    Ok(token)
}

fn serve_worker<R: Runtime>(
    app: AppHandle<R>,
    device: Device,
    channel: EventChannel<R, ServeChannelHandler>,
    path: String,
) -> Result<(), Error> {
    log::debug!(
        "Serve {{ path={path}, device.name={} }} is waiting for start.",
        device.name
    );
    if let Some(h) = channel.handler.lock().unwrap().as_ref() {
        h.wait();
    }
    let sessions = app.state::<SessionManager>();
    let remote_port: u16;
    let conn: ManagedDeviceConnection;
    loop {
        let session = sessions.session(device.clone())?;
        match session.listen_forward(Some("127.0.0.1"), 0) {
            Ok(port) => {
                remote_port = port;
                conn = session;
                break;
            }
            Err(e) => match Error::from(e) {
                Error::Disconnected => continue,
                e => return Err(e),
            },
        }
    }
    log::info!(
        "Serve {{ path={path}, device.name={} }} is available on http://127.0.0.1:{remote_port}/",
        device.name
    );
    channel.rx(&ServeReady {
        host: format!("http://127.0.0.1:{remote_port}/"),
    });

    loop {
        if let Some(h) = channel.handler.lock().unwrap().as_ref() {
            if h.closed() {
                break;
            }
        }
        let (_, ch) = match conn.accept_forward(Duration::from_millis(100)) {
            Ok(res) => res,
            Err(_e) => continue,
        };
        serve_handler(&path, ch)?;
    }
    log::info!(
        "Serve {{ path={path}, device.name={} }} closed",
        device.name
    );
    channel.closed(None::<String>);
    Ok(())
}

fn serve_handler(path: &String, ch: Channel) -> Result<(), Error> {
    let url: String;
    let method: String;
    let mut req_data = Vec::<u8>::new();
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
            Ok(Status::Complete(_size)) => {
                url = req.path.unwrap().to_string();
                method = req.method.unwrap().to_string();
                break;
            }
            Err(_e) => {
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
        Err(_e) => {
            out.write_all(b"HTTP/1.1 404\r\n\r\nFile not found\n")?;
            return Ok(());
        }
    };
    let meta = file.metadata()?;
    let file_len = meta.len();
    out.write(b"HTTP/1.1 200\r\n")?;
    out.write(b"Content-Type: application/octet-stream\r\n")?;
    out.write(format!("Content-Length: {}\r\n", file_len).as_bytes())?;
    if &method == "GET" {
        out.write(b"\r\n")?;
        copy(&mut file, &mut out)?;
    }
    Ok(())
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
        self.closed_lock.lock().unwrap().clone()
    }
}
