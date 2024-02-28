use std::sync::{Arc, Mutex};
use tauri::{AppHandle, EventId, Runtime};
use uuid::Uuid;

mod channel;

pub struct EventChannel<R: Runtime, H: EventHandler + Send + 'static> {
    app: AppHandle<R>,
    category: String,
    id: Uuid,
    pub handler: Mutex<Option<Arc<H>>>,
    listeners: Mutex<Vec<EventId>>,
}

pub trait EventHandler: Sized {
    fn tx(&self, payload: Option<&str>);
    //noinspection RsLiveness
    fn close(&self, _payload: Option<&str>) {
        unimplemented!();
    }
}
