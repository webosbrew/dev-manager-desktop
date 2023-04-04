use libssh_rs::Error::RequestDenied;
use libssh_rs::SshResult;
use std::collections::HashMap;
use std::io::Write;
use std::sync::mpsc::channel;
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};
use vt100::Parser;

use crate::conn_pool::DeviceConnection;
use crate::device_manager::Device;
use crate::error::Error;
use crate::shell_manager::{Shell, ShellInfo, ShellMessage, ShellScreen, ShellToken};

pub(crate) type ShellsMap = HashMap<ShellToken, Arc<Shell>>;

impl Shell {
    pub fn write(&self, data: &[u8]) -> Result<(), Error> {
        return self.queue_message(ShellMessage::Data(Vec::from(data)));
    }

    pub fn resize(&self, rows: u16, cols: u16) -> Result<(), Error> {
        if self.has_pty.lock().unwrap().eq(&false) {
            return Err(Error::Unsupported);
        }
        self.parser.lock().unwrap().set_size(rows, cols);
        log::info!(
            "Shell {:?} resized. rows = {}, cols = {}",
            self.token,
            rows,
            cols
        );
        return self.queue_message(ShellMessage::Resize { rows, cols });
    }

    pub fn screen(&self, cols: u16) -> Result<ShellScreen, Error> {
        if self.has_pty.lock().unwrap().eq(&false) {
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
        self.closed();
        return Ok(());
    }

    pub fn info(&self) -> ShellInfo {
        return ShellInfo {
            token: self.token.clone(),
            title: self.title(),
            ready: self.sender.lock().unwrap().is_some(),
            has_pty: *self.has_pty.lock().unwrap(),
            created_at: self.created_at,
        };
    }

    pub(crate) fn new(
        device: Device,
        has_pty: bool,
        rows: u16,
        cols: u16,
        shells: Arc<Mutex<ShellsMap>>,
    ) -> Self {
        let shell = Self {
            token: ShellToken::new(),
            created_at: Instant::now(),
            device,
            has_pty: Mutex::new(false),
            sender: Mutex::default(),
            callback: Mutex::new(None),
            parser: Mutex::new(Parser::new(rows, cols, 1000)),
            shells,
        };
        log::info!("Create shell {}: rows={}, cols={}", shell.token, rows, cols);
        return shell;
    }

    fn process(&self, data: &[u8]) -> bool {
        if self.has_pty.lock().unwrap().eq(&false) {
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

    fn worker(&self) -> Result<(), Error> {
        let (sender, receiver) = channel::<ShellMessage>();
        let connection = DeviceConnection::new(self.device.clone())?;
        let channel = connection.new_channel()?;
        channel.open_session()?;
        let (rows, cols) = self.parser.lock().unwrap().screen().size();
        match channel.request_pty("xterm", cols as u32, rows as u32) {
            Ok(_) => *self.has_pty.lock().unwrap() = true,
            Err(RequestDenied(s)) => log::warn!("Failed to request pty {:?}", s),
            e => e?,
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
                        channel.stdin().write(&d)?;
                    }
                    ShellMessage::Resize { rows, cols } => {
                        channel.change_pty_size(cols as u32, rows as u32)?;
                    }
                    ShellMessage::Close => {
                        channel.close()?;
                    }
                }
            }
            let size = channel.read_timeout(&mut buf, false, Some(Duration::from_micros(5)))?;
            if size == 0 {
                continue;
            }
            if let Some(callback) = self.callback.lock().unwrap().as_ref() {
                callback.rx(&buf[..size]);
            }
            if self.process(&buf[..size]) {
                if let Some(callback) = self.callback.lock().unwrap().as_ref() {
                    callback.info(self.info());
                }
            }
        }
        return Ok(());
    }

    fn closed(&self) -> bool {
        if let Some(callback) = self.callback.lock().unwrap().take() {
            callback.closed();
            return true;
        }
        return false;
    }

    pub(crate) fn thread(shell: Arc<Shell>) -> JoinHandle<Result<(), Error>> {
        log::info!("Spawning worker thread for shell {:?}", shell.token);
        return std::thread::spawn(move || {
            let result = shell.worker();
            let token = shell.token.clone();
            if shell.shells.lock().unwrap().remove(&shell.token).is_some() {
                log::info!("Removed shell {:?}", token);
                shell.closed();
            }
            return result;
        });
    }
}
