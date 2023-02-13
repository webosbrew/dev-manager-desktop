use std::net::SocketAddr;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use russh::client;
use russh::client::{Config, Handle};
use russh::kex::{CURVE25519, DH_G14_SHA1, DH_G14_SHA256, DH_G1_SHA1};
use russh_keys::key::{ED25519, KeyPair, RSA_SHA2_256, RSA_SHA2_512, SignatureHash, SSH_RSA};
use uuid::Uuid;

use crate::device_manager::{Device, PrivateKey};
use crate::error::Error;
use crate::session_manager::{Proc, SessionManager, Shell, ShellInfo, ShellToken};
use crate::session_manager::connection::Connection;
use crate::session_manager::handler::ClientHandler;

impl SessionManager {
    pub async fn exec(
        &self,
        device: Device,
        command: &str,
        stdin: Option<&[u8]>,
    ) -> Result<Vec<u8>, Error> {
        loop {
            let conn = self.conn_obtain(device.clone()).await?;
            match conn.exec(command, stdin).await {
                Err(Error::NeedsReconnect) => continue,
                e => return e,
            };
        }
    }

    pub async fn spawn(&self, device: Device, command: &str) -> Result<Proc, Error> {
        loop {
            let conn = self.conn_obtain(device.clone()).await?;
            match conn.spawn(command).await {
                Err(Error::NeedsReconnect) => continue,
                e => return e,
            };
        }
    }

    pub async fn shell_open(
        &self,
        device: Device,
        cols: u16,
        rows: u16,
        dumb: Option<bool>,
    ) -> Result<Arc<Shell>, Error> {
        loop {
            let conn = self.conn_obtain(device.clone()).await?;
            match conn.shell(cols, rows, dumb).await {
                Ok(data) => {
                    let shell = Arc::new(data);
                    self.shells
                        .lock()
                        .unwrap()
                        .insert(shell.token.clone(), shell.clone());
                    return Ok(shell);
                }
                Err(Error::NeedsReconnect) => continue,
                Err(e) => return Err(e),
            }
        }
    }

    pub fn shell_close(&self, token: &ShellToken) -> Result<(), Error> {
        let shell = self.shells.lock().unwrap().remove(&token).clone();
        if let Some(shell) = shell {
            let shell = shell.clone();
            tokio::spawn(async move {
                shell.close().await.unwrap_or(());
            });
        }
        return Ok(());
    }

    pub fn shell_find(&self, token: &ShellToken) -> Result<Arc<Shell>, Error> {
        return self
            .shells
            .lock()
            .unwrap()
            .get(token)
            .map(|a| a.clone())
            .ok_or_else(|| Error::NotFound);
    }

    pub fn shell_list(&self) -> Vec<ShellInfo> {
        let mut list: Vec<ShellInfo> = self
            .shells
            .lock()
            .unwrap()
            .iter()
            .map(|(_, shell)| shell.info())
            .collect();
        list.sort_by_key(|v| v.created_at);
        return list;
    }

    async fn conn_obtain(&self, device: Device) -> Result<Arc<Connection>, Error> {
        if device.new {
            return Ok(Arc::new(self.conn_new(device.clone()).await?));
        }
        let guard = self.lock.lock().await;
        if let Some(a) = self.connections.lock().unwrap().get(&device.name) {
            return Ok(a.clone());
        }
        let connection = Arc::new(self.conn_new(device.clone()).await?);
        log::info!("Connection to {} has been created", device.name);
        self.connections
            .lock()
            .unwrap()
            .insert(device.name, connection.clone());
        drop(guard);
        return Ok(connection);
    }

