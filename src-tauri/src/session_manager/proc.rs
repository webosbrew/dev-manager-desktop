use russh::ChannelMsg;

use crate::error::Error;
use crate::session_manager::connection::Connection;
use crate::session_manager::Proc;

impl Proc {
    pub async fn run<F>(&self, stdout: F) -> Result<(), Error>
    where
        F: Fn(u64, &[u8]) -> (),
    {
        if let Some(ch) = self.ch.lock().await.as_mut() {
            ch.exec(true, self.command.as_bytes()).await?;
            if !Connection::wait_reply(ch).await? {
                return Err(Error::NegativeReply);
            }
        }
        let mut stderr: Vec<u8> = Vec::new();
        let mut status: Option<u32> = None;
        let mut eof: bool = false;
        let mut index: u64 = 0;
        loop {
            if let Some(ch) = self.ch.lock().await.as_mut() {
                match ch.wait().await.ok_or(Error::new("empty message"))? {
                    ChannelMsg::Data { data } => {
                        stdout(index, data.as_ref());
                        index += 1;
                    }
                    ChannelMsg::ExtendedData { data, ext } => {
                        log::info!(
                            "Channel: ExtendedData {}: {}",
                            ext,
                            String::from_utf8_lossy(&data.to_vec())
                        );
                        if ext == 1 {
                            stderr.append(&mut data.to_vec());
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
                    _ => {}
                }
            } else {
                break;
            }
        }
        let status = status.unwrap_or(0);
        if status != 0 {
            return Err(Error::ExitStatus {
                message: format!("Command `{}` exited with status {}", self.command, status),
                exit_code: status,
                stderr,
            });
        }
        return Ok(());
    }

    pub async fn interrupt(&self) -> Result<(), Error> {
        let mut guard = self.ch.lock().await;
        if let Some(ch) = guard.take() {
            ch.close().await?;
        }
        return Ok(());
    }
}
