#![cfg_attr(
all(not(debug_assertions), target_os = "windows"),
windows_subsystem = "windows"
)]

use tauri::async_runtime;
use tauri::Manager;

use crate::device_manager::DeviceManager;
use crate::session_manager::SessionManager;

mod session_manager;
mod device_manager;
mod shell_events;
mod plugins;

fn main() {
  env_logger::init();
  tauri::Builder::default()
    .plugin(plugins::devices::plugin("device-manager"))
    .plugin(plugins::cmd::plugin("remote-command"))
    .plugin(plugins::shell::plugin("remote-shell"))
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
