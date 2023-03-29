use std::io::Read;

use crate::device_manager::io::ssh_dir;
use crate::device_manager::PrivateKey;
use crate::error::Error;

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

    pub fn name(&self) -> Result<String, Error> {
        return match self {
            PrivateKey::Path { name } => Ok(name.clone()),
            PrivateKey::Data { data } => Ok(format!(
                "webos_{}",
                &hex::encode(&sha256::digest(data.as_bytes())[..10])
            )),
        };
    }
}
