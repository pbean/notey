use crate::errors::NoteyError;

/// Hides the calling window (dismiss without destroy).
#[tauri::command]
#[specta::specta]
pub async fn dismiss_window(window: tauri::WebviewWindow) -> Result<(), NoteyError> {
    window.hide().map_err(|e| NoteyError::Config(format!("Failed to hide window: {}", e)))?;
    Ok(())
}
