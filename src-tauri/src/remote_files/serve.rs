use std::io::{copy, Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Condvar, Mutex};
use std::time::Duration;

use crate::conn_pool::ManagedDeviceConnection;
use crate::device_manager::Device;
use crate::error::Error;
use crate::event_channel::{EventChannel, EventHandler};
use crate::session_manager::SessionManager;
use httparse::Status;
use libssh_rs::Channel;
use path_slash::PathBufExt;
use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_fs::{FilePath, Fs, OpenOptions};

pub(crate) async fn exec<R: Runtime>(
    app: AppHandle<R>,
    device: Device,
    path: FilePath,
) -> Result<String, Error> {
    let channel = Arc::new(EventChannel::new(app.clone(), ""));
    let handler = ServeChannelHandler::default();
    channel.listen(handler.clone());
    let token = channel.token();
    tauri::async_runtime::spawn(async move {
        let worker_channel = channel.clone();
        run_worker(
            move || serve_worker(app, device, &worker_channel, path, &handler),
            move |error| channel.closed(error),
        )
        .await;
    });
    Ok(token)
}

fn serve_worker<R: Runtime>(
    app: AppHandle<R>,
    device: Device,
    channel: &EventChannel<R, ServeChannelHandler>,
    path: FilePath,
    control: &ServeChannelHandler,
) -> Result<(), Error> {
    log::debug!(
        "Serve {{ path={path}, device.name={} }} is waiting for start.",
        device.name
    );
    if !control.wait() {
        return Ok(());
    }
    let sessions = app.state::<SessionManager>();
    let fs = app.state::<Fs<R>>();
    let remote_port: u16;
    let conn: ManagedDeviceConnection;
    loop {
        if control.closed() {
            return Ok(());
        }
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
        if control.closed() {
            break;
        }
        let Some((_, ch)) = accept_result(conn.accept_forward(Duration::from_millis(100)))? else {
            continue;
        };
        serve_handler(&fs, &path, ch)?;
    }
    log::info!(
        "Serve {{ path={path}, device.name={} }} closed",
        device.name
    );
    Ok(())
}

// The supervisor owns the only close emission, including blocking-task panics.
async fn run_worker<F, C>(worker: F, close: C)
where
    F: FnOnce() -> Result<(), Error> + Send + 'static,
    C: FnOnce(Option<Error>),
{
    let result = match tauri::async_runtime::spawn_blocking(worker).await {
        Ok(result) => result,
        Err(error) => Err(Error::new(format!(
            "IPK HTTP server worker failed: {error}"
        ))),
    };
    close(result.err());
}

fn accept_result<T>(result: Result<T, libssh_rs::Error>) -> Result<Option<T>, Error> {
    match result {
        Ok(channel) => Ok(Some(channel)),
        // libssh-rs reports an idle accept timeout as TryAgain.
        Err(libssh_rs::Error::TryAgain) => Ok(None),
        Err(error) => Err(error.into()),
    }
}

fn read_request(reader: &mut impl Read) -> Result<(String, String), Error> {
    let mut req_data = Vec::<u8>::new();
    loop {
        let mut buf: [u8; 8192] = [0; 8192];
        let mut headers_buf = [httparse::EMPTY_HEADER; 64];
        let mut req = httparse::Request::new(&mut headers_buf);
        let buf_len = reader.read(&mut buf)?;
        if buf_len == 0 {
            return Err(Error::io(std::io::ErrorKind::UnexpectedEof));
        }
        req_data.extend_from_slice(&buf[..buf_len]);
        match req.parse(&req_data) {
            Ok(Status::Partial) => {
                continue;
            }
            Ok(Status::Complete(_size)) => {
                return Ok((
                    req.path.unwrap().to_string(),
                    req.method.unwrap().to_string(),
                ));
            }
            Err(error) => return Err(Error::new(format!("Invalid IPK HTTP request: {error}"))),
        }
    }
}

