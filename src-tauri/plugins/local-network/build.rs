fn main() {
    // No commands: the app calls this plugin from Rust, never from the webview.
    tauri_plugin::Builder::new(&[])
        .android_path("android")
        .build();
}
