use std::sync::Arc;

use russh::{ChannelMsg, Sig};
use tauri::{AppHandle, Runtime};

use crate::device_manager::Device;
use crate::error::Error;
use crate::event_channel::{EventChannel, EventHandler};
use crate::remote_files::path::escape_path;
use crate::session_manager::spawned::Spawned;
use crate::session_manager::{Proc, SessionManager, SpawnedCallback};
use crate::spawn_manager::SpawnManager;

pub(crate) async fn exec<R: Runtime>(
    app: AppHandle<R>,
    sessions: &SessionManager,
    spawns: &SpawnManager,
    device: Device,
    path: String,
) -> Result<String, Error> {
    let channel = Arc::new(EventChannel::new(app, "remote-serve"));
    let proc = Arc::new(
        match sessions
            .spawn(
                device.clone(),
                &format!(
                    "node -e {} {}",
                    escape_path(include_str!("helpers/serve.js")),
                    escape_path(&path)
                ),
            )
            .await
        {
            Err(Error::ExitStatus {
                message,
                exit_code,
                stderr,
            }) => {
                return Err(Error::ExitStatus {
                    message,
                    exit_code,
                    stderr,
                });
            }
            r => r?,
        },
    );
    spawns.add_proc(proc.clone());
    *proc.callback.lock().unwrap() = Some(Box::new(ProcCallback {
        channel: channel.clone(),
    }));
    channel.listen(ServeEventHandler { proc: proc.clone() });

    let token = channel.token();
    tokio::spawn(serve_worker(proc, channel, path));
    return Ok(token);
}

async fn serve_worker<R: Runtime>(
    proc: Arc<Proc>,
    channel: Arc<EventChannel<R, ServeEventHandler>>,
    path: String,
) {
    if let Err(e) = proc.start().await {
        log::warn!("serve {} failed to start: {:?}", path, e);
        channel.closed(e);
        return;
    }
    match proc.wait_close().await {
        Ok(r) => {
            log::debug!("File serving {} closed with {:?}", path, r);
            channel.closed(&r);
        }
        Err(e) => {
            log::debug!("File serving {} got error {:?}", path, e);
            channel.closed(e);
        }
    }
    proc.callback.lock().unwrap().take();
}

struct ServeEventHandler {
    proc: Arc<Proc>,
}

impl EventHandler for ServeEventHandler {
    fn tx(&self, payload: Option<&str>) {
        if let Some(_payload) = payload {
            unimplemented!("No tx supported");
        } else {
            self.proc.interrupt().unwrap_or(());
        }
    }
}

struct ProcCallback<R: Runtime> {
    channel: Arc<EventChannel<R, ServeEventHandler>>,
}

impl<R: Runtime> SpawnedCallback for ProcCallback<R> {
    fn rx(&self, fd: u32, data: &[u8]) {
        if fd == 0 {
            self.channel.rx(String::from_utf8_lossy(data));
        }
    }
}
