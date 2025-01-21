use std::env::temp_dir;
use std::fmt::format;
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;

use flate2::read::GzDecoder;
use libssh_rs::OpenFlags;
use serde::Serialize;
use tauri::ipc::Channel;
use tauri::plugin::{Builder, TauriPlugin};
use tauri::{http, AppHandle, Manager, Runtime, UriSchemeContext, UriSchemeResponder};
use uuid::Uuid;

use crate::device_manager::{Device, DeviceManager};
use crate::error::Error;
use crate::remote_files::serve;
use crate::remote_files::{FileItem, PermInfo};
use crate::session_manager::SessionManager;

#[derive(Copy, Clone, Serialize)]
struct CopyProgress {
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
            let sftp = session.sftp()?;
            let mut file = sftp.open(&path, OpenFlags::READ_ONLY, 0)?;
            let mut buf = Vec::<u8>::new();
            if let Some(encoding) = &encoding {
                if encoding == "gzip" {
                    let mut decoder = GzDecoder::new(&mut file);
                    decoder.read_to_end(&mut buf)?;
                } else {
                    return Err(Error::new(format!("Unsupported encoding {}", encoding)));
                }
            } else {
                file.read_to_end(&mut buf)?;
            }
            return Ok(buf);
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
            let sftp = session.sftp()?;
            let mut file = sftp.open(
                &path,
                OpenFlags::WRITE_ONLY | OpenFlags::CREATE | OpenFlags::TRUNCATE,
                0o644,
            )?;
            file.write_all(&content)?;
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
    target: String,
    on_progress: Channel<CopyProgress>,
) -> Result<(), Error> {
    tauri::async_runtime::spawn_blocking(move || {
        let sessions = app.state::<SessionManager>();
        let on_progress = on_progress.clone();
        return sessions.with_session(device, move |session| {
            let sftp = session.sftp()?;
            let mut sfile = sftp.open(&path, OpenFlags::READ_ONLY, 0)?;
            let mut file = File::create(target.clone())?;
            let size = sfile.metadata()?.len().unwrap_or_default() as usize;
            copy(&mut sfile, &mut file, size, &on_progress)?;
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
    source: String,
    on_progress: Channel<CopyProgress>,
) -> Result<(), Error> {
    tauri::async_runtime::spawn_blocking(move || {
        let sessions = app.state::<SessionManager>();
        let on_progress = on_progress.clone();
        return sessions.with_session(device, move |session| {
            let sftp = session.sftp()?;
            let mut sfile = sftp
                .open(
                    &path,
                    OpenFlags::WRITE_ONLY | OpenFlags::CREATE | OpenFlags::TRUNCATE,
                    0o644,
                )
                .map_err(|e| {
                    let e: Error = e.into();
                    return match e {
                        Error::IO {
                            code,
                            message,
                            unhandled,
                        } => Error::IO {
                            code,
                            message: format!(
                                "Failed to open remote file {path} for writing: {message}"
                            ),
                            unhandled,
                        },
                        e => e,
                    };
                })?;
            let mut file = File::open(source.clone()).map_err(|e| Error::IO {
                code: e.kind(),
                message: format!("Failed to open local file {source} for uploading: {e:?}"),
                unhandled: true,
            })?;
            let size = file.metadata().unwrap().len() as usize;
            copy(&mut file, &mut sfile, size, &on_progress)?;
            return Ok(());
        });
    })
    .await
    .expect("critical failure in file::put task")
}

fn copy<R: ?Sized, W: ?Sized>(
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
) -> Result<String, Error> {
    let source = Path::new(&path);
    let extension = source
        .extension()
        .map_or(String::new(), |s| format!(".{}", s.to_string_lossy()));
    let temp_path = temp_dir().join(format!("webos-dev-tmp-{}{}", Uuid::new_v4(), extension));
    let target = String::from(
        temp_path
            .to_str()
            .expect(&format!("Bad temp_path {:?}", temp_path)),
    );
    get(app, device, path, target.clone(), on_progress).await?;
    Ok(target)
}

#[tauri::command]
async fn serve<R: Runtime>(
    app: AppHandle<R>,
    device: Device,
    path: String,
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

pub fn protocol<R: Runtime>(
    ctx: UriSchemeContext<'_, R>,
    req: http::Request<Vec<u8>>,
    resp: UriSchemeResponder,
) {
    let app = ctx.app_handle().clone();
    let Some((device_name, path)) = req.uri().path()[1..].split_once('/') else {
        resp.respond(http::Response::builder().status(404).body(vec![]).unwrap());
        return;
    };
    let device_name = device_name.to_string();
    let path = format!("/{path}");
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
        match tauri::async_runtime::spawn_blocking(move || {
            let sessions = app.state::<SessionManager>();
            return sessions.with_session(device, |session| {
                let sftp = session.sftp()?;
                let mut file = sftp.open(&path, OpenFlags::READ_ONLY, 0)?;
                let mut buf = Vec::<u8>::new();
                file.read_to_end(&mut buf)?;
                return Ok(buf);
            });
        })
        .await
        {
            Ok(Ok(data)) => {
                resp.respond(http::Response::builder().status(200).body(data).unwrap());
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
