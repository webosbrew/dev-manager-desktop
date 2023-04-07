use crate::conn_pool::{DeviceConnectionManager, ManagedDeviceConnection};
use libssh_rs::Channel;
use r2d2::PooledConnection;
use std::fmt::{Debug, Formatter};
use std::time::Duration;

use crate::error::Error;
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

    pub fn start(&self) -> Result<(), Error> {
        let (lock, cvar) = &*self.ready;
        let mut ready = lock.lock().unwrap();
        while !*ready {
            ready = cvar.wait(ready).unwrap();
        }
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

    pub fn wait_close(&self, sessions: &SessionManager) -> Result<i32, Error> {
        let session: ManagedDeviceConnection;
        let channel: Channel;
        loop {
            let conn = sessions.session(self.device.clone())?;
            let open = || {
                let ch = conn.new_channel()?;
                ch.open_session()?;
                Ok(ch)
            };
            match open() {
                Ok(ch) => {
                    session = conn;
                    channel = ch;
                    break;
                }
                Err(Error::Disconnected) => continue,
                Err(e) => return Err(e),
            };
        }
        channel.request_exec(&self.command)?;
        let mut buf = [0; 8192];
        while !channel.is_closed() {
            if self.interrupted.lock().unwrap().eq(&true) {
                channel.request_send_signal("TERM")?;
                channel.close()?;
                break;
            }
            let buf_size =
                match channel.read_timeout(&mut buf, false, Some(Duration::from_millis(10))) {
                    Ok(len) => len,
                    Err(e) => {
                        log::error!("{self:?} error {e:?}");
                        break;
                    }
                };
            if buf_size > 0 {
                self.data(&buf[..buf_size])?;
            }
        }
        log::debug!("{self:?} channel closed");
        session.mark_last_ok();
        return Ok(channel.get_exit_status().unwrap_or(-1));
    }
}

impl Debug for Proc {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_fmt(format_args!(
            "Proc {{ command={}, device.name={} }}",
            self.command, self.device.name
        ))
    }
}
