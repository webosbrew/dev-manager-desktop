use std::error::Error as ErrorTrait;
use std::fmt::{Display, Formatter};

use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "reason")]
pub enum Error {
    Authorization {
        message: String,
    },
    BadPassphrase,
    Disconnected,
    ExitStatus {
        message: String,
        exit_code: u32,
        stderr: Vec<u8>,
    },
    IO {
        name: String,
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
            name: format!("{:?}", value.kind()),
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
        return Error::new(format!("HTTP Error: {:?}", value));
    }
}

impl From<russh::Error> for Error {
    fn from(value: russh::Error) -> Self {
        return Error::new(format!("russh::Error::{:?}: {}", value, value.to_string()));
    }
}

impl From<russh_keys::Error> for Error {
    fn from(value: russh_keys::Error) -> Self {
        return Error::new(format!("SSH Key Error: {:?}", value));
    }
}

impl From<Box<dyn ErrorTrait>> for Error {
    fn from(value: Box<dyn ErrorTrait>) -> Self {
        return Error::new(format!("{:?}", value));
    }
}
