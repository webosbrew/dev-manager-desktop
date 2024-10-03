use serde::{Deserialize, Serialize, Serializer};

#[derive(Debug, Copy, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub enum Encoding {
    #[serde(rename = "binary")]
    Binary,
    #[serde(rename = "string")]
    String,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ByteString {
    Binary(Vec<u8>),
    String(String),
}

impl ByteString {
    pub fn parse(raw: &[u8], encoding: Encoding) -> Result<ByteString, std::str::Utf8Error> {
        match encoding {
            Encoding::Binary => Ok(ByteString::Binary(raw.to_vec())),
            Encoding::String => {
                let string = std::str::from_utf8(raw)?;
                Ok(ByteString::String(string.to_string()))
            }
        }
    }
}

impl AsRef<[u8]> for ByteString {
    fn as_ref(&self) -> &[u8] {
        match self {
            ByteString::Binary(bytes) => bytes,
            ByteString::String(string) => string.as_bytes(),
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::byte_string::ByteString;
    use serde_json::Value;

    #[test]
    fn test_serializing() {
        let bytes = ByteString::Binary(vec![1, 2, 3]);
        let string = ByteString::String("hello".to_string());
        let bytes_ser = serde_json::to_value(&bytes).unwrap();
        let string_ser = serde_json::to_value(&string).unwrap();
        assert_eq!(
            bytes_ser,
            Value::Array(vec![
                Value::Number(1.into()),
                Value::Number(2.into()),
                Value::Number(3.into())
            ])
        );
        assert_eq!(string_ser, Value::String("hello".to_string()));
    }

    #[test]
    fn test_deserializing() {
        let bytes = ByteString::Binary(vec![1, 2, 3]);
        let string = ByteString::String("hello".to_string());
        let bytes_ser = serde_json::to_value(&bytes).unwrap();
        let string_ser = serde_json::to_value(&string).unwrap();
        let bytes_de: ByteString = serde_json::from_str("[1,2,3]").unwrap();
        let string_de: ByteString = serde_json::from_str("\"hello\"").unwrap();
        assert_eq!(bytes_de, bytes);
        assert_eq!(string_de, string);
    }
}
