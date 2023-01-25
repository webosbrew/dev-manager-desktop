use std::net::SocketAddr;
use std::str::FromStr;
use std::sync::Arc;
use std::time::Duration;

use russh::client::Config;
use russh::kex::{CURVE25519, DH_G14_SHA1, DH_G14_SHA256, DH_G1_SHA1};
use russh::{client, kex, Preferred};
use russh_keys::key::{ED25519, RSA_SHA2_256, RSA_SHA2_512, SSH_RSA};

use crate::device_manager::Device;
use crate::session_manager::connection::Connection;
use crate::session_manager::handler::ClientHandler;
use crate::session_manager::{Error, SessionManager, Shell, ShellToken};

impl SessionManager {
    pub async fn exec(
        &self,
        device: Device,
        command: &str,
        stdin: Option<Vec<u8>>,
    ) -> Result<Vec<u8>, Error> {
        let conn = self.conn_obtain(device).await?;
        return conn.exec(command, stdin).await;
    }

    pub async fn shell_open(
        &self,
        device: &Device,
        cols: u16,
        rows: u16,
    ) -> Result<ShellToken, Error> {
        return Err(Error::unimplemented());
    }

    pub async fn shell_close(&self, token: &ShellToken) -> Result<(), Error> {
        return Err(Error::unimplemented());
    }

    pub fn shell_find(&self, token: &ShellToken) -> Option<Arc<Shell>> {
        return self.shells.read().unwrap().get(token).map(|a| a.clone());
    }

    pub fn shell_list(&self) -> Vec<ShellToken> {
        return self
            .shells
            .read()
            .unwrap()
            .keys()
            .map(|k| k.clone())
            .collect();
    }

    async fn conn_obtain(&self, device: Device) -> Result<Arc<Connection>, Error> {
        if let Some(a) = self.connections.lock().unwrap().get(&device.name) {
            return Ok(a.clone());
        }
        let connection = Arc::new(self.conn_new(device.clone()).await?);
        if !device.new {
            self.connections
                .lock()
                .unwrap()
                .insert(device.name, connection.clone());
        }
        return Ok(connection);
    }

    async fn conn_new(&self, device: Device) -> Result<Connection, Error> {
        let mut config = Config::default();
        config.preferred.key = &[ED25519, RSA_SHA2_512, RSA_SHA2_256, SSH_RSA];
        config.preferred.kex = &[CURVE25519, DH_G14_SHA256, DH_G14_SHA1, DH_G1_SHA1];
        config.connection_timeout = Some(Duration::from_secs(3));
        let handler = ClientHandler {
            id: device.name.clone(),
            connections: Arc::downgrade(&self.connections),
        };
        let addr = SocketAddr::from_str(&format!("{}:{}", &device.host, &device.port)).unwrap();
        let key = Arc::new(device.secret_key()?);
        log::debug!("Connecting to {}", addr);
        let mut handle = client::connect(Arc::new(config), addr, handler).await?;
        log::debug!("Connected to {}", addr);
        if !handle.authenticate_publickey(&device.username, key).await? {
            return Err(Error::disconnected());
        }
        log::debug!("Authenticated to {}", addr);
        return Ok(Connection::new(device, handle));
    }
}
