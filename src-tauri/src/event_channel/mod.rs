use serde::Serialize;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, EventHandler as TauriEventHandler, Runtime};
use uuid::Uuid;

mod channel;

pub struct EventChannel<R: Runtime, H: EventHandler + Send + 'static> {
    app: AppHandle<R>,
    category: String,
    id: Uuid,
    handler: Mutex<Option<Arc<H>>>,
    listeners: Mutex<Vec<TauriEventHandler>>,
}

pub trait EventHandler: Sized {
    fn tx(&self, payload: Option<&str>);
    fn close(&self, payload: Option<&str>) {
        unimplemented!();
    }
}
