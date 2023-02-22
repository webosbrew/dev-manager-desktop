use std::fs;

use russh_keys::{decode_secret_key, load_secret_key};
use russh_keys::{Error as SshKeyError, PublicKeyBase64};
use russh_keys::encoding::Bytes;
use tokio::fs::{File, remove_file};
use tokio::io::AsyncWriteExt;

use crate::device_manager::{Device, DeviceManager, PrivateKey};
use crate::device_manager::io::{ensure_ssh_dir, read, ssh_dir, write};
use crate::error::Error;

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
        log::trace!("{:?}", devices);
        write(devices).await?;
        return Ok(result);
    }

    pub async fn add(&self, device: &Device) -> Result<Device, Error> {
        let mut device = device.clone();
        if let Some(key) = &device.private_key {
            if let PrivateKey::Data { data } = key {
                let pubkey = key
                    .key_pair(device.passphrase.as_deref())?
                    .clone_public_key()?;
                use sha2::{Digest, Sha256};
                let mut hasher = Sha256::new();
                hasher.update(&pubkey.public_key_bytes());
                let name = format!("webos_{}", &hex::encode(&hasher.finalize())[..10]);
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
        let passphrase = Some(passphrase).filter(|s| !s.is_empty());
        decode_secret_key(&content, passphrase).map_err(DeviceManager::map_loadkey_err)?;
        return Ok(content);
    }

    pub async fn localkey_verify(&self, name: &str, passphrase: Option<&str>) -> Result<(), Error> {
        let ssh_dir = ssh_dir().ok_or_else(|| Error::bad_config())?;
        let key_file = fs::canonicalize(ssh_dir.join(name))?;
        let passphrase = passphrase.filter(|s| !s.is_empty());
        load_secret_key(key_file.clone(), passphrase).map_err(DeviceManager::map_loadkey_err)?;
        return Ok(());
    }

    fn map_loadkey_err(e: SshKeyError) -> Error {
        return match e {
            SshKeyError::UnsupportedKeyType(t) => Error::UnsupportedKey {
                type_name: String::from(String::from_utf8_lossy(&t)),
            },
            SshKeyError::KeyIsEncrypted => Error::PassphraseRequired,
            SshKeyError::IndexOutOfBounds => Error::BadPassphrase,
            e => e.into(),
        };
    }
}
