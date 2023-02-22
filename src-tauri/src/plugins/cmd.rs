use russh::Sig;
use std::sync::Arc;

use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Manager, Runtime, State,
};

use crate::device_manager::Device;
use crate::error::Error;
use crate::event_channel::{EventChannel, EventHandler};
use crate::session_manager::spawned::{SpawnResult, Spawned};
use crate::session_manager::{Proc, ProcData, SessionManager, SpawnedCallback};

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
    let channel = Arc::new(channel);
    channel.listen(ProcEventHandler {
        proc: proc.clone(),
        command: command.clone(),
    });
    *proc.callback.lock().unwrap() = Some(Box::new(ProcCallback {
        channel: channel.clone(),
    }));
    proc.start().await?;
    match proc.wait_close().await {
        Ok(r) => {
            log::debug!("Process {} closed with {:?}", command, r);
            channel.closed(&r);
        }
        Err(e) => {
            log::debug!("Process {} got error {:?}", command, e);
            channel.closed(e);
        }
    }
    return Ok(());
}

struct ProcEventHandler {
    proc: Arc<Proc>,
    command: String,
}

struct ProcCallback<R: Runtime> {
    channel: Arc<EventChannel<R, ProcEventHandler>>,
}

impl<R: Runtime> SpawnedCallback for ProcCallback<R> {
    fn rx(&self, fd: u32, data: &[u8]) {
        self.channel.rx(ProcData {
            fd,
            data: Vec::<u8>::from(data),
        });
    }
}

impl EventHandler for ProcEventHandler {
    fn tx(&self, payload: Option<&str>) {
        if let Some(payload) = payload {
            self.proc.data(payload.as_bytes()).unwrap_or(());
        } else {
            self.proc.signal(Sig::INT).unwrap_or(());
        }
    }
}

/// Initializes the plugin.
pub fn plugin<R: Runtime>(name: &'static str) -> TauriPlugin<R> {
    Builder::new(name)
        .invoke_handler(tauri::generate_handler![exec, spawn])
        .build()
}
