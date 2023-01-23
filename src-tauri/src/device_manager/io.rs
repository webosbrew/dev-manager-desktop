use std::env;
use std::fs::File;
use std::io::{BufReader, BufWriter, Error as IoError, ErrorKind, Write};
use std::path::PathBuf;

use serde_json::Value;

use crate::device_manager::{Device, Error};

pub(crate) fn read() -> Result<Vec<Device>, Error> {
    let path = devices_file_path()?;
    let file = File::open(path.as_path())?;
    let reader = BufReader::new(file);

    let raw_list: Vec<Value> = serde_json::from_reader(reader)?;
    return Ok(raw_list
        .iter()
        .filter_map(|v| serde_json::from_value::<Device>(v.clone()).ok())
        .collect());
}

pub(crate) fn write(devices: &Vec<Device>) -> Result<(), Error> {
    let path = devices_file_path()?;
    let writer = BufWriter::new(File::create(path.as_path())?);
    serde_json::to_writer_pretty(writer, devices)?;
    return Ok(());
}

fn devices_file_path() -> Result<PathBuf, IoError> {
    return match env::var("APPDATA")
        .or_else(|_| env::var("HOME"))
        .or_else(|_| env::var("USERPROFILE"))
    {
        Ok(val) => Ok(PathBuf::from(val)
            .join(".webos")
            .join("ose")
            .join("novacom-devices.json")),
        _err => Err(IoError::new(
            ErrorKind::NotFound,
            "Failed to open data path",
        )),
    };
}
