use tauri::plugin::{Builder, TauriPlugin};
use tauri::Runtime;
use tokio::fs::File;
use tokio::io::AsyncReadExt;

use crate::error::Error;

#[tauri::command]
async fn checksum(path: String, algorithm: String) -> Result<String, Error> {
    let mut file = File::open(&path).await?;
    let mut contents: Vec<u8> = vec![];
    file.read_to_end(&mut contents).await?;
    return match algorithm.as_str() {
        "sha256" => Ok(sha256::digest(&contents[..])),
        _ => Err(Error::Unsupported),
    };
}

pub fn plugin<R: Runtime>(name: &'static str) -> TauriPlugin<R> {
    Builder::new(name)
        .invoke_handler(tauri::generate_handler![checksum])
        .build()
}
