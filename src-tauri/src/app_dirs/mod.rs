//! Where this app keeps its SSH keys and the device list.
//!
//! The directories are not known until the Tauri runtime is ready, so each
//! manager holds a [`DirSlot`] that stays empty until then.

use ssh_key::private::{Ed25519Keypair, KeypairData};
use ssh_key::{rand_core::OsRng, LineEnding, PrivateKey};
use std::fs::create_dir_all;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Runtime};

use crate::error::Error;

/// A directory set once at startup and read afterwards.
#[derive(Default)]
pub struct DirSlot(Mutex<Option<PathBuf>>);

impl DirSlot {
    pub fn set(&self, dir: PathBuf) {
        *self.0.lock().expect("Failed to lock DirSlot") = Some(dir);
    }

    pub fn get(&self) -> Option<PathBuf> {
        self.0.lock().expect("Failed to lock DirSlot").clone()
    }

    /// The directory, created if it is absent.
    pub fn ensure(&self) -> Result<PathBuf, Error> {
        let dir = self.get().ok_or_else(Error::bad_config)?;
        if !dir.exists() {
            create_dir_all(&dir)?;
        }
        Ok(dir)
    }
}

/// The directory holding the SSH keys.
///
/// On mobile this is inside the app's own config directory, because there is no
/// home directory to share with anything else.
pub fn ssh_dir<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    let home_dir = if cfg!(mobile) {
        app.path().app_config_dir()
    } else {
        app.path().home_dir()
    };
    home_dir
        .map(|home| home.join(".ssh"))
        .and_then(|path| {
            create_dir_all(&path)?;
            #[cfg(target_family = "unix")]
            {
                use std::fs::Permissions;
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(&path, Permissions::from_mode(0o700))?;
            }
            Ok(path)
        })
        .or_else(|_| app.path().data_dir())
        .ok()
}

/// The directory holding the device list. Off mobile this is the one the webOS
/// SDK uses, because the list is shared with it.
pub fn conf_dir<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    // Windows reads the environment, so it never touches `app`.
    let _ = app;
    #[cfg(mobile)]
    {
        app.path().data_dir().ok()
    }
    #[cfg(not(mobile))]
    {
        #[cfg(target_family = "windows")]
        let home = std::env::var("APPDATA")
            .or_else(|_| std::env::var("USERPROFILE"))
            .map(PathBuf::from)
            .ok();
        #[cfg(not(target_family = "windows"))]
        let home = app.path().home_dir().ok();
        home.map(|d| d.join(".webos").join("ose"))
    }
}

/// The app's own SSH key, the one it offers to a device it sets up.
pub trait GetAppSshKeyDir {
    fn get_app_ssh_key_path(&self) -> Result<PathBuf, Error>;

    fn get_app_ssh_pubkey(&self) -> Result<String, Error>;

    /// The key path, with a key generated first if there isn't a usable one.
    fn ensure_app_ssh_key_path(&self) -> Result<PathBuf, Error> {
        let path = self.get_app_ssh_key_path()?;
        if !path.exists() || PrivateKey::read_openssh_file(&path).is_err() {
            let keypair = Ed25519Keypair::random(&mut OsRng);
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
        Ok(path)
    }
}
