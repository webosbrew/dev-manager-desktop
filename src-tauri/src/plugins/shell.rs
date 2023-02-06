use tauri::plugin::{Builder, TauriPlugin};
use tauri::{AppHandle, Manager, Runtime, State};

use crate::device_manager::Device;
use crate::error::Error;
use crate::session_manager::{
    SessionManager, ShellCallback, ShellData, ShellInfo, ShellScreen, ShellToken,
};

#[tauri::command]
async fn open<R: Runtime>(
    app: AppHandle<R>,
    manager: State<'_, SessionManager>,
    device: Device,
    cols: u16,
    rows: u16,
    dumb: Option<bool>,
) -> Result<ShellInfo, Error> {
    let shell = manager.shell_open(device, cols, rows, dumb).await?;
    app.emit_all("shells-opened", &shell.token).unwrap_or(());
    let run_shell = shell.clone();
    tokio::spawn(async move {
        let cb = PluginShellCb::<R> {
            token: run_shell.token.clone(),
            app,
        };
        run_shell.run(cb).await.unwrap_or(());
    });
    return Ok(shell.info());
}

#[tauri::command]
async fn close<R: Runtime>(
    app: AppHandle<R>,
    manager: State<'_, SessionManager>,
    token: ShellToken,
) -> Result<(), Error> {
    manager.shell_close(&token)?;
    app.emit_all("shells-updated", manager.shell_list())
        .unwrap_or(());
    return Ok(());
}

#[tauri::command]
async fn write(
    manager: State<'_, SessionManager>,
    token: ShellToken,
    data: Vec<u8>,
) -> Result<(), Error> {
    let shell = manager.shell_find(&token)?;
    return shell.write(&data).await;
}

#[tauri::command]
async fn resize(
    manager: State<'_, SessionManager>,
    token: ShellToken,
    rows: u16,
    cols: u16,
) -> Result<(), Error> {
    let shell = manager.shell_find(&token)?;
    return shell.resize(cols, rows).await;
}

#[tauri::command]
async fn screen(
    manager: State<'_, SessionManager>,
    token: ShellToken,
    cols: u16,
) -> Result<ShellScreen, Error> {
    let shell = manager.shell_find(&token)?;
    return shell.screen(cols).await;
}

#[tauri::command]
async fn list(manager: State<'_, SessionManager>) -> Result<Vec<ShellInfo>, Error> {
    return Ok(manager.shell_list());
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
    fn rx(&self, fd: u32, data: &[u8]) {
        let payload = ShellData {
            token: self.token.clone(),
            fd,
            data: Vec::from(data),
        };
        self.app.emit_all("shell-rx", payload).unwrap_or(());
    }

    fn info(&self, info: ShellInfo) {
        self.app.emit_all("shell-info", info).unwrap_or(());
    }

    fn closed(self) {
        let manager = self.app.state::<SessionManager>();
        manager.shell_close(&self.token).unwrap_or(());
        self.app.emit_all("shells-closed", self.token).unwrap_or(());
    }
}
