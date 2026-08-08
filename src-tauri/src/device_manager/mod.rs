use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

mod manager;
pub mod privkey;

// Device, its key and its file transfer mode are shared with the ares-cli-rs
// tools. Reading and writing the device list is shared too, through
// ares_device_lib::DeviceManager. Only how a key name is resolved differs,
// which lives in privkey.rs.
pub use ares_device_lib::{Device, FileTransfer as DeviceFileTransfer, PrivateKey};

#[derive(PartialEq, Eq, Hash)]
pub struct DeviceSessionToken {
    pub name: String,
    pub id: Option<String>,
}

#[derive(Default)]
pub struct DeviceManager {
    ssh_dir: Mutex<Option<PathBuf>>,
    conf_dir: Mutex<Option<PathBuf>>,
    devices: Mutex<Vec<Device>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PrivateKeyInfo {
    pub sha1: String,
    pub sha256: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DeviceCheckConnection {
    pub ssh_22: bool,
    pub ssh_9922: bool,
    pub key_server: bool,
}
