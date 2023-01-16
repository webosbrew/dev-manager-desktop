use std::env;
use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::Value;

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
  pub name: String,
  pub description: Option<String>,
  pub host: String,
  pub port: u16,
  pub username: String,
  #[serde(default)]
  pub indelible: bool,
  pub default: bool,
  #[serde(rename = "privateKey")]
  pub private_key: Option<PrivateKey>,
  pub passphrase: Option<String>,
}

impl DeviceManager {
  pub async fn list(&self) -> Result<Vec<Device>, String> {
    let path: PathBuf;
    match env::var("APPDATA").or_else(|_| env::var("HOME"))
      .or_else(|_| env::var("USERPROFILE")) {
      Ok(val) => path = PathBuf::from(val).join(".webos").join("ose")
        .join("novacom-devices.json"),
      _err => return Err(String::from("Failed to open data path"))
    };
    let file = match File::open(path.into_os_string()) {
      Ok(f) => f,
      _err => return Err(String::from("Failed to open JSON"))
    };
    let reader = BufReader::new(file);

    let raw_list: Vec<Value> = match serde_json::from_reader(reader) {
      Ok(list) => list,
      Err(e) => return Err(format!("Bad JSON {e}")),
    };
    let devices: Vec<Device> = raw_list.iter()
      .filter_map(|v| serde_json::from_value::<Device>(v.clone()).ok())
      .collect();
    *self.devices.lock().unwrap() = devices.clone();
    return Ok(devices);
  }
}
