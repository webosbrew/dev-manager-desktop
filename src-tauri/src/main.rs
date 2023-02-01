#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

extern crate core;

use crate::device_manager::DeviceManager;
use crate::session_manager::SessionManager;

mod device_manager;
mod plugins;
mod session_manager;

fn main() {
    env_logger::init();
    tauri::Builder::default()
        .plugin(plugins::device::plugin("device-manager"))
        .plugin(plugins::cmd::plugin("remote-command"))
        .plugin(plugins::shell::plugin("remote-shell"))
        .plugin(plugins::file::plugin("remote-file"))
        .plugin(plugins::file::plugin("dev-mode"))
        .manage(DeviceManager::default())
        .manage(SessionManager::default())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
