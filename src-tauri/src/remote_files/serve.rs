use std::sync::Arc;

use tauri::{AppHandle, Runtime};

use crate::device_manager::Device;
use crate::error::Error;
use crate::event_channel::{EventChannel, EventHandler};
use crate::remote_files::path::escape_path;
use crate::session_manager::{Proc, SessionManager};

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
    channel.listen(ServeEventHandler { proc: proc.clone() });

    let async_proc = proc.clone();
    let async_channel = channel.clone();
    let async_path = path.clone();
    tokio::spawn(async move {
        if let Err(e) = async_proc
            .run(|index, data| async_channel.send(String::from_utf8(Vec::from(data)).unwrap()))
            .await
        {
            log::info!("serve {} got error {:?}", async_path, e);
            async_channel.close(e);
        } else {
            log::info!("serve {} closed", async_path);
            async_channel.close(None::<String>);
        }
    });
    return Ok(channel.token());
}

struct ServeEventHandler {
    proc: Arc<Proc>,
}

impl EventHandler for ServeEventHandler {
    fn close(&self, payload: Option<&str>) {
        let proc = self.proc.clone();
        tokio::spawn(async move {
            proc.interrupt().await.unwrap_or(());
        });
    }
}
