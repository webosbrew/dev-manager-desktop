use crate::session_manager::Proc;
use crate::spawn_manager::SpawnManager;
use russh::{ChannelMsg, Sig};
use std::sync::Arc;

impl SpawnManager {
    pub fn add_proc(&self, proc: Arc<Proc>) {
        self.items.lock().unwrap().push(Arc::downgrade(&proc))
    }

    pub fn clear(&self) {
        let mut guard = self.items.lock().unwrap();
        let old_items = std::mem::replace(&mut *guard, Vec::new());
        drop(guard);
        for x in old_items {
            if let Some(proc) = x.upgrade() {
                log::debug!("Terminating {:?}", proc.command);
                proc.msg_seq(vec![ChannelMsg::Signal { signal: Sig::TERM }])
                    .unwrap_or(());
            }
        }
    }
}
