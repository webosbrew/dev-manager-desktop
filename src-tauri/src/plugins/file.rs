use std::env::temp_dir;
use std::iter::zip;
use std::path::Path;

use serde::Serialize;
use tauri::plugin::{Builder, TauriPlugin};
use tauri::{Runtime, State};
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use uuid::Uuid;

use crate::device_manager::Device;
use crate::plugins::cmd::escape_path;
use crate::session_manager::{Error, SessionManager};

#[tauri::command]
async fn ls(
    manager: State<'_, SessionManager>,
    device: Device,
    path: String,
) -> Result<Vec<FileItem>, Error> {
    if !path.starts_with("/") {
        return Err(Error::new("Absolute path required"));
    }
    let mut entries: Vec<String> = String::from_utf8(
        manager
            .exec(
                device.clone(),
                "xargs -0 -I PATH find PATH -maxdepth 1 -print0",
                Some(path.clone().into_bytes()),
            )
            .await?,
    )
    .unwrap()
    .split('\0')
    .map(|l| String::from(l))
    .collect();
    // Last line is empty, remove it
    entries.pop();
    entries.sort();
    let mut items = Vec::<FileItem>::new();
    for chunk in entries.chunks(100) {
        let ls_input = chunk.join("\0").into_bytes();
        let mut details: Vec<String> = String::from_utf8(
            manager
                .exec(
                    device.clone(),
                    "xargs -0 ls -ld --full-time",
                    Some(ls_input),
                )
                .await?,
        )
        .unwrap()
        .split('\n')
        .map(|l| String::from(l))
        .collect();
        // Last line is empty, remove it
        details.pop();
        assert_eq!(chunk.len(), details.len());
        let mut group: Vec<FileItem> = zip(chunk, details)
            .skip(1)
            .map(|(entry, line)| {
                return FileItem::new(&path, &entry, &line);
            })
            .collect();
        items.append(&mut group);
    }
    return Ok(items);
}

#[tauri::command]
async fn read(
    manager: State<'_, SessionManager>,
    device: Device,
    path: String,
) -> Result<Vec<u8>, Error> {
    return manager
        .exec(device, &format!("cat {}", escape_path(&path)), None)
        .await;
}

#[tauri::command]
async fn write(
    manager: State<'_, SessionManager>,
    device: Device,
    path: String,
    content: Vec<u8>,
) -> Result<(), Error> {
    manager
        .exec(
            device,
            &format!("dd of={}", escape_path(&path)),
            Some(content),
        )
        .await?;
    return Ok(());
}

#[tauri::command]
async fn get(
    manager: State<'_, SessionManager>,
    device: Device,
    path: String,
    target: String,
) -> Result<(), Error> {
    let buf = manager
        .exec(device, &format!("cat {}", escape_path(&path)), None)
        .await?;
    let mut file = fs::File::create(&target).await?;
    file.write_all(&buf).await?;
    return Ok(());
}

#[tauri::command]
async fn put(
    manager: State<'_, SessionManager>,
    device: Device,
    path: String,
    source: String,
) -> Result<(), Error> {
    let mut file = fs::File::open(&source).await?;
    let mut buf = Vec::<u8>::new();
    file.read_to_end(&mut buf).await?;
    manager
        .exec(device, &format!("dd of={}", escape_path(&path)), Some(buf))
        .await?;
    return Ok(());
}

#[tauri::command]
async fn get_temp(
    manager: State<'_, SessionManager>,
    device: Device,
    path: String,
) -> Result<String, Error> {
    let source = Path::new(&path);
    let extension = source
        .extension()
        .map_or(String::new(), |s| format!(".{}", s.to_string_lossy()));
    let target = temp_dir().join(format!("webos-dev-tmp-{}{}", Uuid::new_v4(), extension));
    let buf = manager
        .exec(device, &format!("cat {}", escape_path(&path)), None)
        .await?;
    log::info!("Downloading {:?} to {:?}", &source, &target);
    let mut file = fs::File::create(target.clone()).await?;
    file.write_all(&buf).await?;
    return Ok(String::from(target.to_str().unwrap()));
}

pub fn plugin<R: Runtime>(name: &'static str) -> TauriPlugin<R> {
    Builder::new(name)
        .invoke_handler(tauri::generate_handler![
            ls, read, write, get, put, get_temp
        ])
        .build()
}

#[derive(Serialize, Clone, Debug)]
pub struct FileItem {
    filename: String,
    r#type: String,
    mode: String,
    user: String,
    group: String,
    size: usize,
    mtime: String,
    abspath: String,
    link: Option<LinkInfo>,
}

#[derive(Serialize, Clone, Debug)]
pub struct LinkInfo {
    target: String,
}

impl FileItem {
    fn basename(dir: &str, path: &str) -> String {
        let without_dir = &path[dir.len()..];
        return String::from(without_dir.strip_prefix("/").unwrap_or(without_dir));
    }

    fn new(path: &str, entry: &str, line: &str) -> FileItem {
        let basename = Self::basename(path, entry);
        let info_name_index = line.find('/').unwrap();
        let info_cols: Vec<&str> = line[..info_name_index - 1]
            .split_ascii_whitespace()
            .collect();
        let perm = *info_cols.get(0).unwrap();
        let file_type = String::from(&perm[..1]);

        let size = if file_type == "-" {
            info_cols[4].parse::<usize>().unwrap()
        } else {
            0
        };

        let link: Option<LinkInfo> = if file_type == "l" {
            let info_name = String::from(&line[info_name_index..]);
            let basename_n_arrows = basename.matches(" -> ").count();
            let segs: Vec<&str> = info_name.split(" -> ").collect();
            Some(LinkInfo {
                target: segs[basename_n_arrows + 1..].join(" -> "),
            })
        } else {
            None
        };
        return FileItem {
            filename: basename,
            r#type: file_type,
            mode: String::from(&perm[1..]),
            user: String::from(*info_cols.get(2).unwrap()),
            group: String::from(*info_cols.get(3).unwrap()),
            mtime: format!(
                "{}T{}{}",
                info_cols.get(info_cols.len() - 3).unwrap(),
                info_cols.get(info_cols.len() - 2).unwrap(),
                info_cols.get(info_cols.len() - 1).unwrap()
            ),
            abspath: String::from(entry),
            size,
            link,
        };
    }
}
