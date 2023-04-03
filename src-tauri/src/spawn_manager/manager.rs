use crate::session_manager::Proc;
use crate::spawn_manager::SpawnManager;
use std::sync::Arc;

impl SpawnManager {
    pub fn add_proc(&self, proc: Arc<Proc>) {
        self.items
            .lock()
            .expect("Failed to lock SpawnManager::items")
            .push(Arc::downgrade(&proc))
    }

    pub fn clear(&self) {
        let mut guard = self
            .items
            .lock()
            .expect("Failed to lock SpawnManager::items");
        let old_items = std::mem::replace(&mut *guard, Vec::new());
        drop(guard);
        for x in old_items {
            if let Some(proc) = x.upgrade() {
                log::debug!("Terminating {:?}", proc.command);
            }
        }
    }
}
