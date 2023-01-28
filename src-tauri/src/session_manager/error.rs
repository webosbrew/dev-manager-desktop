use std::error::Error as ErrorTrait;
use std::fmt::{Display, Formatter, Write};

use crate::session_manager::{Error, ErrorKind};

impl Error {
    pub fn new(message: &str) -> Error {
        return Error {
            message: String::from(message),
            kind: ErrorKind::Message,
        };
    }
    pub fn bad_config() -> Error {
        return Error {
            message: String::from("Bad configuration"),
            kind: ErrorKind::Message,
        };
    }
    pub fn unimplemented() -> Error {
        return Error {
            message: String::from("Not implemented"),
            kind: ErrorKind::Unimplemented,
        };
    }
    pub fn disconnected() -> Error {
        return Error {
            message: String::from("Disconnected"),
            kind: ErrorKind::Message,
        };
    }
    pub fn reconnect() -> Error {
        return Error {
            message: String::from("Needs reconnection"),
            kind: ErrorKind::NeedsReconnect,
        };
    }
}

impl ErrorTrait for Error {}

impl Display for Error {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        return match &self.kind {
            ErrorKind::ExitStatus { status, .. } => {
                f.write_fmt(format_args!("Error::ExitStatus: {{{}}}", status))
            }
            other => f.write_fmt(format_args!("Error::{:?}", other)),
        };
    }
}

impl From<std::io::Error> for Error {
    fn from(value: std::io::Error) -> Self {
        return Error::new(&format!("IO Error: {:?}", value));
    }
}

impl From<russh::Error> for Error {
    fn from(value: russh::Error) -> Self {
        return Error::new(&format!("russh::Error {:?}", value));
    }
}

impl From<russh_keys::Error> for Error {
    fn from(value: russh_keys::Error) -> Self {
        return Error::new(&format!("russh_keys::Error {}", value.to_string()));
    }
}

impl From<Box<dyn ErrorTrait>> for Error {
    fn from(value: Box<dyn ErrorTrait>) -> Self {
        return Error::new("General Error");
    }
}
