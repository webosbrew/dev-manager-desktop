use std::collections::HashMap;
use std::sync::{Arc, Mutex, RwLock, Weak};

use russh::Channel;
use russh::client::Msg;
use serde::Serialize;
use tokio::sync::Mutex as AsyncMutex;
use uuid::Uuid;
use vt100::Parser;

use connection::Connection;

use crate::session_manager::connection::ConnectionsMap;

mod connection;
mod device;
mod error;
mod handler;
mod manager;
mod shell;

#[derive(Default)]
pub struct SessionManager {
    pub(crate) shells: RwLock<HashMap<ShellToken, Arc<Shell>>>,
    connections: Arc<Mutex<ConnectionsMap>>,
}

pub struct Shell {
    pub token: ShellToken,
    connection: Weak<Connection>,
    pub(crate) channel: Mutex<Channel<Msg>>,
    pub(crate) parser: Mutex<Parser>,
}

pub struct Proc {
    pub(crate) command: String,
    pub(crate) ch: AsyncMutex<Option<Channel<Msg>>>,
}

#[derive(Clone, Serialize)]
pub struct ProcData {
    pub index: u64,
    pub data: Vec<u8>,
}

#[derive(PartialEq, Eq, Hash, Clone, Debug)]
pub struct ShellToken {
    pub connection_id: Uuid,
    pub channel_id: String,
}

#[derive(Clone, Serialize, Debug)]
pub struct ShellBuffer {
    rows: Vec<Vec<u8>>,
    cursor: (u16, u16),
}

#[derive(Debug, Serialize, Clone)]
pub struct Error {
    pub message: String,
    #[serde(flatten)]
    pub kind: ErrorKind,
}

#[derive(Debug, Serialize, Clone)]
#[serde(untagged)]
pub enum ErrorKind {
    Message,
    Unimplemented,
    NeedsReconnect,
    Authorization,
    ExitStatus {
        status: u32,
        output: Vec<u8>,
    },
}
