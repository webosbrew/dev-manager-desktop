use async_trait::async_trait;
use std::future::{ready, Ready};
use std::sync::{Arc, Mutex, Weak};
use tokio::sync::Mutex as AsyncMutex;
use russh::{ChannelId, ChannelOpenFailure, client, client::Session, Error};
use russh_keys::key::{PublicKey, SignatureHash};

use crate::session_manager::connection::{Connection, ConnectionsMap};

#[derive(Default)]
pub(crate) struct ClientHandler {
    pub(super) id: String,
    pub(super) connections: Weak<Mutex<ConnectionsMap>>,
    pub(super) hash_alg: Arc<Mutex<Option<SignatureHash>>>,
}

#[async_trait]
impl client::Handler for ClientHandler {
    type Error = Error;

    async fn check_server_key(self, server_public_key: &PublicKey)
                              -> Result<(Self, bool), Self::Error> {
        log::info!("server_public_key: {:?}", server_public_key);
        let alg: Option<SignatureHash> = match server_public_key {
            PublicKey::Ed25519(_) => None,
            PublicKey::RSA { .. } => SignatureHash::from_rsa_hostkey_algo(server_public_key.name().as_bytes()),
        };
        *self.hash_alg.lock().unwrap() = alg;
        return Ok((self, true));
    }
}

impl Drop for ClientHandler {
    fn drop(&mut self) {
        if let Some(c) = self.connections.upgrade() {
            if let Some(removed) = c.lock().unwrap().remove(&self.id) {
                log::info!("Dropped connection to {}", removed.device.name)
            }
        }
    }
}
