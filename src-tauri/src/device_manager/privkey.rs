use crate::device_manager::io::ssh_dir;
use russh_keys::key::{KeyPair, SignatureHash};
use russh_keys::{decode_secret_key, load_secret_key, Error};
use std::io::Read;

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

    pub fn priv_key(
        &self,
        passphrase: Option<&str>,
        hash: Option<SignatureHash>,
    ) -> Result<KeyPair, Error> {
        let passphrase = passphrase.filter(|s| !s.is_empty());
        let content = self.content()?;
        let mut keypair = decode_secret_key(&content, passphrase.clone())?;
        if let Some(hash) = hash {
            keypair = keypair.with_signature_hash(hash).unwrap_or(keypair);
        }
        return Ok(keypair);
    }
}
