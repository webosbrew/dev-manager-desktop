#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use log::LevelFilter;

fn main() {
    #[cfg(feature = "desktop")]
    {
        env_logger::builder()
            .filter_level(LevelFilter::Debug)
            .init();
    }
    devman::run();
}
