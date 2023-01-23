use std::future::{Ready, ready};
use std::sync::{Mutex, Weak};

use russh::{client, client::Session, Error};
use russh_keys::key::PublicKey;

use crate::session_manager::connection::{Connection, ConnectionsMap};

#[derive(Default)]
pub(crate) struct ClientHandler {
  pub(super) id: String,
  pub(super) connections: Weak<Mutex<ConnectionsMap>>,
}

impl client::Handler for ClientHandler {
  type Error = Error;
  type FutureBool = Ready<Result<(Self, bool), Error>>;
  type FutureUnit = Ready<Result<(Self, Session), Error>>;

  fn finished_bool(self, b: bool) -> Self::FutureBool {
    ready(Ok((self, b)))
  }

  fn finished(self, session: Session) -> Self::FutureUnit {
    ready(Ok((self, session)))
  }

  fn check_server_key(self, server_public_key: &PublicKey) -> Self::FutureBool {
    self.finished_bool(true)
  }
}

impl Drop for ClientHandler {
  fn drop(&mut self) {
    if let Some(c) = self.connections.upgrade() {
      c.lock().unwrap().remove(&self.id);
    }
  }
}
