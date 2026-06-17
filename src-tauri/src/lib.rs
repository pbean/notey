mod commands;
pub mod db;
pub mod errors;
pub mod ipc;
pub mod models;
pub mod platform;
pub mod services;

use std::sync::Mutex;

use specta_typescript::Typescript;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
use tauri_specta::{collect_commands, collect_events, Event};

use crate::commands::config::ConfigDir;

fn specta_builder() -> tauri_specta::Builder<tauri::Wry> {
    tauri_specta::Builder::<tauri::Wry>::new()
        .events(collect_events![
            ipc::events::NoteCreated,
            ipc::events::HotkeyPressed
        ])
        .commands(collect_commands![
            commands::notes::create_note,
            commands::notes::get_note,
            commands::notes::update_note,
            commands::notes::trash_note,
            commands::notes::restore_note,
            commands::notes::list_trashed_notes,
            commands::notes::delete_note_permanently,
            commands::notes::list_notes,
            commands::notes::reassign_note_workspace,
            commands::notes::rebuild_fts_index,
            commands::config::get_config,
            commands::config::update_config,
            commands::onboarding::get_onboarding_state,
            commands::onboarding::complete_onboarding,
            commands::onboarding::increment_onboarding_session,
            commands::accessibility::check_accessibility_permission,
            commands::accessibility::open_accessibility_settings,
            commands::autostart::set_autostart,
            commands::autostart::get_autostart,
            commands::window::dismiss_window,
            commands::window::apply_layout_mode,
            commands::workspace::create_workspace,
            commands::workspace::list_workspaces,
            commands::workspace::get_workspace,
            commands::workspace::detect_workspace,
            commands::workspace::resolve_workspace,
            commands::system::get_current_dir,
            commands::search::search_notes,
            commands::export::export_markdown,
            commands::export::export_json,
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
pub(crate) fn parse_shortcut(s: &str) -> Option<tauri_plugin_global_shortcut::Shortcut> {
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
        "A" => Code::KeyA,
        "B" => Code::KeyB,
        "C" => Code::KeyC,
        "D" => Code::KeyD,
        "E" => Code::KeyE,
        "F" => Code::KeyF,
        "G" => Code::KeyG,
        "H" => Code::KeyH,
        "I" => Code::KeyI,
        "J" => Code::KeyJ,
        "K" => Code::KeyK,
        "L" => Code::KeyL,
        "M" => Code::KeyM,
        "N" => Code::KeyN,
        "O" => Code::KeyO,
        "P" => Code::KeyP,
        "Q" => Code::KeyQ,
        "R" => Code::KeyR,
        "S" => Code::KeyS,
        "T" => Code::KeyT,
        "U" => Code::KeyU,
        "V" => Code::KeyV,
        "W" => Code::KeyW,
        "X" => Code::KeyX,
        "Y" => Code::KeyY,
        "Z" => Code::KeyZ,
        "0" => Code::Digit0,
        "1" => Code::Digit1,
        "2" => Code::Digit2,
        "3" => Code::Digit3,
        "4" => Code::Digit4,
        "5" => Code::Digit5,
        "6" => Code::Digit6,
        "7" => Code::Digit7,
        "8" => Code::Digit8,
        "9" => Code::Digit9,
        "SPACE" => Code::Space,
        "ENTER" | "RETURN" => Code::Enter,
        "ESCAPE" | "ESC" => Code::Escape,
        "TAB" => Code::Tab,
        _ => return None,
    };

    let mods = if modifiers.is_empty() {
        None
    } else {
        Some(modifiers)
    };
    Some(Shortcut::new(mods, code))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = specta_builder();

    #[cfg(debug_assertions)]
    builder
        .export(Typescript::default(), "../src/generated/bindings.ts")
        .expect("Failed to export TypeScript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        // Auto-start on login (Story 8.4). LaunchAgent is the macOS mechanism; no
        // extra launch args. The plugin exposes app.autolaunch() (ManagerExt).
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            // Register typed tauri-specta events (e.g. `note-created`) into the
            // app's EventRegistry so emits resolve and the frontend can listen.
            builder.mount_events(app);

            // --- Database ---
            // Resolve the per-user data directory through the Platform abstraction
            // (Story 8.5) so data-path isolation has a single source of truth
            // rather than Tauri's bundle-id-based default.
            let data_dir = crate::platform::current()
                .data_dir()
                .expect("Failed to resolve data dir");
            let conn = db::init_db(data_dir).expect("Failed to initialize database");
            app.manage(Mutex::new(conn));

            // --- Config ---
            let config_dir =
                services::config::config_dir().expect("Failed to determine config directory");
            let config =
                services::config::load_or_create(&config_dir).expect("Failed to load config");
            let shortcut_str = config.hotkey.global_shortcut.clone();

            // --- Trash auto-purge (silent startup maintenance) ---
            // Permanently remove soft-deleted notes older than the configured
            // retention window. Non-fatal: a failure here is logged but must
            // never block app startup, and there is no user-facing notification.
            {
                let retention_days = config.trash.retention_days;
                let conn_state = app.state::<Mutex<rusqlite::Connection>>();
                let conn = conn_state
                    .lock()
                    .unwrap_or_else(commands::recover_poisoned_db);
                if let Err(e) = services::notes::purge_expired_trash(&conn, retention_days) {
                    eprintln!("warning: trash auto-purge failed: {e}");
                }
            }

            // --- First-run onboarding: reveal the window so the overlay shows ---
            // The main window is created hidden and is normally summoned via the
            // global shortcut. On first run (onboarding not yet completed) we show
            // it at startup so the OnboardingOverlay greets the user. A read failure
            // is non-fatal — fall back to the default hidden-until-summoned behavior.
            let first_run = !services::onboarding::is_complete(&config_dir).unwrap_or(false);
            if first_run {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.center();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }

            // --- Auto-start on login: reconcile OS registration to the saved
            // preference (Story 8.4 / FR43). The persisted `[general] auto_start`
            // is the source of truth; aligning the launch agent on every startup
            // ensures a reboot relaunches Notey when enabled (and that an
            // externally-removed agent is restored). Best-effort and non-fatal —
            // a plugin failure must never block startup.
            #[cfg(desktop)]
            {
                use tauri_plugin_autostart::ManagerExt;

                let desired = config.general.auto_start;
                let manager = app.autolaunch();
                match manager.is_enabled() {
                    Ok(active) if active != desired => {
                        let outcome = if desired {
                            manager.enable()
                        } else {
                            manager.disable()
                        };
                        if let Err(e) = outcome {
                            eprintln!("warning: failed to reconcile auto-start to {desired}: {e}");
                        }
                    }
                    Ok(_) => {}
                    Err(e) => eprintln!("warning: failed to query auto-start state: {e}"),
                }
            }

            app.manage(Mutex::new(config));
            app.manage(ConfigDir(config_dir));

            // --- Global shortcut ---
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

                let default_shortcut = models::config::default_global_shortcut();
                let shortcut = parse_shortcut(&shortcut_str).unwrap_or_else(|| {
                    eprintln!(
                        "Warning: invalid shortcut '{}', falling back to {}",
                        shortcut_str, default_shortcut
                    );
                    parse_shortcut(&default_shortcut).expect("platform default shortcut must parse")
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
                                // Notify the webview so the first-run onboarding overlay
                                // can complete on hotkey press (Story 8.1). Best-effort:
                                // a failed emit must not affect window toggling.
                                let _ = ipc::events::HotkeyPressed.emit(&app_handle);
                            }
                        })
                        .build(),
                )?;

                // Story 8.6 / FR57: consult the Platform abstraction for the
                // hotkey backend available on this session before registering.
                // On a compositor with no usable backend (pure Wayland without
                // XWayland — native portal support is a fast-follow, DW-96) it
                // returns Err; notify the user and skip the initial registration.
                // The plugin/handler above stays installed so a later rebind via
                // update_config can still register, and the window remains
                // summonable from the tray.
                match crate::platform::current().register_hotkey(&shortcut_str) {
                    Ok(_backend) => {
                        // Non-fatal: a saved shortcut that conflicts with another
                        // app must not brick startup. Log and continue — the
                        // window stays summonable via the tray and the user can
                        // rebind in Settings.
                        if let Err(e) = app.global_shortcut().register(shortcut) {
                            eprintln!(
                                "Warning: failed to register global shortcut '{}': {}",
                                shortcut_str, e
                            );
                        }
                    }
                    Err(e) => {
                        eprintln!(
                            "Notice: global shortcut unavailable on this compositor ({e}); \
                             summon Notey from the tray icon instead."
                        );
                    }
                }
            }

            // --- System tray ---
            let open_item = MenuItem::with_id(app, "open", "Open Notey", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
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

            // --- IPC socket server (CLI ↔ app) ---
            // Serves the standalone `notey` CLI over a per-user, owner-only local
            // socket. The handler locks the SAME managed connection the Tauri
            // commands use (single-Mutex rule). A bind failure is logged but never
            // blocks app startup. Torn down on `RunEvent::Exit` (see `run`).
            {
                let app_handle = app.handle().clone();
                let handler: ipc::socket_server::Handler =
                    std::sync::Arc::new(move |raw: &[u8]| {
                        let response = {
                            let state = app_handle.state::<Mutex<rusqlite::Connection>>();
                            let conn = state.lock().unwrap_or_else(commands::recover_poisoned_db);
                            ipc::protocol::handle_request(&conn, raw)
                            // conn guard dropped here, before emitting.
                        };

                        // Real-time desktop sync (Story 6.6): a CLI-created note
                        // notifies the running app so its list refreshes. The
                        // emit is best-effort — a failure must never alter the
                        // IPC response returned to the client.
                        if let Some(note_id) = ipc::protocol::created_note_id(raw, &response) {
                            let _ = ipc::events::NoteCreated::now(note_id).emit(&app_handle);
                        }

                        response
                    });
                let socket = ipc::socket_server::socket_path();
                match ipc::socket_server::IpcServer::start(&socket, handler) {
                    Ok(server) => {
                        app.manage(Mutex::new(server));
                    }
                    Err(e) => eprintln!("warning: IPC socket server failed to start: {e}"),
                }
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // Stop the IPC server and unlink its socket on shutdown.
            if let tauri::RunEvent::Exit = event {
                if let Some(server) = app_handle.try_state::<Mutex<ipc::socket_server::IpcServer>>()
                {
                    server.lock().unwrap_or_else(|e| e.into_inner()).shutdown();
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn export_bindings() {
        specta_builder()
            .export(Typescript::default(), "../src/generated/bindings.ts")
            .expect("Failed to export TypeScript bindings");
    }

    #[test]
    fn parse_shortcut_accepts_modifier_plus_key() {
        // A standard modifier+letter combination parses.
        assert!(parse_shortcut("Ctrl+Shift+N").is_some());
        // Digit main keys are supported.
        assert!(parse_shortcut("Ctrl+1").is_some());
        // Whitespace around segments is tolerated.
        assert!(parse_shortcut(" Ctrl + Alt + J ").is_some());
    }

    #[test]
    fn parse_shortcut_accepts_modifier_aliases() {
        // Each spelling of a modifier resolves; same combo parses every way.
        for s in [
            "Ctrl+N",
            "Control+N",
            "Cmd+N",
            "Command+N",
            "Super+N",
            "Meta+N",
            "Alt+N",
        ] {
            assert!(parse_shortcut(s).is_some(), "expected '{s}' to parse");
        }
    }

    #[test]
    fn parse_shortcut_rejects_invalid_input() {
        // Unknown modifier.
        assert!(parse_shortcut("Hyper+N").is_none());
        // Unsupported main key (function keys aren't mapped).
        assert!(parse_shortcut("Ctrl+F1").is_none());
        // Empty string.
        assert!(parse_shortcut("").is_none());
    }

    #[test]
    fn platform_default_shortcut_parses() {
        // The platform default must always be a registrable binding.
        assert!(parse_shortcut(&models::config::default_global_shortcut()).is_some());
    }
}
