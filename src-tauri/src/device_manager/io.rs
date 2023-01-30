use std::env;
use std::fs::{create_dir_all, File};
use std::io::{BufReader, BufWriter, ErrorKind};
use std::path::PathBuf;

use serde_json::Value;
use tauri::api::path::home_dir;

use crate::device_manager::{Device, Error};

pub(crate) async fn read() -> Result<Vec<Device>, Error> {
    return tokio::task::spawn_blocking(move || -> Result<Vec<Device>, Error> {
        let path = devices_file_path()?;
        let file = match File::open(path.as_path()) {
            Ok(file) => file,
            Err(e) => {
                return match e.kind() {
                    ErrorKind::NotFound => Ok(Vec::new()),
                    _ => Err(e.into()),
                }
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
            Err(e) => match e.kind() {
                ErrorKind::NotFound => {
                    let parent = path.parent().ok_or_else(|| Error::bad_config())?;
                    create_dir_all(parent)?;
                    File::create(path.as_path())?
                }
                _ => return Err(e.into()),
            },
        };
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

fn devices_file_path() -> Result<PathBuf, Error> {
    let home = env::var("APPDATA")
        .or_else(|_| env::var("HOME"))
        .or_else(|_| env::var("USERPROFILE"))
        .map_err(|_| Error::bad_config())?;
    return Ok(PathBuf::from(home)
        .join(".webos")
        .join("ose")
        .join("novacom-devices.json"));
}
