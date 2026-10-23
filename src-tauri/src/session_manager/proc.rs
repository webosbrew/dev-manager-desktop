use std::fmt::{Debug, Formatter};
use std::io::Write;
use std::sync::mpsc::{channel, RecvTimeoutError};
use std::thread::sleep;
use std::time::Duration;

use libssh_rs::Channel;

use crate::conn_pool::ManagedDeviceConnection;
use crate::error::Error;
use crate::session_manager::{Proc, ProcResult, SessionManager};

/// How long the loop parks waiting for stdin before polling the remote for
/// output again. Small enough to feel instant, large enough to keep a
/// long-running command off the CPU.
const POLL_INTERVAL: Duration = Duration::from_millis(10);

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
                log::info!("interrupting {}", &self.command);
                channel.request_send_signal("TERM")?;
                channel.close()?;
                interrupted = true;
                break;
            }
            // Forward everything already buffered on both streams before parking,
            // so a burst of output reaches the client in one pass.
            for (fd, is_stderr) in [(0, false), (1, true)] {
                loop {
                    let buf_size =
                        match channel.read_timeout(&mut buf, is_stderr, Some(Duration::ZERO)) {
                            Ok(size) => size,
                            Err(libssh_rs::Error::TryAgain) => 0,
                            Err(e) => return Err(Error::from(e)),
                        };
                    if buf_size == 0 {
                        break;
                    }
                    self.data(fd, &buf[..buf_size])?;
                }
            }
            // Park until there is stdin to forward or it is time to poll again.
            // The reads above are non-blocking, so this is what keeps the loop
            // from spinning while the command is running.
            match receiver.recv_timeout(POLL_INTERVAL) {
                Ok(msg) => channel.stdin().write_all(&msg)?,
                Err(RecvTimeoutError::Timeout) => {}
                // The sender lives in `self.sender` for as long as this loop
                // runs, so this is unreachable in practice; sleep rather than
                // spin if it ever becomes reachable.
                Err(RecvTimeoutError::Disconnected) => sleep(POLL_INTERVAL),
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
