use tauri::plugin::{Builder, TauriPlugin};
use tauri::{AppHandle, Manager, Runtime, State};

use crate::device_manager::Device;
use crate::error::Error;
use crate::session_manager::spawned::Spawned;
use crate::session_manager::{
    SessionManager, ShellCallback, ShellData, ShellInfo, ShellScreen, ShellToken, SpawnedCallback,
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
    app.emit_all("shell-opened", &shell.token).unwrap_or(());
    let run_shell = shell.clone();
    let run_app = app.clone();
    tokio::task::spawn_blocking(move || {
        *run_shell.callback.lock().unwrap() = Some(Box::new(PluginShellCb::<R> {
            token: run_shell.token.clone(),
            app,
        }));
        // TODO: process result here
        let result = run_shell.wait_close();
        log::debug!("Shell {:?} exited with {:?}", run_shell.token, result);
        let manager = run_app.state::<SessionManager>();
        manager.shell_close(&run_shell.token).unwrap_or(());
        run_app
            .emit_all("shell-closed", run_shell.token.clone())
            .unwrap_or(());
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
    return shell.write(&data);
}

#[tauri::command]
async fn resize(
    manager: State<'_, SessionManager>,
    token: ShellToken,
    rows: u16,
    cols: u16,
) -> Result<(), Error> {
    let shell = manager.shell_find(&token)?;
    return shell.resize(cols, rows);
}

#[tauri::command]
async fn screen(
    manager: State<'_, SessionManager>,
    token: ShellToken,
    cols: u16,
) -> Result<ShellScreen, Error> {
    let shell = manager.shell_find(&token)?;
    return shell.screen(cols);
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

impl<R: Runtime> SpawnedCallback for PluginShellCb<R> {
    fn rx(&self, fd: u32, data: &[u8]) {
        let payload = ShellData {
            token: self.token.clone(),
            fd,
            data: Vec::from(data),
        };
        self.app.emit_all("shell-rx", payload).unwrap_or(());
    }
}

impl<R: Runtime> ShellCallback for PluginShellCb<R> {
    fn info(&self, info: ShellInfo) {
        self.app.emit_all("shell-info", info).unwrap_or(());
    }
}
