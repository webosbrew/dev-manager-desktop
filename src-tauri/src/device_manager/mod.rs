use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::app_dirs::DirSlot;

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
    pub ssh_dir: DirSlot,
    pub conf_dir: DirSlot,
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
