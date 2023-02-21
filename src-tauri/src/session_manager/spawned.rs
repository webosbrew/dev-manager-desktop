use crate::error::Error;
use async_trait::async_trait;
use russh::client::Msg;
use russh::{Channel, ChannelId, ChannelMsg, CryptoVec, Sig};
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

    async fn send_msg(&self, _ch: &mut Channel<Msg>, _msg: ChannelMsg) -> Result<(), Error> {
        unimplemented!();
    }

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
                            log::trace!("Send Close, break");
                            receiver.close();
                            break;
                        },
                        Some(msg) => {
                            if let Some(ch) = self.lock_channel().await.as_mut() {
                                log::trace!("{}: Send {:?}", ch.id(), msg);
                                self.send_msg(ch, msg).await?;
                            } else {
                                log::info!("Failed to send {:?}: disconnected", msg);
                                return Err(Error::Disconnected);
                            }
                        },
                        None => {
                            log::trace!("Send None, break");
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
                            log::trace!("{}: Received ExitStatus {{ exit_status: {} }}", ch_id,
                                exit_status);
                            result = Some(SpawnResult::Exit { status: exit_status });
                            if eof {
                                break;
                            }
                        }
                        Some(ChannelMsg::ExitSignal { signal_name, .. }) => {
                            log::trace!("{}: Received ExitSignal {{ signal_name: {:?} }}", ch_id,
                                signal_name);
                            result = Some(SpawnResult::Signal { signal: signal_name });
                            if eof {
                                break;
                            }
                        }
                        Some(ChannelMsg::Eof) => {
                            log::trace!("{}: Received Eof", ch_id);
                            eof = true;
                            if result.is_some() {
                                break;
                            }
                        }
                        Some(ChannelMsg::Close) => log::trace!("{}: Received Close", ch_id),
                        None => break,
                        Some(msg) => log::trace!("{}: Received {:?}", ch_id, msg)
                    }
                }
            }
        }
        return Ok(result.unwrap_or(SpawnResult::Closed));
    }
}

#[derive(Debug)]
pub(crate) enum SpawnResult {
    Exit { status: u32 },
    Signal { signal: Sig },
    Closed,
}
