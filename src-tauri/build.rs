fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "create_note",
                "get_note",
                "update_note",
                "list_notes",
                "get_config",
                "update_config",
                "dismiss_window",
                "create_workspace",
                "list_workspaces",
                "get_workspace",
            ]),
        ),
    )
    .expect("failed to run tauri-build");
}
