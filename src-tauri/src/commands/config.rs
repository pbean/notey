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
#[tauri::command]
#[specta::specta]
pub async fn update_config(
    config_state: State<'_, Mutex<AppConfig>>,
    config_dir_state: State<'_, ConfigDir>,
    partial: PartialAppConfig,
) -> Result<AppConfig, NoteyError> {
    let mut config = config_state.lock().unwrap_or_else(|e| e.into_inner());
    let merged = services::config::merge_update(&config, &partial);
    services::config::save(&config_dir_state.0, &merged)?;
    *config = merged.clone();
    Ok(merged)
}
