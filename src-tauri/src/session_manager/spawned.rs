use crate::error::Error;
use async_trait::async_trait;
use russh::client::Msg;
use russh::{Channel, ChannelId, ChannelMsg, CryptoVec, Sig};
use serde;
use serde::Serialize;
use serde_repr::Serialize_repr;
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};
use tokio::sync::MutexGuard;

#[async_trait]
pub(crate) trait Spawned {
    async fn lock_channel(&self) -> MutexGuard<'_, Option<Channel<Msg>>>;

    fn tx_ready(&self, sender: UnboundedSender<ChannelMsg>);

    fn on_rx(&self, data: CryptoVec, ext: u32);

    async fn wait_msg(&self) -> Result<(ChannelId, Option<ChannelMsg>), Error> {
        return if let Some(ch) = self.lock_channel().await.as_mut() {
            return Ok((ch.id(), ch.wait().await));
        } else {
            log::warn!("Waiting on no channel");
            Err(Error::Disconnected)
        };
    }

    async fn send_msg(&self, _ch: &mut Channel<Msg>, _msg: ChannelMsg) -> Result<(), Error>;

    async fn wait_close(&self) -> Result<SpawnResult, Error> {
        let (sender, mut receiver) = unbounded_channel::<ChannelMsg>();
        self.tx_ready(sender);
        let mut result: Option<SpawnResult> = None;
        let mut eof: bool = false;
        loop {
            tokio::select! {
                data = receiver.recv() => {
                    match data {
                        Some(ChannelMsg::Data { data }) => {
                            if let Some(ch) = self.lock_channel().await.as_mut() {
                                log::trace!("{}: Send Data {{ data: {} }}", ch.id(),
                                    String::from_utf8_lossy(data.as_ref()));
                                ch.data(data.as_ref()).await?;
                            } else {
                                log::info!("Failed to send data {:?}: disconnected", data);
                                return Err(Error::Disconnected)
                            }
                        },
                        Some(ChannelMsg::Close) => {
                            log::debug!("Send Close, break");
                            receiver.close();
                            break;
                        },
                        Some(msg) => {
                            if let Some(ch) = self.lock_channel().await.as_mut() {
                                log::debug!("{}: Send {:?}", ch.id(), msg);
                                self.send_msg(ch, msg).await?;
                            } else {
                                log::info!("Failed to send {:?}: disconnected", msg);
                                return Err(Error::Disconnected);
                            }
                        },
                        None => {
                            log::debug!("Send None, break");
                            break;
                        }
                    }
                }
                resp = self.wait_msg() => {
                    let (ch_id, msg) = resp?;
                    match msg {
                        Some(ChannelMsg::Data { data }) => {
                            log::trace!("{}: Received Data {{ data: {} }}", ch_id,
                                String::from_utf8_lossy(data.as_ref()));
                            self.on_rx(data, 0);
                        }
                        Some(ChannelMsg::ExtendedData { data, ext }) => {
                            log::trace!("{}: Received ExtendedData {{ data: {}, ext: {} }}", ch_id,
                                String::from_utf8_lossy(data.as_ref()), ext);
                            self.on_rx(data, ext);
                        }
                        Some(ChannelMsg::ExitStatus { exit_status }) => {
                            log::debug!("{}: Received ExitStatus {{ exit_status: {} }}", ch_id,
                                exit_status);
                            result = Some(SpawnResult::Exit { status: exit_status });
                            if eof {
                                break;
                            }
                        }
                        Some(ChannelMsg::ExitSignal { signal_name, .. }) => {
                            log::debug!("{}: Received ExitSignal {{ signal_name: {:?} }}", ch_id,
                                signal_name);
                            result = Some(SpawnResult::Signal { signal: signal_name.into() });
                            if eof {
                                break;
                            }
                        }
                        Some(ChannelMsg::Eof) => {
                            log::debug!("{}: Received Eof", ch_id);
                            eof = true;
                            if result.is_some() {
                                break;
                            }
                        }
                        Some(ChannelMsg::Close) => log::debug!("{}: Received Close", ch_id),
                        None => break,
                        Some(msg) => log::debug!("{}: Received {:?}", ch_id, msg)
                    }
                }
            }
        }
        if let Some(ch) = self.lock_channel().await.take() {
            ch.close().await.unwrap_or(());
        }
        if let Some(result) = result {
            return Ok(result);
        }
        return Ok(SpawnResult::Closed);
    }
}

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
pub(crate) enum SpawnResult {
    Exit { status: u32 },
    Signal { signal: ExitSignal },
    Closed,
}

#[derive(Debug, Serialize_repr)]
#[repr(i8)]
pub(crate) enum ExitSignal {
    SIGINT = 2,
    SIGQUIT = 3,
    SIGILL = 4,
    SIGABRT = 6,
    SIGKILL = 9,
    SIGSEGV = 11,
    SIGTERM = 15,
    NONE = -1,
}

impl From<Sig> for ExitSignal {
    fn from(value: Sig) -> Self {
        return match value {
            Sig::ABRT => ExitSignal::SIGABRT,
            Sig::ILL => ExitSignal::SIGILL,
            Sig::INT => ExitSignal::SIGINT,
            Sig::KILL => ExitSignal::SIGKILL,
            Sig::QUIT => ExitSignal::SIGQUIT,
            Sig::SEGV => ExitSignal::SIGSEGV,
            Sig::TERM => ExitSignal::SIGTERM,
            _ => ExitSignal::NONE,
        };
    }
}
