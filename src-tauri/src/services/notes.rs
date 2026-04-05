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

/// Reassign a note to a different workspace, or unscope it by passing None.
pub fn reassign_note_workspace(
    conn: &Connection,
    id: i64,
    workspace_id: Option<i64>,
) -> Result<Note, NoteyError> {
    let now = Utc::now().to_rfc3339();
    let rows = conn.execute(
        "UPDATE notes SET workspace_id = ?1, updated_at = ?2 WHERE id = ?3 AND is_trashed = 0",
        params![workspace_id, now, id],
    )?;
    if rows == 0 {
        return Err(NoteyError::NotFound);
    }
    get_note(conn, id)
}

/// Rebuild the FTS5 index from the content table.
/// Use as a recovery mechanism if the FTS index drifts out of sync with the notes table.
pub fn rebuild_fts_index(conn: &Connection) -> Result<(), NoteyError> {
    conn.execute_batch("INSERT INTO notes_fts(notes_fts) VALUES('rebuild')")?;
    Ok(())
}

/// Lists non-trashed notes, optionally filtered by workspace.
///
/// When `workspace_id` is `Some(id)`, returns only notes belonging to that workspace.
/// When `workspace_id` is `None`, returns all non-trashed notes across all workspaces.
/// Results are always ordered by `updated_at` DESC.
pub fn list_notes(conn: &Connection, workspace_id: Option<i64>) -> Result<Vec<Note>, NoteyError> {
    let row_mapper = |row: &rusqlite::Row| -> rusqlite::Result<Note> {
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
    };

    let notes: Vec<Note> = match workspace_id {
        Some(ws_id) => {
            let mut stmt = conn.prepare(
                "SELECT id, title, content, format, workspace_id, created_at, updated_at, deleted_at, is_trashed
                 FROM notes WHERE is_trashed = 0 AND workspace_id = ?1
                 ORDER BY updated_at DESC",
            )?;
            let rows = stmt.query_map(params![ws_id], row_mapper)?
                .collect::<Result<Vec<_>, _>>()?;
            rows
        }
        None => {
            let mut stmt = conn.prepare(
                "SELECT id, title, content, format, workspace_id, created_at, updated_at, deleted_at, is_trashed
                 FROM notes WHERE is_trashed = 0
                 ORDER BY updated_at DESC",
            )?;
            let rows = stmt.query_map([], row_mapper)?
                .collect::<Result<Vec<_>, _>>()?;
            rows
        }
    };

    Ok(notes)
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

        let notes = list_notes(&conn, None).expect("list_notes failed");
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

        let notes = list_notes(&conn, None).expect("list_notes failed");
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

    // UNIT-2.5-001: list_notes with workspace_id returns only notes in that workspace
    #[test]
    fn test_list_notes_filtered_by_workspace() {
        let conn = setup_test_db();
        // Create two workspaces
        conn.execute(
            "INSERT INTO workspaces (name, path, created_at) VALUES (?1, ?2, ?3)",
            params!["ws-a", "/tmp/ws-a", "2026-01-01T00:00:00+00:00"],
        )
        .expect("insert ws-a");
        let ws_a_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO workspaces (name, path, created_at) VALUES (?1, ?2, ?3)",
            params!["ws-b", "/tmp/ws-b", "2026-01-01T00:00:00+00:00"],
        )
        .expect("insert ws-b");
        let ws_b_id = conn.last_insert_rowid();

        // Create notes in each workspace
        let note_a = create_note(&conn, "markdown", Some(ws_a_id)).expect("create note in ws-a");
        let _note_b = create_note(&conn, "markdown", Some(ws_b_id)).expect("create note in ws-b");

        let result = list_notes(&conn, Some(ws_a_id)).expect("list_notes filtered");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].id, note_a.id);
        assert_eq!(result[0].workspace_id, Some(ws_a_id));
    }

    // UNIT-2.5-004: list_notes with workspace_id excludes trashed notes
    #[test]
    fn test_list_notes_filtered_excludes_trashed() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO workspaces (name, path, created_at) VALUES (?1, ?2, ?3)",
            params!["ws-trash", "/tmp/ws-trash", "2026-01-01T00:00:00+00:00"],
        )
        .expect("insert workspace");
        let ws_id = conn.last_insert_rowid();

        let note = create_note(&conn, "markdown", Some(ws_id)).expect("create note");
        trash_note(&conn, note.id).expect("trash note");

        let result = list_notes(&conn, Some(ws_id)).expect("list_notes filtered");
        assert!(result.is_empty(), "trashed notes should be excluded from filtered results");
    }

    // UNIT-2.5-005: list_notes with workspace_id that has no notes returns empty vec
    #[test]
    fn test_list_notes_filtered_empty_workspace() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO workspaces (name, path, created_at) VALUES (?1, ?2, ?3)",
            params!["ws-empty", "/tmp/ws-empty", "2026-01-01T00:00:00+00:00"],
        )
        .expect("insert workspace");
        let ws_id = conn.last_insert_rowid();

        let result = list_notes(&conn, Some(ws_id)).expect("list_notes filtered");
        assert!(result.is_empty(), "empty workspace should return empty vec, not error");
    }

    // UNIT-2.5-002: list_notes with None workspace_id returns all non-trashed notes
    #[test]
    fn test_list_notes_unfiltered_returns_all() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO workspaces (name, path, created_at) VALUES (?1, ?2, ?3)",
            params!["ws-all", "/tmp/ws-all", "2026-01-01T00:00:00+00:00"],
        )
        .expect("insert workspace");
        let ws_id = conn.last_insert_rowid();

        let _note1 = create_note(&conn, "markdown", Some(ws_id)).expect("create note 1");
        let _note2 = create_note(&conn, "markdown", None).expect("create note 2 (no workspace)");

        let result = list_notes(&conn, None).expect("list_notes unfiltered");
        assert_eq!(result.len(), 2, "unfiltered should return all non-trashed notes");
    }

    // UNIT-2.5-003: list_notes results are ordered by updated_at DESC
    #[test]
    fn test_list_notes_filtered_ordered_by_updated_at_desc() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO workspaces (name, path, created_at) VALUES (?1, ?2, ?3)",
            params!["ws-order", "/tmp/ws-order", "2026-01-01T00:00:00+00:00"],
        )
        .expect("insert workspace");
        let ws_id = conn.last_insert_rowid();

        let note1 = create_note(&conn, "markdown", Some(ws_id)).expect("create note1");
        conn.execute(
            "UPDATE notes SET updated_at = '2020-01-01T00:00:00+00:00' WHERE id = ?",
            params![note1.id],
        )
        .expect("backdate note1");
        let note2 = create_note(&conn, "markdown", Some(ws_id)).expect("create note2");
        conn.execute(
            "UPDATE notes SET updated_at = '2020-01-02T00:00:00+00:00' WHERE id = ?",
            params![note2.id],
        )
        .expect("backdate note2");

        let result = list_notes(&conn, Some(ws_id)).expect("list_notes filtered");
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].id, note2.id, "more recently updated note should come first");
        assert_eq!(result[1].id, note1.id);
    }

    // UNIT-2.6-001: reassign_note_workspace updates workspace_id and updated_at
    #[test]
    fn test_reassign_note_workspace() {
        let conn = setup_test_db();
        // Create two workspaces
        conn.execute(
            "INSERT INTO workspaces (name, path, created_at) VALUES (?1, ?2, ?3)",
            params!["ws-a", "/tmp/ws-a", "2026-01-01T00:00:00+00:00"],
        )
        .expect("insert ws-a");
        let ws_a_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO workspaces (name, path, created_at) VALUES (?1, ?2, ?3)",
            params!["ws-b", "/tmp/ws-b", "2026-01-01T00:00:00+00:00"],
        )
        .expect("insert ws-b");
        let ws_b_id = conn.last_insert_rowid();

        let note = create_note(&conn, "markdown", Some(ws_a_id)).expect("create note in ws-a");
        assert_eq!(note.workspace_id, Some(ws_a_id));
        let old_updated_at = note.updated_at.clone();

        let reassigned = reassign_note_workspace(&conn, note.id, Some(ws_b_id))
            .expect("reassign should succeed");
        assert_eq!(reassigned.workspace_id, Some(ws_b_id));
        assert_ne!(reassigned.updated_at, old_updated_at, "updated_at should be refreshed");
    }

    // UNIT-2.6-002: reassign_note_workspace with None sets workspace_id to NULL
    #[test]
    fn test_reassign_note_workspace_to_null() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO workspaces (name, path, created_at) VALUES (?1, ?2, ?3)",
            params!["ws-unscope", "/tmp/ws-unscope", "2026-01-01T00:00:00+00:00"],
        )
        .expect("insert workspace");
        let ws_id = conn.last_insert_rowid();

        let note = create_note(&conn, "markdown", Some(ws_id)).expect("create note");
        assert_eq!(note.workspace_id, Some(ws_id));

        let reassigned = reassign_note_workspace(&conn, note.id, None)
            .expect("reassign to null should succeed");
        assert!(reassigned.workspace_id.is_none(), "workspace_id should be None after unscopying");
    }

    // UNIT-2.6-003: reassign_note_workspace for nonexistent note returns NotFound
    #[test]
    fn test_reassign_note_workspace_nonexistent() {
        let conn = setup_test_db();
        let result = reassign_note_workspace(&conn, 99999, Some(1));
        assert!(matches!(result, Err(NoteyError::NotFound)));
    }

    // UNIT-2.6-004: reassign_note_workspace for trashed note returns NotFound
    #[test]
    fn test_reassign_note_workspace_trashed() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO workspaces (name, path, created_at) VALUES (?1, ?2, ?3)",
            params!["ws-trash", "/tmp/ws-trash", "2026-01-01T00:00:00+00:00"],
        )
        .expect("insert workspace");
        let ws_id = conn.last_insert_rowid();

        let note = create_note(&conn, "markdown", Some(ws_id)).expect("create note");
        trash_note(&conn, note.id).expect("trash note");

        let result = reassign_note_workspace(&conn, note.id, Some(ws_id));
        assert!(
            matches!(result, Err(NoteyError::NotFound)),
            "trashed notes cannot be reassigned"
        );
    }

    // UNIT-2.6-005: reassign_note_workspace returns the updated note with new workspace_id
    #[test]
    fn test_reassign_note_workspace_returns_updated_note() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO workspaces (name, path, created_at) VALUES (?1, ?2, ?3)",
            params!["ws-ret", "/tmp/ws-ret", "2026-01-01T00:00:00+00:00"],
        )
        .expect("insert workspace");
        let ws_id = conn.last_insert_rowid();

        let note = create_note(&conn, "markdown", None).expect("create note");
        assert!(note.workspace_id.is_none());

        let reassigned = reassign_note_workspace(&conn, note.id, Some(ws_id))
            .expect("reassign should succeed");
        assert_eq!(reassigned.id, note.id);
        assert_eq!(reassigned.workspace_id, Some(ws_id));
        assert_eq!(reassigned.title, note.title);
        assert_eq!(reassigned.content, note.content);
        assert_eq!(reassigned.format, note.format);
        assert!(!reassigned.is_trashed);
    }

    // GAP: Idempotent reassign to same workspace succeeds and updates timestamp
    #[test]
    fn test_reassign_note_workspace_same_workspace_idempotent() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO workspaces (name, path, created_at) VALUES (?1, ?2, ?3)",
            params!["ws-same", "/tmp/ws-same", "2026-01-01T00:00:00+00:00"],
        )
        .expect("insert workspace");
        let ws_id = conn.last_insert_rowid();

        let note = create_note(&conn, "markdown", Some(ws_id)).expect("create note");
        let old_updated_at = note.updated_at.clone();

        let reassigned = reassign_note_workspace(&conn, note.id, Some(ws_id))
            .expect("reassign to same workspace should succeed");
        assert_eq!(reassigned.workspace_id, Some(ws_id));
        assert_ne!(
            reassigned.updated_at, old_updated_at,
            "updated_at should still be refreshed even when workspace doesn't change"
        );
    }

    // GAP AC#2: After reassignment, note leaves old workspace view and appears in new
    #[test]
    fn test_reassign_note_workspace_note_moves_between_views() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO workspaces (name, path, created_at) VALUES (?1, ?2, ?3)",
            params!["ws-old", "/tmp/ws-old", "2026-01-01T00:00:00+00:00"],
        )
        .expect("insert ws-old");
        let ws_old = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO workspaces (name, path, created_at) VALUES (?1, ?2, ?3)",
            params!["ws-new", "/tmp/ws-new", "2026-01-01T00:00:00+00:00"],
        )
        .expect("insert ws-new");
        let ws_new = conn.last_insert_rowid();

        let note = create_note(&conn, "markdown", Some(ws_old)).expect("create note in ws-old");

        // Before reassignment: note in ws-old, not in ws-new
        let old_list = list_notes(&conn, Some(ws_old)).expect("list ws-old");
        assert!(old_list.iter().any(|n| n.id == note.id), "note should be in ws-old before reassign");
        let new_list = list_notes(&conn, Some(ws_new)).expect("list ws-new");
        assert!(!new_list.iter().any(|n| n.id == note.id), "note should not be in ws-new before reassign");

        reassign_note_workspace(&conn, note.id, Some(ws_new)).expect("reassign");

        // After reassignment: note NOT in ws-old, IS in ws-new
        let old_list = list_notes(&conn, Some(ws_old)).expect("list ws-old after");
        assert!(!old_list.iter().any(|n| n.id == note.id), "note should NOT be in ws-old after reassign");
        let new_list = list_notes(&conn, Some(ws_new)).expect("list ws-new after");
        assert!(new_list.iter().any(|n| n.id == note.id), "note should be in ws-new after reassign");
    }

    // GAP AC#3: Unscoped note no longer in workspace view, but appears in all-workspaces view
    #[test]
    fn test_reassign_note_workspace_unscoped_visibility() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO workspaces (name, path, created_at) VALUES (?1, ?2, ?3)",
            params!["ws-vis", "/tmp/ws-vis", "2026-01-01T00:00:00+00:00"],
        )
        .expect("insert workspace");
        let ws_id = conn.last_insert_rowid();

        let note = create_note(&conn, "markdown", Some(ws_id)).expect("create note");

        // Unscope the note
        reassign_note_workspace(&conn, note.id, None).expect("unscope note");

        // Should NOT appear in workspace-filtered view
        let ws_list = list_notes(&conn, Some(ws_id)).expect("list workspace");
        assert!(
            !ws_list.iter().any(|n| n.id == note.id),
            "unscoped note should NOT appear in workspace-filtered view"
        );

        // SHOULD appear in all-workspaces view (null filter)
        let all_list = list_notes(&conn, None).expect("list all");
        assert!(
            all_list.iter().any(|n| n.id == note.id),
            "unscoped note should appear in all-workspaces view"
        );
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
