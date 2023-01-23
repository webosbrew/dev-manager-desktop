use tauri::plugin::{Builder, TauriPlugin};
use tauri::{Runtime, State};

use crate::device_manager::Device;
use crate::session_manager::{Error, SessionManager, ShellBuffer, ShellToken};

#[tauri::command]
async fn open(manager: State<'_, SessionManager>, device: Device) -> Result<ShellToken, Error> {
    return manager.shell_open(&device, 80, 24).await;
}

#[tauri::command]
async fn close(manager: State<'_, SessionManager>, token: ShellToken) -> Result<(), Error> {
    return manager.shell_close(&token).await;
}

#[tauri::command]
async fn activate(
    state: State<'_, SessionManager>,
    token: ShellToken,
    rows: u16,
    cols: u16,
) -> Result<(), Error> {
    return Err(Error::unimplemented());
}

#[tauri::command]
async fn write(
    manager: State<'_, SessionManager>,
    token: ShellToken,
    data: Vec<u8>,
) -> Result<(), Error> {
    return Err(Error::unimplemented());
}

#[tauri::command]
async fn resize(
    manager: State<'_, SessionManager>,
    token: ShellToken,
    rows: u16,
    cols: u16,
) -> Result<(), Error> {
    return Err(Error::unimplemented());
}

#[tauri::command]
async fn screen(
    manager: State<'_, SessionManager>,
    token: ShellToken,
    cols: u16,
) -> Result<ShellBuffer, Error> {
    return Err(Error::unimplemented());
}

#[tauri::command]
async fn list(manager: State<'_, SessionManager>) -> Result<Vec<ShellToken>, Error> {
    return Ok(manager.shell_list());
}

pub fn plugin<R: Runtime>(name: &'static str) -> TauriPlugin<R> {
    Builder::new(name)
        .invoke_handler(tauri::generate_handler![
            open, close, activate, write, resize, screen, list
        ])
        .build()
}
