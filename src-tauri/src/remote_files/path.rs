pub(crate) fn escape_path(path: &String) -> String {
    let mut escaped = String::new();
    let mut first = true;
    for seg in path.split('\'') {
        if first {
            first = false;
        } else {
            escaped.push_str("\\\'");
        }
        escaped.push('\'');
        escaped.push_str(seg);
        escaped.push('\'');
    }
    return escaped;
}

#[cfg(test)]
mod tests {
    use crate::remote_files::path::escape_path;

    #[test]
    fn test_escape_path() {
        assert_eq!(escape_path(&String::from("/")), String::from("'/'"));
        assert_eq!(
            escape_path(&String::from("/dev/null")),
            String::from("'/dev/null'")
        );
        assert_eq!(
            escape_path(&String::from("/path/with/'symbol")),
            String::from("'/path/with/'\\''symbol'")
        );
    }
}
