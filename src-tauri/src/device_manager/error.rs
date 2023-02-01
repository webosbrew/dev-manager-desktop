use std::error::Error as ErrorTrait;
use std::fmt::{Display, Formatter};

use crate::device_manager::Error;

impl Error {
    pub fn new(message: String) -> Error {
        return Error::Message { message };
    }
    pub fn bad_config() -> Error {
        return Error::Message {
            message: String::from("Bad configuration"),
        };
    }
    pub fn unimplemented() -> Error {
        return Error::Unimplemented { feature: None };
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
