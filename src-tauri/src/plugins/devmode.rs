use crate::device_manager::Error;
use reqwest::Url;
use tauri::plugin::{Builder, TauriPlugin};
use tauri::Runtime;

#[tauri::command]
async fn check(token: String) -> Result<String, Error> {
    let url = Url::parse_with_params(
        "https://developer.lge.com/secure/CheckDevModeSession.dev",
        &[("sessionToken", token)],
    )
    .expect("should be valid url");
    let resp = reqwest::get(url).await?;
    return Ok(resp.text().await?);
}

/// Initializes the plugin.
pub fn plugin<R: Runtime>(name: &'static str) -> TauriPlugin<R> {
    Builder::new(name)
        .invoke_handler(tauri::generate_handler![check,])
        .build()
}
