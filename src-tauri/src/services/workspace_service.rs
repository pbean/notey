use std::path::Path;

use chrono::Utc;
use rusqlite::Connection;

use crate::db::workspace_repo;
use crate::errors::NoteyError;
use crate::models::workspace::{DetectedWorkspace, Workspace, WorkspaceInfo};

/// Convert a Path to a UTF-8 string, returning a Validation error for non-UTF-8 paths.
fn path_to_str(path: &Path) -> Result<String, NoteyError> {
    path.to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| NoteyError::Validation(format!(
            "Path contains invalid UTF-8: {}",
            path.display()
        )))
}

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
    let canonical = dunce::canonicalize(path)
        .map_err(|e| NoteyError::Validation(format!("Cannot resolve path '{}': {}", path, e)))?;
    if !canonical.is_dir() {
        return Err(NoteyError::Validation(format!(
            "Path is not a directory: {}",
            canonical.display()
        )));
    }
    let canonical_str = path_to_str(&canonical)?;
    upsert_workspace(conn, name, &canonical_str)
}

/// Internal: create or return existing workspace for an already-canonical path.
/// Skips canonicalization and is_dir checks — caller must guarantee the path is valid.
fn upsert_workspace(
    conn: &Connection,
    name: &str,
    canonical_path: &str,
) -> Result<Workspace, NoteyError> {
    let name = name.trim();
    let now = Utc::now().to_rfc3339();

    match workspace_repo::insert_workspace(conn, name, canonical_path, &now) {
        Ok(id) => Ok(Workspace {
            id,
            name: name.to_string(),
            path: canonical_path.to_string(),
            created_at: now,
        }),
        Err(NoteyError::Database(rusqlite::Error::SqliteFailure(err, _)))
            if err.code == rusqlite::ErrorCode::ConstraintViolation =>
        {
            // UNIQUE constraint on path — return existing workspace
            workspace_repo::find_by_path(conn, canonical_path)?
                .ok_or(NoteyError::NotFound)
        }
        Err(e) => Err(e),
    }
}

/// Detect a workspace by walking up from the given path looking for a `.git` directory.
/// Falls back to the given directory itself if no git repository is found (FR31).
pub fn detect_workspace(path: &str) -> Result<DetectedWorkspace, NoteyError> {
    let canonical = dunce::canonicalize(path)
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
                .and_then(|n| n.to_str())
                .unwrap_or("workspace")
                .to_string();
            return Ok(DetectedWorkspace {
                name,
                path: path_to_str(&current)?,
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
        .and_then(|n| n.to_str())
        .unwrap_or("workspace")
        .to_string();
    Ok(DetectedWorkspace {
        name,
        path: path_to_str(&canonical)?,
    })
}

/// Detect a workspace from a filesystem path and ensure it exists in the database.
/// Returns the persisted Workspace with a database id.
/// Chains: detect_workspace(path) → upsert_workspace(conn, name, detected_path)
/// Skips re-canonicalization since detect_workspace already returns a canonical path.
pub fn resolve_workspace(conn: &Connection, path: &str) -> Result<Workspace, NoteyError> {
    let detected = detect_workspace(path)?;
    upsert_workspace(conn, &detected.name, &detected.path)
}

/// List all workspaces with their non-trashed note counts, ordered by name ASC.
pub fn list_workspaces(conn: &Connection) -> Result<Vec<WorkspaceInfo>, NoteyError> {
    workspace_repo::list_all_with_note_counts(conn)
}

/// Get a single workspace by id, including its non-trashed note count.
pub fn get_workspace(conn: &Connection, id: i64) -> Result<WorkspaceInfo, NoteyError> {
    workspace_repo::get_by_id_with_note_count(conn, id)
}
