use crate::device_manager::Device;

impl Device {
    pub(crate) fn valid_passphrase(&self) -> Option<String> {
        return self.passphrase.clone().filter(|s| !s.is_empty());
    }
}
