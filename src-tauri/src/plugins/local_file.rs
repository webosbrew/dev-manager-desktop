use std::env::temp_dir;

use tauri::ipc::Channel;
use tauri::plugin::{Builder, TauriPlugin};
use tauri::{AppHandle, Manager, Runtime, State};
use tauri_plugin_fs::{FilePath, Fs, OpenOptions};
use tokio::fs::File;
use tokio::io::AsyncReadExt;
use uuid::Uuid;

use crate::error::Error;
use crate::plugins::file;
use crate::plugins::file::CopyProgress;

#[tauri::command]
async fn checksum(path: String, algorithm: String) -> Result<String, Error> {
    let mut file = File::open(&path).await?;
    let mut contents: Vec<u8> = vec![];
    file.read_to_end(&mut contents).await?;
    match algorithm.as_str() {
        "sha256" => Ok(sha256::digest(&contents[..])),
        _ => Err(Error::Unsupported),
    }
}

#[tauri::command]
async fn remove(path: String, recursive: bool) -> Result<(), Error> {
    if recursive {
        tokio::fs::remove_dir_all(&path).await?;
    } else {
        tokio::fs::remove_file(&path).await?;
    }
    Ok(())
}

#[tauri::command]
async fn temp_path(extension: String) -> Result<String, Error> {
    let temp_path = temp_dir().join(format!("webos-dev-tmp-{}{}", Uuid::new_v4(), extension));
    temp_path
        .to_str()
        .map(|s| String::from(s))
        .ok_or_else(|| Error::new(&format!("Bad temp_path {:?}", temp_path)))
}

#[tauri::command]
fn copy<R: Runtime>(
    app: AppHandle<R>,
    source: FilePath,
    target: FilePath,
    on_progress: Channel<CopyProgress>,
) -> Result<(), Error> {
    let fs: State<Fs<R>> = app.state();
    let mut read_options = OpenOptions::new();
    read_options.read(true);
    let mut src_file = fs.open(source, read_options)?;
    let src_len = src_file.metadata()?.len() as usize;
    let mut write_options = OpenOptions::new();
    write_options.write(true).create(true);
    let mut dest_file = fs.open(target, write_options)?;
    file::copy(&mut src_file, &mut dest_file, src_len, &on_progress)?;
    Ok(())
}

pub fn plugin<R: Runtime>(name: &'static str) -> TauriPlugin<R> {
    Builder::new(name)
        .invoke_handler(tauri::generate_handler![checksum, remove, copy, temp_path])
        .build()
}
