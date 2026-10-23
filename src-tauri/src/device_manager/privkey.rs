use std::io::{ErrorKind, Read};
use std::path::Path;

use libssh_rs::{PublicKeyHashType, SshKey};

use crate::device_manager::PrivateKey;
use crate::error::Error;

/// Key handling that is specific to this app: a configurable SSH directory, a
/// mobile fallback, and richer errors. [`PrivateKey`] itself is shared with
/// the ares-cli-rs tools.
pub trait PrivateKeyExt {
    fn read_content(&self, ssh_dir: Option<&Path>) -> Result<String, Error>;
    fn name(&self, passphrase: Option<String>) -> Result<String, Error>;
}

impl PrivateKeyExt for PrivateKey {
    fn read_content(&self, ssh_dir: Option<&Path>) -> Result<String, Error> {
        match self {
            PrivateKey::Name { name } => {
                let mut ssh_dir = ssh_dir.ok_or(Error::bad_config())?;
                if cfg!(mobile) {
                    let ssh_parent = ssh_dir.parent().ok_or(Error::bad_config())?;
                    if ssh_parent.join(name).is_file() {
                        ssh_dir = ssh_parent;
                    }
                }
                let mut secret_file =
                    std::fs::File::open(ssh_dir.join(name)).map_err(|err| match err.kind() {
                        ErrorKind::NotFound => Error::BadPrivateKey {
                            message: format!("Private key file not found: {}", name),
                        },
                        _ => err.into(),
                    })?;
                let mut secret = String::new();
                secret_file.read_to_string(&mut secret)?;
                Ok(secret)
            }
            PrivateKey::Path { path } => {
                let mut secret_file =
                    std::fs::File::open(path).map_err(|err| match err.kind() {
                        ErrorKind::NotFound => Error::BadPrivateKey {
                            message: format!("Private key file not found: {}", path),
                        },
                        _ => err.into(),
                    })?;
                let mut secret = String::new();
                secret_file.read_to_string(&mut secret)?;
                Ok(secret)
            }
            PrivateKey::Data { data } => Ok(data.clone()),
        }
    }

    fn name(&self, passphrase: Option<String>) -> Result<String, Error> {
        match self {
            PrivateKey::Name { name } => Ok(name.clone()),
            PrivateKey::Path { path } => Ok(Path::new(path)
                .file_name()
                .ok_or_else(Error::bad_config)?
                .to_string_lossy()
                .to_string()),
            PrivateKey::Data { data } => Ok(String::from(
                &hex::encode(
                    SshKey::from_privkey_base64(data, passphrase.as_deref())?
                        .get_public_key_hash(PublicKeyHashType::Sha256)?,
                )[..10],
            )),
        }
    }
}
