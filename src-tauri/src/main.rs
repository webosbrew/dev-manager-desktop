#![cfg_attr(
all(not(debug_assertions), target_os = "windows"),
windows_subsystem = "windows"
)]

extern crate core;

use tauri::Manager;
use crate::device_manager::DeviceManager;
use crate::session_manager::SessionManager;

mod session_manager;
mod device_manager;
mod plugins;

fn main() {
  env_logger::init();
  tauri::Builder::default()
    .plugin(plugins::devices::plugin("device-manager"))
    .plugin(plugins::cmd::plugin("remote-command"))
    .plugin(plugins::shell::plugin("remote-shell"))
    .manage(DeviceManager::default())
    .manage(SessionManager::default())
    .setup(|a| {
      a.get_window("main").unwrap().open_devtools();
      return Ok(());
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
