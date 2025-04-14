use crate::app_dirs::{GetAppSshKeyDir, GetSshDir};
use crate::device_manager::{Device, DeviceCheckConnection, DeviceManager, PrivateKeyInfo};
use crate::error::Error;
use std::io::Read;
use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};
use tauri::{AppHandle, State};
use tauri_plugin_fs::{FilePath, Fs, OpenOptions};

#[tauri::command]
async fn list(manager: State<'_, DeviceManager>) -> Result<Vec<Device>, Error> {
    manager.list().await
}

#[tauri::command]
async fn set_default(
    manager: State<'_, DeviceManager>,
    name: String,
) -> Result<Option<Device>, Error> {
    manager.set_default(&name).await
}

#[tauri::command]
async fn add(manager: State<'_, DeviceManager>, device: Device) -> Result<Device, Error> {
    manager.add(&device).await
}

#[tauri::command]
async fn remove(
    manager: State<'_, DeviceManager>,
    name: String,
    remove_key: bool,
) -> Result<(), Error> {
    manager.remove(&name, remove_key).await
}

#[tauri::command]
async fn novacom_getkey(
    manager: State<'_, DeviceManager>,
    address: String,
    passphrase: Option<String>,
) -> Result<String, Error> {
    manager
        .novacom_getkey(&address, passphrase.as_deref().unwrap_or(""))
        .await
}

#[tauri::command]
async fn localkey_verify<R>(
    app: AppHandle<R>,
    path: FilePath,
    passphrase: Option<String>,
) -> Result<PrivateKeyInfo, Error>
where
    R: Runtime,
{
    let manager = app.state::<DeviceManager>();
    let fs = app.state::<Fs<R>>();
    let mut open_options = OpenOptions::new();
    open_options.read(true);
    let file = fs.open(path, open_options)?;
    let mut content = String::new();
    file.take(32768).read_to_string(&mut content)?;
    manager
        .key_verify(&content, passphrase.as_deref().unwrap_or(""))
        .await
}

#[tauri::command]
async fn privkey_read<R: Runtime>(app: AppHandle<R>, device: Device) -> Result<String, Error> {
    Ok(device
        .private_key
        .ok_or_else(|| Error::bad_config())?
        .content(app.get_ssh_dir().as_deref())?)
}

#[tauri::command]
async fn check_connection(
    manager: State<'_, DeviceManager>,
    host: String,
) -> Result<DeviceCheckConnection, Error> {
    manager.check_connection(&host).await
}

#[tauri::command]
async fn app_ssh_key_path<R: Runtime>(app: AppHandle<R>) -> Result<String, Error> {
    Ok(app.ensure_app_ssh_key_path()?.to_string_lossy().to_string())
}

#[tauri::command]
async fn app_ssh_pubkey<R: Runtime>(app: AppHandle<R>) -> Result<String, Error> {
    Ok(app.get_app_ssh_pubkey()?)
}

#[tauri::command]
async fn ssh_key_dir<R: Runtime>(app: AppHandle<R>) -> Result<String, Error> {
    Ok(app.get_ssh_dir().unwrap().to_string_lossy().to_string())
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
            ssh_key_dir,
        ])
        .build()
}
