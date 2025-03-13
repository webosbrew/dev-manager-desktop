use std::sync::Arc;

use crate::byte_string::{ByteString, Encoding};
use crate::conn_pool::ExecuteCommand;
use crate::device_manager::Device;
use crate::error::Error;
use crate::event_channel::{EventChannel, EventHandler};
use crate::session_manager::{Proc, ProcCallback, ProcData, SessionManager};
use crate::spawn_manager::SpawnManager;
use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Manager, Runtime, State,
};

#[tauri::command]
async fn exec<R: Runtime>(
    app: AppHandle<R>,
    device: Device,
    command: String,
    stdin: Option<ByteString>,
    encoding: Option<Encoding>,
) -> Result<ExecOutput, Error> {
    let encoding = encoding.unwrap_or(Encoding::Binary);
    tauri::async_runtime::spawn_blocking(move || {
        let sessions = app.state::<SessionManager>();
        return sessions.with_session(device, move |session| {
            session.execute_command(&command, stdin.as_ref(), encoding)
        });
    })
    .await
    .unwrap()
}

#[tauri::command]
async fn spawn<R: Runtime>(
    app: AppHandle<R>,
    sessions: State<'_, SessionManager>,
    device: Device,
    command: String,
    managed: Option<bool>,
) -> Result<String, Error> {
    let channel = EventChannel::<R, ProcEventHandler>::new(app.clone(), "shell-proc");
    let token = channel.token();
    let proc = Arc::new(sessions.spawn(device, &command));
    channel.listen(ProcEventHandler { proc: proc.clone() });
    tauri::async_runtime::spawn_blocking(move || {
        proc_worker(app, proc, channel, managed.unwrap_or(true))
    });
    Ok(token)
}

fn proc_worker<R: Runtime>(
    app: AppHandle<R>,
    proc: Arc<Proc>,
    channel: EventChannel<R, ProcEventHandler>,
    managed: bool,
) -> Result<(), Error> {
    let spawns = app.state::<SpawnManager>();
    let channel = Arc::new(channel);
    if managed {
        spawns.add_proc(proc.clone());
    }
    *proc.callback.lock().unwrap() = Some(Box::new(ProcCallbackImpl {
        channel: channel.clone(),
    }));
    proc.start()?;
    match proc.wait_close(&app.state::<SessionManager>()) {
        Ok(r) => {
            log::info!("{proc:?} closed with {r:?}");
            channel.closed(r);
        }
        Err(e) => {
            log::warn!("{proc:?} closed with {e:?}");
            channel.closed(e);
        }
    }
    proc.callback.lock().unwrap().take();
    Ok(())
}

struct ProcEventHandler {
    proc: Arc<Proc>,
}

struct ProcCallbackImpl<R: Runtime> {
    channel: Arc<EventChannel<R, ProcEventHandler>>,
}

#[derive(Deserialize)]
struct TxPayload {
    data: Option<Vec<u8>>,
}

#[derive(Serialize, Debug)]
pub(crate) struct ExecOutput {
    pub stdout: ByteString,
    pub stderr: ByteString,
}

impl<R: Runtime> ProcCallback for ProcCallbackImpl<R> {
    fn rx(&self, fd: u32, data: &[u8]) {
        self.channel.rx(ProcData {
            fd,
            data: Vec::<u8>::from(data),
        });
    }
}

impl EventHandler for ProcEventHandler {
    fn tx(&self, payload: Option<&str>) {
        let data = payload
            .map(|p| {
                serde_json::from_str::<TxPayload>(p)
                    .map(|t| t.data)
                    .ok()
                    .flatten()
            })
            .flatten();
        if let Some(data) = data {
            self.proc.write(data).unwrap_or(());
        } else if !self.proc.is_ready() {
            self.proc.notify_ready();
        } else {
            self.proc.interrupt();
        }
    }
}

/// Initializes the plugin.
pub fn plugin<R: Runtime>(name: &'static str) -> TauriPlugin<R> {
    Builder::new(name)
        .invoke_handler(tauri::generate_handler![exec, spawn])
        .build()
}
