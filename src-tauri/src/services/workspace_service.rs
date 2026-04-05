use chrono::Utc;
use rusqlite::Connection;

use crate::db::workspace_repo;
use crate::errors::NoteyError;
use crate::models::workspace::{Workspace, WorkspaceInfo};

/// Create a workspace or return the existing one if a workspace with the same path already exists.
pub fn create_workspace(
    conn: &Connection,
    name: &str,
    path: &str,
) -> Result<Workspace, NoteyError> {
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

/// List all workspaces with their non-trashed note counts, ordered by name ASC.
pub fn list_workspaces(conn: &Connection) -> Result<Vec<WorkspaceInfo>, NoteyError> {
    workspace_repo::list_all_with_note_counts(conn)
}

/// Get a single workspace by id, including its non-trashed note count.
pub fn get_workspace(conn: &Connection, id: i64) -> Result<WorkspaceInfo, NoteyError> {
    workspace_repo::get_by_id_with_note_count(conn, id)
}
