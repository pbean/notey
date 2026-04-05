use rusqlite::{params, Connection};

use crate::errors::NoteyError;
use crate::models::workspace::{Workspace, WorkspaceInfo};

/// Insert a new workspace row. Returns the last-insert rowid on success.
pub fn insert_workspace(
    conn: &Connection,
    name: &str,
    path: &str,
    created_at: &str,
) -> Result<i64, NoteyError> {
    conn.execute(
        "INSERT INTO workspaces (name, path, created_at) VALUES (?1, ?2, ?3)",
        params![name, path, created_at],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Find a workspace by its filesystem path.
pub fn find_by_path(conn: &Connection, path: &str) -> Result<Option<Workspace>, NoteyError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, path, created_at FROM workspaces WHERE path = ?1",
    )?;

    let mut rows = stmt.query_map(params![path], |row| {
        Ok(Workspace {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            created_at: row.get(3)?,
        })
    })?;

    match rows.next() {
        Some(row) => Ok(Some(row?)),
        None => Ok(None),
    }
}

/// Get a workspace by id, including its non-trashed note count.
pub fn get_by_id_with_note_count(
    conn: &Connection,
    id: i64,
) -> Result<WorkspaceInfo, NoteyError> {
    let result = conn.query_row(
        "SELECT w.id, w.name, w.path, w.created_at,
                COUNT(n.id) AS note_count
         FROM workspaces w
         LEFT JOIN notes n ON n.workspace_id = w.id AND n.is_trashed = 0
         WHERE w.id = ?1
         GROUP BY w.id",
        params![id],
        |row| {
            Ok(WorkspaceInfo {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                created_at: row.get(3)?,
                note_count: row.get(4)?,
            })
        },
    );

    match result {
        Ok(info) => Ok(info),
        Err(rusqlite::Error::QueryReturnedNoRows) => Err(NoteyError::NotFound),
        Err(e) => Err(NoteyError::Database(e)),
    }
}

/// List all workspaces with their non-trashed note counts, ordered by name ASC.
pub fn list_all_with_note_counts(
    conn: &Connection,
) -> Result<Vec<WorkspaceInfo>, NoteyError> {
    let mut stmt = conn.prepare(
        "SELECT w.id, w.name, w.path, w.created_at,
                COUNT(n.id) AS note_count
         FROM workspaces w
         LEFT JOIN notes n ON n.workspace_id = w.id AND n.is_trashed = 0
         GROUP BY w.id
         ORDER BY w.name ASC",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(WorkspaceInfo {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            created_at: row.get(3)?,
            note_count: row.get(4)?,
        })
    })?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}
