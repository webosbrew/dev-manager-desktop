use tauri::plugin::{Builder, TauriPlugin};
use tauri::{AppHandle, Manager, Runtime, State};

use crate::device_manager::Device;
use crate::error::Error;
use crate::shell_manager::{
    ShellCallback, ShellData, ShellInfo, ShellManager, ShellScreen, ShellToken,
};

#[tauri::command]
fn open<R: Runtime>(
    app: AppHandle<R>,
    manager: State<'_, ShellManager>,
    device: Device,
    cols: u16,
    rows: u16,
    dumb: Option<bool>,
) -> Result<ShellInfo, Error> {
    let shell = manager.open(device, rows, cols, dumb.unwrap_or(false));
    *shell.callback.lock().unwrap() = Some(Box::new(PluginShellCb::<R> {
        token: shell.token.clone(),
        app: app.clone(),
    }));
    app.emit_all("shell-opened", &shell.token).unwrap_or(());
    return Ok(shell.info());
}

#[tauri::command]
async fn close<R: Runtime>(
    app: AppHandle<R>,
    manager: State<'_, ShellManager>,
    token: ShellToken,
) -> Result<(), Error> {
    manager.close(&token)?;
    app.emit_all("shells-updated", manager.list()).unwrap_or(());
    return Ok(());
}

#[tauri::command]
fn write(manager: State<'_, ShellManager>, token: ShellToken, data: Vec<u8>) -> Result<(), Error> {
    let shell = manager.find(&token).ok_or(Error::NotFound)?;
    return shell.write(&data);
}

#[tauri::command]
async fn resize(
    manager: State<'_, ShellManager>,
    token: ShellToken,
    rows: u16,
    cols: u16,
) -> Result<(), Error> {
    let shell = manager.find(&token).ok_or(Error::NotFound)?;
    return shell.resize(rows, cols);
}

#[tauri::command]
async fn screen(
    manager: State<'_, ShellManager>,
    token: ShellToken,
    cols: u16,
) -> Result<ShellScreen, Error> {
    let shell = manager.find(&token).ok_or(Error::NotFound)?;
    return shell.screen(cols);
}

#[tauri::command]
async fn list(manager: State<'_, ShellManager>) -> Result<Vec<ShellInfo>, Error> {
    return Ok(manager.list());
}

pub fn plugin<R: Runtime>(name: &'static str) -> TauriPlugin<R> {
    Builder::new(name)
        .invoke_handler(tauri::generate_handler![
            open, close, write, resize, screen, list
        ])
        .build()
}

struct PluginShellCb<R: Runtime> {
    token: ShellToken,
    app: AppHandle<R>,
}

impl<R: Runtime> ShellCallback for PluginShellCb<R> {
    fn info(&self, info: ShellInfo) {
        self.app.emit_all("shell-info", info).unwrap_or(());
    }

    fn rx(&self, data: &[u8]) {
        let payload = ShellData {
            token: self.token.clone(),
            fd: 0,
            data: Vec::from(data),
        };
        self.app.emit_all("shell-rx", payload).unwrap_or(());
    }

    fn closed(&self, removed:bool) {
        let shells = self.app.state::<ShellManager>();
        if removed {
            self.app
                .emit_all("shell-removed", self.token.clone())
                .unwrap_or(());
        }
        self.app
            .emit_all("shells-updated", shells.list())
            .unwrap_or(());
    }
}
