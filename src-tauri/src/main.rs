#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

extern crate core;

use crate::device_manager::DeviceManager;
use crate::session_manager::SessionManager;
use dialog::DialogBox;
use tauri::Manager;

mod device_manager;
mod error;
mod plugins;
mod remote_files;
mod session_manager;
mod event_channel;

fn main() {
    env_logger::init();
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            if let Some(wnd) = app.get_window("main") {
                wnd.unminimize().unwrap_or(());
                wnd.set_focus().unwrap_or(());
            }
        }))
        .plugin(plugins::device::plugin("device-manager"))
        .plugin(plugins::cmd::plugin("remote-command"))
        .plugin(plugins::shell::plugin("remote-shell"))
        .plugin(plugins::file::plugin("remote-file"))
        .plugin(plugins::devmode::plugin("dev-mode"))
        .manage(DeviceManager::default())
        .manage(SessionManager::default())
        .run(tauri::generate_context!());
    if let Err(e) = result {
        dialog::Message::new("Unexpected error occurred")
            .title("webOS Dev Manager")
            .show()
            .expect("Unexpected error occurred while processing unexpected error :(");
    }
}
