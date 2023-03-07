use crate::remote_files::FileItem;
use path_slash::PathBufExt;
use std::path::PathBuf;
use ssh2::FileType;

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
