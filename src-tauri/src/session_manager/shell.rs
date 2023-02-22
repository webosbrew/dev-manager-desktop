use std::collections::HashMap;
use std::fmt;
use std::str::FromStr;
use std::sync::Arc;

use async_trait::async_trait;
use russh::client::Msg;
use russh::{Channel, ChannelMsg, CryptoVec};
use serde::de::Visitor;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use tauri::Runtime;
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};
use tokio::sync::{MappedMutexGuard, MutexGuard};
use uuid::Uuid;

use crate::error::Error;
use crate::session_manager::spawned::Spawned;
use crate::session_manager::{Shell, ShellCallback, ShellInfo, ShellScreen, ShellToken};

pub(crate) type ShellsMap = HashMap<ShellToken, Arc<Shell>>;

impl Shell {
    pub fn write(&self, data: &[u8]) -> Result<(), Error> {
        if let Some(sender) = self.sender.lock().unwrap().as_mut() {
            return sender
                .send(ChannelMsg::Data {
                    data: CryptoVec::from_slice(data),
                })
                .map_err(|_| Error::Disconnected);
        }
        return Err(Error::Disconnected);
    }

    pub fn resize(&self, cols: u16, rows: u16) -> Result<(), Error> {
        if !self.has_pty {
            return Err(Error::Unsupported);
        }
        if let Some(sender) = self.sender.lock().unwrap().as_mut() {
            sender
                .send(ChannelMsg::WindowChange {
                    col_width: cols as u32,
                    row_height: rows as u32,
                    pix_width: 0,
                    pix_height: 0,
                })
                .map_err(|_| Error::Disconnected)?;
            self.parser.lock().unwrap().set_size(rows, cols);
            return Ok(());
        }
        return Err(Error::Disconnected);
    }

    pub fn screen(&self, cols: u16) -> Result<ShellScreen, Error> {
        if !self.has_pty {
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
        if let Some(ch) = self.sender.lock().unwrap().take() {}
        return Ok(());
    }

    pub fn info(&self) -> ShellInfo {
        return ShellInfo {
            token: self.token.clone(),
            title: self.title(),
            has_pty: self.has_pty,
            created_at: self.created_at,
        };
    }

    fn process(&self, data: &[u8]) -> bool {
        if !self.has_pty {
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
            return self.def_title.clone();
        }
        return String::from(title);
    }
}

#[async_trait]
impl Spawned for Shell {
    async fn lock_channel(&self) -> MutexGuard<'_, Option<Channel<Msg>>> {
        return self.channel.lock().await;
    }

    fn tx_ready(&self, sender: UnboundedSender<ChannelMsg>) {
        *self.sender.lock().unwrap() = Some(sender);
    }

    fn on_rx(&self, data: CryptoVec, ext: u32) {
        if let Some(cb) = self.callback.lock().unwrap().as_deref() {
            if ext > 1 {
                return;
            }
            let sh_changed = self.process(data.as_ref());
            cb.rx(ext, data.as_ref());
            if ext == 0 && sh_changed {
                cb.info(self.info());
            }
        }
    }

    async fn send_msg(&self, ch: &mut Channel<Msg>, msg: ChannelMsg) -> Result<(), Error> {
        return match msg {
            ChannelMsg::WindowChange {
                col_width,
                row_height,
                pix_width,
                pix_height,
            } => Ok(ch
                .window_change(col_width, row_height, pix_width, pix_height)
                .await?),
            _ => unimplemented!(),
        };
    }
}

impl Serialize for ShellToken {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        return serializer.serialize_str(&format!("{}/{}", self.connection_id, self.channel_id));
    }
}

impl<'de> Deserialize<'de> for ShellToken {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
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
