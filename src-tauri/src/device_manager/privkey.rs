use std::io::Read;

use russh_keys::{decode_secret_key, Error};
use russh_keys::key::KeyPair;

use crate::device_manager::io::ssh_dir;
use crate::device_manager::PrivateKey;

impl PrivateKey {
    pub fn content(&self) -> Result<String, Error> {
        return match self {
            PrivateKey::Path { name } => {
                let mut secret_file = std::fs::File::open(ssh_dir().unwrap().join(name))?;
                let mut secret = String::new();
                secret_file.read_to_string(&mut secret)?;
                Ok(secret)
            }
            PrivateKey::Data { data } => Ok(data.clone()),
        };
    }

    pub fn key_pair(&self, passphrase: Option<&str>) -> Result<KeyPair, Error> {
        let passphrase = passphrase.filter(|s| !s.is_empty());
        let content = self.content()?;
        return Ok(decode_secret_key(&content, passphrase.clone())?);
    }
}
