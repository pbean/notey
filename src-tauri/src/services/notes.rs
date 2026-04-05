use chrono::Utc;
use rusqlite::{Connection, params};

use crate::errors::NoteyError;
use crate::models::Note;

pub fn create_note(conn: &Connection, format: &str, workspace_id: Option<i64>) -> Result<Note, NoteyError> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO notes (title, content, format, workspace_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        params!["", "", format, workspace_id, now, now],
    )?;
    let id = conn.last_insert_rowid();
    get_note(conn, id)
}

pub fn get_note(conn: &Connection, id: i64) -> Result<Note, NoteyError> {
    let result = conn.query_row(
        "SELECT id, title, content, format, workspace_id, created_at, updated_at, deleted_at, is_trashed
         FROM notes WHERE id = ?",
        params![id],
        |row| {
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                format: row.get(3)?,
                workspace_id: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
                deleted_at: row.get(7)?,
                is_trashed: row.get::<_, i64>(8)? != 0,
            })
        },
    );

    match result {
        Ok(note) => Ok(note),
        Err(rusqlite::Error::QueryReturnedNoRows) => Err(NoteyError::NotFound),
        Err(e) => Err(NoteyError::Database(e)),
    }
}

pub fn update_note(
    conn: &Connection,
    id: i64,
    title: Option<String>,
    content: Option<String>,
    format: Option<String>,
) -> Result<Note, NoteyError> {
    let now = Utc::now().to_rfc3339();

    let rows_changed = conn.execute(
        "UPDATE notes
         SET title = COALESCE(?1, title),
             content = COALESCE(?2, content),
             format = COALESCE(?3, format),
             updated_at = ?4
         WHERE id = ?5 AND is_trashed = 0",
        params![title, content, format, now, id],
    )?;

    if rows_changed == 0 {
        return Err(NoteyError::NotFound);
    }

    get_note(conn, id)
}

/// Soft-delete a note by setting `is_trashed = 1` and `deleted_at` to the current timestamp.
pub fn trash_note(conn: &Connection, id: i64) -> Result<Note, NoteyError> {
    let now = Utc::now().to_rfc3339();
    let rows_changed = conn.execute(
        "UPDATE notes SET is_trashed = 1, deleted_at = ?1, updated_at = ?2 WHERE id = ?3 AND is_trashed = 0",
        params![now, now, id],
    )?;

    if rows_changed == 0 {
        return Err(NoteyError::NotFound);
    }

    get_note(conn, id)
}

