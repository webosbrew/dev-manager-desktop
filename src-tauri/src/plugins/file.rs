use std::env::temp_dir;
use std::path::Path;

use serde::{Deserialize, Serialize};
use tauri::plugin::{Builder, TauriPlugin};
use tauri::{Runtime, State};
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use uuid::Uuid;

use crate::device_manager::Device;
use crate::error::Error;
use crate::plugins::cmd::escape_path;
use crate::session_manager::SessionManager;

use file_mode::Mode;

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
    let output = manager
        .exec(
            device.clone(),
            &format!("python - {}", escape_path(&path)),
            Some(include_bytes!("../../res/scripts/files_ls.py")),
        )
        .await?;
    let entries = serde_json::from_slice::<Vec<FileEntry>>(&output)?;
    return Ok(entries.iter().map(|e| e.into()).collect());
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

pub fn plugin<R: Runtime>(name: &'static str) -> TauriPlugin<R> {
    Builder::new(name)
        .invoke_handler(tauri::generate_handler![
            ls, read, write, get, put, get_temp
        ])
        .build()
}

#[derive(Serialize, Clone, Debug)]
pub struct FileItem {
    filename: String,
    r#type: String,
    mode: String,
    user: String,
    group: String,
    size: usize,
    mtime: f64,
    abspath: String,
    link: Option<LinkInfo>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LinkInfo {
    target: String,
    broken: Option<bool>,
}

#[derive(Deserialize, Clone, Debug)]
pub(crate) struct FileEntry {
    name: String,
    stat: FileStat,
    abspath: String,
    link: Option<LinkInfo>,
}

#[derive(Deserialize, Clone, Debug)]
pub(crate) struct FileStat {
    mode: u32,
    uid: u32,
    gid: u32,
    size: u32,
    atime: f64,
    ctime: f64,
    mtime: f64,
}

impl From<&FileEntry> for FileItem {
    fn from(value: &FileEntry) -> FileItem {
        let mode = format!("{}", Mode::from(value.stat.mode));
        return FileItem {
            filename: value.name.clone(),
            r#type: String::from(&mode[..1]),
            mode: String::from(&mode[1..]),
            user: format!("{}", value.stat.uid),
            group: format!("{}", value.stat.gid),
            size: value.stat.size as usize,
            mtime: value.stat.mtime,
            abspath: value.abspath.clone(),
            link: value.link.clone(),
        };
    }
}
