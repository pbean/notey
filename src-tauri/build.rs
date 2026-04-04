fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "create_note",
                "get_note",
                "update_note",
                "list_notes",
            ]),
        ),
    )
    .expect("failed to run tauri-build");
}