fn serve_handler<R: Runtime>(fs: &Fs<R>, path: &FilePath, ch: Channel) -> Result<(), Error> {
    let (url, method) = read_request(&mut ch.stdout())?;
    let mut out = ch.stdin();
    match method.as_str() {
        "GET" | "HEAD" => {}
        _ => {
            out.write_all(b"HTTP/1.1 405\r\nAllow: GET,HEAD\r\n\r\nMethod not supported\n")?;
            return Ok(());
        }
    }
    let mut path = path.clone();
    if url != "/" {
        let Ok(std_path) = path.into_path() else {
            out.write_all(b"HTTP/1.1 404\r\n\r\nFile not found\n")?;
            return Ok(());
        };
        path = FilePath::from(std_path.join(PathBuf::from_slash(&url[1..])));
    }
    log::debug!("Serve {} => {:?}", url, path);
    let mut opt = OpenOptions::new();
    opt.read(true);
    let mut file = match fs.open(path, opt) {
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

#[derive(Clone, Default)]
struct ServeChannelHandler {
    state: Arc<(Mutex<ServeState>, Condvar)>,
}

#[derive(Default)]
struct ServeState {
    started: bool,
    closed: bool,
}

impl EventHandler for ServeChannelHandler {
    fn tx(&self, _payload: Option<&str>) {
        let (lock, cvar) = &*self.state;
        lock.lock().unwrap().started = true;
        cvar.notify_all();
    }

    fn close(&self, _payload: Option<&str>) {
        let (lock, cvar) = &*self.state;
        lock.lock().unwrap().closed = true;
        cvar.notify_all();
        log::debug!("Serve requested to stop");
    }
}

impl ServeChannelHandler {
    fn wait(&self) -> bool {
        let (lock, cvar) = &*self.state;
        let mut state = lock.lock().unwrap();
        while !state.started && !state.closed {
            state = cvar.wait(state).unwrap();
        }
        !state.closed
    }

    fn closed(&self) -> bool {
        self.state.0.lock().unwrap().closed
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{self, Cursor};
    use std::sync::mpsc;
    use std::thread;

    #[tokio::test]
    async fn worker_success_emits_one_normal_close() {
        let mut closes = Vec::new();
        run_worker(|| Ok(()), |error| closes.push(error)).await;
        assert_eq!(closes, vec![None]);
    }

    #[tokio::test]
    async fn worker_errors_emit_one_close_with_original_error() {
        for error in [
            Error::Authorization {
                message: "expired session".into(),
            },
            Error::new("forwarding denied"),
            Error::io(io::ErrorKind::BrokenPipe),
        ] {
            let expected = error.clone();
            let mut closes = Vec::new();
            run_worker(move || Err(error), |error| closes.push(error)).await;
            assert_eq!(closes, vec![Some(expected)]);
        }
    }

    #[tokio::test]
    async fn worker_panic_becomes_one_error_close() {
        let mut closes = Vec::new();
        run_worker(|| panic!("worker test panic"), |error| closes.push(error)).await;
        assert_eq!(closes.len(), 1);
        assert!(matches!(&closes[0], Some(Error::Message { message, .. })
            if message.contains("IPK HTTP server worker failed")));
    }

    #[test]
    fn accept_retries_only_idle_timeout() {
        assert_eq!(
            accept_result::<()>(Err(libssh_rs::Error::TryAgain)),
            Ok(None)
        );
        assert_eq!(accept_result(Ok(42)), Ok(Some(42)));
        assert!(
            accept_result::<()>(Err(libssh_rs::Error::RequestDenied("denied".into()))).is_err()
        );
        assert_eq!(
            accept_result::<()>(Err(libssh_rs::Error::Fatal(
                "Socket error: disconnected".into()
            ))),
            Err(Error::Disconnected)
        );
    }

    #[test]
    fn incomplete_header_eof_terminates_instead_of_spinning() {
        let mut reader = Cursor::new(b"GET / HTTP/1.1\r\nHost: tv");
        assert_eq!(
            read_request(&mut reader),
            Err(Error::io(io::ErrorKind::UnexpectedEof))
        );
    }

    #[test]
    fn complete_headers_can_arrive_in_small_chunks() {
        struct Chunked<T>(T);
        impl<T: Read> Read for Chunked<T> {
            fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
                let size = buffer.len().min(3);
                self.0.read(&mut buffer[..size])
            }
        }
        let mut reader = Chunked(Cursor::new(b"GET /app.ipk HTTP/1.1\r\nHost: tv\r\n\r\n"));
        assert_eq!(
            read_request(&mut reader).unwrap(),
            ("/app.ipk".into(), "GET".into())
        );
    }

    #[test]
    fn malformed_headers_and_read_errors_are_reported() {
        assert!(read_request(&mut Cursor::new(b"GET / HTTP/123\r\n\r\n")).is_err());
        struct FailedRead;
        impl Read for FailedRead {
            fn read(&mut self, _: &mut [u8]) -> io::Result<usize> {
                Err(io::Error::new(
                    io::ErrorKind::ConnectionReset,
                    "connection reset",
                ))
            }
        }
        assert!(matches!(
            read_request(&mut FailedRead),
            Err(Error::IO {
                code: io::ErrorKind::ConnectionReset,
                ..
            })
        ));
    }

    #[test]
    fn close_before_start_wakes_the_waiting_worker() {
        let control = ServeChannelHandler::default();
        let worker = control.clone();
        let (sender, receiver) = mpsc::channel();
        let thread = thread::spawn(move || sender.send(worker.wait()).unwrap());
        control.close(None);
        assert!(!receiver.recv_timeout(Duration::from_secs(1)).unwrap());
        thread.join().unwrap();
        control.tx(None);
        assert!(!control.wait());
    }

    #[test]
    fn start_releases_the_waiting_worker() {
        let control = ServeChannelHandler::default();
        control.tx(None);
        assert!(control.wait());
        control.close(None);
        assert!(control.closed());
    }
}
