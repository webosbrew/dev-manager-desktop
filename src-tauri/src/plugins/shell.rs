use tauri::{AppHandle, Runtime, State};
use tauri::plugin::{Builder, TauriPlugin};

use crate::device_manager::Device;
use crate::session_manager::{SessionManager, ShellSessionToken};

#[tauri::command]
async fn open<R: Runtime>(app: AppHandle<R>, state: State<'_, SessionManager>, device: Device)
                          -> Result<ShellSessionToken, String> {
  return state.shell_open(&device, app).await.map_err(|e| format!("{:?}", e));
}

#[tauri::command]
async fn close<R: Runtime>(app: AppHandle<R>, state: State<'_, SessionManager>,
                           token: ShellSessionToken) -> Result<(), String> {
  return state.shell_close(&token, app).await.map_err(|e| format!("{:?}", e));
}

#[tauri::command]
async fn list(state: State<'_, SessionManager>) -> Result<Vec<ShellSessionToken>, String> {
  return Ok(state.shells_list());
}

pub fn plugin<R: Runtime>(name: &'static str) -> TauriPlugin<R> {
  Builder::new(name)
    .invoke_handler(tauri::generate_handler![open, close, list])
    .build()
}
