use russh_keys::key::KeyPair;
use russh_keys::load_secret_key;
use tauri::api::path::home_dir;
use crate::device_manager::Device;
use crate::session_manager::Error;

impl Device {
  pub(crate) fn secret_key(&self) -> Result<KeyPair, Error> {
    if let Some(kn) = &self.private_key {
      let key_path = home_dir().unwrap().join(".ssh").join(&kn.open_ssh);
      return if let Some(password) = &self.passphrase {
        let password = password.clone();
        load_secret_key(key_path, Some(password.as_str())).map_err(|e| Error::from(e))
      } else {
        load_secret_key(key_path, None).map_err(|e| Error::from(e))
      };
    }
    return Err(Error::unimplemented());
  }
}
