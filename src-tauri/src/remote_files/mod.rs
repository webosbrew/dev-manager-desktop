use serde::{Deserialize, Serialize};

pub(crate) mod ls;
pub(crate) mod path;
pub(crate) mod serve;

#[derive(Serialize, Clone, Debug)]
pub struct FileItem {
    filename: String,
    r#type: String,
    mode: String,
    user: String,
    group: String,
    size: usize,
    mtime: f64,
    abspath: String,
    link: Option<LinkInfo>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LinkInfo {
    target: Option<String>,
    broken: Option<bool>,
}
