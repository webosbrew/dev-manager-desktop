use crate::app_dirs::{GetConfDir, GetSshDir, SetConfDir, SetSshDir};
use crate::device_manager::io::{read, write};
use crate::device_manager::{
    novacom, Device, DeviceCheckConnection, DeviceManager, PrivateKey, PrivateKeyInfo,
};
use crate::error::Error;
use libssh_rs::{PublicKeyHashType, SshKey};
use port_check::is_port_reachable_with_timeout;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::fs::{remove_file, File};
use tokio::io::AsyncWriteExt;

impl DeviceManager {
    pub async fn list(&self) -> Result<Vec<Device>, Error> {
        let devices = read(&self.ensure_conf_dir()?).await?;
        *self.devices.lock().unwrap() = devices.clone();
        Ok(devices)
    }

    pub async fn find(&self, name: &str) -> Result<Option<Device>, Error> {
        let devices = self.list().await?;
        Ok(devices.into_iter().find(|d| d.name == name))
    }

    pub async fn set_default(&self, name: &str) -> Result<Option<Device>, Error> {
        let conf_dir = self.ensure_conf_dir()?;
        let mut devices = read(&conf_dir).await?;
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
        write(devices, &conf_dir).await?;
        Ok(result)
    }

    pub async fn add(&self, device: &Device) -> Result<Device, Error> {
        let conf_dir = self.ensure_conf_dir()?;
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
        let mut devices = read(&conf_dir).await?;
        if let Some(existing) = devices.iter_mut().find(|ref d| d.name == device.name) {
            *existing = device.clone();
        } else {
            devices.push(device.clone());
        }
        write(devices.clone(), &conf_dir).await?;
        Ok(device)
    }

    pub async fn remove(&self, name: &str, remove_key: bool) -> Result<(), Error> {
        let conf_dir = self.ensure_conf_dir()?;
        let devices = read(&conf_dir).await?;
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
        write(will_keep, &conf_dir).await?;
        Ok(())
    }

    pub async fn novacom_getkey(&self, address: &str, passphrase: &str) -> Result<String, Error> {
        let host = address.to_string();
        let content = tauri::async_runtime::spawn_blocking(move || novacom::fetch_key(&host, 9991))
            .await
            .unwrap()?;

        match SshKey::from_privkey_base64(&content, Some(passphrase)) {
            Ok(_) => Ok(content),
            _ => Err(if passphrase.is_empty() {
                Error::PassphraseRequired
            } else {
                Error::BadPassphrase
            }),
        }
    }

    pub async fn key_verify(
        &self,
        content: &str,
        passphrase: &str,
    ) -> Result<PrivateKeyInfo, Error> {
        match SshKey::from_privkey_base64(content, Some(passphrase)) {
            Ok(key) => Ok(PrivateKeyInfo {
                sha1: key.get_public_key_hash_hexa(PublicKeyHashType::Sha1)?,
                sha256: key.get_public_key_hash_hexa(PublicKeyHashType::Sha256)?,
            }),
            _ => Err(if passphrase.is_empty() {
                Error::PassphraseRequired
            } else {
                Error::BadPassphrase
            }),
        }
    }

    pub async fn check_connection(&self, host: &str) -> Result<DeviceCheckConnection, Error> {
        Ok(DeviceCheckConnection {
            ssh_22: is_port_reachable_with_timeout(format!("{host}:22"), Duration::from_secs(10)),
            ssh_9922: is_port_reachable_with_timeout(
                format!("{host}:9922"),
                Duration::from_secs(10),
            ),
            key_server: is_port_reachable_with_timeout(
                format!("{host}:9991"),
                Duration::from_secs(10),
            ),
        })
    }
}

impl GetSshDir for DeviceManager {
    fn get_ssh_dir(&self) -> Option<PathBuf> {
        self.ssh_dir.lock().unwrap().clone()
    }
}

impl SetSshDir for DeviceManager {
    fn set_ssh_dir(&self, dir: PathBuf) {
        *self.ssh_dir.lock().unwrap() = Some(dir);
    }
}

impl GetConfDir for DeviceManager {
    fn get_conf_dir(&self) -> Option<PathBuf> {
        self.conf_dir.lock().unwrap().clone()
    }
}

impl SetConfDir for DeviceManager {
    fn set_conf_dir(&self, dir: PathBuf) {
        *self.conf_dir.lock().unwrap() = Some(dir);
    }
}
