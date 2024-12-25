extern crate core;

#[cfg(any(target_family = "windows", target_os = "android"))]
use std::env;
use std::path::PathBuf;

#[cfg(feature = "desktop")]
use native_dialog::{MessageDialog, MessageType};
use ssh_key::PrivateKey;
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Manager, RunEvent, Runtime};

#[cfg(target_os = "android")]
use android_logger::Config;

use crate::app_dirs::{GetAppSshKeyDir, GetConfDir, GetSshDir, SetConfDir, SetSshDir};
use crate::device_manager::DeviceManager;
use crate::error::Error;
use crate::session_manager::SessionManager;
use crate::shell_manager::ShellManager;
use crate::spawn_manager::SpawnManager;

mod app_dirs;
mod byte_string;
mod conn_pool;
mod device_manager;
mod error;
mod event_channel;
mod plugins;
mod remote_files;
mod session_manager;
mod shell_manager;
mod spawn_manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[tokio::main]
pub async fn run() {
    #[cfg(target_os = "android")]
    {
        android_logger::init_once(Config::default().with_max_level(log::LevelFilter::Debug));
    }

    tauri::async_runtime::set(tokio::runtime::Handle::current());

    let mut builder = tauri::Builder::default();
    #[cfg(feature = "tauri-plugin-single-instance")]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(wnd) = app.get_window("main") {
                wnd.unminimize().unwrap_or(());
                wnd.set_focus().unwrap_or(());
            }
        }));
    }
    let result = builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_upload::init())
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
        .register_asynchronous_uri_scheme_protocol("remote-file", plugins::file::protocol)
        .on_page_load(|wnd, payload| {
            if payload.event() == PageLoadEvent::Started {
                let spawns = wnd.state::<SpawnManager>();
                spawns.clear();
            }
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
    #[cfg(feature = "desktop")]
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
    }
}

impl<R: Runtime> GetSshDir for AppHandle<R> {
    fn get_ssh_dir(&self) -> Option<PathBuf> {
        #[cfg(mobile)]
        {
            self.path().app_config_dir().ok()
        }
        #[cfg(not(mobile))]
        {
            self.path()
                .home_dir()
                .map(|home| home.join(".ssh"))
                .or_else(|_| self.path().data_dir())
                .ok()
        }
    }
}

impl<R: Runtime> GetAppSshKeyDir for AppHandle<R> {
    fn get_app_ssh_key_path(&self) -> Result<PathBuf, Error> {
        let config_dir = self.get_ssh_dir().ok_or(Error::bad_config())?;
        Ok(config_dir.join("id_devman"))
    }

    fn get_app_ssh_pubkey(&self) -> Result<String, Error> {
        let priv_key = self.ensure_app_ssh_key_path()?;
        PrivateKey::read_openssh_file(&priv_key)
            .map_err(|e| Error::BadPrivateKey {
                message: format!("{:?}", e),
            })
            .and_then(|key| {
                key.public_key()
                    .to_openssh()
                    .map_err(|e| Error::BadPrivateKey {
                        message: format!("{:?}", e),
                    })
            })
    }
}

impl<R: Runtime> GetConfDir for AppHandle<R> {
    fn get_conf_dir(&self) -> Option<PathBuf> {
        #[cfg(not(mobile))]
        {
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
                home = self.path().home_dir().ok();
            }
            return home.map(|d| d.join(".webos").join("ose"));
        }
        #[cfg(mobile)]
        {
            return self.path().data_dir().ok();
        }
    }
}
