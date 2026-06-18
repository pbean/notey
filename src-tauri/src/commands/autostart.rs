//! Thin Tauri command handlers for auto-start on login (Story 8.4 / FR41–FR43).
//!
//! The OS launch agent is owned by `tauri-plugin-autostart` (registered with
//! `MacosLauncher::LaunchAgent` in `lib.rs`) and reached through the
//! [`crate::platform::Platform`] trait's `autostart_*` methods (DW-97), which
//! delegate to `app.autolaunch()`. The user's preference is the single source of
//! truth at `config.toml`
//! `[general] auto_start`; [`set_autostart`] registers/unregisters the OS agent
//! AND persists the preference atomically under the shared `Mutex<AppConfig>`,
//! mirroring [`crate::commands::config::update_config`]'s lock discipline.

use std::sync::Mutex;

use tauri::State;

use crate::errors::NoteyError;
use crate::models::config::AppConfig;
use crate::services;

use super::config::ConfigDir;
use super::recover_poisoned_config;

/// Enable/disable auto-start via the plugin, persist atomically, and return committed config.
#[tauri::command]
#[specta::specta]
pub fn set_autostart(
    #[allow(unused_variables)] app: tauri::AppHandle,
    config_state: State<'_, Mutex<AppConfig>>,
    config_dir_state: State<'_, ConfigDir>,
    enabled: bool,
) -> Result<AppConfig, NoteyError> {
    // Hold the config mutex across the OS change + persist so a concurrent
    // update_config cannot interleave and clobber the stored snapshot.
    let mut config = config_state.lock().unwrap_or_else(recover_poisoned_config);

    #[cfg(desktop)]
    let rollback_to = {
        // Route the OS registration through the Platform trait (DW-97) rather than
        // hitting `app.autolaunch()` directly, so the trait is the single source
        // of truth for auto-start side effects.
        let platform = crate::platform::current();
        let currently_enabled = platform.autostart_is_enabled(&app)?;

        if enabled != currently_enabled {
            if enabled {
                platform.autostart_enable(&app)?;
            } else {
                platform.autostart_disable(&app)?;
            }
            Some(currently_enabled)
        } else {
            None
        }
    };

    // OS registration succeeded (or no change needed) — now persist the preference.
    let mut updated = config.clone();
    updated.general.auto_start = enabled;
    if let Err(save_err) = services::config::save(&config_dir_state.0, &updated) {
        #[cfg(desktop)]
        if let Some(previously_enabled) = rollback_to {
            let platform = crate::platform::current();
            let rollback = if previously_enabled {
                platform.autostart_enable(&app)
            } else {
                platform.autostart_disable(&app)
            };
            if let Err(rollback_err) = rollback {
                eprintln!("warning: failed to roll back auto-start after config save failure: {rollback_err}");
            }
        }
        return Err(save_err);
    }
    *config = updated;

    Ok(config.clone())
}

/// Whether auto-start on login is currently registered at the OS level.
/// Reports the live platform state via the autostart plugin (the source of truth
/// for the *active* registration), letting the UI reconcile its toggle with the
/// real OS state. Off desktop there is no launch agent, so it reports `false`.
#[tauri::command]
#[specta::specta]
pub fn get_autostart(#[allow(unused_variables)] app: tauri::AppHandle) -> Result<bool, NoteyError> {
    #[cfg(desktop)]
    {
        crate::platform::current().autostart_is_enabled(&app)
    }
    #[cfg(not(desktop))]
    {
        Ok(false)
    }
}
