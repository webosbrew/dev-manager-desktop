//! Open sockets to devices on the local network.
//!
//! On Android, a socket that is not bound to a network follows the default
//! network. When the default network is mobile data, a TV on the Wi-Fi LAN is
//! out of reach, and the connection fails with "No route to host". [`connect`]
//! binds the socket to the network that routes the address before it connects.
//! On other platforms it connects as usual.
//!
//! The Android library also declares `ACCESS_LOCAL_NETWORK`. Android 17 asks
//! apps that target it for this permission before they reach the LAN.

use std::io::Error;
use std::net::{SocketAddr, TcpStream};
use std::time::Duration;

use tauri::plugin::{Builder, TauriPlugin};
use tauri::Runtime;

#[cfg(target_os = "android")]
mod android;

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("local-network")
        .setup(|_app, _api| {
            #[cfg(target_os = "android")]
            android::register(_api)?;
            Ok(())
        })
        .build()
}

/// Connect to `address` within `timeout`, on the network that routes it.
///
/// Before [`init`] sets the plugin up, and when no network has a route to the
/// address, the socket follows the default network.
///
/// # Errors
///
/// Returns the error from the connection attempt.
pub fn connect(address: &SocketAddr, timeout: Duration) -> Result<TcpStream, Error> {
    #[cfg(target_os = "android")]
    return android::connect(address, timeout);
    #[cfg(not(target_os = "android"))]
    TcpStream::connect_timeout(address, timeout)
}
