use r2d2::{ManageConnection, PooledConnection};
use std::collections::HashMap;
use std::sync::{Arc, Condvar, Mutex};
use std::time::Instant;

use crate::conn_pool::{DeviceConnectionManager, DeviceConnectionPool};
use crate::device_manager::Device;
use crate::error::Error;
use serde::Serialize;
use tauri::{AppHandle, Runtime};
use tokio::sync::mpsc::UnboundedSender;
use tokio::sync::Mutex as AsyncMutex;
use uuid::Uuid;
use vt100::Parser;

use crate::session_manager::shell::ShellsMap;

mod manager;
mod proc;
mod shell;
pub(crate) mod spawned;

#[derive(Default)]
pub struct SessionManager {
    lock: AsyncMutex<()>,
    pub(crate) shells: Arc<Mutex<ShellsMap>>,
    pools: Mutex<HashMap<String, DeviceConnectionPool>>,
}

pub struct Proc {
    pub(crate) device: Device,
    pub(crate) command: String,
    pub(crate) callback: Mutex<Option<Box<dyn SpawnedCallback + Send>>>,
    pub(crate) ready: Arc<(Mutex<bool>, Condvar)>,
}

#[derive(Clone, Serialize)]
pub struct ProcData {
    pub fd: u32,
    pub data: Vec<u8>,
}

pub struct Shell {
    pub token: ShellToken,
    created_at: Instant,
    def_title: String,
    has_pty: bool,
    pub(crate) callback: Mutex<Option<Box<dyn ShellCallback + Send + Sync>>>,
    pub(crate) parser: Mutex<Parser>,
}

pub trait SpawnedCallback {
    fn rx(&self, fd: u32, data: &[u8]);
}

pub trait ShellCallback: SpawnedCallback {
    fn info(&self, info: ShellInfo);
}

#[derive(PartialEq, Eq, Hash, Clone, Debug)]
pub struct ShellToken {
    pub connection_id: Uuid,
    pub channel_id: String,
}

#[derive(Clone, Serialize, Debug)]
pub struct ShellInfo {
    pub token: ShellToken,
    pub title: String,
    #[serde(rename = "hasPty")]
    pub has_pty: bool,
    #[serde(skip_serializing)]
    created_at: Instant,
}

#[derive(Hash, Clone, Debug, Serialize)]
pub struct ShellData {
    pub token: ShellToken,
    pub fd: u32,
    pub data: Vec<u8>,
}

#[derive(Clone, Serialize, Debug)]
pub struct ShellScreen {
    rows: Option<Vec<Vec<u8>>>,
    data: Option<Vec<u8>>,
    cursor: (u16, u16),
}
