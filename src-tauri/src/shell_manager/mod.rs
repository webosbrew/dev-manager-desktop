use std::path::PathBuf;
use std::sync::mpsc::Sender;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use serde::Serialize;
use uuid::Uuid;
use vt100::Parser;

use crate::device_manager::Device;
use crate::error::Error;
use crate::shell_manager::shell::ShellsMap;
use crate::ssh_dir::GetSshDir;

pub(crate) mod manager;
pub(crate) mod shell;
pub(crate) mod token;

#[derive(Default)]
pub struct ShellManager {
    pub(crate) shells: Arc<Mutex<ShellsMap>>,
    ssh_dir: Mutex<Option<PathBuf>>,
}

pub struct Shell {
    pub token: ShellToken,
    created_at: Instant,
    device: Device,
    ssh_dir: Option<PathBuf>,
    pub(crate) has_pty: Mutex<Option<bool>>,
    pub(crate) closed: Mutex<Option<ShellState>>,
    pub(crate) sender: Mutex<Option<Sender<ShellMessage>>>,
    pub(crate) callback: Mutex<Option<Box<dyn ShellCallback + Send + Sync>>>,
    pub(crate) parser: Mutex<Parser>,
    pub(crate) shells: Arc<Mutex<ShellsMap>>,
}

pub trait ShellCallback {
    fn info(&self, info: ShellInfo);
    fn rx(&self, fd: u32, data: &[u8]);
    fn closed(&self, removed: bool);
}

#[derive(PartialEq, Eq, Hash, Clone, Debug)]
pub struct ShellToken(Uuid);

#[derive(Clone, Serialize, Debug)]
pub struct ShellInfo {
    pub token: ShellToken,
    pub title: String,
    pub state: ShellState,
    #[serde(rename = "hasPty", skip_serializing_if = "Option::is_none")]
    pub has_pty: Option<bool>,
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

pub(crate) enum ShellMessage {
    Data(Vec<u8>),
    Resize { rows: u16, cols: u16 },
    Close,
}

#[derive(Clone, Serialize, Debug)]
#[serde(tag = "which")]
pub enum ShellState {
    Connecting,
    Connected,
    Exited {
        #[serde(rename = "returnCode")]
        return_code: i32,
    },
    Error {
        error: Error,
    },
}
