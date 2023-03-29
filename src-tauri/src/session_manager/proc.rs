use async_trait::async_trait;
use libssh_rs::SshResult;
use std::ops::{Deref, DerefMut};
use std::time::Duration;
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};
use tokio::sync::MutexGuard;

use crate::error::Error;
use crate::session_manager::spawned::{SpawnResult, Spawned};
use crate::session_manager::{Proc, SessionManager};

impl Proc {
    pub fn is_ready(&self) -> bool {
        let (lock, _cvar) = &*self.ready;
        return lock.lock().unwrap().clone();
    }

    pub fn notify_ready(&self) {
        let (lock, cvar) = &*self.ready;
        let mut ready = lock.lock().unwrap();
        *ready = true;
        cvar.notify_one();
    }

    pub fn start(&self, sessions: &SessionManager) -> Result<(), Error> {
        let (lock, cvar) = &*self.ready;
        let mut ready = lock.lock().unwrap();
        while !*ready {
            ready = cvar.wait(ready).unwrap();
        }
        *self.session.lock().unwrap() = Some(sessions.session(self.device.clone())?);
        return Ok(());
    }

    pub fn interrupt(&self) {
        *self.interrupted.lock().unwrap() = true;
    }

    pub fn data(&self, data: &[u8]) -> Result<(), Error> {
        if let Some(cb) = self.callback.lock().unwrap().as_ref() {
            cb.rx(0, data);
            return Ok(());
        }
        return Err(Error::Disconnected);
    }
}

impl Spawned for Proc {
    fn wait_close(&self) -> Result<SpawnResult, Error> {
        let mut guard = self.session.lock().unwrap();
        if guard.is_none() {
            return Err(Error::Disconnected);
        }
        let mut session = guard.as_mut().unwrap();
        let mut channel = session.new_channel()?;
        channel.open_session()?;
        channel.request_exec(&self.command)?;
        let mut buf = [0; 8192];
        let mut buf_size: usize = 0;
        while !channel.is_closed() {
            if self.interrupted.lock().unwrap().eq(&true) {
                channel.request_send_signal("TERM")?;
                channel.close()?;
                break;
            }
            match channel.read_timeout(&mut buf, false, Some(Duration::from_millis(10))) {
                Ok(len) => buf_size = len,
                Err(e) => {
                    log::error!("Proc error {:?}", e);
                    break;
                }
            }
            if buf_size > 0 {
                self.data(&buf[..buf_size])?;
            }
        }
        log::info!("Proc channel closed");
        session.mark_last_ok();
        return Ok(SpawnResult::Exit {
            status: channel.get_exit_status().unwrap_or(0) as u32,
        });
    }
}
