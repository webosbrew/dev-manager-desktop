use std::fmt::{Debug, Formatter};
use std::ops::{Deref, DerefMut};
use std::sync::Mutex;
use std::time::Duration;

use libssh_rs::{AuthStatus, Session, SshKey, SshOption};
use uuid::Uuid;

use crate::conn_pool::DeviceConnection;
use crate::device_manager::Device;
use crate::error::Error;

impl DeviceConnection {
    pub(crate) fn new(device: Device) -> Result<DeviceConnection, Error> {
        let session = Session::new()?;
        session.set_option(SshOption::Timeout(Duration::from_secs(10)))?;
        session.set_option(SshOption::Hostname(device.host.clone()))?;
        session.set_option(SshOption::Port(device.port.clone()))?;
        session.set_option(SshOption::User(Some(device.username.clone())))?;
        session.set_option(SshOption::HostKeys(format!("ssh-ed25519,ecdsa-sha2-nistp521,ecdsa-sha2-nistp384,ecdsa-sha2-nistp256,rsa-sha2-512,rsa-sha2-256,ssh-rsa")))?;
        session.set_option(SshOption::PublicKeyAcceptedTypes(format!("ssh-ed25519,ecdsa-sha2-nistp521,ecdsa-sha2-nistp384,ecdsa-sha2-nistp256,rsa-sha2-512,rsa-sha2-256,ssh-rsa")))?;
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
            let priv_key_content = private_key.content()?;
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
            "DeviceConnection {{ id={}, device.name={} }}",
            self.id, self.device.name
        ))
    }
}
