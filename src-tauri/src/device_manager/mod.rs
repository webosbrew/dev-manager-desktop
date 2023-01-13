use tauri::{plugin::{Builder, TauriPlugin}, Runtime};
use tauri::State;

use crate::device_manager::manager::{Device, DeviceManager};

pub(crate) mod manager;

#[tauri::command]
pub async fn list(state: State<'_, DeviceManager>) -> Result<Vec<Device>, String> {
  return state.list().await;
}

/// Initializes the plugin.
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("device-manager")
    .invoke_handler(tauri::generate_handler![list])
    .build()
}
