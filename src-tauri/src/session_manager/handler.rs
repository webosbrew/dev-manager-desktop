use async_trait::async_trait;
use std::future::{ready, Ready};
use std::sync::{Mutex, Weak};

use russh::{client, client::Session, Error};
use russh_keys::key::PublicKey;

use crate::session_manager::connection::ConnectionsMap;

#[derive(Default)]
pub(crate) struct ClientHandler {
    pub(super) id: String,
    pub(super) connections: Weak<Mutex<ConnectionsMap>>,
}

#[async_trait]
impl client::Handler for ClientHandler {
    type Error = Error;

    async fn check_server_key(self, _server_public_key: &PublicKey)
                              -> Result<(Self, bool), Self::Error> {
        return Ok((self, true));
    }
}

impl Drop for ClientHandler {
    fn drop(&mut self) {
        if let Some(c) = self.connections.upgrade() {
            c.lock().unwrap().remove(&self.id);
        }
    }
}
