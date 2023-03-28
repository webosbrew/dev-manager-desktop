use std::io::{Read, Write};
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
use crate::spawn_manager::SpawnManager;

#[tauri::command]
async fn exec<R: Runtime>(
    app: AppHandle<R>,
    device: Device,
    command: String,
    stdin: Option<Vec<u8>>,
) -> Result<Vec<u8>, Error> {
    return tokio::task::spawn_blocking(move || {
        let sessions = app.state::<SessionManager>();
        let session = sessions.session(device)?;
        let mut ch = session.new_channel()?;
        ch.open_session()?;
        ch.request_exec(&command)?;
        if let Some(stdin) = stdin {
            ch.stdin().write_all(&stdin)?;
            ch.send_eof()?;
        }
        let mut buf = Vec::<u8>::new();
        ch.stdout().read_to_end(&mut buf)?;
        ch.close()?;
        session.mark_last_ok();
        return Ok(buf);
    })
    .await
    .unwrap();
}

#[tauri::command]
async fn spawn<R: Runtime>(
    app: AppHandle<R>,
    sessions: State<'_, SessionManager>,
    device: Device,
    command: String,
    managed: Option<bool>,
) -> Result<String, Error> {
    let channel = EventChannel::<R, ProcEventHandler<R>>::new(app.clone(), "shell-proc");
    let token = channel.token();
    let proc = Arc::new(sessions.spawn(device, &command));
    channel.listen(ProcEventHandler {
        app: app.clone(),
        proc: proc.clone(),
        command: command.clone(),
    });
    tokio::task::spawn_blocking(move || {
        proc_worker(app, proc, command, channel, managed.unwrap_or(true))
    });
    return Ok(token);
}

fn proc_worker<R: Runtime>(
    app: AppHandle<R>,
    proc: Arc<Proc>,
    command: String,
    channel: EventChannel<R, ProcEventHandler<R>>,
    managed: bool,
) -> Result<(), Error> {
    let spawns = app.state::<SpawnManager>();
    let channel = Arc::new(channel);
    if managed {
        spawns.add_proc(proc.clone());
    }
    *proc.callback.lock().unwrap() = Some(Box::new(ProcCallback {
        channel: channel.clone(),
    }));
    proc.start(&app.state::<SessionManager>())?;
    match proc.wait_close() {
        Ok(SpawnResult::Closed) => {
            log::warn!("Process {command} was not gracefully closed. It has been leaked.");
            channel.closed(&SpawnResult::Closed);
        }
        Ok(r) => {
            log::debug!("Process {} closed with {:?}", command, r);
            channel.closed(&r);
        }
        Err(e) => {
            log::debug!("Process {} got error {:?}", command, e);
            channel.closed(e);
        }
    }
    proc.callback.lock().unwrap().take();
    return Ok(());
}

struct ProcEventHandler<R: Runtime> {
    app: AppHandle<R>,
    proc: Arc<Proc>,
    command: String,
}

struct ProcCallback<R: Runtime> {
    channel: Arc<EventChannel<R, ProcEventHandler<R>>>,
}

impl<R: Runtime> SpawnedCallback for ProcCallback<R> {
    fn rx(&self, fd: u32, data: &[u8]) {
        self.channel.rx(ProcData {
            fd,
            data: Vec::<u8>::from(data),
        });
    }
}

impl<R: Runtime> EventHandler for ProcEventHandler<R> {
    fn tx(&self, payload: Option<&str>) {
        if let Some(payload) = payload {
            self.proc.data(payload.as_bytes()).unwrap_or(());
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
