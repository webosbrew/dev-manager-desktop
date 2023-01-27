use std::collections::HashMap;
use std::fmt;
use std::str::FromStr;
use std::sync::Arc;
use russh::ChannelMsg;

use serde::{Deserialize, Deserializer, Serialize, Serializer};
use serde::de::Visitor;
use tokio::sync::mpsc::unbounded_channel;
use tokio::sync::MutexGuard;
use tokio::sync::oneshot::channel;
use uuid::Uuid;

use crate::session_manager::{Error, Shell, ShellBuffer, ShellToken};

pub(crate) type ShellsMap = HashMap<ShellToken, Arc<Shell>>;

impl Shell {
    pub async fn write(&self, data: &[u8]) -> Result<(), Error> {
        if let Some(sender) = self.sender.lock().await.as_mut() {
            sender.send(Vec::<u8>::from(data)).unwrap();
        } else {
            return Err(Error::disconnected());
        }
        return Ok(());
    }

    pub async fn resize(&self, cols: u16, rows: u16) -> Result<(), Error> {
        if let Some(ch) = self.channel.lock().await.as_mut() {
            ch.window_change(cols as u32, rows as u32, 0, 0).await?;
        } else {
            return Err(Error::disconnected());
        }
        self.parser.lock().unwrap().set_size(rows, cols);
        return Ok(());
    }

    pub async fn screen(&self, cols: u16, rows: u16) -> Result<ShellBuffer, Error> {
        if self.ready.available_permits() > 0 {
            log::info!("fetching screen {:?} with {cols} cols and {rows} rows", self.token);
        } else if let Some(ch) = self.channel.lock().await.as_mut() {
            log::info!("initializing {:?} with {cols} cols and {rows} rows", self.token);
            let mut have_pty = true;
            if let Err(e) = ch.request_pty(true, "xterm-256color",
                                           cols as u32, rows as u32,
                                           0, 0, &[]).await {
                match e {
                    russh::Error::SendError => have_pty = false,
                    e => return Err(e.into())
                }
            }
            ch.request_shell(true).await?;
            self.ready.add_permits(1);
        } else {
            return Err(Error::disconnected());
        }
        let guard = self.parser.lock().unwrap();
        let screen = guard.screen();
        return Ok(ShellBuffer {
            rows: screen.rows_formatted(0, cols).collect(),
            cursor: screen.cursor_position(),
        });
    }

    pub async fn close(&self) -> Result<(), Error> {
        let mut option = self.channel.lock().await.take();
        if let Some(ch) = option {
            ch.close().await?;
        }
        return Ok(());
    }

    pub(crate) async fn run<F>(&self, rx: F) -> Result<(), Error> where F: Fn(u32, &[u8]) -> () {
        let (mut sender, mut receiver) = unbounded_channel::<Vec<u8>>();
        *self.sender.lock().await = Some(sender);
        log::info!("waiting permit to run {:?}", self.token);
        let permit = self.ready.acquire().await.unwrap();
        log::info!("shell started {:?}", self.token);
        let mut status: Option<u32> = None;
        let mut eof: bool = false;
        loop {
            tokio::select! {
                data = receiver.recv() => {
                    match data {
                        Some(data) => {
                            log::info!("writing data to {:?} ({} bytes)", self.token, data.len());
                            self.send(&data[..]).await?;
                        },
                        None => {
                            self.close().await?;
                            break;
                        }
                    }
                }
                result = self.wait() => {
                    match result? {
                        ChannelMsg::Data { data } => {
                            self.parser.lock().unwrap().process(data.as_ref());
                            rx(0, data.as_ref());
                        }
                        ChannelMsg::ExtendedData { data, ext } => {
                            if ext == 1 {
                                self.parser.lock().unwrap().process(data.as_ref());
                                rx(1, data.as_ref());
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
        self.ready.close();
        return Ok(());
    }

    async fn wait(&self) -> Result<ChannelMsg, Error> {
        return if let Some(ch) = self.channel.lock().await.as_mut() {
            let msg = ch.wait().await;
            msg.ok_or_else(|| Error::disconnected())
        } else {
            Err(Error::disconnected())
        };
    }

    async fn send(&self, data: &[u8]) -> Result<(), Error> {
        return if let Some(ch) = self.channel.lock().await.as_mut() {
            return Ok(ch.data(data).await?);
        } else {
            Err(Error::disconnected())
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
