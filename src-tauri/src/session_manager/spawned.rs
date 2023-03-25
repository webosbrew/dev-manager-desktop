use crate::error::Error;
use async_trait::async_trait;
use serde;
use serde::Serialize;
use serde_repr::Serialize_repr;
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};
use tokio::sync::MutexGuard;

#[async_trait]
pub(crate) trait Spawned {

    async fn wait_close(&self) -> Result<SpawnResult, Error> {
        todo!();
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
