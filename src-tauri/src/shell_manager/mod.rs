use std::sync::mpsc::Sender;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use serde::Serialize;
use uuid::Uuid;
use vt100::Parser;

use crate::device_manager::Device;
use crate::shell_manager::shell::ShellsMap;

pub(crate) mod manager;
pub(crate) mod shell;
pub(crate) mod token;

#[derive(Default)]
pub struct ShellManager {
    pub(crate) shells: Arc<Mutex<ShellsMap>>,
}

pub struct Shell {
    pub token: ShellToken,
    created_at: Instant,
    device: Device,
    has_pty: bool,
    pub(crate) sender: Mutex<Option<Sender<ShellMessage>>>,
    pub(crate) callback: Mutex<Option<Box<dyn ShellCallback + Send + Sync>>>,
    pub(crate) parser: Mutex<Parser>,
    pub(crate) shells: Arc<Mutex<ShellsMap>>,
}

pub trait ShellCallback {
    fn info(&self, info: ShellInfo);
    fn rx(&self, data: &[u8]);
    fn closed(&self);
}

#[derive(PartialEq, Eq, Hash, Clone, Debug)]
pub struct ShellToken(Uuid);

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

pub(crate) enum ShellMessage {
    Data(Vec<u8>),
    Resize { rows: u16, cols: u16 },
    Close,
}
