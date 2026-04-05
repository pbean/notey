use crate::errors::NoteyError;

/// Returns the process's current working directory as a string.
#[tauri::command]
#[specta::specta]
pub async fn get_current_dir() -> Result<String, NoteyError> {
    std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(NoteyError::Io)
}
