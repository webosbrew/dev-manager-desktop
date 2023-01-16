use std::io::prelude::*;
use std::path::Path;

use ssh2::ErrorCode;
use tauri::{plugin::{Builder, TauriPlugin}, Runtime, State};

use crate::device_manager::Device;
use crate::session_manager::SessionManager;

#[tauri::command]
async fn exec(state: State<'_, SessionManager>, device: Device, command: String,
              stdin: Option<String>) -> Result<String, String> {
  return state.cmd_run(&device, |sess| {
    let mut channel = sess.channel_session()?;
    log::debug!("Executing command `{}` on {}", command, device.name);
    channel.exec(&command)?;
    if let Some(s) = &stdin {
      log::trace!("<= {}", s);
      channel.write(s.as_bytes())?;
      channel.flush()?;
    }
    let mut s = String::new();
    channel.read_to_string(&mut s)
      .map_err(|_e| ssh2::Error::new(ErrorCode::Session(-43), "failed to read"))?;
    channel.send_eof()?;
    channel.wait_eof()?;
    channel.close()?;
    channel.wait_close()?;
    log::trace!("=> {}", s);
    return Ok(s);
  }).await.map_err(|e| format!("{:?}", e));
}

#[tauri::command]
async fn read(state: State<'_, SessionManager>, device: Device, path: String) -> Result<Vec<u8>, String> {
  return state.cmd_run(&device, |sess| {
    let (mut channel, _stat) = sess.scp_recv(Path::new(&path))?;
    let mut data = Vec::<u8>::new();
    channel.read_to_end(&mut data)
      .map_err(|_e| ssh2::Error::new(ErrorCode::Session(-43), "failed to read"))?;
    channel.send_eof()?;
    channel.wait_eof()?;
    channel.wait_close()?;
    return Ok(data);
  }).await.map_err(|e| format!("{:?}", e));
}

/// Initializes the plugin.
pub fn plugin<R: Runtime>(name: &'static str) -> TauriPlugin<R> {
  Builder::new(name)
    .invoke_handler(tauri::generate_handler![exec, read])
    .build()
}
