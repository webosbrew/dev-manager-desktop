use std::collections::HashMap;
use std::fmt;
use std::str::FromStr;
use std::sync::Arc;

use russh::ChannelMsg;
use serde::de::Visitor;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use tokio::sync::mpsc::unbounded_channel;
use uuid::Uuid;

use crate::error::Error;
use crate::session_manager::{Shell, ShellCallback, ShellInfo, ShellScreen, ShellToken};

pub(crate) type ShellsMap = HashMap<ShellToken, Arc<Shell>>;

impl Shell {
    pub async fn write(&self, data: &[u8]) -> Result<(), Error> {
        if let Some(sender) = self.sender.lock().await.as_mut() {
            sender.send(Vec::<u8>::from(data)).unwrap();
        } else {
            return Err(Error::Disconnected);
        }
        return Ok(());
    }

    pub async fn resize(&self, cols: u16, rows: u16) -> Result<(), Error> {
        if !self.has_pty {
            return Err(Error::Unsupported);
        }
        if let Some(ch) = self.channel.lock().await.as_mut() {
            ch.window_change(cols as u32, rows as u32, 0, 0).await?;
        } else {
            return Err(Error::Disconnected);
        }
        self.parser.lock().unwrap().set_size(rows, cols);
        return Ok(());
    }

    pub async fn screen(&self, cols: u16) -> Result<ShellScreen, Error> {
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

    pub async fn close(&self) -> Result<(), Error> {
        if let Some(ch) = self.channel.lock().await.take() {
            ch.close().await?;
        }
        return Ok(());
    }

    pub(crate) async fn run<CB>(&self, cb: CB) -> Result<(), Error>
    where
        CB: ShellCallback + Send + 'static,
    {
        let (sender, mut receiver) = unbounded_channel::<Vec<u8>>();
        *self.sender.lock().await = Some(sender);
        let mut status: Option<u32> = None;
        let mut eof: bool = false;
        loop {
            tokio::select! {
                data = receiver.recv() => {
                    log::info!("Write {{ data: {:?} }}", data);
                    match data {
                        Some(data) => self.send(&data[..]).await?,
                        None => {
                            self.close().await?;
                            break;
                        }
                    }
                }
                result = self.wait() => {
                    match result? {
                        ChannelMsg::Data { data } => {
                            let sh_changed = self.process(data.as_ref());
                            cb.rx(0, data.as_ref());
                            if sh_changed {
                                cb.info(self.info());
                            }
                        }
                        ChannelMsg::ExtendedData { data, ext } => {
                            log::info!("ExtendedData {{ data: {:?}, ext: {} }}", data, ext);
                            if ext == 1 {
                                self.process(data.as_ref());
                                cb.rx(1, data.as_ref());
                            }
                        }
                        ChannelMsg::ExitStatus { exit_status } => {
                            status = Some(exit_status);
                            if eof {
                                break;
                            }
                        }
                        ChannelMsg::Eof => {
                            eof = true;
                            if status.is_some() {
                                break;
                            }
                        }
                        ChannelMsg::Close => log::info!("Channel:Close"),
                        e => log::info!("Channel:{:?}", e)
                    }
                }
            }
        }
        self.channel.lock().await.take();
        cb.closed();
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

    async fn wait(&self) -> Result<ChannelMsg, Error> {
        return if let Some(ch) = self.channel.lock().await.as_mut() {
            let msg = ch.wait().await;
            msg.ok_or_else(|| Error::Disconnected)
        } else {
            Err(Error::Disconnected)
        };
    }

    async fn send(&self, data: &[u8]) -> Result<(), Error> {
        return if let Some(ch) = self.channel.lock().await.as_mut() {
            return Ok(ch.data(data).await?);
        } else {
            Err(Error::Disconnected)
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
