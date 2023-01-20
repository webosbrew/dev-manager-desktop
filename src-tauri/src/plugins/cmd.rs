use std::fmt::format;
use std::io::prelude::*;
use std::path::Path;

use tauri::{plugin::{Builder, TauriPlugin}, Runtime, State};

use crate::device_manager::Device;
use crate::session_manager::{Error, SessionManager};

#[tauri::command]
async fn exec(manager: State<'_, SessionManager>, device: Device, command: String,
              stdin: Option<&[u8]>) -> Result<Vec<u8>, Error> {
  return manager.exec(device, &command).await;
}

#[tauri::command]
async fn read(manager: State<'_, SessionManager>, device: Device, path: String) -> Result<Vec<u8>, Error> {
  return manager.exec(device, &format!("cat {}", path)).await;
}

/// Initializes the plugin.
pub fn plugin<R: Runtime>(name: &'static str) -> TauriPlugin<R> {
  Builder::new(name)
    .invoke_handler(tauri::generate_handler![exec, read])
    .build()
}
