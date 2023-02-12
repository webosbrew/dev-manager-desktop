use crate::device_manager::Device;
use crate::error::Error;
use crate::session_manager::SessionManager;

pub(crate) async fn for_entries(
    manager: &SessionManager,
    device: Device,
    entries: &[String],
    use_legacy: bool,
) -> Result<Vec<String>, Error> {
    let ls_input = entries.join("\0").into_bytes();
    let ls_output = match manager
        .exec(
            device.clone(),
            &format!(
                "xargs -0 ls -ld {}",
                if use_legacy { "-e" } else { "--full-time" }
            ),
            Some(ls_input.clone()),
        )
        .await
    {
        Ok(v) => v,
        Err(Error::ExitStatus {
            message,
            exit_code,
            stderr,
        }) => {
            if exit_code == 123 {
                return Err(Error::Unsupported);
            }
            return Err(Error::ExitStatus {
                message,
                exit_code,
                stderr,
            });
        }
        Err(e) => return Err(e),
    };
    let mut details: Vec<String> = String::from_utf8(ls_output)
        .unwrap()
        .split('\n')
        .map(|l| String::from(l))
        .collect();
    // Last line is empty, remove it
    details.pop();
    assert_eq!(entries.len(), details.len());
    return Ok(details);
}
