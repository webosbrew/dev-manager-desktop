use std::fmt::{Debug, Formatter};
use std::io::Write;
use std::sync::mpsc::channel;
use std::time::Duration;

use libssh_rs::Channel;

use crate::conn_pool::ManagedDeviceConnection;
use crate::error::Error;
use crate::session_manager::{Proc, ProcResult, SessionManager};

impl Proc {
    pub fn is_ready(&self) -> bool {
        let (lock, _cvar) = &*self.ready;
        lock.lock().unwrap().clone()
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
        Ok(())
    }

    pub fn interrupt(&self) {
        *self.interrupted.lock().unwrap() = true;
    }

    pub fn data(&self, fd: u32, data: &[u8]) -> Result<(), Error> {
        if let Some(cb) = self.callback.lock().unwrap().as_ref() {
            cb.rx(fd, data);
            return Ok(());
        }
        Err(Error::Disconnected)
    }

    pub fn write(&self, data: Vec<u8>) -> Result<(), Error> {
        if let Some(sender) = self.sender.lock().unwrap().as_ref() {
            if let Ok(_) = sender.send(data) {
                return Ok(());
            }
            return Ok(());
        }
        Err(Error::Disconnected)
    }

    pub fn wait_close(&self, sessions: &SessionManager) -> Result<ProcResult, Error> {
        let session: ManagedDeviceConnection;
        let (sender, receiver) = channel::<Vec<u8>>();
        *self.sender.lock().unwrap() = Some(sender);
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
        let mut interrupted = false;
        while !channel.is_closed() && !channel.is_eof() {
            if self.interrupted.lock().unwrap().eq(&true) {
                channel.send_eof()?;
                log::info!("interrupting luna-send");
                channel.request_send_signal("TERM")?;
                channel.close()?;
                interrupted = true;
                break;
            } else if let Ok(msg) = receiver.recv_timeout(Duration::from_micros(1)) {
                channel.stdin().write_all(&msg)?;
            }
            let buf_size =
                channel.read_timeout(&mut buf, false, Some(Duration::from_millis(10)))?;
            if buf_size > 0 {
                self.data(0, &buf[..buf_size])?;
            }
            let buf_size = channel.read_timeout(&mut buf, true, Some(Duration::from_millis(10)))?;
            if buf_size > 0 {
                self.data(1, &buf[..buf_size])?;
            }
        }
        let mut result = ProcResult::Closed;
        if interrupted {
            log::debug!("{self:?} channel interrupted by client");
            result = ProcResult::Signal {
                signal: Some(String::from("INT")),
                core_dumped: false,
            };
        } else if let Some(status) = channel.get_exit_status() {
            log::debug!("{self:?} channel closed with status {status}");
            result = ProcResult::Exit { status };
        } else if let Some(signal) = channel.get_exit_signal() {
            log::debug!("{self:?} channel closed with signal {signal:?}");
            result = ProcResult::Signal {
                signal: signal.signal_name,
                core_dumped: signal.core_dumped,
            };
        } else {
            log::debug!("{self:?} channel closed with unknown status");
        }
        session.mark_last_ok();
        Ok(result)
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
