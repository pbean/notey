mod helpers;

use rusqlite::params;

use helpers::factories::{create_temp_db, NoteBuilder};
use tauri_app_lib::errors::NoteyError;
use tauri_app_lib::services::notes;

#[test]
fn test_notes_table_creation() {
    let (conn, _dir) = create_temp_db();
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='notes'",
            [],
            |row| row.get(0),
        )
        .expect("query failed");
    assert_eq!(count, 1, "notes table should exist");
}

#[test]
fn test_wal_mode_active() {
    let (conn, _dir) = create_temp_db();
    let mode: String = conn
        .query_row("PRAGMA journal_mode", [], |row| row.get(0))
        .expect("query failed");
    assert_eq!(mode, "wal", "journal_mode should be WAL");
}

#[test]
fn test_pragma_synchronous() {
    let (conn, _dir) = create_temp_db();
    let val: i64 = conn
        .query_row("PRAGMA synchronous", [], |row| row.get(0))
        .expect("query failed");
    assert_eq!(val, 1, "synchronous should be NORMAL (1)");
}

#[test]
fn test_pragma_busy_timeout() {
    let (conn, _dir) = create_temp_db();
    let val: i64 = conn
        .query_row("PRAGMA busy_timeout", [], |row| row.get(0))
        .expect("query failed");
    assert_eq!(val, 5000, "busy_timeout should be 5000");
}

#[test]
fn test_pragma_foreign_keys() {
    let (conn, _dir) = create_temp_db();
    let val: i64 = conn
        .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
        .expect("query failed");
    assert_eq!(val, 1, "foreign_keys should be ON (1)");
}

#[test]
fn test_pragma_cache_size() {
    let (conn, _dir) = create_temp_db();
    let val: i64 = conn
        .query_row("PRAGMA cache_size", [], |row| row.get(0))
        .expect("query failed");
    assert_eq!(val, -10000, "cache_size should be -10000");
}

#[test]
fn test_create_note_inserts_row_with_correct_defaults() {
    let (conn, _dir) = create_temp_db();
    let note = notes::create_note(&conn, "markdown", None).expect("create_note failed");

    assert!(note.id > 0, "note should have a positive id");
    assert_eq!(note.title, "", "title should be empty");
    assert_eq!(note.content, "", "content should be empty");
    assert_eq!(note.format, "markdown", "format should be markdown");
    assert!(note.workspace_id.is_none(), "workspace_id should be None");
    assert!(!note.is_trashed, "is_trashed should be false");
    assert!(
        note.created_at.contains('T'),
        "created_at should be ISO8601: {}",
        note.created_at
    );
    assert!(
        note.updated_at.contains('T'),
        "updated_at should be ISO8601: {}",
        note.updated_at
    );

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes WHERE id = ?",
            params![note.id],
            |row| row.get(0),
        )
        .expect("query failed");
    assert_eq!(count, 1, "note should exist in database");
}

#[test]
fn test_get_note_not_found_returns_not_found_error() {
    let (conn, _dir) = create_temp_db();
    let result = notes::get_note(&conn, 99999);
    assert!(
        matches!(result, Err(NoteyError::NotFound)),
        "get_note with nonexistent id should return NotFound"
    );
}

#[test]
fn test_update_note_only_updates_provided_fields() {
    let (conn, _dir) = create_temp_db();
    let note = notes::create_note(&conn, "markdown", None).expect("create_note failed");

    let updated = notes::update_note(
        &conn,
        note.id,
        None,
        Some("updated content".to_string()),
        None,
    )
    .expect("update_note failed");

    assert_eq!(updated.content, "updated content", "content should be updated");
    assert_eq!(updated.title, note.title, "title should not change");
    assert_eq!(updated.format, note.format, "format should not change");
}

#[test]
fn test_list_notes_filters_trashed_notes() {
    let (conn, _dir) = create_temp_db();

    let _note1 = NoteBuilder::new().trashed().insert(&conn);
    let note2 = NoteBuilder::new().title("Visible").insert(&conn);

    let result = notes::list_notes(&conn, None).expect("list_notes failed");

    assert_eq!(result.len(), 1, "only non-trashed notes should appear");
    assert_eq!(result[0].id, note2.id);
}

// P0-INT-002: DB write durability — data survives close + reopen
#[test]
fn test_db_write_survives_reopen() {
    let (conn, dir) = create_temp_db();

    let note = notes::create_note(&conn, "markdown", None).expect("create_note failed");
    let note_id = note.id;
    notes::update_note(
        &conn,
        note_id,
        Some("durable title".to_string()),
        Some("durable content".to_string()),
        None,
    )
    .expect("update_note failed");

    // Force WAL checkpoint and close
    conn.execute_batch("PRAGMA wal_checkpoint(FULL);")
        .expect("checkpoint failed");
    drop(conn);

    // Reopen the same database
    let conn2 = tauri_app_lib::db::init_db(dir.path().to_path_buf()).expect("reopen failed");
    let reloaded = notes::get_note(&conn2, note_id).expect("get_note after reopen failed");

    assert_eq!(reloaded.title, "durable title");
    assert_eq!(reloaded.content, "durable content");
}

// P0-INT-003: integrity_check passes after concurrent writes
#[test]
fn test_integrity_check_after_concurrent_writes() {
    let (conn, dir) = create_temp_db();

    // Open a second connection to the same file DB
    let db_path = dir.path().join("notey.db");
    let conn2 = rusqlite::Connection::open(&db_path).expect("open second connection");
    conn2
        .execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;")
        .expect("pragmas on conn2");

    // Write from both connections
    notes::create_note(&conn, "markdown", None).expect("create from conn1");
    conn2
        .execute(
            "INSERT INTO notes (title, content, format, created_at, updated_at) VALUES ('c2', '', 'markdown', '2026-01-01T00:00:00+00:00', '2026-01-01T00:00:00+00:00')",
            [],
        )
        .expect("insert from conn2");

    // Verify integrity on both connections
    let check1: String = conn
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .expect("integrity_check conn1");
    let check2: String = conn2
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .expect("integrity_check conn2");

    assert_eq!(check1, "ok", "conn1 integrity_check should pass");
    assert_eq!(check2, "ok", "conn2 integrity_check should pass");
}

// P1-UNIT-006: Migration applies identically on fresh and existing DB
#[test]
fn test_migration_idempotent_on_existing_db() {
    let (conn, dir) = create_temp_db();

    // Capture schema from first init
    let schema1: String = conn
        .query_row(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='notes'",
            [],
            |row| row.get(0),
        )
        .expect("schema query 1");

    drop(conn);

    // Re-init the same DB (migrations should be a no-op)
    let conn2 = tauri_app_lib::db::init_db(dir.path().to_path_buf()).expect("re-init failed");
    let schema2: String = conn2
        .query_row(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='notes'",
            [],
            |row| row.get(0),
        )
        .expect("schema query 2");

    assert_eq!(schema1, schema2, "schema should be identical after re-migration");
}
