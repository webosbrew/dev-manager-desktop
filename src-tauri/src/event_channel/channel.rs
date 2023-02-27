use crate::event_channel::{EventChannel, EventHandler};
use serde::Serialize;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, Runtime};
use uuid::Uuid;

impl<R, H> EventChannel<R, H>
where
    R: Runtime,
    H: EventHandler + Sync + Send + 'static,
{
    pub fn rx<D>(&self, data: D)
    where
        D: Serialize + Clone,
    {
        self.app
            .emit_all(
                &format!("event_channel:{}:{}:rx", self.category, self.id),
                data,
            )
            .unwrap();
    }

    pub fn closed<D>(&self, data: D)
    where
        D: Serialize + Clone,
    {
        self.app
            .emit_all(
                &format!("event_channel:{}:{}:closed", self.category, self.id),
                data,
            )
            .unwrap();
    }

    pub fn listen(&self, handler: H) {
        let handler = Arc::new(handler);
        *self.handler.lock().unwrap() = Some(handler.clone());
        let handler2 = handler.clone();
        let handler3 = handler.clone();
        self.listeners.lock().unwrap().extend(&[
            self.app.once_global(
                format!("event_channel:{}:{}:close", self.category, self.id),
                move |e| {
                    handler2.close(e.payload());
                },
            ),
            self.app.listen_global(
                format!("event_channel:{}:{}:tx", self.category, self.id),
                move |e| {
                    handler3.tx(e.payload());
                },
            ),
        ]);
    }

    pub fn token(&self) -> String {
        return format!("event_channel:{}:{}", self.category, self.id);
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
