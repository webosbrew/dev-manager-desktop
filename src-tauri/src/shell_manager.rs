use std::collections::HashMap;
use std::io::{Error, ErrorKind, Read};
use std::sync::{Arc, Mutex, MutexGuard, RwLock};
use std::thread;

use rand::{Rng, thread_rng};
use rand::distributions::Alphanumeric;
use serde::{Deserialize, Serialize};
use ssh2::{Channel, ExtendedData, Session};
use tauri::{AppHandle, Manager, Runtime};
use vt100::Parser;

use crate::device_manager::Device;
use crate::session_manager::SessionManager;
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
  parser: Mutex<Parser>,
}

pub struct ShellManager {
  shells: Arc<RwLock<HashMap<ShellSessionToken, Arc<ShellSession>>>>,
}

impl Default for ShellManager {
  fn default() -> Self {
    return ShellManager {
      shells: Arc::new(RwLock::new(HashMap::new())),
    };
  }
}

impl ShellManager {
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
    let parser = Parser::new(24, 80, 0);
    let shell = Arc::new(ShellSession {
      token: token.clone(),
      session,
      channel: Mutex::new(channel),
      parser: Mutex::new(parser),
    });
    sessions.insert(token.clone(), shell.clone());
    let tokens: Vec<ShellSessionToken> = sessions.keys().cloned().collect();
    app.emit_all("shells-updated", tokens).unwrap();
    app.emit_all("shell-opened", &token).unwrap();

    thread::spawn(move || {
      let shell = shell.clone();
      let token = shell.token.clone();
      ShellManager::shell_worker(shell, &app).expect("");
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
          let mut parser = sh.parser.lock().unwrap();
          parser.process(&buf[..r]);
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
