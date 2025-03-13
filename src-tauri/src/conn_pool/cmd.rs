use crate::byte_string::{ByteString, Encoding};
use crate::conn_pool::DeviceConnection;
use crate::error::Error;
use crate::plugins::cmd::ExecOutput;
use std::io::{Read, Write};

pub trait ExecuteCommand {
    fn execute_command(
        &self,
        command: &str,
        stdin: Option<&ByteString>,
        encoding: Encoding,
    ) -> Result<ExecOutput, Error>;
}

impl ExecuteCommand for DeviceConnection {
    fn execute_command(
        &self,
        command: &str,
        stdin: Option<&ByteString>,
        encoding: Encoding,
    ) -> Result<ExecOutput, Error> {
        let ch = self.new_channel()?;
        ch.open_session()?;
        ch.request_exec(command)?;
        if let Some(stdin) = stdin.clone() {
            ch.stdin().write_all(stdin.as_ref())?;
            ch.send_eof()?;
        }
        let mut stdout = Vec::<u8>::new();
        ch.stdout().read_to_end(&mut stdout)?;
        let mut stderr = Vec::<u8>::new();
        ch.stderr().read_to_end(&mut stderr)?;
        let exit_code = ch.get_exit_status().unwrap_or(0);
        ch.close()?;
        self.mark_last_ok();
        if exit_code != 0 {
            return Err(Error::ExitStatus {
                message: "".to_string(),
                command: command.to_string(),
                exit_code,
                stderr,
                unhandled: true,
            });
        }
        Ok(ExecOutput {
            stdout: ByteString::parse(&stdout, encoding).unwrap(),
            stderr: ByteString::parse(&stderr, encoding).unwrap(),
        })
    }
}

#[cfg(test)]
mod test {
    use crate::byte_string::{ByteString, Encoding};
    use crate::conn_pool::{DeviceConnection, ExecuteCommand};
    use crate::device_manager::Device;
    use crate::error::Error;
    use crate::tests::common::SshContainer;

    #[test]
    fn execute_command_timeout() {
        // language=json
        let device = serde_json::from_str::<Device>(
            r#"
{
  "profile": "ose",
  "name": "test",
  "host": "0.0.0.0",
  "port": 22,
  "username": "root",
  "password": "12345678"
}
"#,
        )
        .unwrap();
        let conn = DeviceConnection::new(device, None);
        assert_eq!(Error::Timeout, conn.unwrap_err())
    }

    #[test]
    fn execute_command_noauth() {
        let sshd = SshContainer::new();
        let port = sshd.wait();
        let device = serde_json::from_str::<Device>(&format!(
            "{{\"profile\":\"ose\",\"name\":\"test\",\"host\":\"127.0.0.1\",\
            \"port\": {port},\"username\": \"root\"}}"
        ))
        .unwrap();
        let err = DeviceConnection::new(device, None).expect_err("Should have failed");
        assert!(
            matches!(err, Error::Authorization { message } if message == "Host needs authorization")
        );
    }

    #[test]
    fn execute_command_wrongpass() {
        let sshd = SshContainer::new();
        let port = sshd.wait();
        let device = serde_json::from_str::<Device>(&format!(
            "{{\"profile\":\"ose\",\"name\":\"test\",\"host\":\"127.0.0.1\",\
            \"port\": {port},\"username\": \"root\",\"password\": \"youshallnotpass\"}}"
        ))
        .unwrap();
        let err = DeviceConnection::new(device, None).expect_err("Should have failed");
        assert!(
            matches!(err, Error::Authorization { message } if message == "Bad SSH password")
        );
    }

    #[test]
    fn execute_command_whoami() {
        let sshd = SshContainer::new();
        let port = sshd.wait();
        let device = serde_json::from_str::<Device>(&format!(
            "{{\"profile\":\"ose\",\"name\":\"test\",\"host\":\"127.0.0.1\",\
            \"port\": {port},\"username\": \"root\",\"password\": \"alpine\"}}"
        ))
        .unwrap();
        let conn = DeviceConnection::new(device, None).expect("Failed to create connection");
        let output = conn
            .execute_command("whoami", None, Encoding::String)
            .expect("Failed to execute command");
        assert_eq!(b"root\n", output.stdout.as_ref());
    }

    #[test]
    fn execute_command_false() {
        let sshd = SshContainer::new();
        let port = sshd.wait();
        let device = serde_json::from_str::<Device>(&format!(
            "{{\"profile\":\"ose\",\"name\":\"test\",\"host\":\"127.0.0.1\",\
            \"port\": {port},\"username\": \"root\",\"password\": \"alpine\"}}"
        ))
        .unwrap();
        let conn = DeviceConnection::new(device, None).expect("Failed to create connection");
        let err = conn
            .execute_command(
                "false",
                Some(ByteString::String("input".to_string())).as_ref(),
                Encoding::String,
            )
            .expect_err("Should have failed");
        assert!(matches!(err, Error::ExitStatus { exit_code, .. } if exit_code == 1));
    }
}
