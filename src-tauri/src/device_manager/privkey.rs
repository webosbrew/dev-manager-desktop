use std::io::Read;
use std::path::Path;

use libssh_rs::{PublicKeyHashType, SshKey};

use crate::device_manager::PrivateKey;
use crate::error::Error;

impl PrivateKey {
    pub fn content(&self, ssh_dir: Option<&Path>) -> Result<String, Error> {
        match self {
            PrivateKey::Path { name } => {
                let mut secret_file =
                    std::fs::File::open(ssh_dir.ok_or(Error::bad_config())?.join(name))?;
                let mut secret = String::new();
                secret_file.read_to_string(&mut secret)?;
                Ok(secret)
            }
            PrivateKey::Data { data } => Ok(data.clone()),
        }
    }

    pub fn name(&self, passphrase: Option<String>) -> Result<String, Error> {
        match self {
            PrivateKey::Path { name } => Ok(name.clone()),
            PrivateKey::Data { data } => Ok(String::from(
                &hex::encode(
                    SshKey::from_privkey_base64(data, passphrase.as_deref())?
                        .get_public_key_hash(PublicKeyHashType::Sha256)?,
                )[..10],
            )),
        }
    }
}