    async fn conn_new(&self, device: Device) -> Result<Connection, Error> {
        let id = Uuid::new_v4();
        let (mut handle, sig_alg) = match self.try_conn(&id, &device, false).await {
            Ok(v) => v,
            Err(russh::Error::KexInit)
            | Err(russh::Error::NoCommonKexAlgo)
            | Err(russh::Error::NoCommonKeyAlgo)
            | Err(russh::Error::NoCommonCipher) => self.try_conn(&id, &device, true).await?,
            Err(russh::Error::ConnectionTimeout) => {
                return Err(Error::Timeout);
            }
            e => e?,
        };
        log::debug!("Connected to {}, sig_alg: {:?}", device.name, sig_alg);
        if let Some(key) = &device.private_key {
            if !self
                .try_pubkey_auth(
                    &mut handle,
                    &device.username,
                    key,
                    &device.passphrase,
                    sig_alg,
                )
                .await?
            {
                return Err(Error::Authorization {
                    message: format!("Device refused pubkey authorization"),
                });
            }
        } else if let Some(password) = &device.password {
            if !handle
                .authenticate_password(&device.username, password)
                .await?
            {
                return Err(Error::Authorization {
                    message: format!("Device refused password authorization"),
                });
            }
        } else if !handle.authenticate_none(&device.username).await? {
            return Err(Error::Authorization {
                message: format!("Device refused authorization"),
            });
        }
        log::debug!("Authenticated to {}", device.name);
        return Ok(Connection::new(
            id,
            device,
            handle,
            Arc::downgrade(&self.connections),
        ));
    }

    async fn try_conn(
        &self,
        id: &Uuid,
        device: &Device,
        legacy_algo: bool,
    ) -> Result<(Handle<ClientHandler>, Option<SignatureHash>), russh::Error> {
        let mut config = Config::default();
        if legacy_algo {
            config.preferred.key = &[SSH_RSA, RSA_SHA2_512, RSA_SHA2_256, ED25519];
            config.preferred.kex = &[DH_G14_SHA1, DH_G1_SHA1, DH_G14_SHA256, CURVE25519];
        }
        config.connection_timeout = Some(Duration::from_secs(3));
        let server_sig_alg: Arc<Mutex<Option<SignatureHash>>> = Arc::new(Mutex::default());
        let handler = ClientHandler {
            id: id.clone(),
            key: device.name.clone(),
            connections: Arc::downgrade(&self.connections),
            shells: Arc::downgrade(&self.shells),
            sig_alg: server_sig_alg.clone(),
        };
        let addr = SocketAddr::from_str(&format!("{}:{}", &device.host, &device.port)).unwrap();
        log::debug!("Connecting to {}", addr);
        let handle = match tokio::time::timeout(
            Duration::from_secs(5),
            client::connect(Arc::new(config), addr, handler),
        )
        .await
        {
            Ok(resp) => resp?,
            Err(_) => return Err(russh::Error::ConnectionTimeout),
        };
        return Ok((handle, server_sig_alg.lock().unwrap().clone()));
    }

    async fn try_pubkey_auth(
        &self,
        handle: &mut Handle<ClientHandler>,
        username: &str,
        key: &PrivateKey,
        passphrase: &Option<String>,
        sig_alg: Option<SignatureHash>,
    ) -> Result<bool, russh::Error> {
        match key.key_pair(passphrase.as_deref())? {
            kp @ KeyPair::RSA { .. } => {
                if let Some(alg) = sig_alg {
                    log::debug!("Authenticate with key algorithm: {:?}", alg.name());
                    let kp = kp.with_signature_hash(alg).unwrap();
                    return handle.authenticate_publickey(username, Arc::new(kp)).await;
                } else {
                    for alg in [
                        SignatureHash::SHA2_512,
                        SignatureHash::SHA2_256,
                        SignatureHash::SHA1,
                    ] {
                        log::debug!("Try authenticate with key algorithm: {:?}", alg.name());
                        let kp = kp.with_signature_hash(alg).unwrap();
                        if handle
                            .authenticate_publickey(username, Arc::new(kp))
                            .await?
                        {
                            return Ok(true);
                        }
                    }
                }
            }
            kp => {
                log::debug!("Authenticate with key: {:?}", key);
                return handle.authenticate_publickey(username, Arc::new(kp)).await;
            }
        }
        return Ok(false);
    }
}
