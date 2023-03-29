use r2d2::{ManageConnection, PooledConnection};
use std::collections::HashMap;
use std::sync::{Arc, Condvar, Mutex};
use std::time::Instant;

use crate::conn_pool::{DeviceConnectionManager, DeviceConnectionPool, ManagedDeviceConnection};
use crate::device_manager::Device;
use crate::error::Error;
use serde::Serialize;
use tauri::{AppHandle, Runtime};
use tokio::sync::mpsc::UnboundedSender;
use tokio::sync::Mutex as AsyncMutex;
use uuid::Uuid;
use vt100::Parser;

use crate::shell_manager::shell::ShellsMap;

mod manager;
mod proc;
pub(crate) mod spawned;

#[derive(Default)]
pub struct SessionManager {
    lock: AsyncMutex<()>,
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
