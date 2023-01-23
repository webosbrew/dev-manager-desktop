use std::collections::HashMap;
use std::sync::Arc;

use russh::{Channel, ChannelMsg};
use russh::client::{Handle, Msg};
use tokio::sync::Mutex as AsyncMutex;
use uuid::Uuid;

use crate::device_manager::Device;
use crate::session_manager::Error;
use crate::session_manager::handler::ClientHandler;

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
      let data = data.clone();
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
