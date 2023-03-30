use std::sync::Arc;

use crate::device_manager::Device;
use crate::error::Error;
use crate::shell_manager::{Shell, ShellInfo, ShellManager, ShellToken};

impl ShellManager {
    pub fn open(&self, device: Device, rows: u16, cols: u16, dumb: bool) -> Arc<Shell> {
        let shell = Arc::new(Shell::new(device, !dumb, rows, cols, self.shells.clone()));
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
