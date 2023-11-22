use crate::error::Error;
use std::fs::create_dir_all;
use std::path::PathBuf;

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
