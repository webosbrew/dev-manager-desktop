use std::env::temp_dir;
use std::io::{Read, Write};
use std::path::Path;

use flate2::read::GzDecoder;
use libssh_rs::OpenFlags;
use serde::Serialize;
use tauri::ipc::Channel;
use tauri::plugin::{Builder, TauriPlugin};
use tauri::{http, AppHandle, Manager, Runtime, UriSchemeContext, UriSchemeResponder};
use tauri_plugin_fs::{FilePath, Fs, OpenOptions};
use uuid::Uuid;

use crate::device_manager::{Device, DeviceManager};
use ares_connection_lib::transfer::FileTransfer;

use crate::error::Error;
use crate::remote_files::serve;
use crate::remote_files::{FileItem, PermInfo};
use crate::session_manager::SessionManager;

#[derive(Copy, Clone, Serialize)]
pub(crate) struct CopyProgress {
    copied: usize,
    total: usize,
}

#[tauri::command]
async fn ls<R: Runtime>(
    app: AppHandle<R>,
    device: Device,
    path: String,
) -> Result<Vec<FileItem>, Error> {
    if !path.starts_with("/") {
        return Err(Error::new("Absolute path required"));
    }
    log::info!("ls {}", path);
    tauri::async_runtime::spawn_blocking(move || {
        let sessions = app.state::<SessionManager>();
        return sessions.with_session(device, |session| {
            let sftp = session.sftp()?;
            let entries = sftp.read_dir(&path)?;
            let user = session.user.as_ref();
            return Ok(entries
                .iter()
                .filter(|entry| entry.name() != Some(".") && entry.name() != Some(".."))
                .map(|entry| FileItem::new(entry, None, user.map(|u| PermInfo::from(entry, &u))))
                .collect());
        });
    })
    .await
    .expect("critical failure in file::ls task")
}

#[tauri::command]
async fn read<R: Runtime>(
    app: AppHandle<R>,
    device: Device,
    path: String,
    encoding: Option<String>,
) -> Result<Vec<u8>, Error> {
    tauri::async_runtime::spawn_blocking(move || {
        let sessions = app.state::<SessionManager>();
        return sessions.with_session(device, |session| {
            let mut raw = Vec::<u8>::new();
            session.get(&path, &mut raw, |_| {})?;
            if let Some(encoding) = &encoding {
                if encoding != "gzip" {
                    return Err(Error::new(format!("Unsupported encoding {}", encoding)));
                }
                let mut buf = Vec::<u8>::new();
                GzDecoder::new(&raw[..]).read_to_end(&mut buf)?;
                return Ok(buf);
            }
            return Ok(raw);
        });
    })
    .await
    .expect("critical failure in file::read task")
}

#[tauri::command]
async fn write<R: Runtime>(
    app: AppHandle<R>,
    device: Device,
    path: String,
    content: Vec<u8>,
) -> Result<(), Error> {
    tauri::async_runtime::spawn_blocking(move || {
        let sessions = app.state::<SessionManager>();
        return Ok(sessions.with_session(device, |session| {
            session.put(&mut content.as_slice(), &path, |_| {})?;
            return Ok(());
        })?);
    })
    .await
    .expect("critical failure in file::write task")
}

#[tauri::command]
async fn get<R: Runtime>(
    app: AppHandle<R>,
    device: Device,
    path: String,
    target: FilePath,
    on_progress: Channel<CopyProgress>,
) -> Result<(), Error> {
    tauri::async_runtime::spawn_blocking(move || {
        let sessions = app.state::<SessionManager>();
        let fs = app.state::<Fs<R>>();
        let on_progress = on_progress.clone();
        return sessions.with_session(device, move |session| {
            let mut opt = OpenOptions::new();
            opt.create(true).write(true);
            let mut file = fs.open(target.clone(), opt)?;
            // Only SFTP can tell us the size up front. Without it the progress
            // events carry a total of 0, which the frontend already tolerates.
            let total = session
                .maybe_sftp()
                .and_then(|sftp| sftp.open(&path, OpenFlags::READ_ONLY, 0)?.metadata())
                .ok()
                .and_then(|meta| meta.len())
                .unwrap_or_default() as usize;
            // The shared FileTransfer streams the file over an exec channel when
            // the device has no SFTP.
            session.get(&path, &mut file, |copied| {
                let _ = on_progress.send(CopyProgress { copied, total });
            })?;
            return Ok(());
        });
    })
    .await
    .expect("critical failure in file::get task")
}

