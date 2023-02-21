use std::sync::Arc;

use russh::Sig;
use tauri::{AppHandle, Runtime};

use crate::device_manager::Device;
use crate::error::Error;
use crate::event_channel::{EventChannel, EventHandler};
use crate::remote_files::path::escape_path;
use crate::session_manager::spawned::Spawned;
use crate::session_manager::{Proc, SessionManager, SpawnedCallback};

pub(crate) async fn exec<R: Runtime>(
    app: AppHandle<R>,
    manager: &SessionManager,
    device: &Device,
    path: &String,
) -> Result<String, Error> {
    let channel = Arc::new(EventChannel::new(app, "remote-serve"));
    let proc = Arc::new(
        match manager
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
    *proc.callback.lock().unwrap() = Some(Box::new(ProcCallback {
        channel: channel.clone(),
    }));
    channel.listen(ServeEventHandler { proc: proc.clone() });

    let async_proc = proc.clone();
    let async_channel = channel.clone();
    let async_path = path.clone();
    tokio::spawn(async move {
        if let Err(e) = async_proc.start().await {
            log::warn!("serve {} failed to start: {:?}", async_path, e);
            async_channel.closed(e);
            return;
        }
        match proc.wait_close().await {
            Ok(r) => {
                log::info!("serve {} closed with {:?}", async_path, r);
                async_channel.closed(None::<String>);
            }
            Err(e) => {
                log::info!("serve {} got error {:?}", async_path, e);
                async_channel.closed(e);
            }
        }
    });
    return Ok(channel.token());
}

struct ServeEventHandler {
    proc: Arc<Proc>,
}

impl EventHandler for ServeEventHandler {
    fn close(&self, payload: Option<&str>) {
        self.proc.signal(Sig::INT).unwrap_or(());
    }
}

struct ProcCallback<R: Runtime> {
    channel: Arc<EventChannel<R, ServeEventHandler>>,
}

impl<R: Runtime> SpawnedCallback for ProcCallback<R> {
    fn rx(&self, fd: u32, data: &[u8]) {
        self.channel.rx(String::from_utf8_lossy(data));
    }

}
