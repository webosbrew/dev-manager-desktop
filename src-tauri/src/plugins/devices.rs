use tauri::{plugin::{Builder, TauriPlugin}, Runtime};
use tauri::State;

use crate::device_manager::{Device, DeviceManager};

#[tauri::command]
async fn list(state: State<'_, DeviceManager>) -> Result<Vec<Device>, String> {
  return state.list().await;
}

/// Initializes the plugin.
pub fn plugin<R: Runtime>(name: &'static str) -> TauriPlugin<R> {
  Builder::new(name)
    .invoke_handler(tauri::generate_handler![list])
    .build()
}
