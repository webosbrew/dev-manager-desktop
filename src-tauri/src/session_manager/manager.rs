use std::sync::{Arc, Condvar, Mutex};

use r2d2::PooledConnection;

use crate::conn_pool::{DeviceConnectionManager, DeviceConnectionPool};
use crate::device_manager::Device;
use crate::error::Error;
use crate::session_manager::{Proc, SessionManager};

impl SessionManager {
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
            interrupted: Mutex::new(false),
            session: Mutex::default(),
        };
    }

    fn pool(&self, device: Device) -> DeviceConnectionPool {
        if device.new {
            return DeviceConnectionPool::new(device);
        }
        if let Some(p) = self
            .pools
            .lock()
            .expect("Failed to lock SessionManager::pools")
            .get(&device.name)
        {
            return p.clone();
        }
        let key = device.name.clone();
        let pool = DeviceConnectionPool::new(device);
        self.pools
            .lock()
            .expect("Failed to lock SessionManager::pools")
            .insert(key, pool.clone());
        return pool;
    }
}
