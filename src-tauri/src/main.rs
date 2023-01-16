#![cfg_attr(
all(not(debug_assertions), target_os = "windows"),
windows_subsystem = "windows"
)]

use tauri::Manager;
use tauri::async_runtime;
use device_manager::manager::DeviceManager;
use crate::session_manager::SessionManager;

mod device_manager;
mod session_manager;
mod remote_command;
mod shell_events;

fn main() {
  env_logger::init();
  tauri::Builder::default()
    .plugin(device_manager::plugin())
    .plugin(remote_command::plugin())
    .manage(DeviceManager::default())
    .manage(SessionManager::default())
    .setup(|app| {
      let handle = app.app_handle();
      app.listen_global("shell-tx", move |event| {
        let handle = handle.clone();
        async_runtime::spawn(async move { shell_events::on_tx_event(handle.clone(), event).await });
      });
      return Ok(());
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
