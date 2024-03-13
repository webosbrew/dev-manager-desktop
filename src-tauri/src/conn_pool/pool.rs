use std::fmt::Debug;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use r2d2::{HandleError, ManageConnection, Pool};

use crate::conn_pool::{
    DeviceConnection, DeviceConnectionManager, DeviceConnectionPool, ManagedDeviceConnection,
};
use crate::device_manager::Device;
use crate::error::Error;

impl DeviceConnectionPool {
    pub fn new(device: Device, ssh_dir: Option<PathBuf>) -> DeviceConnectionPool {
        let last_error = Arc::<Mutex<Option<Error>>>::default();
        let inner = Pool::<DeviceConnectionManager>::builder()
            .min_idle(Some(0))
            .max_size(3)
            .idle_timeout(Some(Duration::from_secs(900)))
            .error_handler(Box::new(DeviceConnectionErrorHandler {
                last_error: last_error.clone(),
            }))
            .build_unchecked(DeviceConnectionManager { device, ssh_dir });
        return DeviceConnectionPool { inner, last_error };
    }

    pub fn get(&self) -> Result<ManagedDeviceConnection, Error> {
        return match self.inner.get() {
            Ok(c) => {
                c.reset_last_ok();
                Ok(c)
            }
            Err(_) => Err(self
                .last_error
                .lock()
                .unwrap()
                .take()
                .unwrap_or(Error::Timeout)),
        };
    }
}

impl ManageConnection for DeviceConnectionManager {
    type Connection = DeviceConnection;
    type Error = Error;

    fn connect(&self) -> Result<Self::Connection, Self::Error> {
        return DeviceConnection::new(self.device.clone(), self.ssh_dir.as_deref());
    }

    fn is_valid(&self, _: &mut Self::Connection) -> Result<(), Self::Error> {
        return Ok(());
    }

    fn has_broken(&self, conn: &mut Self::Connection) -> bool {
        if !conn.is_connected() {
            return true;
        }
        return conn.last_ok.lock().unwrap().eq(&false);
    }
}

#[derive(Debug)]
struct DeviceConnectionErrorHandler {
    last_error: Arc<Mutex<Option<Error>>>,
}

impl HandleError<Error> for DeviceConnectionErrorHandler {
    fn handle_error(&self, error: Error) {
        *self.last_error.lock().unwrap() = Some(error);
    }

    fn can_retry(&self, error: &Error, num_retries: u32) -> bool {
        if *error == Error::Disconnected {
            return num_retries < 3;
        }
        return false;
    }
}

#[derive(Debug)]
struct DeviceConnectionCustomizer {}

impl Clone for DeviceConnectionPool {
    fn clone(&self) -> Self {
        return DeviceConnectionPool {
            inner: self.inner.clone(),
            last_error: self.last_error.clone(),
        };
    }
}
