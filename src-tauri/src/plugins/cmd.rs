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

/// Initializes the plugin.
pub fn plugin<R: Runtime>(name: &'static str) -> TauriPlugin<R> {
  Builder::new(name)
    .invoke_handler(tauri::generate_handler![exec])
    .build()
}

pub(crate) fn escape_path(path: &String) -> String {
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
