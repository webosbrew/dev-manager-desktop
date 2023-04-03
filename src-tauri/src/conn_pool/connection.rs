use std::ops::{Deref, DerefMut};
use std::sync::Mutex;

use libssh_rs::{AuthStatus, Session, SshKey, SshOption};
use uuid::Uuid;

use crate::conn_pool::DeviceConnection;
use crate::device_manager::Device;
use crate::error::Error;

impl DeviceConnection {
    pub(crate) fn new(device: Device) -> Result<DeviceConnection, Error> {
        let mut session = Session::new()?;
        session.set_option(SshOption::Hostname(device.host.clone()))?;
        session.set_option(SshOption::Port(device.port.clone()))?;
        session.set_option(SshOption::User(Some(device.username.clone())))?;
        session.set_option(SshOption::HostKeys(format!("ssh-ed25519,ecdsa-sha2-nistp521,ecdsa-sha2-nistp384,ecdsa-sha2-nistp256,rsa-sha2-512,rsa-sha2-256,ssh-rsa")))?;
        session.set_option(SshOption::PublicKeyAcceptedTypes(format!("ssh-ed25519,ecdsa-sha2-nistp521,ecdsa-sha2-nistp384,ecdsa-sha2-nistp256,rsa-sha2-512,rsa-sha2-256,ssh-rsa")))?;

        session.connect()?;

        let passphrase = device.valid_passphrase();
        let priv_key_content = device
            .private_key
            .clone()
            .map(|k| k.content().unwrap())
            .unwrap();
        let priv_key = SshKey::from_privkey_base64(&priv_key_content, passphrase.as_deref())?;

        if session.userauth_publickey(None, &priv_key)? != AuthStatus::Success {
            return Err(Error::BadPassphrase);
        }
        let connection = DeviceConnection {
            id: Uuid::new_v4(),
            session,
            last_ok: Mutex::new(true),
        };
        log::debug!("Connection {} created", connection.id);
        return Ok(connection);
    }

    pub(super) fn reset_last_ok(&self) {
        *self.last_ok.lock().unwrap() = false;
    }

    pub fn mark_last_ok(&self) {
        *self.last_ok.lock().unwrap() = true;
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
        log::debug!(
            "Connection {} dropped. last_ok={}",
            self.id,
            self.last_ok.lock().unwrap()
        );
    }
}
