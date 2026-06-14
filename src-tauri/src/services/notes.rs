use chrono::Utc;
use rusqlite::{params, Connection};

use crate::errors::NoteyError;
use crate::models::{Note, NoteListItem};

pub fn create_note(
    conn: &Connection,
    format: &str,
    workspace_id: Option<i64>,
) -> Result<Note, NoteyError> {
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

/// Restore a soft-deleted note by clearing `is_trashed` and `deleted_at`.
///
/// The exact inverse of [`trash_note`]: sets `is_trashed = 0`, `deleted_at = NULL`,
/// and refreshes `updated_at`, guarded by `AND is_trashed = 1` so restoring an
/// already-active or absent note returns [`NoteyError::NotFound`] rather than a
/// silent no-op. The note's `workspace_id` is untouched, so it returns to its
/// original workspace automatically.
pub fn restore_note(conn: &Connection, id: i64) -> Result<Note, NoteyError> {
    let now = Utc::now().to_rfc3339();
    let rows_changed = conn.execute(
        "UPDATE notes SET is_trashed = 0, deleted_at = NULL, updated_at = ?1 WHERE id = ?2 AND is_trashed = 1",
        params![now, id],
    )?;

    if rows_changed == 0 {
        return Err(NoteyError::NotFound);
    }

    get_note(conn, id)
}

/// Lists all soft-deleted (trashed) notes across every workspace.
///
/// Trash is global — there is no workspace filter. Results are ordered by
/// `deleted_at` DESC so the most recently deleted note appears first.
pub fn list_trashed_notes(conn: &Connection) -> Result<Vec<Note>, NoteyError> {
    let mut stmt = conn.prepare(
        "SELECT id, title, content, format, workspace_id, created_at, updated_at, deleted_at, is_trashed
         FROM notes WHERE is_trashed = 1
         ORDER BY deleted_at DESC",
    )?;
    let notes = stmt
        .query_map([], |row| {
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
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(notes)
}

/// Permanently delete a trashed note, removing the row from `notes` for good.
///
/// Guarded by `AND is_trashed = 1` so only notes already in the trash can be
/// hard-deleted — an active note, a missing id, or an already-deleted id all
/// change 0 rows and return [`NoteyError::NotFound`]. The `notes_fts_ad` DELETE
/// trigger removes the matching `notes_fts` row automatically; never mutate the
/// FTS table by hand. This is the only irreversible note operation.
pub fn delete_note_permanently(conn: &Connection, id: i64) -> Result<(), NoteyError> {
    let rows_changed = conn.execute(
        "DELETE FROM notes WHERE id = ?1 AND is_trashed = 1",
        params![id],
    )?;

    if rows_changed == 0 {
        return Err(NoteyError::NotFound);
    }

    Ok(())
}

/// Permanently delete every trashed note whose `deleted_at` is older than the
/// retention window. Runs as a silent startup maintenance task and returns the
/// number of rows purged.
///
/// The cutoff is computed in Rust as `Utc::now() - retention_days` and formatted
/// with `to_rfc3339()` — the same formatter used to write `deleted_at` — so the
/// `deleted_at < ?cutoff` comparison is an exact lexicographic match against the
/// stored RFC3339 strings. SQLite's `datetime('now', …)` is deliberately avoided:
/// its space-separated, offset-less format does not sort consistently against
/// RFC3339 values and would mis-purge near the boundary.
///
/// The comparison is strict (`<`), so a note deleted exactly `retention_days` ago
/// is kept — this upholds the "recoverable for at least `retention_days`"
/// guarantee. Only trashed rows (`is_trashed = 1`) are ever touched; active notes
/// are never affected. The `notes_fts_ad` DELETE trigger removes the matching
/// `notes_fts` rows automatically — never mutate the FTS table by hand.
pub fn purge_expired_trash(conn: &Connection, retention_days: u32) -> Result<usize, NoteyError> {
    let cutoff = Utc::now()
        .checked_sub_signed(chrono::Duration::days(retention_days as i64))
        .ok_or_else(|| {
            NoteyError::Config(format!(
                "trash.retentionDays={} is out of range",
                retention_days
            ))
        })?
        .to_rfc3339();
    let purged = conn.execute(
        "DELETE FROM notes WHERE is_trashed = 1 AND deleted_at IS NOT NULL AND deleted_at < ?1",
        params![cutoff],
    )?;
    Ok(purged)
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
            let rows = stmt
                .query_map(params![ws_id], row_mapper)?
                .collect::<Result<Vec<_>, _>>()?;
            rows
        }
        None => {
            let mut stmt = conn.prepare(
                "SELECT id, title, content, format, workspace_id, created_at, updated_at, deleted_at, is_trashed
                 FROM notes WHERE is_trashed = 0
                 ORDER BY updated_at DESC",
            )?;
            let rows = stmt
                .query_map([], row_mapper)?
                .collect::<Result<Vec<_>, _>>()?;
            rows
        }
    };

    Ok(notes)
}

/// Lists non-trashed notes enriched with their workspace name, optionally
/// filtered by workspace name (Story 6.4, FR15).
///
/// This is the listing path for the `notey list` CLI command: it `LEFT JOIN`s
/// `workspaces` so each row carries the workspace *name* (or `None` for an
/// unassigned note), mirroring [`crate::services::search_service::search_notes`].
/// It is intentionally separate from [`list_notes`] (the GUI path), which returns
/// raw [`Note`] rows by `workspace_id` and is left unchanged.
///
/// When `workspace_name` is `Some(name)`, only notes whose workspace name equals
/// `name` are returned. Because `workspaces.name` is not unique (only `path` is),
/// a name filter may match notes across several workspaces sharing that name.
/// Results are always ordered by `updated_at` DESC. The filter is parameterized —
/// never interpolated — guarding the CLI injection vector (RISK-E6-006).
pub fn list_notes_with_workspace(
    conn: &Connection,
    workspace_name: Option<&str>,
) -> Result<Vec<NoteListItem>, NoteyError> {
    let mut stmt = conn.prepare(
        "SELECT n.id, n.title, w.name AS workspace_name, n.updated_at
         FROM notes n
         LEFT JOIN workspaces w ON w.id = n.workspace_id
         WHERE n.is_trashed = 0
           AND (?1 IS NULL OR w.name = ?1)
         ORDER BY n.updated_at DESC",
    )?;

    let items = stmt
        .query_map(params![workspace_name], |row| {
            Ok(NoteListItem {
                id: row.get(0)?,
                title: row.get(1)?,
                workspace_name: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(items)
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
        assert!(
            note.created_at.contains('T'),
            "created_at should be ISO8601"
        );
        assert!(
            note.updated_at.contains('T'),
            "updated_at should be ISO8601"
        );
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
    fn test_restore_note_clears_fields() {
        let conn = setup_test_db();
        let note = create_note(&conn, "markdown", None).expect("create_note failed");
        trash_note(&conn, note.id).expect("trash_note failed");

        let restored = restore_note(&conn, note.id).expect("restore_note failed");
        assert!(
            !restored.is_trashed,
            "is_trashed should be false after restore"
        );
        assert!(
            restored.deleted_at.is_none(),
            "deleted_at should be cleared after restore"
        );
        assert_eq!(restored.id, note.id);

        // Restored note reappears in the active list.
        let notes = list_notes(&conn, None).expect("list_notes failed");
        assert!(
            notes.iter().any(|n| n.id == note.id),
            "restored note should be active again"
        );
    }

    #[test]
    fn test_restore_note_preserves_workspace() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO workspaces (name, path, created_at) VALUES (?1, ?2, ?3)",
            params!["ws-restore", "/tmp/ws-restore", "2026-01-01T00:00:00+00:00"],
        )
        .expect("insert workspace");
        let ws_id = conn.last_insert_rowid();

        let note = create_note(&conn, "markdown", Some(ws_id)).expect("create note");
        trash_note(&conn, note.id).expect("trash note");
        let restored = restore_note(&conn, note.id).expect("restore note");
        assert_eq!(
            restored.workspace_id,
            Some(ws_id),
            "restore must keep the original workspace"
        );
    }

    #[test]
    fn test_restore_note_not_found() {
        let conn = setup_test_db();
        let result = restore_note(&conn, 99999);
        assert!(matches!(result, Err(NoteyError::NotFound)));
    }

    #[test]
    fn test_restore_note_already_active() {
        let conn = setup_test_db();
        let note = create_note(&conn, "markdown", None).expect("create_note failed");
        let result = restore_note(&conn, note.id);
        assert!(
            matches!(result, Err(NoteyError::NotFound)),
            "restoring an already-active note should return NotFound"
        );
    }

    #[test]
    fn test_list_trashed_notes_returns_only_trashed() {
        let conn = setup_test_db();
        let active = create_note(&conn, "markdown", None).expect("create active note");
        let trashed = create_note(&conn, "markdown", None).expect("create note to trash");
        trash_note(&conn, trashed.id).expect("trash note");

        let result = list_trashed_notes(&conn).expect("list_trashed_notes failed");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].id, trashed.id);
        assert!(result.iter().all(|n| n.is_trashed));
        assert!(
            !result.iter().any(|n| n.id == active.id),
            "active notes must be excluded"
        );
    }

    #[test]
    fn test_list_trashed_notes_ordered_by_deleted_at_desc() {
        let conn = setup_test_db();
        let note1 = create_note(&conn, "markdown", None).expect("create note1");
        trash_note(&conn, note1.id).expect("trash note1");
        conn.execute(
            "UPDATE notes SET deleted_at = '2020-01-01T00:00:00+00:00' WHERE id = ?",
            params![note1.id],
        )
        .expect("backdate note1 deleted_at");
        let note2 = create_note(&conn, "markdown", None).expect("create note2");
        trash_note(&conn, note2.id).expect("trash note2");
        conn.execute(
            "UPDATE notes SET deleted_at = '2020-01-02T00:00:00+00:00' WHERE id = ?",
            params![note2.id],
        )
        .expect("backdate note2 deleted_at");

        let result = list_trashed_notes(&conn).expect("list_trashed_notes failed");
        assert_eq!(result.len(), 2);
        assert_eq!(
            result[0].id, note2.id,
            "most recently deleted note should come first"
        );
        assert_eq!(result[1].id, note1.id);
    }

    #[test]
    fn test_list_trashed_notes_empty() {
        let conn = setup_test_db();
        create_note(&conn, "markdown", None).expect("create active note");
        let result = list_trashed_notes(&conn).expect("list_trashed_notes failed");
        assert!(
            result.is_empty(),
            "no trashed notes should return empty vec"
        );
    }

    #[test]
    fn test_delete_note_permanently_removes_trashed_note() {
        let conn = setup_test_db();
        let note = create_note(&conn, "markdown", None).expect("create note");
        trash_note(&conn, note.id).expect("trash note");

        delete_note_permanently(&conn, note.id).expect("permanent delete should succeed");

        assert!(
            matches!(get_note(&conn, note.id), Err(NoteyError::NotFound)),
            "deleted note row should be gone"
        );
        let trashed = list_trashed_notes(&conn).expect("list_trashed_notes failed");
        assert!(
            !trashed.iter().any(|n| n.id == note.id),
            "note must leave the trash list"
        );
    }

    #[test]
    fn test_delete_note_permanently_not_found() {
        let conn = setup_test_db();
        let result = delete_note_permanently(&conn, 99999);
        assert!(matches!(result, Err(NoteyError::NotFound)));
    }

    #[test]
    fn test_delete_note_permanently_rejects_active_note() {
        let conn = setup_test_db();
        let note = create_note(&conn, "markdown", None).expect("create note");

        let result = delete_note_permanently(&conn, note.id);
        assert!(
            matches!(result, Err(NoteyError::NotFound)),
            "an active (non-trashed) note must not be hard-deletable"
        );
        assert!(
            get_note(&conn, note.id).is_ok(),
            "active note must still exist"
        );
    }

    #[test]
    fn test_delete_note_permanently_already_deleted() {
        let conn = setup_test_db();
        let note = create_note(&conn, "markdown", None).expect("create note");
        trash_note(&conn, note.id).expect("trash note");
        delete_note_permanently(&conn, note.id).expect("first permanent delete should succeed");

        let result = delete_note_permanently(&conn, note.id);
        assert!(
            matches!(result, Err(NoteyError::NotFound)),
            "deleting an already-deleted note should return NotFound"
        );
    }

    #[test]
    fn test_delete_note_permanently_removes_fts_row() {
        let conn = setup_test_db();
        let note = create_note(&conn, "markdown", None).expect("create note");
        update_note(
            &conn,
            note.id,
            Some("zebracrossing".to_string()),
            None,
            None,
        )
        .expect("update note title");
        trash_note(&conn, note.id).expect("trash note");

        // Sanity: the term is indexed before the permanent delete.
        let before: i64 = conn
            .query_row(
                "SELECT count(*) FROM notes_fts WHERE notes_fts MATCH ?1",
                params!["zebracrossing"],
                |row| row.get(0),
            )
            .expect("fts query before delete");
        assert_eq!(before, 1, "term should be indexed before delete");

        delete_note_permanently(&conn, note.id).expect("permanent delete should succeed");

        let after: i64 = conn
            .query_row(
                "SELECT count(*) FROM notes_fts WHERE notes_fts MATCH ?1",
                params!["zebracrossing"],
                |row| row.get(0),
            )
            .expect("fts query after delete");
        assert_eq!(after, 0, "DELETE trigger should remove the note's FTS row");
    }

    #[test]
    fn test_purge_expired_trash_removes_aged_note() {
        let conn = setup_test_db();
        let note = create_note(&conn, "markdown", None).expect("create note");
        update_note(&conn, note.id, Some("quokkasnack".to_string()), None, None)
            .expect("update note title");
        trash_note(&conn, note.id).expect("trash note");
        // Age the note well past the 30-day window.
        let aged = (Utc::now() - chrono::Duration::days(40)).to_rfc3339();
        conn.execute(
            "UPDATE notes SET deleted_at = ?1 WHERE id = ?2",
            params![aged, note.id],
        )
        .expect("backdate deleted_at");

        let purged = purge_expired_trash(&conn, 30).expect("purge failed");
        assert_eq!(purged, 1, "the aged note should be purged");
        assert!(
            matches!(get_note(&conn, note.id), Err(NoteyError::NotFound)),
            "purged note row should be gone"
        );
        let trashed = list_trashed_notes(&conn).expect("list_trashed_notes failed");
        assert!(
            !trashed.iter().any(|n| n.id == note.id),
            "note must leave the trash list"
        );
        // FTS row removed by the DELETE trigger.
        let fts: i64 = conn
            .query_row(
                "SELECT count(*) FROM notes_fts WHERE notes_fts MATCH ?1",
                params!["quokkasnack"],
                |row| row.get(0),
            )
            .expect("fts query after purge");
        assert_eq!(
            fts, 0,
            "purge should remove the note's FTS row via the trigger"
        );
    }

    #[test]
    fn test_purge_expired_trash_keeps_recent_note() {
        let conn = setup_test_db();
        let note = create_note(&conn, "markdown", None).expect("create note");
        trash_note(&conn, note.id).expect("trash note");
        let recent = (Utc::now() - chrono::Duration::days(5)).to_rfc3339();
        conn.execute(
            "UPDATE notes SET deleted_at = ?1 WHERE id = ?2",
            params![recent, note.id],
        )
        .expect("backdate deleted_at");

        let purged = purge_expired_trash(&conn, 30).expect("purge failed");
        assert_eq!(purged, 0, "a note within the window must be kept");
        assert!(
            get_note(&conn, note.id).is_ok(),
            "recent note must still exist"
        );
    }

    #[test]
    fn test_purge_expired_trash_respects_boundary() {
        let conn = setup_test_db();
        // Just inside the window (29d 23h old) — must be kept.
        let inside = create_note(&conn, "markdown", None).expect("create inside note");
        trash_note(&conn, inside.id).expect("trash inside note");
        let inside_ts =
            (Utc::now() - chrono::Duration::days(30) + chrono::Duration::hours(1)).to_rfc3339();
        conn.execute(
            "UPDATE notes SET deleted_at = ?1 WHERE id = ?2",
            params![inside_ts, inside.id],
        )
        .expect("backdate inside note");
        // Just outside the window (30d 1h old) — must be purged.
        let outside = create_note(&conn, "markdown", None).expect("create outside note");
        trash_note(&conn, outside.id).expect("trash outside note");
        let outside_ts =
            (Utc::now() - chrono::Duration::days(30) - chrono::Duration::hours(1)).to_rfc3339();
        conn.execute(
            "UPDATE notes SET deleted_at = ?1 WHERE id = ?2",
            params![outside_ts, outside.id],
        )
        .expect("backdate outside note");

        let purged = purge_expired_trash(&conn, 30).expect("purge failed");
        assert_eq!(
            purged, 1,
            "only the note past the boundary should be purged"
        );
        assert!(
            get_note(&conn, inside.id).is_ok(),
            "boundary-inside note must be kept"
        );
        assert!(
            matches!(get_note(&conn, outside.id), Err(NoteyError::NotFound)),
            "boundary-outside note must be purged"
        );
    }

    #[test]
    fn test_purge_expired_trash_ignores_active_notes() {
        let conn = setup_test_db();
        let note = create_note(&conn, "markdown", None).expect("create note");
        // Force a stale deleted_at while leaving the note active (is_trashed = 0).
        let aged = (Utc::now() - chrono::Duration::days(365)).to_rfc3339();
        conn.execute(
            "UPDATE notes SET deleted_at = ?1 WHERE id = ?2",
            params![aged, note.id],
        )
        .expect("set stale deleted_at on active note");

        let purged = purge_expired_trash(&conn, 30).expect("purge failed");
        assert_eq!(purged, 0, "active notes must never be purged");
        assert!(
            get_note(&conn, note.id).is_ok(),
            "active note must still exist"
        );
    }

    #[test]
    fn test_purge_expired_trash_no_trash_returns_zero() {
        let conn = setup_test_db();
        create_note(&conn, "markdown", None).expect("create active note");
        let purged = purge_expired_trash(&conn, 30).expect("purge failed");
        assert_eq!(purged, 0, "nothing to purge should return 0");
    }

    #[test]
    fn test_purge_expired_trash_zero_retention_purges_all_trash() {
        let conn = setup_test_db();
        let note = create_note(&conn, "markdown", None).expect("create note");
        trash_note(&conn, note.id).expect("trash note");

        // retention_days = 0 → cutoff is now; the just-trashed note is older.
        let purged = purge_expired_trash(&conn, 0).expect("purge failed");
        assert_eq!(
            purged, 1,
            "zero retention should purge currently-trashed notes"
        );
        assert!(
            matches!(get_note(&conn, note.id), Err(NoteyError::NotFound)),
            "note should be purged under zero retention"
        );
    }

    #[test]
    fn test_purge_expired_trash_rejects_out_of_range_retention() {
        let conn = setup_test_db();
        let err =
            purge_expired_trash(&conn, u32::MAX).expect_err("overflowing retention must error");
        assert!(
            matches!(err, NoteyError::Config(_)),
            "overflowing retention must surface as a config error"
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
        let note = create_note(&conn, "markdown", Some(99999))
            .expect("create_note should succeed even with non-existent workspace_id");
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
        assert!(
            result.is_empty(),
            "trashed notes should be excluded from filtered results"
        );
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
        assert!(
            result.is_empty(),
            "empty workspace should return empty vec, not error"
        );
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
        assert_eq!(
            result.len(),
            2,
            "unfiltered should return all non-trashed notes"
        );
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
        assert_eq!(
            result[0].id, note2.id,
            "more recently updated note should come first"
        );
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
        assert_ne!(
            reassigned.updated_at, old_updated_at,
            "updated_at should be refreshed"
        );
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

        let reassigned =
            reassign_note_workspace(&conn, note.id, None).expect("reassign to null should succeed");
        assert!(
            reassigned.workspace_id.is_none(),
            "workspace_id should be None after unscopying"
        );
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

        let reassigned =
            reassign_note_workspace(&conn, note.id, Some(ws_id)).expect("reassign should succeed");
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
        assert!(
            old_list.iter().any(|n| n.id == note.id),
            "note should be in ws-old before reassign"
        );
        let new_list = list_notes(&conn, Some(ws_new)).expect("list ws-new");
        assert!(
            !new_list.iter().any(|n| n.id == note.id),
            "note should not be in ws-new before reassign"
        );

        reassign_note_workspace(&conn, note.id, Some(ws_new)).expect("reassign");

        // After reassignment: note NOT in ws-old, IS in ws-new
        let old_list = list_notes(&conn, Some(ws_old)).expect("list ws-old after");
        assert!(
            !old_list.iter().any(|n| n.id == note.id),
            "note should NOT be in ws-old after reassign"
        );
        let new_list = list_notes(&conn, Some(ws_new)).expect("list ws-new after");
        assert!(
            new_list.iter().any(|n| n.id == note.id),
            "note should be in ws-new after reassign"
        );
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

        let toggled = update_note(&conn, note.id, None, None, Some("plaintext".to_string()))
            .expect("toggle to plaintext failed");
        assert_eq!(toggled.format, "plaintext");

        // Reload from DB to verify persistence
        let reloaded = get_note(&conn, note.id).expect("get_note after toggle failed");
        assert_eq!(reloaded.format, "plaintext");

        // Toggle back
        let toggled_back = update_note(&conn, note.id, None, None, Some("markdown".to_string()))
            .expect("toggle back to markdown failed");
        assert_eq!(toggled_back.format, "markdown");
    }

    // ── Story 6.4: list_notes_with_workspace (name-enriched listing) ──────────

    /// Insert a workspace row directly and return its id (names need not be unique).
    fn insert_workspace(conn: &Connection, name: &str, path: &str) -> i64 {
        conn.execute(
            "INSERT INTO workspaces (name, path, created_at) VALUES (?1, ?2, ?3)",
            params![name, path, "2026-06-13T00:00:00+00:00"],
        )
        .expect("insert workspace");
        conn.last_insert_rowid()
    }

    /// Create a titled note in `workspace_id` and stamp a fixed `updated_at` so
    /// ordering is deterministic.
    fn seed_note(conn: &Connection, title: &str, workspace_id: Option<i64>, updated_at: &str) -> i64 {
        let note = create_note(conn, "markdown", workspace_id).expect("create note");
        conn.execute(
            "UPDATE notes SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![title, updated_at, note.id],
        )
        .expect("stamp note");
        note.id
    }

    #[test]
    fn list_with_workspace_enriches_name_and_orders_desc() {
        let conn = setup_test_db();
        let ws = insert_workspace(&conn, "my-proj", "/home/me/my-proj");
        seed_note(&conn, "older", Some(ws), "2026-06-10T00:00:00+00:00");
        seed_note(&conn, "newer", None, "2026-06-12T00:00:00+00:00");

        let items = list_notes_with_workspace(&conn, None).expect("list");
        assert_eq!(items.len(), 2);
        // updated_at DESC → "newer" first.
        assert_eq!(items[0].title, "newer");
        assert_eq!(items[0].workspace_name, None);
        assert_eq!(items[1].title, "older");
        assert_eq!(items[1].workspace_name, Some("my-proj".to_string()));
    }

    #[test]
    fn list_with_workspace_filters_by_name() {
        let conn = setup_test_db();
        let a = insert_workspace(&conn, "alpha", "/p/alpha");
        let b = insert_workspace(&conn, "beta", "/p/beta");
        seed_note(&conn, "in-alpha", Some(a), "2026-06-11T00:00:00+00:00");
        seed_note(&conn, "in-beta", Some(b), "2026-06-12T00:00:00+00:00");

        let items = list_notes_with_workspace(&conn, Some("alpha")).expect("list");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].title, "in-alpha");
    }

    #[test]
    fn list_with_workspace_name_filter_matches_all_duplicate_names() {
        // workspaces.name is not unique (only path is): a name filter spans them.
        let conn = setup_test_db();
        let ws1 = insert_workspace(&conn, "dup", "/p/one/dup");
        let ws2 = insert_workspace(&conn, "dup", "/p/two/dup");
        seed_note(&conn, "from-one", Some(ws1), "2026-06-11T00:00:00+00:00");
        seed_note(&conn, "from-two", Some(ws2), "2026-06-12T00:00:00+00:00");

        let items = list_notes_with_workspace(&conn, Some("dup")).expect("list");
        assert_eq!(items.len(), 2, "name filter must match both 'dup' workspaces");
    }

    #[test]
    fn list_with_workspace_excludes_trashed() {
        let conn = setup_test_db();
        let id = seed_note(&conn, "trashme", None, "2026-06-12T00:00:00+00:00");
        conn.execute("UPDATE notes SET is_trashed = 1 WHERE id = ?1", params![id])
            .expect("trash note");

        let items = list_notes_with_workspace(&conn, None).expect("list");
        assert!(items.is_empty(), "trashed notes must not be listed");
    }
}
