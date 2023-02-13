use std::fs::{create_dir_all, File};
use std::io::{BufReader, BufWriter, ErrorKind};
use std::path::PathBuf;
use std::{env, fs};

use serde_json::Value;
use tauri::api::path::home_dir;

use crate::device_manager::Device;
use crate::error::Error;

pub(crate) async fn read() -> Result<Vec<Device>, Error> {
    return tokio::task::spawn_blocking(move || -> Result<Vec<Device>, Error> {
        let path = devices_file_path()?;
        let file = match File::open(path.as_path()) {
            Ok(file) => file,
            Err(e) => {
                return match e.kind() {
                    ErrorKind::NotFound => Ok(Vec::new()),
                    _ => Err(e.into()),
                };
            }
        };
        let reader = BufReader::new(file);

        let raw_list: Vec<Value> = serde_json::from_reader(reader)?;
        return Ok(raw_list
            .iter()
            .filter_map(|v| serde_json::from_value::<Device>(v.clone()).ok())
            .collect());
    })
    .await
    .unwrap();
}

pub(crate) async fn write(devices: Vec<Device>) -> Result<(), Error> {
    return tokio::task::spawn_blocking(move || -> Result<(), Error> {
        let path = devices_file_path()?;
        let file = match File::create(path.as_path()) {
            Ok(file) => file,
            Err(e) => {
                match e.kind() {
                    ErrorKind::PermissionDenied => {
                        fix_devices_json_perm(path.clone())?;
                    }
                    ErrorKind::NotFound => {
                        let parent = path.parent().ok_or_else(|| Error::bad_config())?;
                        create_dir_all(parent)?;
                    }
                    _ => return Err(e.into()),
                }
                File::create(path.as_path())?
            }
        };
        log::info!("make the file writable: {:?}", path);
        file.metadata()?.permissions().set_readonly(false);
        let writer = BufWriter::new(file);
        serde_json::to_writer_pretty(writer, &devices)?;
        return Ok(());
    })
    .await
    .unwrap();
}

pub(crate) fn ssh_dir() -> Option<PathBuf> {
    return home_dir().map(|d| d.join(".ssh"));
}

pub(crate) fn ensure_ssh_dir() -> Result<PathBuf, Error> {
    let dir = ssh_dir().ok_or_else(|| Error::bad_config())?;
    if !dir.exists() {
        create_dir_all(dir.clone())?;
    }
    return Ok(dir);
}

#[cfg(target_family = "windows")]
fn devices_file_path() -> Result<PathBuf, Error> {
    let home = env::var("APPDATA")
        .or_else(|_| env::var("USERPROFILE"))
        .map_err(|_| Error::bad_config())?;
    return Ok(PathBuf::from(home)
        .join(".webos")
        .join("ose")
        .join("novacom-devices.json"));
}

#[cfg(not(unix))]
fn fix_devices_json_perm(path: PathBuf) -> Result<(), Error> {
    let mut perm = fs::metadata(path.clone())?.permissions();
    perm.set_readonly(false);
    fs::set_permissions(path, perm)?;
    return Ok(());
}

#[cfg(not(target_family = "windows"))]
fn devices_file_path() -> Result<PathBuf, Error> {
    let home = home_dir().ok_or_else(|| Error::bad_config())?;
    return Ok(home.join(".webos").join("ose").join("novacom-devices.json"));
}

#[cfg(unix)]
fn fix_devices_json_perm(path: PathBuf) -> Result<(), Error> {
    use std::os::unix::fs::PermissionsExt;
    let perm = fs::Permissions::from_mode(0o644);
    fs::set_permissions(path, perm)?;
    return Ok(());
}
