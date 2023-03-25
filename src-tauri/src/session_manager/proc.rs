use async_trait::async_trait;
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};
use tokio::sync::MutexGuard;

use crate::error::Error;
use crate::session_manager::Proc;
use crate::session_manager::spawned::Spawned;

impl Proc {
    pub async fn start(&self) -> Result<(), Error> {
        todo!();
    }

    pub fn interrupt(&self) -> Result<(), Error> {
        todo!();
    }

    pub fn data(&self, data: &[u8]) -> Result<(), Error> {
        todo!();
    }
}

#[async_trait]
impl Spawned for Proc {

}
