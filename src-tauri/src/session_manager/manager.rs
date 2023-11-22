use std::path::PathBuf;
use std::sync::{Arc, Condvar, Mutex};

use crate::conn_pool::{DeviceConnectionPool, ManagedDeviceConnection};
use crate::device_manager::Device;
use crate::error::Error;
use crate::session_manager::{Proc, SessionManager};
use crate::app_dirs::{GetSshDir, SetSshDir};

impl SessionManager {
    pub fn session(&self, device: Device) -> Result<ManagedDeviceConnection, Error> {
        return self.pool(device).get();
    }

    pub fn with_session<T, F>(&self, device: Device, action: F) -> Result<T, Error>
    where
        F: Fn(&ManagedDeviceConnection) -> Result<T, Error>,
    {
        let pool = self.pool(device);
        loop {
            let session = pool.get()?;
            return match action(&session) {
                Ok(ret) => {
                    session.mark_last_ok();
                    Ok(ret)
                }
                Err(Error::Disconnected) => {
                    continue;
                }
                Err(e) => Err(e),
            };
        }
    }

    pub fn spawn(&self, device: Device, command: &str) -> Proc {
        return Proc {
            device,
            command: String::from(command),
            callback: Mutex::default(),
            ready: Arc::new((Mutex::default(), Condvar::new())),
            sender: Mutex::default(),
            interrupted: Mutex::new(false),
        };
    }

    fn pool(&self, device: Device) -> DeviceConnectionPool {
        if device.new {
            return DeviceConnectionPool::new(device, self.get_ssh_dir());
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
        let pool = DeviceConnectionPool::new(device, self.get_ssh_dir());
        self.pools
            .lock()
            .expect("Failed to lock SessionManager::pools")
            .insert(key, pool.clone());
        return pool;
    }
}

impl GetSshDir for SessionManager {
    fn get_ssh_dir(&self) -> Option<PathBuf> {
        return self.ssh_dir.lock().unwrap().clone();
    }
}

impl SetSshDir for SessionManager {
    fn set_ssh_dir(&self, dir: PathBuf) {
        *self.ssh_dir.lock().unwrap() = Some(dir);
    }
}
