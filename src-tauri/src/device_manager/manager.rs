use libssh_rs_sys::{ssh_key_free, ssh_key_new, ssh_pki_import_privkey_file, SSH_EOF, SSH_OK};
use std::ffi::CString;
use std::fs;
use std::ptr::{null, null_mut};

use tokio::fs::{remove_file, File};
use tokio::io::AsyncWriteExt;

use crate::device_manager::io::{ensure_ssh_dir, read, ssh_dir, write};
use crate::device_manager::{Device, DeviceManager, PrivateKey};
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
                let name = key.name()?;
                let key_path = ensure_ssh_dir()?.join(&name);
                let mut file = File::create(key_path).await?;
                file.write(data.as_bytes()).await?;
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
    pub async fn novacom_getkey(&self, address: &str) -> Result<String, Error> {
        let response = reqwest::get(format!("http://{}:9991/webos_rsa", address)).await?;
        return Ok(response.text().await?);
    }

    pub async fn localkey_verify(&self, name: &str, passphrase: Option<&str>) -> Result<(), Error> {
        let ssh_dir = ssh_dir().ok_or_else(|| Error::bad_config())?;
        let key_file =
            CString::new(fs::canonicalize(ssh_dir.join(name))?.to_str().unwrap()).unwrap();
        let mut ret_code: i32 = SSH_OK as i32;
        unsafe {
            let mut key = ssh_key_new();
            if let Some(passphrase) = passphrase {
                let passphrase = CString::new(passphrase).unwrap();
                ret_code = ssh_pki_import_privkey_file(
                    key_file.as_ptr(),
                    passphrase.as_ptr(),
                    None,
                    null_mut(),
                    &mut key,
                ) as i32;
            } else {
                ret_code = ssh_pki_import_privkey_file(
                    key_file.as_ptr(),
                    null(),
                    None,
                    null_mut(),
                    &mut key,
                ) as i32;
            }
            ssh_key_free(key);
        }
        return match ret_code {
            0 => Ok(()),
            SSH_EOF => Err(Error::IO {
                code: String::from("Other"),
                message: String::from("Bad private key"),
            }),
            _ => Err(Error::BadPassphrase),
        };
    }
}
