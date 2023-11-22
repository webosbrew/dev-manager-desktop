use std::fmt::{Debug, Formatter};
use std::io::Read;
use std::ops::{Deref, DerefMut};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use libssh_rs::{AuthStatus, Session, SshKey, SshOption};
use regex::Regex;
use uuid::Uuid;

use crate::conn_pool::{DeviceConnection, DeviceConnectionUserInfo, Id};
use crate::device_manager::Device;
use crate::error::Error;

impl DeviceConnection {
    pub(crate) fn new(device: Device, ssh_dir: Option<&Path>) -> Result<DeviceConnection, Error> {
        let kex = vec![
            "curve25519-sha256",
            "curve25519-sha256@libssh.org",
            "ecdh-sha2-nistp256",
            "ecdh-sha2-nistp384",
            "ecdh-sha2-nistp521",
            "diffie-hellman-group18-sha512",
            "diffie-hellman-group16-sha512",
            "diffie-hellman-group-exchange-sha256",
            "diffie-hellman-group14-sha256",
            "diffie-hellman-group1-sha1",
            "diffie-hellman-group14-sha1",
        ];
        let hmac = vec![
            "hmac-sha2-256-etm@openssh.com",
            "hmac-sha2-512-etm@openssh.com",
            "hmac-sha2-256",
            "hmac-sha2-512",
            "hmac-sha1-96",
            "hmac-sha1",
            "hmac-md5",
        ];
        let key_types = vec![
            "ssh-ed25519",
            "ecdsa-sha2-nistp521",
            "ecdsa-sha2-nistp384",
            "ecdsa-sha2-nistp256",
            "rsa-sha2-512",
            "rsa-sha2-256",
            "ssh-rsa",
        ];
        let session = Session::new()?;
        session.set_option(SshOption::Timeout(Duration::from_secs(10)))?;
        session.set_option(SshOption::Hostname(device.host.clone()))?;
        session.set_option(SshOption::Port(device.port.clone()))?;
        session.set_option(SshOption::User(Some(device.username.clone())))?;
        session.set_option(SshOption::KeyExchange(kex.join(",")))?;
        session.set_option(SshOption::HmacCS(hmac.join(",")))?;
        session.set_option(SshOption::HmacSC(hmac.join(",")))?;
        session.set_option(SshOption::HostKeys(key_types.join(",")))?;
        session.set_option(SshOption::PublicKeyAcceptedTypes(key_types.join(",")))?;
        session.set_option(SshOption::ProcessConfig(false))?;
        #[cfg(windows)]
        {
            session.set_option(SshOption::KnownHosts(Some(format!("C:\\nul"))))?;
            session.set_option(SshOption::GlobalKnownHosts(Some(format!("C:\\nul"))))?;
        }

        #[cfg(not(windows))]
        {
            session.set_option(SshOption::KnownHosts(Some(format!("/dev/null"))))?;
            session.set_option(SshOption::GlobalKnownHosts(Some(format!("/dev/null"))))?;
        }

        session.connect()?;

        if let Some(private_key) = &device.private_key {
            let passphrase = device.valid_passphrase();
            let priv_key_content = private_key.content(ssh_dir)?;
            let priv_key = SshKey::from_privkey_base64(&priv_key_content, passphrase.as_deref())?;

            if session.userauth_publickey(None, &priv_key)? != AuthStatus::Success {
                return Err(Error::Authorization {
                    message: format!("Key authorization failed"),
                });
            }
        } else if let Some(password) = &device.password {
            if session.userauth_password(None, Some(password))? != AuthStatus::Success {
                return Err(Error::Authorization {
                    message: format!("Bad SSH password"),
                });
            }
        } else if session.userauth_none(None)? != AuthStatus::Success {
            return Err(Error::Authorization {
                message: format!("Host needs authorization"),
            });
        }
        let connection = DeviceConnection {
            id: Uuid::new_v4(),
            device: device.clone(),
            user: DeviceConnectionUserInfo::new(&session)?,
            session,
            last_ok: Mutex::new(true),
        };
        log::info!("{:?} created", connection);
        return Ok(connection);
    }

    pub(super) fn reset_last_ok(&self) {
        *self
            .last_ok
            .lock()
            .expect("Failed to lock DeviceConnection::last_ok") = false;
    }

    pub fn mark_last_ok(&self) {
        *self
            .last_ok
            .lock()
            .expect("Failed to lock DeviceConnection::last_ok") = true;
    }
}

impl Deref for DeviceConnection {
    type Target = Session;

    fn deref(&self) -> &Self::Target {
        return &self.session;
    }
}

impl DerefMut for DeviceConnection {
    fn deref_mut(&mut self) -> &mut Self::Target {
        return &mut self.session;
    }
}

impl Drop for DeviceConnection {
    fn drop(&mut self) {
        log::info!(
            "Dropping {:?}, last_ok={}",
            self,
            self.last_ok
                .lock()
                .expect("Failed to lock DeviceConnection::last_ok")
        );
    }
}

impl Debug for DeviceConnection {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_fmt(format_args!(
            "DeviceConnection {{ id={}, device.name={}, user={:?} }}",
            self.id, self.device.name, self.user,
        ))
    }
}

impl DeviceConnectionUserInfo {
    fn new(session: &Session) -> Result<Option<DeviceConnectionUserInfo>, Error> {
        let ch = session.new_channel()?;
        ch.open_session()?;
        ch.request_exec("id")?;
        let mut buf = String::new();
        ch.stdout().read_to_string(&mut buf)?;
        let exit_code = ch.get_exit_status().unwrap_or(0);
        ch.close()?;
        if exit_code != 0 {
            return Err(Error::Message {
                message: format!("id command failed with exit code {}", exit_code),
            });
        }
        return Ok(DeviceConnectionUserInfo::parse(&buf));
    }

    fn parse(s: &str) -> Option<DeviceConnectionUserInfo> {
        let mut uid: Option<Id> = None;
        let mut gid: Option<Id> = None;
        let mut groups: Vec<Id> = Vec::new();
        for seg in s.split_ascii_whitespace() {
            let Some((k, v)) = seg.split_once('=') else {
                continue;
            };
            match k {
                "uid" => {
                    uid = Id::parse(v);
                }
                "gid" => {
                    gid = Id::parse(v);
                }
                "groups" => {
                    for group in v.split(',') {
                        if let Some(id) = Id::parse(group) {
                            groups.push(id);
                        }
                    }
                }
                _ => {}
            }
        }
        let (Some(uid), Some(gid)) = (uid, gid) else {
            return None;
        };
        return Some(DeviceConnectionUserInfo { uid, gid, groups });
    }
}

impl Debug for Id {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        if let Some(name) = &self.name {
            f.write_fmt(format_args!("{}({})", self.id, name))
        } else {
            f.write_fmt(format_args!("{}", self.id))
        }
    }
}
impl Id {
    fn parse(s: &str) -> Option<Self> {
        let regex = Regex::new("(\\d+)(\\(\\w+\\))?").unwrap();
        let Some(caps) = regex.captures(s) else {
            return None;
        };
        return Some(Self {
            id: u32::from_str_radix(caps.get(1).unwrap().as_str(), 10).unwrap(),
            name: caps.get(2).map(|s| {
                s.as_str()
                    .trim_matches(|c| c == '(' || c == ')')
                    .to_string()
            }),
        });
    }
}
