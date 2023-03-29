use crate::device_manager::Device;
use crate::error::Error;
use crate::shell_manager::{Shell, ShellInfo, ShellManager, ShellMessage, ShellToken};
use std::sync::mpsc::channel;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use vt100::Parser;

impl ShellManager {
    pub fn open(&self, device: Device, cols: u16, rows: u16, dumb: bool) -> Arc<Shell> {
        let shell = Arc::new(Shell {
            token: ShellToken::new(),
            created_at: Instant::now(),
            device,
            has_pty: !dumb,
            sender: Mutex::default(),
            callback: Mutex::new(None),
            parser: Mutex::new(Parser::new(rows, cols, 1000)),
            shells: self.shells.clone(),
        });
        self.shells
            .lock()
            .unwrap()
            .insert(shell.token.clone(), shell.clone());
        Shell::thread(shell.clone());
        return shell;
    }

    pub fn find(&self, token: &ShellToken) -> Option<Arc<Shell>> {
        return self.shells.lock().unwrap().get(token).map(|a| a.clone());
    }

    pub fn close(&self, token: &ShellToken) -> Result<(), Error> {
        let shell = self.shells.lock().unwrap().remove(&token).clone();
        if let Some(shell) = shell {
            shell.close().unwrap_or(());
        }
        return Ok(());
    }

    pub fn list(&self) -> Vec<ShellInfo> {
        let mut list: Vec<ShellInfo> = self
            .shells
            .lock()
            .unwrap()
            .iter()
            .map(|(_, shell)| shell.info())
            .collect();
        list.sort_by_key(|v| v.created_at);
        return list;
    }
}
