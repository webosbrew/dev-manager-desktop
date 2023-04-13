use std::collections::HashMap;
use std::fmt::{Debug, Formatter};
use std::future::Future;
use std::io::Write;
use std::ops::Deref;
use std::sync::mpsc::channel;
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use libssh_rs::Error::RequestDenied;
use vt100::Parser;

use crate::conn_pool::DeviceConnection;
use crate::device_manager::Device;
use crate::error::Error;
use crate::shell_manager::{Shell, ShellInfo, ShellMessage, ShellScreen, ShellState, ShellToken};

pub(crate) type ShellsMap = HashMap<ShellToken, Arc<Shell>>;

impl Shell {
    pub fn write(&self, data: &[u8]) -> Result<(), Error> {
        return self.queue_message(ShellMessage::Data(Vec::from(data)));
    }

    pub fn resize(&self, rows: u16, cols: u16) -> Result<(), Error> {
        if !self.has_pty.lock().unwrap().unwrap_or(false) {
            return Err(Error::Unsupported);
        }
        self.parser.lock().unwrap().set_size(rows, cols);
        log::info!("{self:?} resized. rows = {}, cols = {}", rows, cols);
        return self.queue_message(ShellMessage::Resize { rows, cols });
    }

    pub fn screen(&self, cols: u16) -> Result<ShellScreen, Error> {
        if !self.has_pty.lock().unwrap().unwrap_or(false) {
            return Err(Error::Unsupported);
        }
        let guard = self.parser.lock().unwrap();
        let screen = guard.screen();
        let (_, screen_cols) = screen.size();
        if cols == screen_cols {
            return Ok(ShellScreen {
                rows: None,
                data: Some(screen.contents_formatted()),
                cursor: screen.cursor_position(),
            });
        }
        let mut rows: Vec<Vec<u8>> = screen.rows_formatted(0, cols).collect();
        if let Some(idx) = rows.iter().rposition(|row| !row.is_empty()) {
            rows = Vec::from(&rows[0..idx + 1]);
        } else {
            rows = Vec::new();
        }
        for x in &mut rows {
            x.extend(b"\x1b\x5b\x30\x6d");
        }
        return Ok(ShellScreen {
            rows: Some(rows),
            data: None,
            cursor: screen.cursor_position(),
        });
    }

    pub fn close(&self) -> Result<(), Error> {
        self.queue_message(ShellMessage::Close)?;
        return Ok(());
    }

    pub fn info(&self) -> ShellInfo {
        let state: ShellState = if let Some(s) = self.closed.lock().unwrap().as_ref() {
            s.clone()
        } else if self.sender.lock().unwrap().is_some() {
            ShellState::Connected
        } else {
            ShellState::Connecting
        };
        return ShellInfo {
            token: self.token.clone(),
            title: self.title(),
            has_pty: self.has_pty.lock().unwrap().clone(),
            state,
            created_at: self.created_at,
        };
    }

    pub(crate) fn new(
        device: Device,
        wants_pty: bool,
        rows: u16,
        cols: u16,
        shells: Arc<Mutex<ShellsMap>>,
    ) -> Self {
        let shell = Self {
            token: ShellToken::new(),
            created_at: Instant::now(),
            device,
            has_pty: Mutex::new(if !wants_pty { Some(false) } else { None }),
            closed: Mutex::default(),
            sender: Mutex::default(),
            callback: Mutex::new(None),
            parser: Mutex::new(Parser::new(rows, cols, 1000)),
            shells,
        };
        log::info!("{shell:?} created: rows={rows}, cols={cols}");
        return shell;
    }

    fn process(&self, data: &[u8]) -> bool {
        if !self.has_pty.lock().unwrap().unwrap_or(false) {
            return false;
        }
        let mut parser = self.parser.lock().unwrap();
        let old = parser.screen().clone();
        parser.process(data);
        return !parser.screen().title_diff(&old).is_empty();
    }

