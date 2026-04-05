mod commands;
pub mod db;
pub mod errors;
pub mod models;
pub mod services;

use std::sync::Mutex;

use specta_typescript::Typescript;
use tauri::Manager;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::menu::{Menu, MenuItem};
use tauri_specta::collect_commands;

use crate::commands::config::ConfigDir;

fn specta_builder() -> tauri_specta::Builder<tauri::Wry> {
    tauri_specta::Builder::<tauri::Wry>::new().commands(collect_commands![
        commands::notes::create_note,
        commands::notes::get_note,
        commands::notes::update_note,
        commands::notes::list_notes,
        commands::config::get_config,
        commands::config::update_config,
        commands::window::dismiss_window,
        commands::workspace::create_workspace,
        commands::workspace::list_workspaces,
        commands::workspace::get_workspace,
    ])
}

/// Toggles the main window: shows + centers + focuses if hidden, hides if visible.
fn toggle_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        match window.is_visible() {
            Ok(true) => {
                let _ = window.hide();
            }
            Ok(false) => {
                let _ = window.center();
                let _ = window.show();
                let _ = window.set_focus();
            }
            Err(e) => {
                eprintln!("Failed to check window visibility: {}", e);
            }
        }
    }
}

/// Parses a shortcut string like "Ctrl+Shift+N" into Modifiers + Code.
pub(crate) fn parse_shortcut(
    s: &str,
) -> Option<tauri_plugin_global_shortcut::Shortcut> {
    use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut};

    let parts: Vec<&str> = s.split('+').map(|p| p.trim()).collect();
    if parts.is_empty() {
        return None;
    }

    let mut modifiers = Modifiers::empty();
    for part in &parts[..parts.len() - 1] {
        match part.to_lowercase().as_str() {
            "ctrl" | "control" => modifiers |= Modifiers::CONTROL,
            "shift" => modifiers |= Modifiers::SHIFT,
            "alt" => modifiers |= Modifiers::ALT,
            "cmd" | "super" | "meta" | "command" => modifiers |= Modifiers::SUPER,
            _ => return None,
        }
    }

    let key_str = parts.last()?;
    let code = match key_str.to_uppercase().as_str() {
        "A" => Code::KeyA, "B" => Code::KeyB, "C" => Code::KeyC, "D" => Code::KeyD,
        "E" => Code::KeyE, "F" => Code::KeyF, "G" => Code::KeyG, "H" => Code::KeyH,
        "I" => Code::KeyI, "J" => Code::KeyJ, "K" => Code::KeyK, "L" => Code::KeyL,
        "M" => Code::KeyM, "N" => Code::KeyN, "O" => Code::KeyO, "P" => Code::KeyP,
        "Q" => Code::KeyQ, "R" => Code::KeyR, "S" => Code::KeyS, "T" => Code::KeyT,
        "U" => Code::KeyU, "V" => Code::KeyV, "W" => Code::KeyW, "X" => Code::KeyX,
        "Y" => Code::KeyY, "Z" => Code::KeyZ,
        "0" => Code::Digit0, "1" => Code::Digit1, "2" => Code::Digit2,
        "3" => Code::Digit3, "4" => Code::Digit4, "5" => Code::Digit5,
        "6" => Code::Digit6, "7" => Code::Digit7, "8" => Code::Digit8,
        "9" => Code::Digit9,
        "SPACE" => Code::Space, "ENTER" | "RETURN" => Code::Enter,
        "ESCAPE" | "ESC" => Code::Escape, "TAB" => Code::Tab,
        _ => return None,
    };

    let mods = if modifiers.is_empty() { None } else { Some(modifiers) };
    Some(Shortcut::new(mods, code))
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
            // --- Database ---
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            let conn = db::init_db(data_dir).expect("Failed to initialize database");
            app.manage(Mutex::new(conn));

            // --- Config ---
            let config_dir = services::config::config_dir()
                .expect("Failed to determine config directory");
            let config = services::config::load_or_create(&config_dir)
                .expect("Failed to load config");
            let shortcut_str = config.hotkey.global_shortcut.clone();
            app.manage(Mutex::new(config));
            app.manage(ConfigDir(config_dir));

            // --- Global shortcut ---
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

                let shortcut = parse_shortcut(&shortcut_str).unwrap_or_else(|| {
                    eprintln!(
                        "Warning: invalid shortcut '{}', falling back to Ctrl+Shift+N",
                        shortcut_str
                    );
                    parse_shortcut("Ctrl+Shift+N").unwrap()
                });

                let app_handle = app.handle().clone();
                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |_app, _shortcut, event| {
                            // Only one global shortcut is registered at a time, so any
                            // press event is ours. This avoids capturing a stale shortcut
                            // value when the hotkey is re-registered via update_config.
                            if event.state() == ShortcutState::Pressed {
                                toggle_main_window(&app_handle);
                            }
                        })
                        .build(),
                )?;

                app.global_shortcut().register(shortcut)?;
            }

            // --- System tray ---
            let open_item =
                MenuItem::with_id(app, "open", "Open Notey", true, None::<&str>)?;
            let quit_item =
                MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_item, &quit_item])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.center();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            // --- Prevent close (hide instead) ---
            if let Some(window) = app.get_webview_window("main") {
                let win = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win.hide();
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(builder.invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn export_bindings() {
        specta_builder()
            .export(
                Typescript::default(),
                "../src/generated/bindings.ts",
            )
            .expect("Failed to export TypeScript bindings");
    }
}
