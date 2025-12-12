use crate::error::Error;
use httparse::{Response, Status};
use std::io::{Error as IoError, Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

pub(crate) fn fetch_key(host: &str, port: u16) -> Result<String, Error> {
    let address = format!("{host}:{port}")
        .to_socket_addrs()?
        .next()
        .ok_or(Error::NotFound)?;
    let mut stream = TcpStream::connect_timeout(&address, Duration::from_secs(10))?;
    stream.write(b"GET /webos_rsa HTTP/1.0\r\n")?;
    stream.write(b"Connection: close\r\n")?;
    stream.write(b"\r\n")?;

    let mut limited_stream = stream.take(65536);
    let mut buffer = Vec::with_capacity(65536);
    limited_stream.read_to_end(&mut buffer)?;
    let mut headers = [httparse::EMPTY_HEADER; 64];
    let mut response = Response::new(&mut headers);
    let Status::Complete(size_to_skip) = response
        .parse(&buffer)
        .map_err(|e| IoError::new(std::io::ErrorKind::InvalidData, e))?
    else {
        return Err(Error::NotFound);
    };
    if response.code.unwrap() != 200 {
        return Err(Error::NotFound);
    }
    Ok(String::from_utf8_lossy(&buffer[size_to_skip..]).to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use httptest::matchers::request;
    use httptest::responders::status_code;
    use httptest::{Expectation, Server};
    use std::io::ErrorKind;

    #[test]
    fn fetch_key_404() {
        let server = Server::run();
        server.expect(
            Expectation::matching(request::method_path("GET", "/webos_rsa"))
                .respond_with(status_code(404).body("Not Found")),
        );
        let addr = server.addr();
        let result = fetch_key(addr.ip().to_string().as_str(), addr.port());
        assert!(result.is_err());
    }

    #[test]
    fn fetch_key_success() {
        let server = Server::run();
        let expected_key =
            "-----BEGIN ENCRYPTED PRIVATE KEY-----\n...\n-----END ENCRYPTED PRIVATE KEY-----\n";
        server.expect(
            Expectation::matching(request::method_path("GET", "/webos_rsa"))
                .respond_with(status_code(200).body(expected_key)),
        );
        let addr = server.addr();
        let result = fetch_key(addr.ip().to_string().as_str(), addr.port());
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), expected_key);
    }

    #[test]
    fn fetch_key_refused() {
        let result = fetch_key("127.0.0.1", 9991);
        assert!(result.is_err());
        assert_eq!(
            match result.unwrap_err() {
                Error::IO { code, .. } => code,
                _ => ErrorKind::Other,
            },
            ErrorKind::ConnectionRefused
        );
    }
}