    fn title(&self) -> String {
        let guard = self.parser.lock().unwrap();
        let title = guard.screen().title();
        if title.is_empty() {
            return format!("{}@{}", self.device.username, self.device.host);
        }
        return String::from(title);
    }

    fn queue_message(&self, message: ShellMessage) -> Result<(), Error> {
        if let Some(sender) = self.sender.lock().unwrap().as_ref() {
            if let Ok(_) = sender.send(message) {
                return Ok(());
            }
        }
        return Err(Error::Disconnected);
    }

    fn worker(&self) -> Result<i32, Error> {
        let (sender, receiver) = channel::<ShellMessage>();
        let connection = DeviceConnection::new(self.device.clone())?;
        let channel = connection.new_channel()?;
        channel.open_session()?;
        let (rows, cols) = self.parser.lock().unwrap().screen().size();
        let mut has_pty = false;
        if self.has_pty.lock().unwrap().unwrap_or(true) {
            match channel.request_pty("xterm", cols as u32, rows as u32) {
                Ok(_) => {
                    *self.has_pty.lock().unwrap() = {
                        has_pty = true;
                        Some(true)
                    }
                }
                Err(RequestDenied(s)) => {
                    *self.has_pty.lock().unwrap() = Some(false);
                    log::warn!("{self:?} failed to request pty {s:?}");
                }
                e => e?,
            }
        }
        channel.request_shell()?;
        *self.sender.lock().unwrap() = Some(sender);
        if let Some(callback) = self.callback.lock().unwrap().as_ref() {
            callback.info(self.info());
        }
        let mut buf = [0; 8192];
        while !channel.is_closed() {
            if let Ok(msg) = receiver.recv_timeout(Duration::from_micros(1)) {
                match msg {
                    ShellMessage::Data(d) => {
                        channel.stdin().write_all(&d)?;
                    }
                    ShellMessage::Resize { rows, cols } => {
                        channel.change_pty_size(cols as u32, rows as u32)?;
                    }
                    ShellMessage::Close => {
                        channel.close()?;
                        break;
                    }
                }
            }
            let size = channel.read_timeout(&mut buf, false, Some(Duration::from_micros(5)))?;
            if size != 0 {
                if let Some(callback) = self.callback.lock().unwrap().as_ref() {
                    callback.rx(0, &buf[..size]);
                }
                if self.process(&buf[..size]) {
                    if let Some(callback) = self.callback.lock().unwrap().as_ref() {
                        callback.info(self.info());
                    }
                }
            }
            if !has_pty {
                let size = channel.read_timeout(&mut buf, true, Some(Duration::from_micros(5)))?;
                if size != 0 {
                    if let Some(callback) = self.callback.lock().unwrap().as_ref() {
                        callback.rx(1, &buf[..size]);
                    }
                }
            }
        }
        return Ok(channel.get_exit_status().unwrap_or(0));
    }

    fn closed(&self, result: Result<i32, Error>) -> bool {
        *self.closed.lock().unwrap() = Some(match &result {
            Ok(code) => ShellState::Exited {
                return_code: code.clone(),
            },
            Err(e) => ShellState::Error { error: e.clone() },
        });
        if let Some(callback) = self.callback.lock().unwrap().take() {
            let removed = result.map_or(false, |v| v == 0);
            if !removed {
                callback.info(self.info());
            }
            callback.closed(removed);
            return true;
        }
        return false;
    }

    pub(crate) fn thread(shell: Arc<Shell>) -> JoinHandle<()> {
        log::info!("Starting thread for {shell:?}");
        return std::thread::spawn(move || {
            let result = shell.worker();
            log::info!("{shell:?} worker exited with {result:?}");
            if let Ok(0) = result {
                if shell.shells.lock().unwrap().remove(&shell.token).is_some() {
                    log::info!("Removed {shell:?}");
                }
            }
            shell.closed(result);
        });
    }
}

impl Debug for Shell {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_fmt(format_args!(
            "Shell {{ token={}, device.name={} }}",
            self.token.0, self.device.name
        ))
    }
}
