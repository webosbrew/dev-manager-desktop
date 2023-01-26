use russh_keys::encoding::Bytes;
use russh_keys::decode_secret_key;
use std::fs::File;
use std::io::Write;

use crate::device_manager::io::{read, ssh_dir, write};
use crate::device_manager::{Device, DeviceManager, Error, PrivateKey};

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
                device.default = Some(true);
                result = Some(device.clone());
            } else {
                device.default = None;
            }
        }
        write(&devices)?;
        return Ok(result);
    }

    pub async fn add(&self, device: &Device) -> Result<Device, Error> {
        let mut device = device.clone();
        if let Some(key) = &device.private_key {
            if let PrivateKey::Data { data } = key {
                let pubkey = key
                    .priv_key(device.passphrase.as_deref(), None)?
                    .clone_public_key()?;
                let name = format!("webos_{}", pubkey.fingerprint());
                let key_path = ssh_dir().unwrap().join(name.clone());
                let mut file = File::create(key_path)?;
                file.write(data.bytes())?;
                device.private_key = Some(PrivateKey::Path { name });
            }
        }
        log::info!("Save device {}", device.name);
        let mut devices = read()?;
        devices.push(device.clone());
        write(&devices)?;
        return Ok(device);
    }

    pub async fn remove(&self, name: &str) -> Result<(), Error> {
        let mut devices = read()?;
        if devices
            .iter()
            .any(|device| device.name == name && device.indelible == Some(true))
        {
            return Err(Error::new("Can't delete indelible device"));
        }
        devices.retain(|device| device.name != name);
        write(&devices)?;
        return Ok(());
    }

    //noinspection HttpUrlsUsage
    pub async fn novacom_getkey(&self, address: &str, passphrase: &str) -> Result<String, Error> {
        let response = reqwest::get(format!("http://{}:9991/webos_rsa", address)).await?;
        let content = response.text().await?;
        if let Err(_e) = decode_secret_key(&content, Some(&passphrase)) {
            return Err(Error::new("Bad key"));
        }
        return Ok(content);
    }
}
