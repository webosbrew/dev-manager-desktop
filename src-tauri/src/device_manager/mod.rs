use std::env;
use std::fs::File;
use std::io::{BufReader, Error as IoError, ErrorKind};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::device_manager::io::{read, write};

mod error;
mod io;
mod manager;

#[derive(PartialEq, Eq, Hash)]
pub struct DeviceSessionToken {
    pub name: String,
    pub id: Option<String>,
}

pub struct DeviceManager {
    devices: Mutex<Vec<Device>>,
}

impl Default for DeviceManager {
    fn default() -> Self {
        return DeviceManager {
            devices: Mutex::new(Vec::new()),
        };
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PrivateKey {
    #[serde(rename = "openSsh")]
    pub open_ssh: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Device {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<String>,
    pub default: bool,
    pub profile: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub host: String,
    pub port: u16,
    pub username: String,
    #[serde(rename = "privateKey", skip_serializing_if = "Option::is_none")]
    pub private_key: Option<PrivateKey>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub files: Option<DeviceFileTransfer>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub passphrase: Option<String>,
    #[serde(rename = "logDaemon", skip_serializing_if = "Option::is_none")]
    pub log_daemon: Option<String>,
    #[serde(
        rename = "noPortForwarding",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub no_port_forwarding: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub indelible: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum DeviceFileTransfer {
    #[serde(rename = "stream")]
    Stream,
    #[serde(rename = "sftp")]
    Sftp,
}

#[derive(Debug, Serialize, Clone)]
pub struct Error {
    message: String,
}
