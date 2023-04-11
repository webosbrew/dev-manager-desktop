use std::error::Error as ErrorTrait;
use std::fmt::{Display, Formatter};

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(tag = "reason")]
pub enum Error {
    Authorization {
        message: String,
    },
    BadPassphrase,
    Disconnected,
    ExitStatus {
        message: String,
        exit_code: i32,
        stderr: Vec<u8>,
    },
    IO {
        code: String,
        message: String,
    },
    Message {
        message: String,
    },
    NeedsReconnect,
    NegativeReply,
    NotFound,
    PassphraseRequired,
    Timeout,
    Unsupported,
    UnsupportedKey {
        type_name: String,
    },
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
            code: format!("{:?}", value.kind()),
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

impl From<curl::Error> for Error {
    fn from(value: curl::Error) -> Self {
        return Error::new(format!("HTTP Error: {:?}", value));
    }
}

impl From<libssh_rs::Error> for Error {
    fn from(value: libssh_rs::Error) -> Self {
        if let libssh_rs::Error::Fatal(s) = &value {
            if s == "Socket error: disconnected" {
                return Error::Disconnected;
            } else if s.starts_with("Timeout connecting to ") {
                return Error::Timeout;
            }
        }
        return Error::new(format!("SSH Error: {:?}", value));
    }
}

impl From<Box<dyn ErrorTrait>> for Error {
    fn from(value: Box<dyn ErrorTrait>) -> Self {
        return Error::new(format!("{:?}", value));
    }
}
