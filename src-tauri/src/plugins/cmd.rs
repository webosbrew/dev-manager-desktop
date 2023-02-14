use std::sync::Arc;

use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Manager, Runtime, State,
};
use uuid::Uuid;

use crate::device_manager::Device;
use crate::error::Error;
use crate::session_manager::{ProcData, SessionManager};

#[tauri::command]
async fn exec(
    manager: State<'_, SessionManager>,
    device: Device,
    command: String,
    stdin: Option<Vec<u8>>,
) -> Result<Vec<u8>, Error> {
    return manager.exec(device, &command, stdin.as_deref()).await;
}

#[tauri::command]
async fn spawn<R: Runtime>(
    app: AppHandle<R>,
    device: Device,
    command: String,
) -> Result<String, Error> {
    let string = Uuid::new_v4().to_string();
    let string2 = string.clone();
    tokio::spawn(proc_worker(app, device, command, string2));
    return Ok(string);
}

async fn proc_worker<R: Runtime>(
    app: AppHandle<R>,
    device: Device,
    command: String,
    token: String,
) -> Result<(), Error> {
    let manager = app.state::<SessionManager>();
    let proc = Arc::new(manager.spawn(device, &command).await?);
    let proc_ev = proc.clone();
    let handler = app.once_global(format!("cmd-interrupt-{}", token), move |_| {
        log::info!("interrupting proc");
        let proc_ev = proc_ev.clone();
        tokio::spawn(async move {
            proc_ev.interrupt().await.unwrap_or(());
        });
    });
    if let Err(e) = proc
        .run(|index, data| {
            app.emit_all(
                &format!("cmd-read-{}", token.clone()),
                ProcData {
                    index,
                    data: Vec::<u8>::from(data),
                },
            )
            .unwrap_or(());
        })
        .await
    {
        log::info!("{:?}", e);
        app.emit_all(&format!("cmd-error-{}", token.clone()), e)
            .unwrap_or(());
    } else {
        app.emit_all(&format!("cmd-finish-{}", token.clone()), ())
            .unwrap_or(());
    }
    app.unlisten(handler);
    return Ok(());
}

/// Initializes the plugin.
pub fn plugin<R: Runtime>(name: &'static str) -> TauriPlugin<R> {
    Builder::new(name)
        .invoke_handler(tauri::generate_handler![exec, spawn])
        .build()
}
