use std::io::prelude::*;
use std::path::Path;

use tauri::{plugin::{Builder, TauriPlugin}, Runtime, State};

use crate::device_manager::manager::{Device, DeviceManager};

#[tauri::command]
pub async fn exec(state: State<'_, DeviceManager>, device: Device, command: String) -> Result<String, String> {
  let sess = match state.session(&device).await {
    Ok(m) => m,
    Err(_) => return Err(String::from("Failed to open session"))
  };

  let mut channel = sess.channel_session().unwrap();
  channel.exec(&command).unwrap();
  let mut s = String::new();
  channel.read_to_string(&mut s).unwrap();
  channel.send_eof().unwrap();
  channel.wait_eof().unwrap();
  channel.wait_close().unwrap();
  return Ok(s);
}

#[tauri::command]
pub async fn read(state: State<'_, DeviceManager>, device: Device, path: &str) -> Result<Vec<u8>, String> {
  let sess = match state.session(&device).await {
    Ok(m) => m,
    Err(_) => return Err(String::from("Failed to open session"))
  };

  let (mut channel, _stat) = sess.scp_recv(Path::new(path)).unwrap();
  let mut data = Vec::<u8>::new();
  channel.read_to_end(&mut data).unwrap();
  channel.send_eof().unwrap();
  channel.wait_eof().unwrap();
  channel.wait_close().unwrap();
  return Ok(data);
}

/// Initializes the plugin.
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("remote-command")
    .invoke_handler(tauri::generate_handler![exec, read])
    .build()
}
