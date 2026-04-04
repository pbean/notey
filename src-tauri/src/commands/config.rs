use std::sync::Mutex;

use tauri::State;

use crate::errors::NoteyError;
use crate::models::config::AppConfig;
use crate::services;
use crate::services::config::PartialAppConfig;

/// Configuration directory path, managed as Tauri state.
pub struct ConfigDir(pub std::path::PathBuf);

/// Returns the full application config.
#[tauri::command]
#[specta::specta]
pub async fn get_config(
    state: State<'_, Mutex<AppConfig>>,
) -> Result<AppConfig, NoteyError> {
    let config = state.lock().unwrap_or_else(|e| e.into_inner());
    Ok(config.clone())
}

/// Applies a partial update to the config, saves to disk, and returns the updated config.
/// Validates shortcut strings before persisting. Re-registers the global hotkey if changed.
/// Releases the mutex before filesystem I/O to avoid blocking concurrent reads.
#[tauri::command]
#[specta::specta]
pub async fn update_config(
    app: tauri::AppHandle,
    config_state: State<'_, Mutex<AppConfig>>,
    config_dir_state: State<'_, ConfigDir>,
    partial: PartialAppConfig,
) -> Result<AppConfig, NoteyError> {
    // Validate shortcut string before doing anything
    let new_shortcut = partial
        .hotkey
        .as_ref()
        .and_then(|h| h.global_shortcut.as_ref());

    let parsed_new_shortcut = if let Some(shortcut_str) = new_shortcut {
        let parsed = crate::parse_shortcut(shortcut_str).ok_or_else(|| {
            NoteyError::Validation(format!(
                "Invalid shortcut string: '{}'",
                shortcut_str
            ))
        })?;
        Some(parsed)
    } else {
        None
    };

    // Read current config under lock, then drop lock before I/O
    let (existing, old_shortcut_str) = {
        let config = config_state.lock().unwrap_or_else(|e| e.into_inner());
        (config.clone(), config.hotkey.global_shortcut.clone())
    };

    let merged = services::config::merge_update(&existing, &partial);
    services::config::save(&config_dir_state.0, &merged)?;

    // Re-acquire lock to update in-memory state
    {
        let mut config = config_state.lock().unwrap_or_else(|e| e.into_inner());
        *config = merged.clone();
    }

    // Re-register hotkey if it changed
    #[cfg(desktop)]
    if let Some(new_shortcut) = parsed_new_shortcut {
        use tauri_plugin_global_shortcut::GlobalShortcutExt;

        let old_parsed = crate::parse_shortcut(&old_shortcut_str);
        if let Some(ref old) = old_parsed {
            let _ = app.global_shortcut().unregister(*old);
        }
        if let Err(e) = app.global_shortcut().register(new_shortcut) {
            // Rollback: re-register old shortcut so the app isn't left without a hotkey
            if let Some(old) = old_parsed {
                let _ = app.global_shortcut().register(old);
            }
            return Err(NoteyError::Config(format!(
                "Failed to register new shortcut: {}",
                e
            )));
        }
    }

    Ok(merged)
}
