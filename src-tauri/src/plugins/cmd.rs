use std::io::{Read, Write};
use std::sync::Arc;

use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Manager, Runtime, State,
};

use crate::device_manager::Device;
use crate::error::Error;
use crate::event_channel::{EventChannel, EventHandler};
use crate::session_manager::{Proc, ProcCallback, ProcData, SessionManager};
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
        return sessions.with_session(device, |session| {
            let ch = session.new_channel()?;
            ch.open_session()?;
            ch.request_exec(&command)?;
            if let Some(stdin) = stdin.clone() {
                ch.stdin().write_all(&stdin)?;
                ch.send_eof()?;
            }
            let mut buf = Vec::<u8>::new();
            ch.stdout().read_to_end(&mut buf)?;
            let mut stderr = Vec::<u8>::new();
            ch.stderr().read_to_end(&mut stderr)?;
            let exit_code = ch.get_exit_status().unwrap_or(0);
            ch.close()?;
            session.mark_last_ok();
            if exit_code != 0 {
                return Err(Error::ExitStatus {
                    message: format!(""),
                    exit_code,
                    stderr,
                });
            }
            return Ok(buf);
        });
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
    let channel = EventChannel::<R, ProcEventHandler>::new(app.clone(), "shell-proc");
    let token = channel.token();
    let proc = Arc::new(sessions.spawn(device, &command));
    channel.listen(ProcEventHandler { proc: proc.clone() });
    tokio::task::spawn_blocking(move || proc_worker(app, proc, channel, managed.unwrap_or(true)));
    return Ok(token);
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
            channel.closed(&r);
        }
        Err(e) => {
            log::warn!("{proc:?} closed with {e:?}");
            channel.closed(e);
        }
    }
    proc.callback.lock().unwrap().take();
    return Ok(());
}

struct ProcEventHandler {
    proc: Arc<Proc>,
}

struct ProcCallbackImpl<R: Runtime> {
    channel: Arc<EventChannel<R, ProcEventHandler>>,
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
        if let Some(payload) = payload {
            self.proc.write(Vec::from(payload.as_bytes())).unwrap_or(());
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
