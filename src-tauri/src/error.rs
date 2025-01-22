use std::error::Error as ErrorTrait;
use std::fmt::{Debug, Display, Formatter};
use std::io::ErrorKind;
use std::str::FromStr;

use libssh_rs::{Error as SshError, SftpError};
use regex::Regex;
use reqwest::StatusCode;
use serde::{Serialize, Serializer};

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(tag = "reason")]
pub enum Error {
    Authorization {
        message: String,
    },
    BadPassphrase,
    BadPrivateKey {
        message: String,
    },
    Disconnected,
    ExitStatus {
        message: String,
        command: String,
        exit_code: i32,
        stderr: Vec<u8>,
        unhandled: bool,
    },
    IO {
        #[serde(serialize_with = "as_debug_string")]
        code: ErrorKind,
        message: String,
        unhandled: bool,
    },
    Message {
        message: String,
        unhandled: bool,
    },
    PassphraseRequired,
    NotFound,
    Timeout,
    Unsupported,
}

impl Error {
    pub fn new<S: Into<String>>(message: S) -> Error {
        Error::Message {
            message: message.into(),
            unhandled: false,
        }
    }
    pub fn bad_config() -> Error {
        Error::Message {
            message: String::from("Bad configuration"),
            unhandled: true,
        }
    }
    pub fn io(kind: ErrorKind) -> Error {
        Error::IO {
            code: kind,
            message: kind.to_string(),
            unhandled: false,
        }
    }
}

impl ErrorTrait for Error {}

impl Display for Error {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_fmt(format_args!("AppError: {:?}", self))
    }
}

impl From<std::io::Error> for Error {
    fn from(value: std::io::Error) -> Self {
        let message = value.to_string();
        if let Some(code) = Regex::new(r"(?i)sftp error code (\d+)")
            .unwrap()
            .captures(&message)
            .and_then(|c| c.get(1))
            .and_then(|m| u32::from_str(m.as_str()).ok())
        {
            return from_sftp_error_code(code, message);
        }
        Error::IO {
            code: value.kind(),
            message,
            unhandled: true,
        }
    }
}

impl From<serde_json::Error> for Error {
    fn from(value: serde_json::Error) -> Self {
        Error::Message {
            message: format!("JSON Error: {:?}", value),
            unhandled: false,
        }
    }
}

impl From<reqwest::Error> for Error {
    fn from(value: reqwest::Error) -> Self {
        if value.is_timeout() {
            return Error::Timeout;
        } else if value.is_connect() {
            return Error::IO {
                code: ErrorKind::ConnectionRefused,
                message: format!(
                    "Connection refused by host {}",
                    value.url().map(|u| u.host_str()).flatten().unwrap_or("")
                ),
                unhandled: false,
            };
        } else if let Some(status) = value.status() {
            return Error::IO {
                code: match status {
                    StatusCode::NOT_FOUND => ErrorKind::NotFound,
                    StatusCode::UNAUTHORIZED => ErrorKind::PermissionDenied,
                    StatusCode::FORBIDDEN => ErrorKind::PermissionDenied,
                    StatusCode::CONFLICT => ErrorKind::AlreadyExists,
                    StatusCode::BAD_REQUEST => ErrorKind::InvalidInput,
                    _ => ErrorKind::Other,
                },
                message: value.to_string(),
                unhandled: false,
            };
        }
        Error::IO {
            code: ErrorKind::Other,
            message: value.to_string(),
            unhandled: true,
        }
    }
}

impl From<SshError> for Error {
    fn from(value: SshError) -> Self {
        match value {
            SshError::RequestDenied(s) => Error::Message {
                message: format!("SSH Error: {s}"),
                unhandled: false,
            },
            SshError::TryAgain => Error::IO {
                code: ErrorKind::WouldBlock,
                message: "Would block".to_string(),
                unhandled: true,
            },
            SshError::Fatal(s) => {
                if let Some(socket_error) = s.strip_prefix("Socket error:") {
                    return if socket_error.trim() == "disconnected" {
                        Error::Disconnected
                    } else {
                        Error::IO {
                            code: ErrorKind::Other,
                            message: String::from(socket_error),
                            unhandled: false,
                        }
                    };
                } else if s == "Connection refused" {
                    return Error::IO {
                        code: ErrorKind::ConnectionRefused,
                        message: "Connection refused by host".to_string(),
                        unhandled: false,
                    };
                } else if s.starts_with("Timeout connecting to ") {
                    return Error::Timeout;
                } else if s.starts_with("Failed to parse ssh key") {
                    return Error::BadPrivateKey {
                        message: String::from(s),
                    };
                }
                Error::Message {
                    message: format!("SSH Error: {s}"),
                    unhandled: false,
                }
            }
            SshError::Sftp(e) => e.into(),
        }
    }
}

impl From<SftpError> for Error {
    fn from(value: SftpError) -> Self {
        let message = value.to_string();
        if let Some(code) = message
            .strip_prefix("Sftp error code ")
            .and_then(|s| u32::from_str(s).ok())
        {
            return from_sftp_error_code(code, message);
        }
        Error::Message {
            message,
            unhandled: false,
        }
    }
}

impl From<Box<dyn ErrorTrait>> for Error {
    fn from(value: Box<dyn ErrorTrait>) -> Self {
        Error::new(format!("{:?}", value))
    }
}

fn from_sftp_error_code(code: u32, message: String) -> Error {
    match code {
        libssh_rs_sys::SSH_FX_EOF => Error::io(ErrorKind::UnexpectedEof),
        libssh_rs_sys::SSH_FX_NO_SUCH_FILE => Error::io(ErrorKind::NotFound),
        libssh_rs_sys::SSH_FX_PERMISSION_DENIED => Error::io(ErrorKind::PermissionDenied),
        libssh_rs_sys::SSH_FX_FAILURE => Error::new("Failed to perform this operation"),
        libssh_rs_sys::SSH_FX_NO_CONNECTION => Error::Disconnected,
        libssh_rs_sys::SSH_FX_CONNECTION_LOST => Error::Disconnected,
        libssh_rs_sys::SSH_FX_NO_SUCH_PATH => Error::io(ErrorKind::NotFound),
        libssh_rs_sys::SSH_FX_FILE_ALREADY_EXISTS => Error::io(ErrorKind::AlreadyExists),
        libssh_rs_sys::SSH_FX_WRITE_PROTECT => Error::IO {
            code: ErrorKind::Other,
            message: String::from("SSH_FX_WRITE_PROTECT"),
            unhandled: true,
        },
        _ => Error::Message {
            message,
            unhandled: false,
        },
    }
}

fn as_debug_string<T, S>(v: &T, serializer: S) -> Result<S::Ok, S::Error>
where
    T: Debug,
    S: Serializer,
{
    serializer.serialize_str(&format!("{v:?}"))
}
