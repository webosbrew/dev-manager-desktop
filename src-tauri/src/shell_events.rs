use std::io::{Error, ErrorKind, Write};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Event, Manager, Runtime};

use crate::session_manager::{SessionManager, ShellSessionToken};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Message {
  pub token: ShellSessionToken,
  pub data: Vec<u8>,
}

pub async fn on_tx_event<R: Runtime>(handle: AppHandle<R>, event: Event) -> Result<(), Error> {
  if let Some(payload) = event.payload() {
    let manager = handle.state::<SessionManager>();
    let message = serde_json::from_str::<Message>(payload)?;
    manager.shell_do(&message.token, |mut ch| {
      ch.write_all(message.data.as_slice())?;
      ch.flush()?;
      return Ok(());
    }).await?;
    return Ok(());
  }
  return Err(Error::new(ErrorKind::Other, "No payload"));
}
