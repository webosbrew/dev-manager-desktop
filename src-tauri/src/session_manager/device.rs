use russh_keys::key::{KeyPair, SignatureHash};

use crate::device_manager::{Device, PrivateKey};
use crate::session_manager::Error;


impl Device {

    pub(crate) fn secret_key(&self, hash: Option<SignatureHash>) -> Result<KeyPair, Error> {
        if let Some(key) = &self.private_key {
            return Ok(key.priv_key(self.passphrase.as_deref(), hash)?);
        }
        return Err(Error::unimplemented());
    }
}
