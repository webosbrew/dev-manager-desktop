use std::fs;
use std::path::{Path, PathBuf};

use libssh_rs::SshKey;
use tokio::fs::{File, remove_file};
use tokio::io::AsyncWriteExt;

use crate::app_dirs::{GetConfDir, GetSshDir, SetConfDir, SetSshDir};
use crate::device_manager::io::{read, write};
use crate::device_manager::{Device, DeviceManager, PrivateKey};
use crate::error::Error;

impl DeviceManager {
    pub async fn list(&self) -> Result<Vec<Device>, Error> {
        let devices = read(self.get_conf_dir().as_deref()).await?;
        *self.devices.lock().unwrap() = devices.clone();
        return Ok(devices);
    }

    pub async fn set_default(&self, name: &str) -> Result<Option<Device>, Error> {
        let conf_dir = self.get_conf_dir();
        let mut devices = read(conf_dir.as_deref()).await?;
        let mut result: Option<Device> = None;
        for device in &mut devices {
            if device.name == name {
                device.default = Some(true);
                result = Some(device.clone());
            } else {
                device.default = None;
            }
        }
        log::trace!("{:?}", devices);
        write(devices, conf_dir.as_deref()).await?;
        return Ok(result);
    }

    pub async fn add(&self, device: &Device) -> Result<Device, Error> {
        let conf_dir = self.get_conf_dir();
        let mut device = device.clone();
        if let Some(key) = &device.private_key {
            match key {
                PrivateKey::Path { name } => {
                    let path = Path::new(name);
                    if path.is_absolute() {
                        let name = String::from(
                            pathdiff::diff_paths(path, self.ensure_ssh_dir()?)
                                .ok_or(Error::NotFound)?
                                .to_string_lossy(),
                        );
                        device.private_key = Some(PrivateKey::Path { name });
                    }
                }
                PrivateKey::Data { data } => {
                    let name = key.name(device.valid_passphrase())?;
                    let key_path = self.ensure_ssh_dir()?.join(&name);
                    let mut file = File::create(key_path).await?;
                    file.write(data.as_bytes()).await?;
                    device.private_key = Some(PrivateKey::Path { name });
                }
            }
        }
        log::info!("Save device {}", device.name);
        let mut devices = read(conf_dir.as_deref()).await?;
        devices.push(device.clone());
        write(devices.clone(), conf_dir.as_deref()).await?;
        return Ok(device);
    }

    pub async fn remove(&self, name: &str, remove_key: bool) -> Result<(), Error> {
        let conf_dir = self.get_conf_dir();
        let devices = read(conf_dir.as_deref()).await?;
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
                    let key_path = self.ensure_ssh_dir()?.join(name);
                    remove_file(key_path).await?;
                }
            }
        }
        if need_new_default && !will_keep.is_empty() {
            will_keep.first_mut().unwrap().default = Some(true);
        }
        write(will_keep, conf_dir.as_deref()).await?;
        return Ok(());
    }

    //noinspection HttpUrlsUsage
    pub async fn novacom_getkey(&self, address: &str, passphrase: &str) -> Result<String, Error> {
        let resp = reqwest::get(format!("http://{}:9991/webos_rsa", address))
            .await?
            .error_for_status()?;
        let content = resp.text().await?;

        return match SshKey::from_privkey_base64(&content, Some(passphrase)) {
            Ok(_) => Ok(content),
            _ => Err(if passphrase.is_empty() {
                Error::PassphraseRequired
            } else {
                Error::BadPassphrase
            }),
        };
    }

    pub async fn localkey_verify(&self, name: &str, passphrase: &str) -> Result<(), Error> {
        let name_path = Path::new(name);
        let ssh_key_path = if name_path.is_absolute() {
            name_path.to_path_buf()
        } else {
            fs::canonicalize(self.ensure_ssh_dir()?)?
        };
        return match SshKey::from_privkey_file(ssh_key_path.to_str().unwrap(), Some(passphrase)) {
            Ok(_) => Ok(()),
            _ => Err(if passphrase.is_empty() {
                Error::PassphraseRequired
            } else {
                Error::BadPassphrase
            }),
        };
    }
}

impl GetSshDir for DeviceManager {
    fn get_ssh_dir(&self) -> Option<PathBuf> {
        return self.ssh_dir.lock().unwrap().clone();
    }
}

impl SetSshDir for DeviceManager {
    fn set_ssh_dir(&self, dir: PathBuf) {
        *self.ssh_dir.lock().unwrap() = Some(dir);
    }
}

impl GetConfDir for DeviceManager {
    fn get_conf_dir(&self) -> Option<PathBuf> {
        return self.conf_dir.lock().unwrap().clone();
    }
}

impl SetConfDir for DeviceManager {
    fn set_conf_dir(&self, dir: PathBuf) {
        *self.conf_dir.lock().unwrap() = Some(dir);
    }
}
