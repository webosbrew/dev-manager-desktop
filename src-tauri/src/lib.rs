extern crate core;

use std::env;
use std::path::PathBuf;

use log::LevelFilter;
use native_dialog::{MessageDialog, MessageType};
use tauri::api::path::home_dir;
use tauri::{AppHandle, Manager, RunEvent, Runtime};

use crate::app_dirs::{GetConfDir, GetSshDir, SetConfDir, SetSshDir};
use crate::device_manager::DeviceManager;
use crate::session_manager::SessionManager;
use crate::shell_manager::ShellManager;
use crate::spawn_manager::SpawnManager;

mod app_dirs;
mod conn_pool;
mod device_manager;
mod error;
mod event_channel;
mod plugins;
mod remote_files;
mod session_manager;
mod shell_manager;
mod spawn_manager;

//#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::builder()
        .filter_level(LevelFilter::Debug)
        .init();
    let mut builder = tauri::Builder::default();
    #[cfg(feature = "single-instance")]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(wnd) = app.get_window("main") {
                wnd.unminimize().unwrap_or(());
                wnd.set_focus().unwrap_or(());
            }
        }));
    }
    let result = builder
        .plugin(plugins::device::plugin("device-manager"))
        .plugin(plugins::cmd::plugin("remote-command"))
        .plugin(plugins::shell::plugin("remote-shell"))
        .plugin(plugins::file::plugin("remote-file"))
        .plugin(plugins::devmode::plugin("dev-mode"))
        .plugin(plugins::local_file::plugin("local-file"))
        .manage(DeviceManager::default())
        .manage(SessionManager::default())
        .manage(SpawnManager::default())
        .manage(ShellManager::default())
        .on_page_load(|wnd, _payload| {
            let spawns = wnd.state::<SpawnManager>();
            spawns.clear();
        })
        .build(tauri::generate_context!())
        .and_then(|app| {
            app.run(|app, event| match event {
                RunEvent::Ready => {
                    if let Some(ssh_dir) = app.get_ssh_dir() {
                        app.state::<DeviceManager>().set_ssh_dir(ssh_dir.clone());
                        app.state::<SessionManager>().set_ssh_dir(ssh_dir.clone());
                        app.state::<ShellManager>().set_ssh_dir(ssh_dir.clone());
                    }
                    if let Some(conf_dir) = app.get_conf_dir() {
                        app.state::<DeviceManager>().set_conf_dir(conf_dir.clone());
                    }
                }
                _ => {}
            });
            return Ok(());
        });
    if let Err(e) = result {
        #[cfg(windows)]
        if let tauri::Error::Runtime(ref e) = e {
            if format!("{:?}", e).starts_with("CreateWebview(") {
                MessageDialog::new()
                    .set_type(MessageType::Error)
                    .set_title("webOS Dev Manager")
                    .set_text(&format!("Unexpected error occurred: {:?}\nThis may be due to broken installation of WebView2 Runtime. You may need to reinstall WebView2 Runtime as administrator.", e))
                    .show_alert()
                    .expect("Unexpected error occurred while processing unexpected error :(");
                return;
            }
        }
        MessageDialog::new()
            .set_type(MessageType::Error)
            .set_title("webOS Dev Manager")
            .set_text(&format!("Unexpected error occurred: {:?}", e))
            .show_alert()
            .expect("Unexpected error occurred while processing unexpected error :(");
    }
}

impl<R: Runtime> GetSshDir for AppHandle<R> {
    fn get_ssh_dir(&self) -> Option<PathBuf> {
        return home_dir()
            .or_else(|| self.path_resolver().app_data_dir())
            .map(|d| d.join(".ssh"));
    }
}

impl<R: Runtime> GetConfDir for AppHandle<R> {
    fn get_conf_dir(&self) -> Option<PathBuf> {
        let home: Option<PathBuf>;
        #[cfg(target_family = "windows")]
        {
            home = env::var("APPDATA")
                .or_else(|_| env::var("USERPROFILE"))
                .map(|d| PathBuf::from(d))
                .ok();
        }
        #[cfg(not(target_family = "windows"))]
        {
            home = home_dir();
        }
        return home.map(|d| d.join(".webos").join("ose"));
    }
}
