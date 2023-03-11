use crate::conn_pool::{DeviceConnectionManager, DeviceConnectionPool};
use crate::device_manager::Device;
use crate::error::Error;
use r2d2::{
    CustomizeConnection, HandleError, LoggingErrorHandler, ManageConnection,
    NopConnectionCustomizer, Pool, PooledConnection,
};
use ssh2::{BlockDirections, Session, TraceFlags};
use std::fmt::{Debug, Formatter};
use std::net::TcpStream;
use std::ops::BitXor;
use std::sync::{Arc, Mutex};

impl DeviceConnectionPool {
    pub fn new(device: Device) -> DeviceConnectionPool {
        let last_error = Arc::<Mutex<Option<Error>>>::default();
        let inner = Pool::<DeviceConnectionManager>::builder()
            .max_size(5)
            .error_handler(Box::new(DeviceConnectionErrorHandler {
                last_error: last_error.clone(),
            }))
            .build_unchecked(DeviceConnectionManager { device });
        return DeviceConnectionPool { inner, last_error };
    }

    pub fn get(&self) -> Result<PooledConnection<DeviceConnectionManager>, Error> {
        return match self.inner.get() {
            Ok(c) => {
                c.set_blocking(true);
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
    type Connection = Session;
    type Error = Error;

    fn connect(&self) -> Result<Self::Connection, Self::Error> {
        let mut session = Session::new()?;
        let tcp = TcpStream::connect(format!("{}:{}", self.device.host, self.device.port))?;
        session.trace(TraceFlags::all().bitxor(TraceFlags::TRANS));
        session.set_tcp_stream(tcp);
        session.handshake()?;

        let passphrase = self.device.valid_passphrase();
        let priv_key = self
            .device
            .private_key
            .clone()
            .map(|k| k.content().unwrap())
            .unwrap();
        session.userauth_pubkey_memory(
            &self.device.username,
            None,
            &priv_key,
            passphrase.as_ref().map(|x| &**x),
        )?;
        return Ok(session);
    }

    fn is_valid(&self, conn: &mut Self::Connection) -> Result<(), Self::Error> {
        conn.set_blocking(true);
        conn.keepalive_send()?;
        return Ok(());
    }

    fn has_broken(&self, conn: &mut Self::Connection) -> bool {
        return false;
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

impl Clone for DeviceConnectionPool {
    fn clone(&self) -> Self {
        return DeviceConnectionPool {
            inner: self.inner.clone(),
            last_error: self.last_error.clone(),
        };
    }
}
