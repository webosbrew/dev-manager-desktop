use std::env::temp_dir;
use std::path::Path;

use serde::{Deserialize, Serialize};
use tauri::plugin::{Builder, TauriPlugin};
use tauri::{AppHandle, Runtime, State};
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use uuid::Uuid;

use crate::device_manager::Device;
use crate::error::Error;
use crate::remote_files::ls;
use crate::remote_files::path::escape_path;
use crate::remote_files::serve;
use crate::remote_files::FileItem;
use crate::session_manager::SessionManager;
use crate::spawn_manager::SpawnManager;

#[tauri::command]
async fn ls(
    manager: State<'_, SessionManager>,
    device: Device,
    path: String,
) -> Result<Vec<FileItem>, Error> {
    if !path.starts_with("/") {
        return Err(Error::new("Absolute path required"));
    }
    log::info!("ls {}", path);
    return ls::exec(&manager, &device, &path).await;
}

#[tauri::command]
async fn read(
    manager: State<'_, SessionManager>,
    device: Device,
    path: String,
) -> Result<Vec<u8>, Error> {
    return manager
        .exec(device, &format!("cat {}", escape_path(&path)), None)
        .await;
}

#[tauri::command]
async fn write(
    manager: State<'_, SessionManager>,
    device: Device,
    path: String,
    content: Vec<u8>,
) -> Result<(), Error> {
    manager
        .exec(
            device,
            &format!("dd of={}", escape_path(&path)),
            Some(content.as_slice()),
        )
        .await?;
    return Ok(());
}

#[tauri::command]
async fn get(
    manager: State<'_, SessionManager>,
    device: Device,
    path: String,
    target: String,
) -> Result<(), Error> {
    let buf = manager
        .exec(device, &format!("cat {}", escape_path(&path)), None)
        .await?;
    let mut file = fs::File::create(&target).await?;
    file.write_all(&buf).await?;
    return Ok(());
}

#[tauri::command]
async fn put(
    manager: State<'_, SessionManager>,
    device: Device,
    path: String,
    source: String,
) -> Result<(), Error> {
    let mut file = fs::File::open(&source).await?;
    let mut buf = Vec::<u8>::new();
    file.read_to_end(&mut buf).await?;
    manager
        .exec(
            device,
            &format!("dd of={}", escape_path(&path)),
            Some(buf.as_slice()),
        )
        .await?;
    return Ok(());
}

#[tauri::command]
async fn get_temp(
    manager: State<'_, SessionManager>,
    device: Device,
    path: String,
) -> Result<String, Error> {
    let source = Path::new(&path);
    let extension = source
        .extension()
        .map_or(String::new(), |s| format!(".{}", s.to_string_lossy()));
    let target = temp_dir().join(format!("webos-dev-tmp-{}{}", Uuid::new_v4(), extension));
    let buf = manager
        .exec(device, &format!("cat {}", escape_path(&path)), None)
        .await?;
    log::info!("Downloading {:?} to {:?}", &source, &target);
    let mut file = fs::File::create(target.clone()).await?;
    file.write_all(&buf).await?;
    return Ok(String::from(target.to_str().unwrap()));
}

#[tauri::command]
async fn serve<R: Runtime>(
    app: AppHandle<R>,
    sessions: State<'_, SessionManager>,
    spawns: State<'_, SpawnManager>,
    device: Device,
    path: String,
) -> Result<String, Error> {
    return serve::exec(app, &sessions, &spawns, device, path).await;
}

pub fn plugin<R: Runtime>(name: &'static str) -> TauriPlugin<R> {
    Builder::new(name)
        .invoke_handler(tauri::generate_handler![
            ls, read, write, get, put, get_temp, serve
        ])
        .build()
}
