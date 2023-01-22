use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::net::SocketAddr;
use std::str::FromStr;
use std::sync::{Arc, Mutex};

use russh::{Channel, ChannelId, ChannelMsg, client};
use russh::client::{Config, Handle, Msg};
use russh_keys::load_secret_key;
use tauri::api::path::home_dir;
use tokio::sync::Mutex as AsyncMutex;
use uuid::Uuid;
use vt100::Parser;

use crate::device_manager::Device;
use crate::session_manager::handler::ClientHandler;
use crate::session_manager::{Error, Shell, ShellToken};

pub(crate) struct Connection {
  pub(crate) id: Uuid,
  pub(crate) device: Device,
  pub(crate) handle: AsyncMutex<Handle<ClientHandler>>,
}

pub(crate) type ConnectionsMap = HashMap<String, Arc<Connection>>;

impl Connection {
  pub async fn exec(&self, command: &str, stdin: Option<Vec<u8>>) -> Result<Vec<u8>, Error> {
    let mut ch = self.open_cmd_channel().await?;
    ch.exec(true, command).await?;
    if let Some(data) = stdin {
      let mut data = data.clone();
      ch.data(&*data).await?;
      ch.eof().await?;
    }
    let mut result: Vec<u8> = Vec::new();
    loop {
      match ch.wait().await.ok_or(Error::new("empty message"))? {
        ChannelMsg::Data { data } => { result.append(&mut data.to_vec()) }
        ChannelMsg::Eof => break,
        _ => {}
      }
    }
    return Ok(result.to_vec());
  }

  async fn open_cmd_channel(&self) -> Result<Channel<Msg>, Error> {
    return Ok(self.handle.lock().await.channel_open_session().await?);
  }

  pub(crate) fn new(device: Device, handle: Handle<ClientHandler>) -> Connection {
    let id = Uuid::new_v4();
    log::info!("Created connection {} for device {}", id, device.name);
    return Connection { id, device, handle: AsyncMutex::new(handle) };
  }
}

impl Drop for Connection {
  fn drop(&mut self) {
    log::info!("Dropped connection {} for device {}", self.id, self.device.name);
  }
}
