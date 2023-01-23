use std::fmt;
use std::io::Write;
use std::str::FromStr;
use std::string::ParseError;
use std::sync::{Arc, Mutex};

use rand::{Rng, thread_rng};
use rand::distributions::Alphanumeric;
use russh::{Channel, ChannelId};
use russh::client::Msg;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use serde::de::Visitor;
use uuid::Uuid;
use vt100::Parser;

use crate::device_manager::Device;
use crate::session_manager::{Error, Shell, ShellToken};
use crate::session_manager::connection::Connection;

impl Shell {
  pub async fn resize(&self, cols: u16, rows: u16) -> Result<(), Error> {
    // self.channel.lock().await.window_change(cols as u32, rows as u32,
    //                                         0, 0).await?;
    self.parser.lock().unwrap().set_size(rows, cols);
    return Ok(());
  }

  pub(crate) fn data(&self, data: &[u8]) {
    self.parser.lock().unwrap().process(data);
  }
}

impl Serialize for ShellToken {
  fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error> where S: Serializer {
    return serializer.serialize_str(&format!("{}/{}", self.connection_id, self.channel_id));
  }
}

impl<'de> Deserialize<'de> for ShellToken {
  fn deserialize<D>(deserializer: D) -> Result<Self, D::Error> where D: Deserializer<'de> {
    return deserializer.deserialize_string(ShellTokenVisitor);
  }
}

struct ShellTokenVisitor;

impl<'de> Visitor<'de> for ShellTokenVisitor {
  type Value = ShellToken;

  fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    formatter.write_str("string")
  }

  // parse the version from the string
  fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
    where
      E: std::error::Error,
  {
    let mut split = value.split('/');
    let first = split.next().unwrap();
    let second = split.next().unwrap();
    return Ok(ShellToken {
      connection_id: Uuid::from_str(first).unwrap(),
      channel_id: String::from(second),
    });
  }
}