pub fn list_notes(conn: &Connection) -> Result<Vec<Note>, NoteyError> {
    let mut stmt = conn.prepare(
        "SELECT id, title, content, format, workspace_id, created_at, updated_at, deleted_at, is_trashed
         FROM notes
         WHERE is_trashed = 0
         ORDER BY updated_at DESC",
    )?;

    let notes = stmt.query_map([], |row| {
        Ok(Note {
            id: row.get(0)?,
            title: row.get(1)?,
            content: row.get(2)?,
            format: row.get(3)?,
            workspace_id: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
            deleted_at: row.get(7)?,
            is_trashed: row.get::<_, i64>(8)? != 0,
        })
    })?;

    let mut result = Vec::new();
    for note in notes {
        result.push(note?);
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let mut conn = Connection::open_in_memory().expect("failed to open in-memory db");
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA foreign_keys=ON;",
        )
        .expect("failed to set pragmas");
        crate::db::MIGRATIONS
            .to_latest(&mut conn)
            .expect("failed to run migrations");
        conn
    }

    #[test]
    fn test_create_note_returns_note_with_id() {
        let conn = setup_test_db();
        let note = create_note(&conn, "markdown", None).expect("create_note failed");
        assert!(note.id > 0);
        assert_eq!(note.title, "");
        assert_eq!(note.content, "");
        assert_eq!(note.format, "markdown");
        assert!(!note.is_trashed);
    }

    #[test]
    fn test_create_note_timestamps_are_iso8601() {
        let conn = setup_test_db();
        let note = create_note(&conn, "markdown", None).expect("create_note failed");
        // ISO 8601 with RFC3339 format: YYYY-MM-DDTHH:MM:SS+00:00
        assert!(note.created_at.contains('T'), "created_at should be ISO8601");
        assert!(note.updated_at.contains('T'), "updated_at should be ISO8601");
    }

    #[test]
    fn test_get_note_not_found() {
        let conn = setup_test_db();
        let result = get_note(&conn, 99999);
        assert!(matches!(result, Err(NoteyError::NotFound)));
    }

    #[test]
    fn test_update_note_only_updates_provided_fields() {
        let conn = setup_test_db();
        let note = create_note(&conn, "markdown", None).expect("create_note failed");
        let original_title = note.title.clone();
        let original_format = note.format.clone();

        let updated = update_note(&conn, note.id, None, Some("new content".to_string()), None)
            .expect("update_note failed");

        assert_eq!(updated.content, "new content");
        assert_eq!(updated.title, original_title);
        assert_eq!(updated.format, original_format);
    }

    #[test]
    fn test_update_note_not_found() {
        let conn = setup_test_db();
        let result = update_note(&conn, 99999, Some("title".to_string()), None, None);
        assert!(matches!(result, Err(NoteyError::NotFound)));
    }

    #[test]
    fn test_list_notes_filters_trashed() {
        let conn = setup_test_db();
        let note = create_note(&conn, "markdown", None).expect("create_note failed");
        trash_note(&conn, note.id).expect("trash_note failed");

        let notes = list_notes(&conn).expect("list_notes failed");
        assert!(
            notes.iter().all(|n| !n.is_trashed),
            "list_notes should not return trashed notes"
        );
        assert!(!notes.iter().any(|n| n.id == note.id));
    }

    // P0-UNIT-002: Soft-delete sets is_trashed + deleted_at
    #[test]
    fn test_trash_note_sets_fields() {
        let conn = setup_test_db();
        let note = create_note(&conn, "markdown", None).expect("create_note failed");
        assert!(!note.is_trashed);
        assert!(note.deleted_at.is_none());

        let trashed = trash_note(&conn, note.id).expect("trash_note failed");
        assert!(trashed.is_trashed, "is_trashed should be true");
        assert!(trashed.deleted_at.is_some(), "deleted_at should be set");
        assert!(
            trashed.deleted_at.as_ref().unwrap().contains('T'),
            "deleted_at should be ISO8601"
        );
    }

    #[test]
    fn test_trash_note_not_found() {
        let conn = setup_test_db();
        let result = trash_note(&conn, 99999);
        assert!(matches!(result, Err(NoteyError::NotFound)));
    }

    #[test]
    fn test_trash_note_already_trashed() {
        let conn = setup_test_db();
        let note = create_note(&conn, "markdown", None).expect("create_note failed");
        trash_note(&conn, note.id).expect("first trash should succeed");
        let result = trash_note(&conn, note.id);
        assert!(
            matches!(result, Err(NoteyError::NotFound)),
            "trashing an already-trashed note should return NotFound"
        );
    }

    #[test]
    fn test_list_notes_ordered_by_updated_at_desc() {
        let conn = setup_test_db();
        let note1 = create_note(&conn, "markdown", None).expect("create note1");
        // Update note1's updated_at to be earlier
        conn.execute(
            "UPDATE notes SET updated_at = '2020-01-01T00:00:00+00:00' WHERE id = ?",
            params![note1.id],
        )
        .expect("failed to update note1");
        let note2 = create_note(&conn, "markdown", None).expect("create note2");
        conn.execute(
            "UPDATE notes SET updated_at = '2020-01-02T00:00:00+00:00' WHERE id = ?",
            params![note2.id],
        )
        .expect("failed to update note2");

        let notes = list_notes(&conn).expect("list_notes failed");
        assert_eq!(notes.len(), 2);
        // note2 should be first (more recent)
        assert_eq!(notes[0].id, note2.id);
        assert_eq!(notes[1].id, note1.id);
    }

    // UNIT-2.3-001: create_note with workspace_id stores it in DB
    #[test]
    fn test_create_note_with_workspace_id() {
        let conn = setup_test_db();
        // Create a workspace first
        conn.execute(
            "INSERT INTO workspaces (name, path, created_at) VALUES (?1, ?2, ?3)",
            params!["test-ws", "/tmp/test-ws", "2026-01-01T00:00:00+00:00"],
        )
        .expect("insert workspace");
        let ws_id = conn.last_insert_rowid();

        let note = create_note(&conn, "markdown", Some(ws_id)).expect("create_note failed");
        assert_eq!(note.workspace_id, Some(ws_id));
    }

    // UNIT-2.3-002: create_note without workspace_id stores NULL
    #[test]
    fn test_create_note_without_workspace_id() {
        let conn = setup_test_db();
        let note = create_note(&conn, "markdown", None).expect("create_note failed");
        assert!(note.workspace_id.is_none());
    }

    // UNIT-2.3-006: create_note with non-existent workspace_id still inserts (no FK)
    #[test]
    fn test_create_note_with_nonexistent_workspace_id() {
        let conn = setup_test_db();
        let note = create_note(&conn, "markdown", Some(99999)).expect("create_note should succeed even with non-existent workspace_id");
        assert_eq!(note.workspace_id, Some(99999));
    }

    // P1-UNIT-005: Note format toggle persists
    #[test]
    fn test_format_toggle_persists() {
        let conn = setup_test_db();
        let note = create_note(&conn, "markdown", None).expect("create_note failed");
        assert_eq!(note.format, "markdown");

        let toggled =
            update_note(&conn, note.id, None, None, Some("plaintext".to_string()))
                .expect("toggle to plaintext failed");
        assert_eq!(toggled.format, "plaintext");

        // Reload from DB to verify persistence
        let reloaded = get_note(&conn, note.id).expect("get_note after toggle failed");
        assert_eq!(reloaded.format, "plaintext");

        // Toggle back
        let toggled_back =
            update_note(&conn, note.id, None, None, Some("markdown".to_string()))
                .expect("toggle back to markdown failed");
        assert_eq!(toggled_back.format, "markdown");
    }
}
