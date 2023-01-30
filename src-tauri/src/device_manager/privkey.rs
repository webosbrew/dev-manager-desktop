use crate::device_manager::io::ssh_dir;
use russh_keys::key::{KeyPair, SignatureHash};
use russh_keys::{decode_secret_key, load_secret_key, Error};

use crate::device_manager::PrivateKey;

impl PrivateKey {
    pub fn priv_key(
        &self,
        passphrase: Option<&str>,
        hash: Option<SignatureHash>,
    ) -> Result<KeyPair, Error> {
        let passphrase = passphrase.filter(|s| !s.is_empty());
        let mut keypair = match self {
            PrivateKey::Path { name } => {
                load_secret_key(ssh_dir().unwrap().join(name), passphrase.clone())
            }
            PrivateKey::Data { data } => decode_secret_key(data, passphrase.clone()),
        }?;
        if let Some(hash) = hash {
            keypair = keypair.with_signature_hash(hash).unwrap_or(keypair);
        }
        return Ok(keypair);
    }
}
