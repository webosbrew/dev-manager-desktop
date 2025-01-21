#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

fn main() {
    #[cfg(feature = "desktop")]
    {
        use log::LevelFilter;
        env_logger::builder()
            .filter_level(LevelFilter::Debug)
            .init();
    }
    devman::run();
}
