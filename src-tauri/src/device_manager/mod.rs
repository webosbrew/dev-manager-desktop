use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

mod device;
#[cfg(not(feature = "karma"))]
mod io;
mod manager;
mod novacom;
mod privkey;

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
#[serde(untagged)]
pub enum PrivateKey {
    Path {
        #[serde(rename = "openSsh")]
        name: String,
    },
    Data {
        #[serde(rename = "openSshData")]
        data: String,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PrivateKeyInfo {
    pub sha1: String,
    pub sha256: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Device {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<bool>,
    pub profile: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub host: String,
    pub port: u16,
    pub username: String,
    #[serde(default, skip_serializing)]
    pub(crate) new: bool,
    #[serde(rename = "privateKey", skip_serializing_if = "Option::is_none")]
    pub private_key: Option<PrivateKey>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub files: Option<DeviceFileTransfer>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub passphrase: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
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

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DeviceCheckConnection {
    pub ssh_22: bool,
    pub ssh_9922: bool,
    pub key_server: bool,
}

#[cfg(feature = "karma")]
mod io {
    use crate::device_manager::Device;
    use crate::error::Error;
    use std::path::Path;
    use std::sync::LazyLock;
    use tokio::sync::Mutex;

    static DEVICES: LazyLock<Mutex<Vec<Device>>> = LazyLock::new(Default::default);

    pub(crate) async fn read(_conf_dir: &Path) -> Result<Vec<Device>, Error> {
        Ok(DEVICES.lock().await.clone())
    }

    pub(crate) async fn write(devices: Vec<Device>, _conf_dir: &Path) -> Result<(), Error> {
        *DEVICES.lock().await = devices;
        Ok(())
    }
}
