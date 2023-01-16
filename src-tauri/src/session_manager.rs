use std::collections::HashMap;
use std::error::Error as ErrorTrait;
use std::io::{Error, ErrorKind};
use std::net::TcpStream;
use std::sync::{Arc, RwLock};

use ssh2::Session;
use tauri::api::path::home_dir;

use crate::device_manager::Device;

pub struct SessionManager {
  cmds: Arc<RwLock<HashMap<String, Arc<Session>>>>,
}

impl Default for SessionManager {
  fn default() -> Self {
    return SessionManager {
      cmds: Arc::new(RwLock::new(HashMap::new())),
    };
  }
}

impl SessionManager {
  pub async fn cmd_run<R, F: Fn(&Session) -> Result<R, Box<dyn ErrorTrait>>>(&self, device: &Device, f: F) -> Result<R, Error> {
    let mut retry = 0;
    while retry < 3 {
      let sess = self.obtain_cmd(device).await?;
      match f(&sess) {
        Ok(v) => return Ok(v),
        Err(e) => {
          if !e.is::<ssh2::Error>() {
            log::warn!("Other error! {:?}", e);
            return Err(Error::new(ErrorKind::Other, e.to_string()));
          }
          self.remove_cmd(device);
        }
      }
      retry += 1;
    }
    return Err(Error::new(ErrorKind::Other, "Too many attempts"));
  }

  async fn obtain_cmd(&self, device: &Device) -> Result<Arc<Session>, Error> {
    let mut sessions = self.cmds.write().unwrap();
    let option = sessions.get(&device.name);
    match option {
      Some(v) => return Ok(v.clone()),
      None => {}
    };
    let session = Self::create_session(device, "command")?;
    let arc = Arc::new(session);
    sessions.insert(device.name.clone(), arc.clone());
    return Ok(arc.clone());
  }


  fn remove_cmd(&self, device: &Device) {
    let mut sessions = self.cmds.write().unwrap();
    if sessions.remove(&device.name).is_some() {
      log::debug!("Dropped dead connection for {}", device.name);
    }
  }

  pub(crate) fn create_session(device: &Device, session_type: &str) -> Result<Session, Error> {
    let tcp = TcpStream::connect(format!("{}:{}", device.host, device.port))?;
    let mut sess: Session = Session::new()?;
    sess.set_tcp_stream(tcp);
    sess.handshake()?;
    let pubkey_path = home_dir().unwrap().join(".ssh")
      .join(&device.private_key.as_ref().unwrap().open_ssh);
    sess.userauth_pubkey_file(&device.username, None, pubkey_path.as_path(), None)?;
    log::debug!("Created {} session for {}", session_type, device.name);
    return Ok(sess);
  }
}
