use abs_file_macro::abs_file;
use std::borrow::Cow;
use std::io::BufRead;
use std::net::SocketAddr;
use std::path::{Component, PathBuf};
use std::process::Command;
use std::str::FromStr;
use std::thread::sleep;
use std::time::Duration;

pub struct SshContainer {
    container_id: String,
}

impl SshContainer {
    pub fn new() -> Self {
        let output = Command::new("docker")
            .args(["run", "--rm", "-d", "-p", "22"])
            .args(["-e", "SSH_ENABLE_ROOT=true"])
            .args(["-e", "SSH_ENABLE_ROOT_PASSWORD_AUTH=true"])
            .args([
                "--health-cmd",
                "netstat -a | grep ':ssh'",
                "--health-start-period",
                "5s",
                "--health-interval",
                "3s",
            ])
            .args([
                "-v",
                &format!(
                    "{}:/etc/entrypoint.d/",
                    Self::fixture_path("entrypoint.d", true).to_string_lossy()
                ),
                "-v",
                &format!(
                    "{}:/root/.ssh/authorized_keys",
                    Self::fixture_path("keys/id_root.pub", true).to_string_lossy()
                ),
            ])
            .arg("public.ecr.aws/panubo/sshd")
            .output()
            .expect("Failed to start sshd container");
        if !output.status.success() {
            panic!(
                "Failed to start sshd container: {}",
                String::from_utf8_lossy(&output.stderr)
            );
        }
        Self {
            container_id: String::from_utf8(output.stdout.trim_ascii().to_vec())
                .expect("Failed to parse container id"),
        }
    }

    pub fn wait(&self) -> u16 {
        let mut retries = 0;
        while retries < 10 {
            let health_status = Command::new("docker")
                .args([
                    "inspect",
                    "--format='{{json .State.Health.Status}}'",
                    &self.container_id,
                ])
                .output()
                .expect("Failed to query sshd container health");
            if String::from_utf8_lossy(&health_status.stdout).contains("\"healthy\"") {
                let output = Command::new("docker")
                    .args(["port", &self.container_id, "22/tcp"])
                    .output()
                    .expect("Failed to query sshd container port");
                if !output.status.success() {
                    panic!("Failed to get sshd container port");
                }
                return SocketAddr::from_str(&output.stdout.lines().next().unwrap().unwrap())
                    .expect("Failed to parse sshd container port")
                    .port();
            }
            sleep(Duration::from_secs(3));
            retries += 1;
        }
        panic!("Failed to start sshd container");
    }

    pub fn fixture_path(name: &str, for_container: bool) -> PathBuf {
        let path = abs_file!().parent().unwrap().join(name);
        if for_container && cfg!(target_family = "windows") {
            let mut components = path.components();
            let drive: Component = components.next().unwrap().into();
            components.next();
            let rest: Vec<Cow<'_, str>> = components
                .map(|c| c.as_os_str().to_string_lossy())
                .collect();
            return PathBuf::from(format!(
                "/{}/{}",
                drive
                    .as_os_str()
                    .to_string_lossy()
                    .strip_suffix(":")
                    .unwrap()
                    .to_ascii_lowercase(),
                rest.join("/")
            ));
        }
        path
    }
}

impl Drop for SshContainer {
    fn drop(&mut self) {
        Command::new("docker")
            .args(["kill", &self.container_id])
            .status()
            .expect("Failed to stop sshd container");
    }
}
