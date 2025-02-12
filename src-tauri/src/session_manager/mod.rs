use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::mpsc::Sender;
use std::sync::{Arc, Condvar, Mutex};

use serde::Serialize;

use crate::conn_pool::DeviceConnectionPool;
use crate::device_manager::Device;

mod manager;
mod proc;

#[derive(Default)]
pub struct SessionManager {
    ssh_dir: Mutex<Option<PathBuf>>,
    pools: Mutex<HashMap<String, DeviceConnectionPool>>,
}

pub struct Proc {
    pub(crate) device: Device,
    pub(crate) command: String,
    pub(crate) callback: Mutex<Option<Box<dyn ProcCallback + Send>>>,
    pub(crate) ready: Arc<(Mutex<bool>, Condvar)>,
    pub(crate) sender: Mutex<Option<Sender<Vec<u8>>>>,
    pub(crate) interrupted: Mutex<bool>,
}

#[derive(Clone, Serialize)]
pub struct ProcData {
    pub fd: u32,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "type")]
pub enum ProcResult {
    Exit {
        status: i32,
    },
    Signal {
        signal: Option<String>,
        core_dumped: bool,
    },
    Closed,
}

pub trait ProcCallback {
    fn rx(&self, fd: u32, data: &[u8]);
}
