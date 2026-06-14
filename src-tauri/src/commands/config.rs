use std::sync::Mutex;

use tauri::State;

use crate::errors::NoteyError;
use crate::models::config::AppConfig;
use crate::services;
use crate::services::config::PartialAppConfig;

use super::recover_poisoned_config;

/// Configuration directory path, managed as Tauri state.
pub struct ConfigDir(pub std::path::PathBuf);

#[cfg(desktop)]
fn resolve_active_shortcut(
    app: &tauri::AppHandle,
    stored_shortcut_str: &str,
) -> Option<tauri_plugin_global_shortcut::Shortcut> {
    use tauri_plugin_global_shortcut::GlobalShortcutExt;

    if let Some(shortcut) = crate::parse_shortcut(stored_shortcut_str) {
        if app.global_shortcut().is_registered(shortcut) {
            return Some(shortcut);
        }
    } else {
        let fallback = crate::parse_shortcut(&crate::models::config::default_global_shortcut())
            .expect("platform default shortcut must parse");
        if app.global_shortcut().is_registered(fallback) {
            return Some(fallback);
        }
    }

    None
}

#[cfg(desktop)]
fn restore_shortcut_registrations(
    app: &tauri::AppHandle,
    desired_active: Option<tauri_plugin_global_shortcut::Shortcut>,
) -> Result<(), NoteyError> {
    use tauri_plugin_global_shortcut::GlobalShortcutExt;

    app.global_shortcut()
        .unregister_all()
        .map_err(|e| NoteyError::Config(format!("Failed to reset shortcut registrations: {e}")))?;

    if let Some(shortcut) = desired_active {
        app.global_shortcut()
            .register(shortcut)
            .map_err(|e| NoteyError::Config(format!("Failed to restore shortcut registration: {e}")))?;
    }

    Ok(())
}

/// Returns the full application config.
#[tauri::command]
#[specta::specta]
pub fn get_config(state: State<'_, Mutex<AppConfig>>) -> Result<AppConfig, NoteyError> {
    let config = state.lock().unwrap_or_else(recover_poisoned_config);
    Ok(config.clone())
}

/// Applies a partial update to the config, saves to disk, and returns the updated config.
/// Validates shortcut strings before persisting. Re-registers the global hotkey if changed.
/// Holds the config mutex through merge + save so overlapping partial updates
/// cannot clobber each other from stale snapshots.
#[tauri::command]
#[specta::specta]
pub fn update_config(
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
            NoteyError::Validation(format!("Invalid shortcut string: '{}'", shortcut_str))
        })?;
        Some(parsed)
    } else {
        None
    };

    // Hold the config mutex through the full rebind so overlapping updates
    // cannot each register a different shortcut against a stale snapshot.
    let mut config = config_state.lock().unwrap_or_else(recover_poisoned_config);
    let old_shortcut_str = config.hotkey.global_shortcut.clone();

    // Conflict detection BEFORE committing: register the new shortcut FIRST,
    // while the old one is still active. Only a successful bind lets us persist
    // and then retire the old shortcut. On a conflict we return early with
    // nothing written, so a rejected binding can never corrupt the stored config
    // or strand the app without a working hotkey.
    #[cfg(desktop)]
    let old_active_shortcut = resolve_active_shortcut(&app, &old_shortcut_str);
    #[cfg(desktop)]
    let mut registered_new = false;

    #[cfg(desktop)]
    if let Some(new_shortcut) = parsed_new_shortcut {
        use tauri_plugin_global_shortcut::GlobalShortcutExt;

        // Skip all registration churn only when the requested shortcut is the
        // one actually active, not merely the one currently stored on disk.
        if !app.global_shortcut().is_registered(new_shortcut) {
            if let Err(e) = app.global_shortcut().register(new_shortcut) {
                return Err(NoteyError::Config(format!(
                    "Failed to register new shortcut: {}",
                    e
                )));
            }
            registered_new = true;
        }
    }

    // Registration succeeded (or no hotkey change) — now commit. Merge, save, and
    // update in-memory state under one lock so concurrent partial writes observe
    // the latest committed snapshot.
    let merged = services::config::merge_update(&config, &partial);
    if let Err(save_error) = services::config::save(&config_dir_state.0, &merged) {
        // Persistence failed after we registered the new binding. Restore the
        // previously-active registration so runtime state still matches the
        // unchanged persisted config.
        #[cfg(desktop)]
        if registered_new {
            if let Err(recovery_error) =
                restore_shortcut_registrations(&app, old_active_shortcut)
            {
                return Err(NoteyError::Config(format!(
                    "{} (original save error: {})",
                    match recovery_error {
                        NoteyError::Config(message) => message,
                        other => other.to_string(),
                    },
                    save_error
                )));
            }
        }
        return Err(save_error);
    }
    *config = merged.clone();

    // Persisted successfully — now retire the old binding.
    #[cfg(desktop)]
    if registered_new {
        use tauri_plugin_global_shortcut::GlobalShortcutExt;
        if let Some(new_shortcut) = parsed_new_shortcut {
            if let Some(old_shortcut) = old_active_shortcut {
                if old_shortcut != new_shortcut {
                    if let Err(unregister_error) =
                        app.global_shortcut().unregister(old_shortcut)
                    {
                        restore_shortcut_registrations(&app, Some(new_shortcut))
                            .map_err(|recovery_error| {
                                NoteyError::Config(format!(
                                    "Failed to retire previous shortcut: {} (recovery: {})",
                                    unregister_error, recovery_error
                                ))
                            })?;
                    }
                }
            }
        }
    }

    Ok(merged)
}
