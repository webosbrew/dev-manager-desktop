use std::collections::HashMap;
use std::env;
use std::error::Error as ErrorTrait;
use std::fs::File;
use std::io::{BufReader, Error};
use std::io::ErrorKind::Other;
use std::net::TcpStream;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, RwLock};

use home::home_dir;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use ssh2::Session;

pub struct DeviceManager {
  devices: Mutex<Vec<Device>>,
  sessions: Arc<RwLock<HashMap<String, Arc<Session>>>>,
}

impl Default for DeviceManager {
  fn default() -> Self {
    return DeviceManager {
      devices: Mutex::new(Vec::new()),
      sessions: Arc::new(RwLock::new(HashMap::new())),
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

  pub async fn run_with_session<R, F: Fn(&Session) -> Result<R, Box<dyn ErrorTrait>>>(&self, device: &Device, f: F) -> Result<R, Error> {
    let mut retry = 0;
    while retry < 3 {
      let sess = self.obtain_session(device).await?;
      match f(&sess) {
        Ok(v) => return Ok(v),
        Err(e) => {
          if !e.is::<ssh2::Error>() {
            log::warn!("Other error! {:?}", e);
            return Err(Error::new(Other, e.to_string()));
          }
          self.remove_session(device);
        }
      }
      retry += 1;
    }
    return Err(Error::new(Other, "Too many attempts"));
  }

  async fn obtain_session(&self, device: &Device) -> Result<Arc<Session>, Error> {
    let mut sessions = self.sessions.write().unwrap();
    let option = sessions.get(&device.name);
    match option {
      Some(v) => return Ok(v.clone()),
      None => {}
    };
    let session = Self::create_session(device)?;
    let arc = Arc::new(session);
    sessions.insert(device.name.clone(), arc.clone());
    return Ok(arc);
  }

  fn remove_session(&self, device: &Device) {
    let mut sessions = self.sessions.write().unwrap();
    if sessions.remove(&device.name).is_some() {
      log::debug!("Dropped dead connection for {}", device.name);
    }
  }

  fn create_session(device: &Device) -> Result<Session, Error> {
    let tcp = TcpStream::connect(format!("{}:{}", device.host, device.port))?;
    let mut sess: Session = Session::new()?;
    sess.set_tcp_stream(tcp);
    sess.handshake()?;
    let pubkey_path = home_dir().unwrap().join(".ssh")
      .join(&device.private_key.as_ref().unwrap().open_ssh);
    sess.userauth_pubkey_file(&device.username, None, pubkey_path.as_path(), None)?;
    log::debug!("Created session for {}", device.name);
    return Ok(sess);
  }
}
