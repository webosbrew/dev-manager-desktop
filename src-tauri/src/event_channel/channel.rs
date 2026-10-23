use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Listener, Runtime};
use uuid::Uuid;

use crate::event_channel::{EventChannel, EventHandler};

impl<R, H> EventChannel<R, H>
where
    R: Runtime,
    H: EventHandler + Sync + Send + 'static,
{
    pub fn rx<D>(&self, data: D)
    where
        D: Serialize + Clone,
    {
        self.emit("rx", data);
    }

    pub fn closed<D>(&self, data: D)
    where
        D: Serialize + Clone,
    {
        self.emit("closed", data);
    }

    pub fn listen(&self, handler: H) {
        let handler = Arc::new(handler);
        *self.handler.lock().unwrap() = Some(handler.clone());
        let on_close = handler.clone();
        let on_tx = handler;
        self.app.once(self.topic("close"), move |e| {
            on_close.close(Some(e.payload()));
        });
        self.listeners
            .lock()
            .unwrap()
            .push(self.app.listen(self.topic("tx"), move |e| {
                on_tx.tx(Some(e.payload()));
            }));
    }

    pub fn token(&self) -> String {
        format!("event_channel:{}:{}", self.category, self.id)
    }

    /// The event name the frontend listens on for one kind of message.
    fn topic(&self, suffix: &str) -> String {
        format!("{}:{suffix}", self.token())
    }

    fn emit<D>(&self, suffix: &str, data: D)
    where
        D: Serialize + Clone,
    {
        self.app.emit(&self.topic(suffix), data).unwrap();
    }

    pub fn new<S>(app: AppHandle<R>, category: S) -> EventChannel<R, H>
    where
        S: Into<String>,
    {
        return EventChannel {
            app,
            category: category.into(),
            id: Uuid::new_v4(),
            handler: Mutex::default(),
            listeners: Mutex::default(),
        };
    }
}

impl<R, H> Drop for EventChannel<R, H>
where
    R: Runtime,
    H: EventHandler + Send + 'static,
{
    fn drop(&mut self) {
        for listener in self.listeners.lock().unwrap().drain(..) {
            self.app.unlisten(listener);
        }
    }
}
