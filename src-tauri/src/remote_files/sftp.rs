use std::time::UNIX_EPOCH;

use crate::conn_pool::DeviceConnectionUserInfo;
use libssh_rs::{FileType, Metadata};

use crate::remote_files::{FileItem, LinkInfo, PermInfo};

impl From<&Metadata> for FileItem {
    fn from(stat: &Metadata) -> Self {
        FileItem::new(stat, None, None)
    }
}

impl FileItem {
    pub(crate) fn new(stat: &Metadata, link: Option<LinkInfo>, access: Option<PermInfo>) -> Self {
        FileItem {
            filename: String::from(stat.name().unwrap()),
            r#type: format!(
                "{}",
                abbrev_type(stat.file_type().unwrap_or(FileType::Unknown))
            ),
            mode: unix_mode::to_string(stat.permissions().unwrap_or(0)),
            user: stat.owner().map(|s| String::from(s)),
            group: stat.group().map(|s| String::from(s)),
            size: stat.len().unwrap_or(0) as usize,
            mtime: stat
                .modified()
                .unwrap_or(UNIX_EPOCH)
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs_f64(),
            link,
            access,
        }
    }
}

impl PermInfo {
    pub fn from(stat: &Metadata, user: &DeviceConnectionUserInfo) -> Self {
        let perms = stat.permissions().unwrap_or(0);
        if user.uid.id == stat.uid().unwrap_or(0) {
            return PermInfo {
                read: (perms & 0o400) != 0,
                write: (perms & 0o200) != 0,
                execute: (perms & 0o100) != 0,
            };
        }
        for group in &user.groups {
            if group.id == stat.gid().unwrap_or(0) {
                return PermInfo {
                    read: (perms & 0o040) != 0,
                    write: (perms & 0o020) != 0,
                    execute: (perms & 0o010) != 0,
                };
            }
        }
        if user.gid.id == stat.gid().unwrap_or(0) {
            return PermInfo {
                read: (perms & 0o040) != 0,
                write: (perms & 0o020) != 0,
                execute: (perms & 0o010) != 0,
            };
        }
        PermInfo {
            read: (perms & 0o004) != 0,
            write: (perms & 0o002) != 0,
            execute: (perms & 0o001) != 0,
        }
    }
}

fn abbrev_type(value: FileType) -> char {
    match value {
        FileType::Special => 'b',
        FileType::Directory => 'd',
        FileType::Regular => '-',
        FileType::Symlink => 'l',
        FileType::Unknown => ' ',
    }
}
