use russh_keys::decode_secret_key;
use russh_keys::encoding::Bytes;
use tokio::fs::{remove_file, File};
use tokio::io::AsyncWriteExt;

use crate::device_manager::io::{ensure_ssh_dir, read, write};
use crate::device_manager::{Device, DeviceManager, Error, PrivateKey};

impl DeviceManager {
    pub async fn list(&self) -> Result<Vec<Device>, Error> {
        let devices = read().await?;
        *self.devices.lock().unwrap() = devices.clone();
        return Ok(devices);
    }

    pub async fn set_default(&self, name: &str) -> Result<Option<Device>, Error> {
        let mut devices = read().await?;
        let mut result: Option<Device> = None;
        for mut device in &mut devices {
            if device.name == name {
                device.default = Some(true);
                result = Some(device.clone());
            } else {
                device.default = None;
            }
        }
        log::info!("{:?}", devices);
        write(devices).await?;
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
                let key_path = ensure_ssh_dir()?.join(name.clone());
                let mut file = File::create(key_path).await?;
                file.write(data.bytes()).await?;
                device.private_key = Some(PrivateKey::Path { name });
            }
        }
        log::info!("Save device {}", device.name);
        let mut devices = read().await?;
        devices.push(device.clone());
        write(devices.clone()).await?;
        return Ok(device);
    }

    pub async fn remove(&self, name: &str, remove_key: bool) -> Result<(), Error> {
        let devices = read().await?;
        let (will_delete, mut will_keep): (Vec<Device>, Vec<Device>) =
            devices.into_iter().partition(|d| d.name == name);
        let mut need_new_default = false;
        if remove_key {
            for device in will_delete {
                if device.default.unwrap_or(false) {
                    need_new_default = true;
                }
                if let Some(name) = device.private_key.and_then(|k| match k {
                    PrivateKey::Path { name } => Some(name),
                    _ => None,
                }) {
                    if !name.starts_with("webos_") {
                        continue;
                    }
                    let key_path = ensure_ssh_dir()?.join(name);
                    remove_file(key_path).await?;
                }
            }
        }
        if need_new_default && !will_keep.is_empty() {
            will_keep.first_mut().unwrap().default = Some(true);
        }
        write(will_keep).await?;
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
