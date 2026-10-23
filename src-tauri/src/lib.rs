extern crate core;

#[cfg(any(target_family = "windows", target_os = "android"))]
use std::env;
use std::path::PathBuf;

use crate::app_dirs::GetAppSshKeyDir;
use crate::device_manager::DeviceManager;
use crate::error::Error;
use crate::session_manager::SessionManager;
use crate::shell_manager::ShellManager;
use crate::spawn_manager::SpawnManager;
use ssh_key::PrivateKey;
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Builder, Manager, RunEvent, Runtime};

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
#[cfg(test)]
mod tests;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();
    builder = optional_setup(builder);
    let result = builder
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_http::init())
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
        .register_asynchronous_uri_scheme_protocol(
            plugins::file::URI_SCHEME,
            plugins::file::protocol,
        )
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
                    if let Some(dir) = app_dirs::ssh_dir(app) {
                        app.state::<DeviceManager>().ssh_dir.set(dir.clone());
                        app.state::<SessionManager>().ssh_dir.set(dir.clone());
                        app.state::<ShellManager>().ssh_dir.set(dir);
                    }
                    if let Some(dir) = app_dirs::conf_dir(app) {
                        app.state::<DeviceManager>().conf_dir.set(dir);
                    }
                }
                _ => {}
            });
            return Ok(());
        });
    if let Err(e) = result {
        handle_error(&e);
    }
}

#[cfg(feature = "desktop")]
fn handle_error(e: &tauri::Error) {
    use native_dialog::{MessageDialog, MessageType};
    fn error_message(err: &tauri::Error) -> String {
        #[cfg(windows)]
        if let tauri::Error::Runtime(ref e) = *err {
            if format!("{:?}", e).starts_with("CreateWebview(") {
                return format!("Unexpected error occurred: {:?}\nThis may be due to broken installation of WebView2 Runtime. You may need to reinstall WebView2 Runtime as administrator.", e);
            }
        }
        format!("Unexpected error occurred: {:?}", err)
    }
    let msg = error_message(e);
    MessageDialog::new()
        .set_type(MessageType::Error)
        .set_title("webOS Dev Manager")
        .set_text(&msg)
        .show_alert()
        .expect("Unexpected error occurred while processing unexpected error :(");
}

#[cfg(not(feature = "desktop"))]
fn handle_error(e: &tauri::Error) {
    log::error!("Unexpected error occurred: {:?}", e);
}

#[must_use]
fn optional_setup<R: Runtime>(builder: Builder<R>) -> Builder<R> {
    #[cfg(feature = "tauri-plugin-single-instance")]
    {
        builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(wnd) = app.get_webview_window("main") {
                wnd.unminimize().unwrap_or(());
                wnd.set_focus().unwrap_or(());
            }
        }))
    }
    #[cfg(not(feature = "tauri-plugin-single-instance"))]
    {
        builder
    }
}

impl<R: Runtime> GetAppSshKeyDir for AppHandle<R> {
    fn get_app_ssh_key_path(&self) -> Result<PathBuf, Error> {
        if cfg!(mobile) {
            if let Ok(conf_dir) = self.path().app_config_dir() {
                let old_idfile = conf_dir.join("id_devman");
                if old_idfile.exists() {
                    return Ok(old_idfile);
                }
            }
        }
        let config_dir = app_dirs::ssh_dir(self).ok_or_else(Error::bad_config)?;
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

