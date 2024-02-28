use tauri_build::{Attributes, CodegenContext, InlinedPlugin};

fn main() {
    tauri_build::try_build(
        Attributes::new()
            .codegen(CodegenContext::new())
            .plugin(
                "device-manager",
                InlinedPlugin::new().commands(&[
                    "list",
                    "set_default",
                    "add",
                    "remove",
                    "novacom_getkey",
                    "localkey_verify",
                    "privkey_read",
                ]),
            )
            .plugin(
                "remote-command",
                InlinedPlugin::new().commands(&["exec", "spawn"]),
            )
            .plugin(
                "remote-shell",
                InlinedPlugin::new()
                    .commands(&["open", "close", "write", "resize", "screen", "list"]),
            )
            .plugin(
                "remote-file",
                InlinedPlugin::new()
                    .commands(&["ls", "read", "write", "get", "put", "get_temp", "serve"]),
            )
            .plugin(
                "dev-mode",
                InlinedPlugin::new().commands(&["status", "token"]),
            )
            .plugin(
                "local-file",
                InlinedPlugin::new().commands(&["checksum", "download", "remove", "temp_path"]),
            ),
    )
    .expect("failed to run tauri-build");
}
