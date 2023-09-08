use serde::{Deserialize, Serialize};

pub(crate) mod serve;
mod sftp;

#[derive(Serialize, Clone, Debug)]
pub struct FileItem {
    filename: String,
    r#type: String,
    mode: String,
    user: Option<String>,
    group: Option<String>,
    size: usize,
    mtime: f64,
    link: Option<LinkInfo>,
    access: Option<PermInfo>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LinkInfo {
    target: Option<String>,
    broken: Option<bool>,
}

#[derive(Serialize, Clone, Debug)]
pub struct PermInfo {
    read: bool,
    write: bool,
    execute: bool,
}
