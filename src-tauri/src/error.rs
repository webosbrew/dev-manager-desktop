use libssh_rs::Error as SshError;
use serde::{Serialize, Serializer};
use std::error::Error as ErrorTrait;
use std::fmt::{Debug, Display, Formatter};

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "reason")]
pub enum Error {
    Authorization {
        message: String,
    },
    BadPassphrase,
    BadPrivateKey,
    Disconnected,
    ExitStatus {
        message: String,
        exit_code: i32,
        stderr: Vec<u8>,
    },
    IO {
        #[serde(serialize_with = "as_debug_string")]
        code: std::io::ErrorKind,
        message: String,
    },
    Message {
        message: String,
    },
    PassphraseRequired,
    NotFound,
    Timeout,
    Unsupported,
}

impl Error {
    pub fn new<S: Into<String>>(message: S) -> Error {
        return Error::Message {
            message: message.into(),
        };
    }
    pub fn bad_config() -> Error {
        return Error::Message {
            message: String::from("Bad configuration"),
        };
    }
}

impl ErrorTrait for Error {}

impl Display for Error {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        return f.write_fmt(format_args!("AppError: {:?}", self));
    }
}

impl From<std::io::Error> for Error {
    fn from(value: std::io::Error) -> Self {
        return Error::IO {
            code: value.kind(),
            message: value.to_string(),
        };
    }
}

impl From<serde_json::Error> for Error {
    fn from(value: serde_json::Error) -> Self {
        return Error::Message {
            message: format!("JSON Error: {:?}", value),
        };
    }
}

impl From<reqwest::Error> for Error {
    fn from(value: reqwest::Error) -> Self {
        if value.is_timeout() {
            return Error::Timeout;
        }
        return Error::new(format!("HTTP Error: {:?}", value));
    }
}

impl From<SshError> for Error {
    fn from(value: SshError) -> Self {
        return match value {
            SshError::RequestDenied(s) => Error::Message {
                message: format!("SSH Error: {s}"),
            },
            SshError::TryAgain => Error::IO {
                code: std::io::ErrorKind::WouldBlock,
                message: format!("Would block"),
            },
            SshError::Fatal(s) => {
                if let Some(socket_error) = s.strip_prefix("Socket error:") {
                    return if socket_error == "disconnected" {
                        Error::Disconnected
                    } else {
                        Error::IO {
                            code: std::io::ErrorKind::Other,
                            message: String::from(socket_error),
                        }
                    };
                } else if s == "Connection refused" {
                    return Error::IO {
                        code: std::io::ErrorKind::ConnectionRefused,
                        message: format!("Connection refused by host"),
                    };
                } else if s.starts_with("Timeout connecting to ") {
                    return Error::Timeout;
                } else if s.starts_with("Failed to parse ssh key") {
                    return Error::BadPrivateKey;
                }
                Error::Message {
                    message: format!("SSH Error: {s}"),
                }
            }
            SshError::Sftp(e) => Error::new(format!("SFTP Error: {:?}", e)),
        };
    }
}

impl From<Box<dyn ErrorTrait>> for Error {
    fn from(value: Box<dyn ErrorTrait>) -> Self {
        return Error::new(format!("{:?}", value));
    }
}

fn as_debug_string<T, S>(v: &T, serializer: S) -> Result<S::Ok, S::Error>
where
    T: Debug,
    S: Serializer,
{
    return serializer.serialize_str(&format!("{v:?}"));
}
