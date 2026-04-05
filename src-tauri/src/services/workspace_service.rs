use chrono::Utc;
use rusqlite::Connection;

use crate::db::workspace_repo;
use crate::errors::NoteyError;
use crate::models::workspace::{DetectedWorkspace, Workspace, WorkspaceInfo};

/// Create a workspace or return the existing one if a workspace with the same path already exists.
pub fn create_workspace(
    conn: &Connection,
    name: &str,
    path: &str,
) -> Result<Workspace, NoteyError> {
    let name = name.trim();
    let path = path.trim();
    if name.is_empty() {
        return Err(NoteyError::Validation(
            "Workspace name cannot be empty".to_string(),
        ));
    }
    if path.is_empty() {
        return Err(NoteyError::Validation(
            "Workspace path cannot be empty".to_string(),
        ));
    }
    if !std::path::Path::new(path).is_absolute() {
        return Err(NoteyError::Validation(
            format!("Workspace path must be absolute: {}", path),
        ));
    }
    let now = Utc::now().to_rfc3339();

    match workspace_repo::insert_workspace(conn, name, path, &now) {
        Ok(id) => Ok(Workspace {
            id,
            name: name.to_string(),
            path: path.to_string(),
            created_at: now,
        }),
        Err(NoteyError::Database(rusqlite::Error::SqliteFailure(err, _)))
            if err.code == rusqlite::ErrorCode::ConstraintViolation =>
        {
            // UNIQUE constraint on path — return existing workspace
            workspace_repo::find_by_path(conn, path)?
                .ok_or(NoteyError::NotFound)
        }
        Err(e) => Err(e),
    }
}

/// Detect a workspace by walking up from the given path looking for a `.git` directory.
/// Falls back to the given directory itself if no git repository is found (FR31).
pub fn detect_workspace(path: &str) -> Result<DetectedWorkspace, NoteyError> {
    let canonical = std::fs::canonicalize(path)
        .map_err(|e| NoteyError::Validation(format!("Cannot resolve path '{}': {}", path, e)))?;

    if !canonical.is_dir() {
        return Err(NoteyError::Validation(format!(
            "Path is not a directory: {}",
            canonical.display()
        )));
    }

    // Walk up from canonical path looking for .git
    let mut current = canonical.clone();
    loop {
        if current.join(".git").exists() {
            let name = current
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "workspace".to_string());
            return Ok(DetectedWorkspace {
                name,
                path: current.to_string_lossy().to_string(),
            });
        }
        match current.parent() {
            Some(parent) if parent != current => current = parent.to_path_buf(),
            _ => break, // Reached filesystem root
        }
    }

    // Fallback: use the original directory itself (FR31)
    let name = canonical
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "workspace".to_string());
    Ok(DetectedWorkspace {
        name,
        path: canonical.to_string_lossy().to_string(),
    })
}

/// Detect a workspace from a filesystem path and ensure it exists in the database.
/// Returns the persisted Workspace with a database id.
/// Chains: detect_workspace(path) → create_workspace(conn, name, detected_path)
/// create_workspace has upsert behavior — returns existing workspace if path matches.
pub fn resolve_workspace(conn: &Connection, path: &str) -> Result<Workspace, NoteyError> {
    let detected = detect_workspace(path)?;
    create_workspace(conn, &detected.name, &detected.path)
}

/// List all workspaces with their non-trashed note counts, ordered by name ASC.
pub fn list_workspaces(conn: &Connection) -> Result<Vec<WorkspaceInfo>, NoteyError> {
    workspace_repo::list_all_with_note_counts(conn)
}

/// Get a single workspace by id, including its non-trashed note count.
pub fn get_workspace(conn: &Connection, id: i64) -> Result<WorkspaceInfo, NoteyError> {
    workspace_repo::get_by_id_with_note_count(conn, id)
}
