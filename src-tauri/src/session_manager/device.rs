use russh_keys::key::KeyPair;

use crate::device_manager::Device;
use crate::session_manager::Error;

impl Device {
    pub(crate) fn secret_key(&self) -> Result<KeyPair, Error> {
        if let Some(key) = &self.private_key {
            return Ok(key.priv_key(self.passphrase.as_deref())?);
        }
        return Err(Error::unimplemented());
    }
}
