use reqwest::Url;
use serde::{Deserialize, Serialize};
use tauri::plugin::{Builder, TauriPlugin};
use tauri::regex::Regex;
use tauri::{Runtime, State};

use crate::device_manager::Device;
use crate::error::Error;
use crate::session_manager::SessionManager;

#[derive(Serialize)]
pub struct DevModeStatus {
    token: Option<String>,
    remaining: Option<String>,
}

#[derive(Deserialize)]
struct DevModeSession {
    result: String,
    #[serde(rename = "errorCode")]
    error_code: Option<String>,
    #[serde(rename = "errorMsg")]
    error_msg: Option<String>,
}

#[tauri::command]
async fn status(
    manager: State<'_, SessionManager>,
    device: Device,
) -> Result<DevModeStatus, Error> {
    if device.username != "prisoner" {
        return Err(Error::Unsupported);
    }
    let token = match manager
        .exec(device, "cat /var/luna/preferences/devmode_enabled", None)
        .await
    {
        Ok(data) => String::from_utf8(data).map_err(|_| Error::IO {
            code: format!("Other"),
            message: format!("Can\'t read dev mode token"),
        })?,
        Err(e) => return Err(e),
    };
    let regex = Regex::new("^[0-9a-zA-Z]+$").unwrap();
    if !regex.is_match(&token) {
        return Ok(DevModeStatus {
            token: None,
            remaining: None,
        });
    }
    let url = Url::parse_with_params(
        "https://developer.lge.com/secure/CheckDevModeSession.dev",
        &[("sessionToken", token.clone())],
    )
    .expect("should be valid url");
    let session: DevModeSession = reqwest::get(url).await?.json().await?;
    if session.result == "success" {
        return Ok(DevModeStatus {
            token: Some(token),
            remaining: Some(session.error_msg.unwrap_or(String::from(""))),
        });
    }
    return Ok(DevModeStatus {
        token: Some(token),
        remaining: None,
    });
}

/// Initializes the plugin.
pub fn plugin<R: Runtime>(name: &'static str) -> TauriPlugin<R> {
    Builder::new(name)
        .invoke_handler(tauri::generate_handler![status,])
        .build()
}
