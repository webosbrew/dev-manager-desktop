use std::env::temp_dir;
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;

use tauri::plugin::{Builder, TauriPlugin};
use tauri::{AppHandle, Manager, Runtime};
use uuid::Uuid;

use crate::device_manager::Device;
use crate::error::Error;
use crate::remote_files::serve;
use crate::remote_files::FileItem;
use crate::session_manager::SessionManager;

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
    return tokio::task::spawn_blocking(move || {
        let sessions = app.state::<SessionManager>();
        let pool = sessions.pool(device);
        let session = pool.get()?;
        let sftp = session.sftp()?;
        let entries = sftp.readdir(Path::new(&path))?;
        return Ok(entries.iter().map(|entry| entry.into()).collect());
    })
    .await
    .unwrap();
}

#[tauri::command]
async fn read<R: Runtime>(
    app: AppHandle<R>,
    device: Device,
    path: String,
) -> Result<Vec<u8>, Error> {
    return tokio::task::spawn_blocking(move || {
        let sessions = app.state::<SessionManager>();
        let pool = sessions.pool(device);
        let session = pool.get()?;
        let (mut ch, _) = session.scp_recv(Path::new(&path))?;
        let mut buf = Vec::<u8>::new();
        ch.read_to_end(&mut buf)?;
        return Ok(buf);
    })
    .await
    .unwrap();
}

#[tauri::command]
async fn write<R: Runtime>(
    app: AppHandle<R>,
    device: Device,
    path: String,
    content: Vec<u8>,
) -> Result<(), Error> {
    return tokio::task::spawn_blocking(move || {
        let sessions = app.state::<SessionManager>();
        let pool = sessions.pool(device);
        let session = pool.get()?;
        let mut ch = session.scp_send(Path::new(&path), 0o644, content.len() as u64, None)?;
        ch.write_all(&content)?;
        return Ok(());
    })
    .await
    .unwrap();
}

#[tauri::command]
async fn get<R: Runtime>(
    app: AppHandle<R>,
    device: Device,
    path: String,
    target: String,
) -> Result<(), Error> {
    return tokio::task::spawn_blocking(move || {
        let sessions = app.state::<SessionManager>();
        let pool = sessions.pool(device);
        let session = pool.get()?;
        let (mut ch, _) = session.scp_recv(Path::new(&path))?;
        let mut file = File::create(target)?;
        let mut buf = [0; 8192];
        loop {
            let u = ch.read(&mut buf)?;
            if u == 0 {
                break;
            }
            file.write_all(&buf[u..])?;
        }
        return Ok(());
    })
    .await
    .unwrap();
}

#[tauri::command]
async fn put<R: Runtime>(
    app: AppHandle<R>,
    device: Device,
    path: String,
    source: String,
) -> Result<(), Error> {
    return tokio::task::spawn_blocking(move || {
        let sessions = app.state::<SessionManager>();
        let pool = sessions.pool(device);
        let session = pool.get()?;
        let mut file = File::open(source)?;
        let mut ch = session.scp_send(Path::new(&path), 0o644, file.metadata()?.len(), None)?;
        let mut buf = [0; 8192];
        loop {
            let u = file.read(&mut buf)?;
            if u == 0 {
                break;
            }
            ch.write_all(&buf[u..])?;
        }
        return Ok(());
    })
    .await
    .unwrap();
}

#[tauri::command]
async fn get_temp<R: Runtime>(
    app: AppHandle<R>,
    device: Device,
    path: String,
) -> Result<String, Error> {
    let source = Path::new(&path);
    let extension = source
        .extension()
        .map_or(String::new(), |s| format!(".{}", s.to_string_lossy()));
    let target = String::from(
        temp_dir()
            .join(format!("webos-dev-tmp-{}{}", Uuid::new_v4(), extension))
            .to_str()
            .unwrap(),
    );
    get(app, device, path, target.clone()).await?;
    return Ok(target);
}

#[tauri::command]
async fn serve<R: Runtime>(
    app: AppHandle<R>,
    device: Device,
    path: String,
) -> Result<String, Error> {
    return serve::exec(app, device, path).await;
}

pub fn plugin<R: Runtime>(name: &'static str) -> TauriPlugin<R> {
    Builder::new(name)
        .invoke_handler(tauri::generate_handler![
            ls, read, write, get, put, get_temp, serve
        ])
        .build()
}
