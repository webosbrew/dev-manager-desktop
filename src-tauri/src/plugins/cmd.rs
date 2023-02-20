use std::sync::Arc;

use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Manager, Runtime, State,
};
use uuid::Uuid;

use crate::device_manager::Device;
use crate::error::Error;
use crate::event_channel::{EventChannel, EventHandler};
use crate::session_manager::{Proc, ProcData, SessionManager};

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
    let channel = EventChannel::<R, ProcEventHandler>::new(app.clone(), "shell-proc");
    let token = channel.token();
    tokio::spawn(proc_worker(app, device, command, channel));
    return Ok(token);
}

async fn proc_worker<R: Runtime>(
    app: AppHandle<R>,
    device: Device,
    command: String,
    channel: EventChannel<R, ProcEventHandler>,
) -> Result<(), Error> {
    let manager = app.state::<SessionManager>();
    let proc = Arc::new(manager.spawn(device, &command).await?);
    let proc_ev = proc.clone();
    let handler = ProcEventHandler { proc: proc.clone() };
    channel.listen(handler);
    log::info!("Wait for {}", command);
    if let Err(e) = proc
        .run(|index, data| {
            channel.send(ProcData {
                index,
                data: Vec::<u8>::from(data),
            });
        })
        .await
    {
        log::info!("{} got error {:?}", command, e);
        channel.close(e);
    } else {
        log::info!("{} closed", command);
        channel.close(None::<String>);
    }
    return Ok(());
}

struct ProcEventHandler {
    proc: Arc<Proc>,
}

impl EventHandler for ProcEventHandler {
    fn recv(&self, payload: Option<&str>) {}

    fn close(&self, payload: Option<&str>) {
        log::info!("interrupting proc");
        let proc = self.proc.clone();
        tokio::spawn(async move {
            proc.interrupt().await.unwrap_or(());
        });
    }
}

/// Initializes the plugin.
pub fn plugin<R: Runtime>(name: &'static str) -> TauriPlugin<R> {
    Builder::new(name)
        .invoke_handler(tauri::generate_handler![exec, spawn])
        .build()
}
