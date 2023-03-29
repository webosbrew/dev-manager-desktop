use std::collections::HashMap;
use std::sync::{Arc, Condvar, Mutex};

use serde::Serialize;

use crate::conn_pool::{DeviceConnectionPool, ManagedDeviceConnection};
use crate::device_manager::Device;

mod manager;
mod proc;
pub(crate) mod spawned;

#[derive(Default)]
pub struct SessionManager {
    pools: Mutex<HashMap<String, DeviceConnectionPool>>,
}

pub struct Proc {
    pub(crate) device: Device,
    pub(crate) command: String,
    pub(crate) callback: Mutex<Option<Box<dyn SpawnedCallback + Send>>>,
    pub(crate) ready: Arc<(Mutex<bool>, Condvar)>,
    pub(crate) interrupted: Mutex<bool>,
    pub(crate) session: Mutex<Option<ManagedDeviceConnection>>,
}

#[derive(Clone, Serialize)]
pub struct ProcData {
    pub fd: u32,
    pub data: Vec<u8>,
}

pub trait SpawnedCallback {
    fn rx(&self, fd: u32, data: &[u8]);
}
