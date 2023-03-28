use std::fmt::Debug;
use std::sync::{Arc, Mutex};

use libssh_rs;
use libssh_rs::{AuthStatus, LogLevel, Session, SshKey, SshOption};
use r2d2::{HandleError, LoggingErrorHandler, ManageConnection, Pool, PooledConnection};
use uuid::Uuid;

use crate::conn_pool::{DeviceConnection, DeviceConnectionManager, DeviceConnectionPool};
use crate::device_manager::Device;
use crate::error::Error;

impl DeviceConnectionPool {
    pub fn new(device: Device) -> DeviceConnectionPool {
        let last_error = Arc::<Mutex<Option<Error>>>::default();
        let inner = Pool::<DeviceConnectionManager>::builder()
            .min_idle(Some(0))
            .max_size(3)
            .error_handler(Box::new(DeviceConnectionErrorHandler {
                last_error: last_error.clone(),
            }))
            .build_unchecked(DeviceConnectionManager { device });
        return DeviceConnectionPool { inner, last_error };
    }

    pub fn get(&self) -> Result<PooledConnection<DeviceConnectionManager>, Error> {
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
        let mut session = Session::new()?;
        session.set_option(SshOption::Hostname(self.device.host.clone()))?;
        session.set_option(SshOption::Port(self.device.port.clone()))?;
        session.set_option(SshOption::User(Some(self.device.username.clone())))?;

        session.connect()?;

        let passphrase = self.device.valid_passphrase();
        let priv_key_content = self
            .device
            .private_key
            .clone()
            .map(|k| k.content().unwrap())
            .unwrap();
        let priv_key = SshKey::from_privkey_base64(&priv_key_content, passphrase.as_deref())?;

        return match session.userauth_publickey(None, &priv_key)? {
            AuthStatus::Success => Ok(DeviceConnection::new(session)),
            _ => return Err(Error::BadPassphrase),
        };
    }

    fn is_valid(&self, conn: &mut Self::Connection) -> Result<(), Self::Error> {
        if !(conn.is_connected()) {
            return Err(Error::Disconnected);
        }
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
