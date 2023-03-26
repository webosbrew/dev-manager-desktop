use async_trait::async_trait;
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};
use tokio::sync::MutexGuard;

use crate::error::Error;
use crate::session_manager::spawned::Spawned;
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

    pub fn interrupt(&self) -> Result<(), Error> {
        todo!();
    }

    pub fn data(&self, data: &[u8]) -> Result<(), Error> {
        todo!();
    }
}

impl Spawned for Proc {}
