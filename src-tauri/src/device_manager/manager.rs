use crate::device_manager::{Device, DeviceManager, Error};
use crate::device_manager::io::{read, write};

impl DeviceManager {
  pub async fn list(&self) -> Result<Vec<Device>, Error> {
    let devices = read()?;
    *self.devices.lock().unwrap() = devices.clone();
    return Ok(devices);
  }

  pub async fn set_default(&self, name: &str) -> Result<Option<Device>, Error> {
    let mut devices = read()?;
    let mut result: Option<Device> = None;
    for mut device in &mut devices {
      if device.name == name {
        device.default = true;
        result = Some(device.clone());
      } else {
        device.default = false;
      }
    }
    write(&devices)?;
    return Ok(result);
  }

  pub async fn remove(&self, name: &str) -> Result<(), Error> {
    let mut devices = read()?;
    devices.retain(|device| device.name != name);
    write(&devices)?;
    return Ok(());
  }
}
