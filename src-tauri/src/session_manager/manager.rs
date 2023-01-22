use std::net::SocketAddr;
use std::str::FromStr;
use std::sync::Arc;
use russh::client;
use russh::client::Config;
use crate::device_manager::Device;
use crate::session_manager::{SessionManager, Shell, ShellToken, Error};
use crate::session_manager::connection::Connection;
use crate::session_manager::handler::ClientHandler;

impl SessionManager {
  pub async fn exec(&self, device: Device, command: &str, stdin: Option<Vec<u8>>) -> Result<Vec<u8>, Error> {
    let conn = self.conn_obtain(device).await?;
    return conn.exec(command, stdin).await;
  }

  pub async fn shell_open(&self, device: &Device, cols: u16, rows: u16) -> Result<ShellToken, Error> {
    return Err(Error::unimplemented());
  }

  pub async fn shell_close(&self, token: &ShellToken) -> Result<(), Error> {
    return Err(Error::unimplemented());
  }

  pub fn shell_find(&self, token: &ShellToken) -> Option<Arc<Shell>> {
    return self.shells.read().unwrap().get(token).map(|a| a.clone());
  }

  pub fn shell_list(&self) -> Vec<ShellToken> {
    return self.shells.read().unwrap().keys().map(|k| k.clone()).collect();
  }

  async fn conn_obtain(&self, device: Device) -> Result<Arc<Connection>, Error> {
    if let Some(a) = self.connections.lock().unwrap().get(&device.name) {
      return Ok(a.clone());
    }
    let name = device.name.clone();
    let connection = Arc::new(self.conn_new(device).await?);
    self.connections.lock().unwrap().insert(name, connection.clone());
    return Ok(connection);
  }

  async fn conn_new(&self, device: Device) -> Result<Connection, Error> {
    let config = Arc::new(Config::default());
    let handler = ClientHandler {
      id: device.name.clone(),
      connections: Arc::downgrade(&self.connections),
    };
    let addr = SocketAddr::from_str(&format!("{}:{}", &device.host, &device.port)).unwrap();
    let key = Arc::new(device.secret_key()?);
    let mut handle = client::connect(config, addr, handler).await?;
    if !handle.authenticate_publickey(&device.username, key).await? {
      return Err(Error::disconnected());
    }
    return Ok(Connection::new(device, handle));
  }
}
