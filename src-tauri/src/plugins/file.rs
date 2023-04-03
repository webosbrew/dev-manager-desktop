use std::env::temp_dir;
use std::fs::File;
use std::io::{copy, BufWriter, Read, Write};
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
        let session = sessions.session(device)?;
        let sftp = session.sftp()?;
        let entries = sftp.read_dir(&path)?;
        session.mark_last_ok();
        return Ok(entries
            .iter()
            .filter(|entry| entry.name() != Some(".") && entry.name() != Some(".."))
            .map(|entry| entry.into())
            .collect());
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
        let session = sessions.session(device)?;
        let sftp = session.sftp()?;
        let mut file = sftp.open(&path, 0 /*O_RDONLY*/, 0)?;
        let mut buf = Vec::<u8>::new();
        file.read_to_end(&mut buf)?;
        session.mark_last_ok();
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
        let session = sessions.session(device)?;
        let sftp = session.sftp()?;
        let mut file = sftp.open(&path, 1 /*O_WRONLY*/, 0o644)?;
        file.write_all(&content)?;
        session.mark_last_ok();
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
        let session = sessions.session(device)?;
        let sftp = session.sftp()?;
        let mut sfile = sftp.open(&path, 0, 0)?;
        let meta = sfile.metadata()?;
        let mut file = File::create(target)?;
        copy(&mut sfile, &mut file)?;
        log::info!(
            "remote file {:?} has size {:?}, {} written",
            meta.name(),
            meta.len(),
            file.metadata()?.len()
        );
        session.mark_last_ok();
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
        let session = sessions.session(device)?;
        let sftp = session.sftp()?;
        let mut file = File::open(source)?;
        let mut sfile = sftp.open(&path, 1, 0o644)?;
        copy(&mut file, &mut sfile)?;
        session.mark_last_ok();
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
