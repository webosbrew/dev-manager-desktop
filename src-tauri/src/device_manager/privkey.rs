use crate::device_manager::io::ssh_dir;
use russh_keys::key::{KeyPair, SignatureHash};
use russh_keys::{decode_secret_key_with_hash, load_secret_key_with_hash, Error};

use crate::device_manager::PrivateKey;

impl PrivateKey {
    pub fn priv_key(
        &self,
        passphrase: Option<&str>,
        hash: Option<SignatureHash>,
    ) -> Result<KeyPair, Error> {
        return match self {
            PrivateKey::Path { name } => {
                load_secret_key_with_hash(ssh_dir().unwrap().join(name), passphrase.clone(), hash)
            }
            PrivateKey::Data { data } => {
                decode_secret_key_with_hash(data, passphrase.clone(), hash)
            }
        };
    }
}
