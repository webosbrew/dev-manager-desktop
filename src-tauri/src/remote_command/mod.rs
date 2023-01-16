use std::io::prelude::*;
use std::path::Path;

use ssh2::ErrorCode;
use tauri::{AppHandle, plugin::{Builder, TauriPlugin}, Runtime, State};

use crate::device_manager::manager::Device;
use crate::session_manager::{SessionManager, ShellSessionToken};

#[tauri::command]
pub async fn exec(state: State<'_, SessionManager>, device: Device, command: String,
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
pub async fn read(state: State<'_, SessionManager>, device: Device, path: String) -> Result<Vec<u8>, String> {
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

#[tauri::command]
pub async fn shell_open<R: Runtime>(app: AppHandle<R>, state: State<'_, SessionManager>, device: Device)
                                    -> Result<ShellSessionToken, String> {
  return state.shell_open(&device, app).await.map_err(|e| format!("{:?}", e));
}

#[tauri::command]
pub async fn shell_close<R: Runtime>(app: AppHandle<R>, state: State<'_, SessionManager>,
                                     token: ShellSessionToken) -> Result<(), String> {
  return state.shell_close(&token, app).await.map_err(|e| format!("{:?}", e));
}

#[tauri::command]
pub async fn shells_list(state: State<'_, SessionManager>) -> Result<Vec<ShellSessionToken>, String> {
  return Ok(state.shells_list());
}

/// Initializes the plugin.
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("remote-command")
    .invoke_handler(tauri::generate_handler![exec, read, shell_open, shell_close, shells_list])
    .build()
}
