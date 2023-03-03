use crate::device_manager::Device;
use crate::error::Error;
use crate::remote_files::path::escape_path;
use crate::remote_files::{FileItem, LinkInfo};
use crate::session_manager::SessionManager;
use file_mode::Mode;
use path_slash::PathBufExt;
use posix_errors;
use serde::Deserialize;
use serde_json::{Map, Value};
use ssh2::FileType;
use std::io::Error as IoError;
use std::io::ErrorKind;
use std::path::PathBuf;

pub(crate) async fn exec(
    manager: &SessionManager,
    device: &Device,
    path: &String,
) -> Result<Vec<FileItem>, Error> {
    let output = match manager
        .exec(
            device.clone(),
            &format!(
                "if command -v python3 &>/dev/null; then python3 - {}; else python2 - {}; fi",
                escape_path(&path),
                escape_path(&path)
            ),
            Some(include_bytes!("./helpers/ls.py")),
        )
        .await
    {
        Err(Error::ExitStatus {
            message,
            exit_code,
            stderr,
        }) => {
            if stderr.starts_with(b"{") {
                let value = serde_json::from_slice::<Map<String, Value>>(&stderr)?;
                log::info!("{:?}", value);
                if let Some(errno) = value.get("errno").map(|v| v.as_u64().unwrap()) {
                    return Err(error_from_posix(errno as i32).into());
                }
            }
            return Err(Error::ExitStatus {
                message,
                exit_code,
                stderr,
            });
        }
        r => r?,
    };
    let entries = serde_json::from_slice::<Vec<FileEntry>>(&output)?;
    return Ok(entries.iter().map(|e| e.into()).collect());
}

#[derive(Deserialize, Clone, Debug)]
struct FileEntry {
    name: String,
    stat: FileStat,
    abspath: String,
    link: Option<LinkInfo>,
}

#[derive(Deserialize, Clone, Debug)]
struct FileStat {
    mode: u32,
    uid: u32,
    gid: u32,
    size: u32,
    atime: f64,
    ctime: f64,
    mtime: f64,
}

impl From<&(PathBuf, ssh2::FileStat)> for FileItem {
    fn from((path, stat): &(PathBuf, ssh2::FileStat)) -> Self {
        let posix_path = path.to_slash().unwrap();
        return FileItem {
            filename: String::from(path.file_name().unwrap().to_str().unwrap()),
            r#type: format!("{}", abbrev_type(stat.file_type())),
            mode: unix_mode::to_string(stat.perm.unwrap_or(0)),
            user: format!("{}", stat.uid.unwrap_or(0)),
            group: format!("{}", stat.gid.unwrap_or(0)),
            size: stat.size.unwrap_or(0) as usize,
            mtime: stat.mtime.unwrap_or(0) as f64,
            abspath: String::from(posix_path),
            link: None,
        };
    }
}

impl From<&FileEntry> for FileItem {
    fn from(value: &FileEntry) -> FileItem {
        let mode = format!("{}", Mode::from(value.stat.mode));
        return FileItem {
            filename: value.name.clone(),
            r#type: String::from(&mode[..1]),
            mode: String::from(&mode[1..]),
            user: format!("{}", value.stat.uid),
            group: format!("{}", value.stat.gid),
            size: value.stat.size as usize,
            mtime: value.stat.mtime,
            abspath: value.abspath.clone(),
            link: value.link.clone(),
        };
    }
}

fn abbrev_type(value: FileType) -> char {
    return match value {
        FileType::NamedPipe => 'p',
        FileType::CharDevice => 'c',
        FileType::BlockDevice => 'b',
        FileType::Directory => 'd',
        FileType::RegularFile => '-',
        FileType::Symlink => 'l',
        FileType::Socket => 's',
        FileType::Other(_) => ' ',
    };
}

fn error_from_posix(value: i32) -> IoError {
    return match value {
        posix_errors::EACCES => IoError::from(ErrorKind::PermissionDenied),
        posix_errors::ENOENT => IoError::from(ErrorKind::NotFound),
        _ => IoError::new(ErrorKind::Other, format!("Other error {}", value)),
    };
}
