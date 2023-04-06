use crate::device_manager::Device;
use crate::error::Error;
use libssh_rs::Session;
use r2d2::{Pool, PooledConnection};
use std::sync::{Arc, Mutex};
use uuid::Uuid;

pub mod connection;
pub mod pool;

pub struct DeviceConnection {
    id: Uuid,
    device: Device,
    session: Session,
    last_ok: Mutex<bool>,
}

pub type ManagedDeviceConnection = PooledConnection<DeviceConnectionManager>;

pub struct DeviceConnectionPool {
    inner: Pool<DeviceConnectionManager>,
    last_error: Arc<Mutex<Option<Error>>>,
}

pub struct DeviceConnectionManager {
    device: Device,
}
