use tauri::plugin::{Builder, TauriPlugin};
use tauri::{AppHandle, Manager, Runtime, State};

use crate::device_manager::Device;
use crate::session_manager::{Error, SessionManager, ShellBuffer, ShellData, ShellToken};

#[tauri::command]
async fn open<R: Runtime>(
    app: AppHandle<R>,
    manager: State<'_, SessionManager>,
    device: Device,
) -> Result<ShellToken, Error> {
    let shell = manager.shell_open(device).await?;
    app.emit_all("shells-updated", manager.shell_list())
        .unwrap_or(());
    let run_shell = shell.clone();
    tokio::spawn(async move {
        let token = run_shell.token.clone();
        run_shell
            .run(move |fd, data| {
                app.emit_all(
                    "shell-rx",
                    ShellData {
                        token: token.clone(),
                        fd,
                        data: Vec::from(data),
                    },
                )
                .unwrap_or(());
            })
            .await
            .unwrap_or(());
    });
    return Ok(shell.token.clone());
}

#[tauri::command]
async fn close(manager: State<'_, SessionManager>, token: ShellToken) -> Result<(), Error> {
    return manager.shell_close(&token).await;
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
    rows: u16,
    cols: u16,
) -> Result<ShellBuffer, Error> {
    let shell = manager.shell_find(&token)?;
    return shell.screen(cols, rows).await;
}

#[tauri::command]
async fn list(manager: State<'_, SessionManager>) -> Result<Vec<ShellToken>, Error> {
    return Ok(manager.shell_list());
}

pub fn plugin<R: Runtime>(name: &'static str) -> TauriPlugin<R> {
    Builder::new(name)
        .invoke_handler(tauri::generate_handler![
            open, close, write, resize, screen, list
        ])
        .build()
}
