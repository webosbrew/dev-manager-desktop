use crate::app_dirs::{GetConfDir, GetSshDir, SetConfDir, SetSshDir};
use crate::device_manager::privkey::PrivateKeyExt;
use crate::device_manager::{
    Device, DeviceCheckConnection, DeviceManager, PrivateKey, PrivateKeyInfo,
};
use crate::error::Error;
use ares_connection_lib::setup::{fetch_key, NOVACOM_KEY_PORT};
use ares_device_lib::DeviceManager as SharedDeviceManager;
use libssh_rs::{PublicKeyHashType, SshKey};
use port_check::is_port_reachable_with_timeout;
use std::io::{Error as IoError, ErrorKind};
use std::path::PathBuf;
use std::time::Duration;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;

impl DeviceManager {
    /// The shared manager, pointed at this app's own directories.
    fn shared(&self) -> Result<SharedDeviceManager, Error> {
        Ok(SharedDeviceManager::with_dirs(
            self.ensure_conf_dir()?,
            self.ensure_ssh_dir()?,
        ))
    }

    /// Runs a shared-manager call off the async runtime, because it reads and
    /// writes the device list on the calling thread.
    async fn with_shared<T, F>(&self, f: F) -> Result<T, Error>
    where
        T: Send + 'static,
        F: FnOnce(SharedDeviceManager) -> Result<T, IoError> + Send + 'static,
    {
        let shared = self.shared()?;
        tauri::async_runtime::spawn_blocking(move || Ok(f(shared)?))
            .await
            .expect("critical failure in device manager task")
    }

    pub async fn list(&self) -> Result<Vec<Device>, Error> {
        let devices = self.with_shared(|shared| shared.list()).await?;
        *self.devices.lock().unwrap() = devices.clone();
        Ok(devices)
    }

    pub async fn find(&self, name: &str) -> Result<Option<Device>, Error> {
        let devices = self.list().await?;
        Ok(devices.into_iter().find(|d| d.name == name))
    }

    pub async fn set_default(&self, name: &str) -> Result<Option<Device>, Error> {
        let name = name.to_string();
        self.with_shared(move |shared| shared.set_default(&name))
            .await
    }

    pub async fn add(&self, device: &Device) -> Result<Device, Error> {
        let mut device = device.clone();
        // An inline key becomes a file here, so the shared code sees a name it
        // can resolve. Naming the file needs libssh, which ares-device-lib has
        // no dependency on, so this part stays.
        if let Some(key @ PrivateKey::Data { data }) = &device.private_key {
            let name = key.name(device.valid_passphrase())?;
            let key_path = self.ensure_ssh_dir()?.join(&name);
            let mut file = File::create(key_path).await?;
            file.write(data.as_bytes()).await?;
            device.private_key = Some(PrivateKey::Name { name });
        }
        log::info!("Save device {}", device.name);
        self.with_shared(move |shared| {
            // Unlike the CLI, editing a device saves it under the name it
            // already has, so replace an existing entry instead of refusing it.
            if shared.find_or_default(Some(&device.name))?.is_some() {
                shared.modify(&device.name.clone(), &device)
            } else {
                shared.add(&device)
            }
        })
        .await
    }

    /// Removes a device, including one the webOS SDK marks `indelible`. The UI
    /// asks the person to confirm first, so there is nothing left to protect
    /// them from.
    pub async fn remove(&self, name: &str, remove_key: bool) -> Result<(), Error> {
        let name = name.to_string();
        self.with_shared(move |shared| shared.remove(&name, remove_key, true))
            .await
    }

    pub async fn novacom_getkey(&self, address: &str, passphrase: &str) -> Result<String, Error> {
        let host = address.to_string();
        let content =
            tauri::async_runtime::spawn_blocking(move || fetch_key(&host, NOVACOM_KEY_PORT))
                .await
                .unwrap()
                .map_err(|e| match e.kind() {
                    // The device answered, but not with a key.
                    ErrorKind::NotFound => Error::NotFound,
                    _ => e.into(),
                })?;

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
