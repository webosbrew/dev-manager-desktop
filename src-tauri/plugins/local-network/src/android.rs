use std::error::Error as StdError;
use std::io::Error;
use std::net::{IpAddr, SocketAddr, TcpStream};
use std::os::fd::AsRawFd;
use std::os::raw::c_int;
use std::sync::OnceLock;
use std::time::Duration;

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use socket2::{Domain, Protocol, Socket, Type};
use tauri::plugin::{PluginApi, PluginHandle};
use tauri::Runtime;

const PLUGIN_IDENTIFIER: &str = "org.webosbrew.devman.localnetwork";

type FindNetwork = Box<dyn Fn(IpAddr) -> Option<u64> + Send + Sync>;

/// Asks the Kotlin plugin for a network. Set once the plugin is registered.
static FIND_NETWORK: OnceLock<FindNetwork> = OnceLock::new();

#[link(name = "android")]
extern "C" {
    /// From `<android/multinetwork.h>`, API level 23.
    fn android_setsocknetwork(network: u64, fd: c_int) -> c_int;
}

pub(crate) fn register<R: Runtime, C: DeserializeOwned>(
    api: PluginApi<R, C>,
) -> Result<(), Box<dyn StdError>> {
    let plugin = api.register_android_plugin(PLUGIN_IDENTIFIER, "LocalNetworkPlugin")?;
    let _ = FIND_NETWORK.set(Box::new(move |address| find_network(&plugin, address)));
    Ok(())
}

pub(crate) fn connect(address: &SocketAddr, timeout: Duration) -> Result<TcpStream, Error> {
    let socket = Socket::new(
        Domain::for_address(*address),
        Type::STREAM,
        Some(Protocol::TCP),
    )?;
    if let Some(network) = FIND_NETWORK.get().and_then(|find| find(address.ip())) {
        // Best effort. An unbound socket still connects when the default
        // network routes the address, and a VPN that does not let apps bypass
        // it refuses the bind.
        if unsafe { android_setsocknetwork(network, socket.as_raw_fd()) } != 0 {
            log::warn!(
                "Can't bind the socket for {address} to network {network}: {}",
                Error::last_os_error()
            );
        }
    }
    socket.connect_timeout(&(*address).into(), timeout)?;
    Ok(socket.into())
}

#[derive(Serialize)]
struct FindNetworkArgs {
    address: String,
}

#[derive(Deserialize)]
struct FoundNetwork {
    /// `Network.getNetworkHandle()`, as a string so JSON keeps all 64 bits.
    handle: Option<String>,
}

fn find_network<R: Runtime>(plugin: &PluginHandle<R>, address: IpAddr) -> Option<u64> {
    let args = FindNetworkArgs {
        address: address.to_string(),
    };
    match plugin.run_mobile_plugin::<FoundNetwork>("findNetwork", args) {
        Ok(found) => found.handle.and_then(|handle| handle.parse().ok()),
        Err(e) => {
            log::warn!("Can't find the network that routes {address}: {e}");
            None
        }
    }
}
