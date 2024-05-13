use std::fs::create_dir_all;
use std::path::PathBuf;

use ssh_key::private::{Ed25519Keypair, KeypairData};
use ssh_key::{LineEnding, PrivateKey};

use crate::error::Error;

pub trait GetSshDir {
    fn get_ssh_dir(&self) -> Option<PathBuf>;

    fn ensure_ssh_dir(&self) -> Result<PathBuf, Error> {
        let Some(dir) = self.get_ssh_dir() else {
            return Err(Error::bad_config());
        };
        if !dir.exists() {
            create_dir_all(&dir)?;
        }
        return Ok(dir);
    }
}

pub trait SetSshDir {
    fn set_ssh_dir(&self, dir: PathBuf);
}

pub trait GetConfDir {
    fn get_conf_dir(&self) -> Option<PathBuf>;
    fn ensure_conf_dir(&self) -> Result<PathBuf, Error> {
        let Some(dir) = self.get_conf_dir() else {
            return Err(Error::bad_config());
        };
        if !dir.exists() {
            create_dir_all(&dir)?;
        }
        return Ok(dir);
    }
}

pub trait SetConfDir {
    fn set_conf_dir(&self, dir: PathBuf);
}

pub trait GetAppSshKeyDir {
    fn get_app_ssh_key_path(&self) -> Result<PathBuf, Error>;

    fn get_app_ssh_pubkey(&self) -> Result<String, Error>;

    fn ensure_app_ssh_key_path(&self) -> Result<PathBuf, Error> {
        let path = self.get_app_ssh_key_path()?;
        if !path.exists() || !PrivateKey::read_openssh_file(&path).is_ok() {
            let mut rng = rand::thread_rng();
            let keypair = Ed25519Keypair::random(&mut rng);
            let key_comment = String::from(&format!("devman_{:x}", keypair.public)[0..15]);
            log::info!(
                "Generating new SSH key `{}` and saving to {}",
                key_comment,
                path.display()
            );
            let key_data = KeypairData::Ed25519(keypair);
            PrivateKey::new(key_data, key_comment)
                .unwrap()
                .write_openssh_file(&path, LineEnding::LF)
                .map_err(|e| Error::BadPrivateKey {
                    message: format!("{:?}", e),
                })?;
        }
        return Ok(path);
    }
}