#[tauri::command]
async fn put<R: Runtime>(
    app: AppHandle<R>,
    device: Device,
    path: String,
    source: FilePath,
    on_progress: Channel<CopyProgress>,
) -> Result<(), Error> {
    tauri::async_runtime::spawn_blocking(move || {
        let sessions = app.state::<SessionManager>();
        let fs = app.state::<Fs<R>>();
        let on_progress = on_progress.clone();
        return sessions.with_session(device, move |session| {
            let mut opt = OpenOptions::new();
            opt.read(true).write(false);
            let mut file = fs.open(source.clone(), opt).map_err(|e| Error::IO {
                code: e.kind(),
                message: format!("Failed to open local file {source} for uploading: {e:?}"),
                unhandled: true,
            })?;
            let total = file.metadata().unwrap().len() as usize;
            // The shared FileTransfer streams the file over an exec channel when
            // the device has no SFTP.
            session.put(&mut file, &path, |copied| {
                let _ = on_progress.send(CopyProgress { copied, total });
            })?;
            return Ok(());
        });
    })
    .await
    .expect("critical failure in file::put task")
}

pub(crate) fn copy<R, W>(
    reader: &mut R,
    writer: &mut W,
    total: usize,
    progress: &Channel<CopyProgress>,
) -> std::io::Result<usize>
where
    R: Read,
    W: Write,
{
    let mut buf = [0; 8192];
    let mut copied: usize = 0;
    loop {
        let bytes = reader.read(&mut buf)?;
        if bytes == 0 {
            break;
        }
        writer.write_all(&buf[..bytes])?;
        copied += bytes;
        progress.send(CopyProgress { copied, total }).map_err(|e| {
            return match e {
                tauri::Error::Io(e) => e,
                e => std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to send progress: {e}"),
                ),
            };
        })?;
    }
    Ok(copied)
}

#[tauri::command]
async fn get_temp<R: Runtime>(
    app: AppHandle<R>,
    device: Device,
    path: String,
    on_progress: Channel<CopyProgress>,
) -> Result<FilePath, Error> {
    let source = Path::new(&path);
    let extension = source
        .extension()
        .map_or(String::new(), |s| format!(".{}", s.to_string_lossy()));
    let temp_path = temp_dir().join(format!("webos-dev-tmp-{}{}", Uuid::new_v4(), extension));
    let target = FilePath::from(&temp_path);
    get(app, device, path, target.clone(), on_progress).await?;
    Ok(target)
}

#[tauri::command]
async fn serve<R: Runtime>(
    app: AppHandle<R>,
    device: Device,
    path: FilePath,
) -> Result<String, Error> {
    serve::exec(app, device, path).await
}

pub fn plugin<R: Runtime>(name: &'static str) -> TauriPlugin<R> {
    Builder::new(name)
        .invoke_handler(tauri::generate_handler![
            ls, read, write, get, put, get_temp, serve
        ])
        .build()
}

pub const URI_SCHEME: &str = "remote-file";

fn content_type_for_path(path: &str) -> &'static str {
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase());
    match ext.as_deref() {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("bmp") => "image/bmp",
        Some("svg") => "image/svg+xml",
        Some("ico") => "image/x-icon",
        _ => "application/octet-stream",
    }
}

pub fn protocol<R: Runtime>(
    ctx: UriSchemeContext<'_, R>,
    req: http::Request<Vec<u8>>,
    resp: UriSchemeResponder,
) {
    let app = ctx.app_handle().clone();
    let uri = req.uri();
    let Some((device_name, path)) = (match cfg!(any(target_os = "windows", target_os = "android")) {
        true => uri.path()[1..]
            .split_once('/')
            .map(|(device, path)| (device.to_string(), format!("/{path}"))),
        _ => uri
            .host()
            .map(|host| (host.to_string(), uri.path().to_string())),
    }) else {
        resp.respond(http::Response::builder().status(404).body(vec![]).unwrap());
        return;
    };
    tauri::async_runtime::spawn(async move {
        let devices = app.state::<DeviceManager>();
        let Some(device) = devices.find(&device_name).await.ok().flatten() else {
            resp.respond(
                http::Response::builder()
                    .status(404)
                    .body(format!("Device {device_name} not found!").into_bytes())
                    .unwrap(),
            );
            return;
        };
        let app = app.clone();
        let content_type = content_type_for_path(&path);
        match tauri::async_runtime::spawn_blocking(move || {
            let sessions = app.state::<SessionManager>();
            return sessions.with_session(device, |session| {
                let mut buf = Vec::<u8>::new();
                session.get(&path, &mut buf, |_| {})?;
                return Ok(buf);
            });
        })
        .await
        {
            Ok(Ok(data)) => {
                resp.respond(
                    http::Response::builder()
                        .status(200)
                        .header(http::header::CONTENT_TYPE, content_type)
                        .body(data)
                        .unwrap(),
                );
                return;
            }
            Ok(Err(e)) => {
                resp.respond(
                    http::Response::builder()
                        .status(500)
                        .body(format!("{e}").into_bytes())
                        .unwrap(),
                );
                return;
            }
            Err(e) => {
                resp.respond(
                    http::Response::builder()
                        .status(500)
                        .body(format!("Internal error: {e:?}").into_bytes())
                        .unwrap(),
                );
                return;
            }
        }
    });
}
