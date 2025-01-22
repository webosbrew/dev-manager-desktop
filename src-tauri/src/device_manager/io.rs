use std::fs;
use std::fs::{create_dir_all, File};
use std::io::{BufReader, BufWriter, ErrorKind};
use std::path::{Path, PathBuf};

use serde_json::Value;

use crate::device_manager::Device;
use crate::error::Error;

pub(crate) async fn read(conf_dir: &Path) -> Result<Vec<Device>, Error> {
    let conf_dir = conf_dir.to_path_buf();
    tauri::async_runtime::spawn_blocking(move || -> Result<Vec<Device>, Error> {
        let path = devices_file_path(&conf_dir);
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
    .expect("critical failure in app::io::read task")
}

pub(crate) async fn write(devices: Vec<Device>, conf_dir: &Path) -> Result<(), Error> {
    let conf_dir = conf_dir.to_path_buf();
    tauri::async_runtime::spawn_blocking(move || -> Result<(), Error> {
        let path = devices_file_path(&conf_dir);
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
    .expect("critical failure in app::io::write task")
}

fn devices_file_path(conf_dir: &Path) -> PathBuf {
    conf_dir.join("novacom-devices.json")
}

#[cfg(not(unix))]
fn fix_devices_json_perm(path: PathBuf) -> Result<(), Error> {
    let mut perm = fs::metadata(path.clone())?.permissions();
    perm.set_readonly(false);
    fs::set_permissions(path, perm)?;
    Ok(())
}

#[cfg(unix)]
fn fix_devices_json_perm(path: PathBuf) -> Result<(), Error> {
    use std::os::unix::fs::PermissionsExt;
    let perm = fs::Permissions::from_mode(0o644);
    fs::set_permissions(path, perm)?;
    Ok(())
}
