use std::env::temp_dir;
use std::path::Path;

use tauri::{plugin::{Builder, TauriPlugin}, Runtime, State};
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use uuid::Uuid;

use crate::device_manager::Device;
use crate::session_manager::{Error, SessionManager};

#[tauri::command]
async fn exec(manager: State<'_, SessionManager>, device: Device, command: String,
              stdin: Option<Vec<u8>>) -> Result<Vec<u8>, Error> {
  return manager.exec(device, &command, stdin).await;
}

#[tauri::command]
async fn read(manager: State<'_, SessionManager>, device: Device, path: String) -> Result<Vec<u8>, Error> {
  return manager.exec(device, &format!("cat {}", escape_path(&path)), None).await;
}

#[tauri::command]
async fn write(manager: State<'_, SessionManager>, device: Device, path: String, content: Vec<u8>) -> Result<(), Error> {
  manager.exec(device, &format!("dd of={}", escape_path(&path)), Some(content)).await?;
  return Ok(());
}

#[tauri::command]
async fn get(manager: State<'_, SessionManager>, device: Device, path: String, target: String) -> Result<(), Error> {
  let buf = manager.exec(device, &format!("cat {}", escape_path(&path)), None).await?;
  let mut file = fs::File::create(&target).await?;
  file.write_all(&buf).await?;
  return Ok(());
}

#[tauri::command]
async fn put(manager: State<'_, SessionManager>, device: Device, path: String, source: String) -> Result<(), Error> {
  let mut file = fs::File::open(&source).await?;
  let mut buf = Vec::<u8>::new();
  file.read_to_end(&mut buf).await?;
  manager.exec(device, &format!("dd of={}", escape_path(&path)), Some(buf)).await?;
  return Ok(());
}

#[tauri::command]
async fn get_temp(manager: State<'_, SessionManager>, device: Device, path: String) -> Result<String, Error> {
  let source = Path::new(&path);
  let extension = source.extension().map_or(String::new(), |s| format!(".{}", s.to_string_lossy()));
  let target = temp_dir().join(format!("webos-dev-tmp-{}{}", Uuid::new_v4(), extension));
  let buf = manager.exec(device, &format!("cat {}", escape_path(&path)), None).await?;
  log::info!("Downloading {:?} to {:?}", &source, &target);
  let mut file = fs::File::create(target.clone()).await?;
  file.write_all(&buf).await?;
  return Ok(String::from(target.to_str().unwrap()));
}

/// Initializes the plugin.
pub fn plugin<R: Runtime>(name: &'static str) -> TauriPlugin<R> {
  Builder::new(name)
    .invoke_handler(tauri::generate_handler![exec, read, write, get, put, get_temp])
    .build()
}

fn escape_path(path: &String) -> String {
  let mut escaped = String::new();
  let mut first = true;
  for seg in path.split('\'') {
    if first {
      first = false;
    } else {
      escaped.push_str("\\\'");
    }
    escaped.push('\'');
    escaped.push_str(seg);
    escaped.push('\'');
  }
  return escaped;
}

#[cfg(test)]
mod tests {
  use crate::plugins::cmd::escape_path;

  #[test]
  fn test_escape_path() {
    assert_eq!(escape_path(&String::from("/")), String::from("'/'"));
    assert_eq!(escape_path(&String::from("/dev/null")), String::from("'/dev/null'"));
    assert_eq!(escape_path(&String::from("/path/with/single'quote")), String::from("'/path/with/single'\\''quote'"));
  }
}
