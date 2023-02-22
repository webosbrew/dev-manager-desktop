use crate::session_manager::Proc;
use std::sync::{Mutex, Weak};

mod manager;

#[derive(Default)]
pub(crate) struct SpawnManager {
    items: Mutex<Vec<Weak<Proc>>>,
}
