use std::ops::{Deref, DerefMut};
use std::sync::Mutex;

use libssh_rs::Session;
use log::log;
use uuid::Uuid;

use crate::conn_pool::DeviceConnection;

impl DeviceConnection {
    pub(super) fn new(session: Session) -> DeviceConnection {
        let connection = DeviceConnection {
            id: Uuid::new_v4(),
            session,
            last_ok: Mutex::new(true),
        };
        log::debug!("Connection {} created", connection.id);
        return connection;
    }

    pub(super) fn reset_last_ok(&self) {
        *self.last_ok.lock().unwrap() = false;
    }

    pub fn mark_last_ok(&self) {
        *self.last_ok.lock().unwrap() = true;
    }
}

impl Deref for DeviceConnection {
    type Target = Session;

    fn deref(&self) -> &Self::Target {
        return &self.session;
    }
}

impl DerefMut for DeviceConnection {
    fn deref_mut(&mut self) -> &mut Self::Target {
        return &mut self.session;
    }
}

impl Drop for DeviceConnection {
    fn drop(&mut self) {
        log::debug!(
            "Connection {} dropped. last_ok={}",
            self.id,
            self.last_ok.lock().unwrap()
        );
    }
}
