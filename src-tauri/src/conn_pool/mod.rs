use crate::device_manager::Device;
use crate::error::Error;
use libssh_rs::Session;
use r2d2::{Pool, PooledConnection};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

pub mod connection;
pub mod pool;

pub struct DeviceConnection {
    id: Uuid,
    pub device: Device,
    pub user: Option<DeviceConnectionUserInfo>,
    session: Session,
    last_ok: Mutex<bool>,
}

#[derive(Debug)]
pub struct DeviceConnectionUserInfo {
    pub uid: Id,
    pub gid: Id,
    pub groups: Vec<Id>,
}

pub struct Id {
    pub id: u32,
    pub name: Option<String>,
}

pub type ManagedDeviceConnection = PooledConnection<DeviceConnectionManager>;

pub struct DeviceConnectionPool {
    inner: Pool<DeviceConnectionManager>,
    last_error: Arc<Mutex<Option<Error>>>,
}

pub struct DeviceConnectionManager {
    device: Device,
    ssh_dir: Option<PathBuf>,
}
