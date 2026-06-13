use std::path::{Path, PathBuf};
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

/// Export every active (non-trashed) note as a single 2-space-indented JSON
/// array to the user-selected `file_path` (chosen via the frontend's native
/// file-save dialog). Returns the number of notes written.
///
/// The target file may not exist yet, so the **parent directory** is
/// canonicalized and required to exist before any write; the validated parent is
/// rejoined with the chosen filename, confining the write to a real directory
/// and blocking path traversal. All serialization is delegated to the testable
/// export service.
#[tauri::command]
#[specta::specta]
pub fn export_json(
    state: State<'_, Mutex<rusqlite::Connection>>,
    file_path: String,
) -> Result<usize, NoteyError> {
    let target = resolve_export_json_target(&file_path)?;

    let conn = state.lock().unwrap_or_else(recover_poisoned_db);
    services::export::export_json_to_file(&conn, &target)
}

fn resolve_export_json_target(file_path: &str) -> Result<PathBuf, NoteyError> {
    let requested = Path::new(file_path);
    let file_name = requested.file_name().ok_or_else(|| {
        NoteyError::Validation("export path has no filename component".to_string())
    })?;
    let parent = requested.parent().filter(|p| !p.as_os_str().is_empty());
    let parent = parent.ok_or_else(|| {
        NoteyError::Validation("export path has no parent directory".to_string())
    })?;

    let canonical_parent = dunce::canonicalize(parent).map_err(|err| match err.kind() {
        std::io::ErrorKind::NotFound => {
            NoteyError::Validation("export directory does not exist".to_string())
        }
        _ => NoteyError::Io(err),
    })?;
    if !canonical_parent.is_dir() {
        return Err(NoteyError::Validation(
            "export target's parent is not a directory".to_string(),
        ));
    }

    let target = canonical_parent.join(file_name);
    match std::fs::symlink_metadata(&target) {
        Ok(metadata) if metadata.file_type().is_symlink() => Err(NoteyError::Validation(
            "export target may not be a symlink".to_string(),
        )),
        Ok(_) => Ok(target),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(target),
        Err(err) => Err(NoteyError::Io(err)),
    }
}

#[cfg(test)]
mod tests {
    use super::resolve_export_json_target;
    use crate::errors::NoteyError;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_resolve_export_json_target_rejects_missing_parent_directory() {
        let base = tempdir().unwrap();
        let missing = base.path().join("missing").join("export.json");

        let result = resolve_export_json_target(missing.to_str().unwrap());

        assert!(
            matches!(&result, Err(NoteyError::Validation(msg)) if msg.contains("does not exist"))
        );
    }

    #[test]
    fn test_resolve_export_json_target_rejects_non_directory_parent() {
        let base = tempdir().unwrap();
        let file_parent = base.path().join("not-a-dir");
        fs::write(&file_parent, "seed").unwrap();
        let target = file_parent.join("export.json");

        let result = resolve_export_json_target(target.to_str().unwrap());

        assert!(
            matches!(&result, Err(NoteyError::Validation(msg)) if msg.contains("not a directory"))
        );
    }

    #[cfg(unix)]
    #[test]
    fn test_resolve_export_json_target_rejects_symlink_target() {
        let base = tempdir().unwrap();
        let outside = tempdir().unwrap();
        let link_path = base.path().join("export.json");
        std::os::unix::fs::symlink(outside.path().join("outside.json"), &link_path).unwrap();

        let result = resolve_export_json_target(link_path.to_str().unwrap());

        assert!(
            matches!(&result, Err(NoteyError::Validation(msg)) if msg.contains("symlink"))
        );
    }

    #[cfg(unix)]
    #[test]
    fn test_resolve_export_json_target_permission_denied_is_io() {
        use std::os::unix::fs::PermissionsExt;

        let base = tempdir().unwrap();
        let secret = base.path().join("secret");
        let hidden = secret.join("hidden");
        fs::create_dir(&secret).unwrap();
        fs::create_dir(&hidden).unwrap();
        fs::set_permissions(&secret, fs::Permissions::from_mode(0o000)).unwrap();

        let target = hidden.join("export.json");
        let result = resolve_export_json_target(target.to_str().unwrap());

        fs::set_permissions(&secret, fs::Permissions::from_mode(0o700)).unwrap();

        assert!(matches!(result, Err(NoteyError::Io(_))));
    }
}
