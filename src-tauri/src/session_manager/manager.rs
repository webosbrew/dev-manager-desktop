use r2d2::PooledConnection;
use std::net::SocketAddr;
use std::str::FromStr;
use std::sync::{Arc, Condvar, Mutex};
use std::time::Duration;

use crate::conn_pool::{DeviceConnectionManager, DeviceConnectionPool};
use uuid::Uuid;

use crate::device_manager::{Device, PrivateKey};
use crate::error::Error;
use crate::session_manager::{Proc, SessionManager, Shell, ShellInfo, ShellToken};

impl SessionManager {
    pub fn pool(&self, device: Device) -> DeviceConnectionPool {
        if let Some(p) = self.pools.lock().unwrap().get(&device.name) {
            return p.clone();
        }
        let key = device.name.clone();
        let pool = DeviceConnectionPool::new(device);
        self.pools.lock().unwrap().insert(key, pool.clone());
        return pool;
    }

    pub fn session(
        &self,
        device: Device,
    ) -> Result<PooledConnection<DeviceConnectionManager>, Error> {
        return self.pool(device).get();
    }

    pub fn spawn(&self, device: Device, command: &str) -> Proc {
        return Proc {
            device,
            command: String::from(command),
            callback: Mutex::default(),
            ready: Arc::new((Mutex::default(), Condvar::new())),
        };
    }

    pub async fn shell_open(
        &self,
        device: Device,
        cols: u16,
        rows: u16,
        dumb: Option<bool>,
    ) -> Result<Arc<Shell>, Error> {
        todo!();
    }

    pub fn shell_close(&self, token: &ShellToken) -> Result<(), Error> {
        let shell = self.shells.lock().unwrap().remove(&token).clone();
        if let Some(shell) = shell {
            shell.close().unwrap_or(());
        }
        return Ok(());
    }

    pub fn shell_find(&self, token: &ShellToken) -> Result<Arc<Shell>, Error> {
        return self
            .shells
            .lock()
            .unwrap()
            .get(token)
            .map(|a| a.clone())
            .ok_or_else(|| Error::NotFound);
    }

    pub fn shell_list(&self) -> Vec<ShellInfo> {
        let mut list: Vec<ShellInfo> = self
            .shells
            .lock()
            .unwrap()
            .iter()
            .map(|(_, shell)| shell.info())
            .collect();
        list.sort_by_key(|v| v.created_at);
        return list;
    }
}
