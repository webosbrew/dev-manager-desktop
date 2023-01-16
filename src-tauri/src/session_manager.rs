use std::collections::HashMap;
use std::error::Error as ErrorTrait;
use std::io::{Error, ErrorKind, Read};
use std::net::TcpStream;
use std::sync::{Arc, Mutex, MutexGuard, RwLock};
use std::thread;

use rand::{Rng, thread_rng};
use rand::distributions::Alphanumeric;
use serde::{Deserialize, Serialize};
use ssh2::{Channel, ExtendedData, Session};
use tauri::{AppHandle, Manager, Runtime};
use tauri::api::path::home_dir;

use crate::device_manager::Device;
use crate::shell_events::Message;

#[derive(PartialEq, Eq, Hash, Clone, Serialize, Deserialize, Debug)]
pub struct ShellSessionToken {
  pub name: String,
  pub id: String,
}

pub struct ShellSession {
  token: ShellSessionToken,
  session: Session,
  channel: Mutex<Channel>,
}

pub struct SessionManager {
  cmds: Arc<RwLock<HashMap<String, Arc<Session>>>>,
  shells: Arc<RwLock<HashMap<ShellSessionToken, Arc<ShellSession>>>>,
}

impl Default for SessionManager {
  fn default() -> Self {
    return SessionManager {
      cmds: Arc::new(RwLock::new(HashMap::new())),
      shells: Arc::new(RwLock::new(HashMap::new())),
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

  pub async fn shell_open<R: Runtime>(&self, device: &Device, app: AppHandle<R>)
                                      -> Result<ShellSessionToken, Error> {
    let token = ShellSessionToken {
      name: String::from(&device.name),
      id: thread_rng()
        .sample_iter(&Alphanumeric)
        .take(10)
        .map(char::from)
        .collect(),
    };

    let mut sessions = self.shells.write().unwrap();

    let session = SessionManager::create_session(device, "shell")?;
    session.set_keepalive(true, 25);

    let channel = session.channel_session()?;
    let shell = Arc::new(ShellSession {
      token: token.clone(),
      session,
      channel: Mutex::new(channel),
    });
    sessions.insert(token.clone(), shell.clone());
    let tokens: Vec<ShellSessionToken> = sessions.keys().cloned().collect();
    app.emit_all("shells-updated", tokens).unwrap();
    app.emit_all("shell-opened", &token).unwrap();

    thread::spawn(move || {
      let shell = shell.clone();
      let token = shell.token.clone();
      SessionManager::shell_worker(shell, &app).expect("");
      app.emit_all("shell-closed", &token).unwrap();
    });
    return Ok(token);
  }

  pub async fn shell_do<F: FnOnce(MutexGuard<Channel>) -> Result<(), Error>>(&self, token: &ShellSessionToken, f: F) -> Result<(), Error> {
    let sessions = self.shells.read().unwrap();
    if let Some(session) = sessions.get(&token) {
      f(session.channel.lock().unwrap())?;
    }
    return Err(Error::new(ErrorKind::Other, "Shell not found"));
  }

  pub async fn shell_close<R: Runtime>(&self, token: &ShellSessionToken, app: AppHandle<R>)
                                       -> Result<(), Error> {
    let mut sessions = self.shells.write().unwrap();
    if let Some(session) = sessions.remove(&token) {
      session.close()?;
      log::debug!("Closed shell {} for {}", &token.id, &token.name);
      let tokens: Vec<ShellSessionToken> = sessions.keys().cloned().collect();
      log::debug!("shells: {:?}", tokens);
      app.emit_all("shells-updated", tokens).unwrap();
    }
    return Ok(());
  }

  pub fn shells_list(&self) -> Vec<ShellSessionToken> {
    return self.shells.read().unwrap().keys().cloned().collect();
  }

  fn remove_cmd(&self, device: &Device) {
    let mut sessions = self.cmds.write().unwrap();
    if sessions.remove(&device.name).is_some() {
      log::debug!("Dropped dead connection for {}", device.name);
    }
  }

  fn create_session(device: &Device, session_type: &str) -> Result<Session, Error> {
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

  fn shell_worker<R: Runtime>(sh: Arc<ShellSession>, app: &AppHandle<R>)
                              -> Result<(), Error> {
    {
      let mut ch = sh.channel.lock().unwrap();
      ch.handle_extended_data(ExtendedData::Merge)?;
      ch.request_pty("xterm", None, None)?;
      ch.shell()?;
    }
    sh.session.set_blocking(false);
    loop {
      let mut buf: [u8; 1024] = [0; 1024];
      let mut ch = sh.channel.lock().unwrap();
      match ch.read(&mut buf) {
        Ok(r) => if r == 0 {
          break;
        } else {
          app.emit_all("shell-rx", Message {
            token: sh.token.clone(),
            data: buf[..r].to_vec(),
          }).unwrap();
        },
        Err(e) => match e.kind() {
          ErrorKind::WouldBlock => {
            continue;
          }
          _ => return Err(e),
        },
      };
    }
    return Ok(());
  }
}

impl ShellSession {
  pub fn close(&self) -> Result<(), Error> {
    let mut channel = self.channel.lock().unwrap();
    channel.close()?;
    channel.wait_close()?;
    return Ok(());
  }
}
