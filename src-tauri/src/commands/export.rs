use std::path::Path;
use std::sync::Mutex;

use serde::Serialize;
use specta::Type;
use tauri::{AppHandle, Emitter, State};

use crate::errors::NoteyError;
use crate::services;

use super::recover_poisoned_db;

/// Emit progress at most once per this many notes (plus a final event), so a
/// large export doesn't flood the IPC channel.
const PROGRESS_EMIT_INTERVAL: usize = 50;

/// Payload for the `export-markdown-progress` event the frontend listens on to
/// render a live "Exporting… N/total" toast for slow exports.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ExportProgress {
    /// Number of notes written so far.
    pub current: usize,
    /// Total number of notes that will be written.
    pub total: usize,
}

/// Export every active (non-trashed) note as an individual Markdown file into
/// the user-selected `directory` (chosen via the frontend's native directory
/// picker). Returns the number of files written.
///
/// The directory is canonicalized and validated to exist before any write; all
/// file writing is delegated to the testable export service. Progress is
/// emitted on `export-markdown-progress` throttled to every
/// [`PROGRESS_EMIT_INTERVAL`] notes (and once at completion).
#[tauri::command]
#[specta::specta]
pub fn export_markdown(
    app: AppHandle,
    state: State<'_, Mutex<rusqlite::Connection>>,
    directory: String,
) -> Result<usize, NoteyError> {
    let canonical = dunce::canonicalize(Path::new(&directory))
        .map_err(|_| NoteyError::Validation("export directory does not exist".to_string()))?;
    if !canonical.is_dir() {
        return Err(NoteyError::Validation(
            "export target is not a directory".to_string(),
        ));
    }

    let conn = state.lock().unwrap_or_else(recover_poisoned_db);
    services::export::export_markdown_to_dir(&conn, &canonical, |current, total| {
        if current % PROGRESS_EMIT_INTERVAL == 0 || current == total {
            // A failed emit must not abort the export; the result toast still fires.
            let _ = app.emit(
                "export-markdown-progress",
                ExportProgress { current, total },
            );
        }
    })
}
