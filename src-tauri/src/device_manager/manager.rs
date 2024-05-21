use std::fs;
use std::path::{Path, PathBuf};

use libssh_rs::{Session, SshKey};
use tokio::fs::{remove_file, File};
use tokio::io::AsyncWriteExt;

use crate::app_dirs::{GetConfDir, GetSshDir, SetConfDir, SetSshDir};
use crate::conn_pool::DeviceConnection;
use crate::device_manager::io::{read, write};
use crate::device_manager::{Device, DeviceCheckConnection, DeviceManager, PrivateKey};
use crate::error::Error;

impl DeviceManager {
    pub async fn list(&self) -> Result<Vec<Device>, Error> {
        let devices = read(&self.ensure_conf_dir()?).await?;
        *self.devices.lock().unwrap() = devices.clone();
        return Ok(devices);
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
        return Ok(result);
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
        devices.push(device.clone());
        write(devices.clone(), &conf_dir).await?;
        return Ok(device);
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
        return Ok(());
    }

    //noinspection HttpUrlsUsage
    pub async fn novacom_getkey(&self, address: &str, passphrase: &str) -> Result<String, Error> {
        let resp = reqwest::get(format!("http://{address}:9991/webos_rsa"))
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

    pub async fn check_connection(&self, host: &str) -> Result<DeviceCheckConnection, Error> {
        async fn ssh_probe(host: &str, port: u16, user: &str) -> Result<String, Error> {
            let host = host.to_string();
            let user = user.to_string();
            return tokio::task::spawn_blocking(move || {
                let ssh_sess = Session::new()?;
                DeviceConnection::session_init(&ssh_sess)?;
                ssh_sess.set_option(libssh_rs::SshOption::Hostname(host))?;
                ssh_sess.set_option(libssh_rs::SshOption::Port(port))?;
                ssh_sess.set_option(libssh_rs::SshOption::User(Some(user)))?;
                ssh_sess.connect()?;
                return Ok(ssh_sess.get_server_banner()?);
            })
            .await
            .expect("Failed to spawn_blocking");
        }
        //noinspection HttpUrlsUsage
        async fn key_server_probe(host: &str) -> Result<String, Error> {
            return reqwest::get(format!("http://{host}:9991/webos_rsa"))
                .await?
                .error_for_status()?
                .text()
                .await
                .map_err(Error::from);
        }
        return Ok(DeviceCheckConnection {
            ssh_22: ssh_probe(host, 22, "root").await.ok(),
            ssh_9922: ssh_probe(host, 9922, "prisoner").await.ok(),
            key_server: key_server_probe(host).await.is_ok(),
        });
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
