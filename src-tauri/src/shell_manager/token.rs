use std::fmt;
use std::fmt::{Display, Formatter};
use std::str::FromStr;

use serde::de::Visitor;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use uuid::Uuid;

use crate::shell_manager::ShellToken;

impl ShellToken {
    pub(crate) fn new() -> Self {
        ShellToken(Uuid::new_v4())
    }
}
impl Serialize for ShellToken {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&format!("{}", self.0))
    }
}

impl<'de> Deserialize<'de> for ShellToken {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_string(ShellTokenVisitor)
    }
}

struct ShellTokenVisitor;

impl<'de> Visitor<'de> for ShellTokenVisitor {
    type Value = ShellToken;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("string")
    }

    // parse the version from the string
    fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
    where
        E: std::error::Error,
    {
        Ok(ShellToken(Uuid::from_str(value).unwrap()))
    }
}

impl Display for ShellToken {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0.to_string())
    }
}
