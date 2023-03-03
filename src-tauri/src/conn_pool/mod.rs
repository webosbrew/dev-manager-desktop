use crate::device_manager::Device;
use crate::error::Error;
use r2d2::Pool;
use std::sync::{Arc, Mutex};

pub mod pool;

pub struct DeviceConnectionPool {
    inner: Pool<DeviceConnectionManager>,
    last_error: Arc<Mutex<Option<Error>>>,
}

pub struct DeviceConnectionManager {
    device: Device,
}
