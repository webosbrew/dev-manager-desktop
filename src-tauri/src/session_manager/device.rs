use russh_keys::key::{KeyPair, SignatureHash};

use crate::device_manager::{Device, PrivateKey};
use crate::session_manager::Error;

impl Device {
    pub(crate) fn need_legacy_algo(&self) -> bool {
        if let Some(key) = &self.private_key {
            return match key {
                PrivateKey::Path { name } => name.starts_with("webos_"),
                PrivateKey::Data { .. } => true,
            };
        }
        return false;
    }

    pub(crate) fn secret_key(&self, hash: Option<SignatureHash>) -> Result<KeyPair, Error> {
        if let Some(key) = &self.private_key {
            return Ok(key.priv_key(self.passphrase.as_deref(), hash)?);
        }
        return Err(Error::unimplemented());
    }
}
