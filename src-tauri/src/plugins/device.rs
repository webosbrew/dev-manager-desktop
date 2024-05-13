use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};
use tauri::{AppHandle, State};

use crate::app_dirs::{GetAppSshKeyDir, GetSshDir};
use crate::device_manager::{Device, DeviceCheckConnection, DeviceManager};
use crate::error::Error;

#[tauri::command]
async fn list(manager: State<'_, DeviceManager>) -> Result<Vec<Device>, Error> {
    return manager.list().await;
}

#[tauri::command]
async fn set_default(
    manager: State<'_, DeviceManager>,
    name: String,
) -> Result<Option<Device>, Error> {
    return manager.set_default(&name).await;
}

#[tauri::command]
async fn add(manager: State<'_, DeviceManager>, device: Device) -> Result<Device, Error> {
    return manager.add(&device).await;
}

#[tauri::command]
async fn remove(
    manager: State<'_, DeviceManager>,
    name: String,
    remove_key: bool,
) -> Result<(), Error> {
    return manager.remove(&name, remove_key).await;
}

#[tauri::command]
async fn novacom_getkey(
    manager: State<'_, DeviceManager>,
    address: String,
    passphrase: Option<String>,
) -> Result<String, Error> {
    return manager
        .novacom_getkey(&address, passphrase.as_deref().unwrap_or(""))
        .await;
}

#[tauri::command]
async fn localkey_verify(
    manager: State<'_, DeviceManager>,
    name: String,
    passphrase: Option<String>,
) -> Result<(), Error> {
    return manager
        .localkey_verify(&name, passphrase.as_deref().unwrap_or(""))
        .await;
}

#[tauri::command]
async fn privkey_read<R: Runtime>(app: AppHandle<R>, device: Device) -> Result<String, Error> {
    return Ok(device
        .private_key
        .ok_or_else(|| Error::bad_config())?
        .content(app.get_ssh_dir().as_deref())?);
}

#[tauri::command]
async fn check_connection(
    manager: State<'_, DeviceManager>,
    host: String,
) -> Result<DeviceCheckConnection, Error> {
    return manager.check_connection(&host).await;
}

#[tauri::command]
async fn app_ssh_key_path<R: Runtime>(app: AppHandle<R>) -> Result<String, Error> {
    return Ok(app.ensure_app_ssh_key_path()?.to_string_lossy().to_string());
}

#[tauri::command]
async fn app_ssh_pubkey<R: Runtime>(app: AppHandle<R>) -> Result<String, Error> {
    return Ok(app.get_app_ssh_pubkey()?);
}

/// Initializes the plugin.
pub fn plugin<R: Runtime>(name: &'static str) -> TauriPlugin<R> {
    Builder::new(name)
        .invoke_handler(tauri::generate_handler![
            list,
            set_default,
            add,
            remove,
            novacom_getkey,
            localkey_verify,
            privkey_read,
            check_connection,
            app_ssh_key_path,
            app_ssh_pubkey,
        ])
        .build()
}
