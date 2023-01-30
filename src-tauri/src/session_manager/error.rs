use crate::session_manager::{Error, ErrorKind};
use russh_keys::Error as SshKeyError;
use std::error::Error as ErrorTrait;
use std::fmt::{Display, Formatter, Write};

impl Error {
    pub fn new<S: Into<String>>(message: S) -> Error {
        return Error {
            message: String::from(message.into()),
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
            ErrorKind::ExitStatus {
                exit_code: status, ..
            } => f.write_fmt(format_args!("Error::ExitStatus: {{{}}}", status)),
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
        return Error::new(format!("russh::Error::{:?}: {}", value, value.to_string()));
    }
}

impl From<SshKeyError> for Error {
    fn from(value: SshKeyError) -> Self {
        return match value {
            SshKeyError::UnsupportedKeyType(v) => Error::new(format!(
                "Unsupported SSH key type {}",
                String::from_utf8_lossy(&v)
            )),
            value => Error::new(format!("SSH key error: {}", value.to_string())),
        };
    }
}

impl From<Box<dyn ErrorTrait>> for Error {
    fn from(value: Box<dyn ErrorTrait>) -> Self {
        return Error::new(format!("{:?}", value));
    }
}
