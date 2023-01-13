#![cfg_attr(
all(not(debug_assertions), target_os = "windows"),
windows_subsystem = "windows"
)]

mod device_manager;
mod remote_command;

use std::thread;
use device_manager::manager::DeviceManager;

fn main() {
  println!("thread id for main: {:?}", thread::current().id());
  tauri::Builder::default()
    .plugin(device_manager::plugin())
    .plugin(remote_command::plugin())
    .manage(DeviceManager::default())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
