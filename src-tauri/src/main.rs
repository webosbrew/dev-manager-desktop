#![cfg_attr(
all(not(debug_assertions), target_os = "windows"),
windows_subsystem = "windows"
)]

use device_manager::manager::DeviceManager;

mod device_manager;
mod remote_command;

fn main() {
  env_logger::init();
  tauri::Builder::default()
    .plugin(device_manager::plugin())
    .plugin(remote_command::plugin())
    .manage(DeviceManager::default())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
