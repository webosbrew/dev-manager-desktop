//! The device list file, shared with the ares-cli-rs tools.
//!
//! [`ares_device_lib::io`] does the reading and writing. This only moves it off
//! the async runtime and onto our own error type.

use std::path::Path;

use crate::device_manager::Device;
use crate::error::Error;

pub(crate) async fn read(conf_dir: &Path) -> Result<Vec<Device>, Error> {
    let conf_dir = conf_dir.to_path_buf();
    tauri::async_runtime::spawn_blocking(move || Ok(ares_device_lib::io::read_in(&conf_dir)?))
        .await
        .expect("critical failure in app::io::read task")
}

pub(crate) async fn write(devices: Vec<Device>, conf_dir: &Path) -> Result<(), Error> {
    let conf_dir = conf_dir.to_path_buf();
    tauri::async_runtime::spawn_blocking(move || {
        Ok(ares_device_lib::io::write_in(&conf_dir, &devices)?)
    })
    .await
    .expect("critical failure in app::io::write task")
}
