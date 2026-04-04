mod commands;
pub mod db;
pub mod errors;
pub mod models;
pub mod services;

use std::sync::Mutex;

use specta_typescript::Typescript;
use tauri::Manager;
use tauri_specta::collect_commands;

fn specta_builder() -> tauri_specta::Builder<tauri::Wry> {
    tauri_specta::Builder::<tauri::Wry>::new().commands(collect_commands![
        commands::notes::create_note,
        commands::notes::get_note,
        commands::notes::update_note,
        commands::notes::list_notes,
    ])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = specta_builder();

    #[cfg(debug_assertions)]
    builder
        .export(
            Typescript::default(),
            "../src/generated/bindings.ts",
        )
        .expect("Failed to export TypeScript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            let conn = db::init_db(data_dir).expect("Failed to initialize database");
            app.manage(Mutex::new(conn));
            Ok(())
        })
        .invoke_handler(builder.invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
