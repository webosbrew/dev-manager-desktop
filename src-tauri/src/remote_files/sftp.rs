use std::time::UNIX_EPOCH;

use libssh_rs::{FileType, Metadata};

use crate::remote_files::FileItem;

impl From<&Metadata> for FileItem {
    fn from(stat: &Metadata) -> Self {
        return FileItem {
            filename: String::from(stat.name().unwrap()),
            r#type: format!(
                "{}",
                abbrev_type(stat.file_type().unwrap_or(FileType::Unknown))
            ),
            mode: unix_mode::to_string(stat.permissions().unwrap_or(0)),
            user: format!("{}", stat.uid().unwrap_or(0)),
            group: format!("{}", stat.gid().unwrap_or(0)),
            size: stat.len().unwrap_or(0) as usize,
            mtime: stat
                .modified()
                .unwrap_or(UNIX_EPOCH)
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs_f64(),
            abspath: String::from(stat.name().unwrap()),
            link: None,
        };
    }
}

fn abbrev_type(value: FileType) -> char {
    return match value {
        FileType::Special => 'b',
        FileType::Directory => 'd',
        FileType::Regular => '-',
        FileType::Symlink => 'l',
        FileType::Unknown => ' ',
    };
}
