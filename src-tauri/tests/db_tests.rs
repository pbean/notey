use rusqlite::{Connection, params};
use std::env;

use tauri_app_lib::db;
use tauri_app_lib::errors::NoteyError;
use tauri_app_lib::services::notes;

fn create_temp_db() -> (Connection, std::path::PathBuf) {
    let dir = env::temp_dir().join(format!("notey_test_{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos()));
    std::fs::create_dir_all(&dir).expect("failed to create temp dir");
    let conn = db::init_db(dir.clone()).expect("failed to init db");
    (conn, dir)
}

fn cleanup_temp_db(dir: &std::path::Path) {
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn test_notes_table_creation() {
    let (conn, dir) = create_temp_db();
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='notes'",
            [],
            |row| row.get(0),
        )
        .expect("query failed");
    assert_eq!(count, 1, "notes table should exist");
    cleanup_temp_db(&dir);
}

#[test]
fn test_wal_mode_active() {
    let (conn, dir) = create_temp_db();
    let mode: String = conn
        .query_row("PRAGMA journal_mode", [], |row| row.get(0))
        .expect("query failed");
    assert_eq!(mode, "wal", "journal_mode should be WAL");
    cleanup_temp_db(&dir);
}

#[test]
fn test_pragma_synchronous() {
    let (conn, dir) = create_temp_db();
    let val: i64 = conn
        .query_row("PRAGMA synchronous", [], |row| row.get(0))
        .expect("query failed");
    // NORMAL = 1
    assert_eq!(val, 1, "synchronous should be NORMAL (1)");
    cleanup_temp_db(&dir);
}

#[test]
fn test_pragma_busy_timeout() {
    let (conn, dir) = create_temp_db();
    let val: i64 = conn
        .query_row("PRAGMA busy_timeout", [], |row| row.get(0))
        .expect("query failed");
    assert_eq!(val, 5000, "busy_timeout should be 5000");
    cleanup_temp_db(&dir);
}

#[test]
fn test_pragma_foreign_keys() {
    let (conn, dir) = create_temp_db();
    let val: i64 = conn
        .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
        .expect("query failed");
    assert_eq!(val, 1, "foreign_keys should be ON (1)");
    cleanup_temp_db(&dir);
}

#[test]
fn test_pragma_cache_size() {
    let (conn, dir) = create_temp_db();
    let val: i64 = conn
        .query_row("PRAGMA cache_size", [], |row| row.get(0))
        .expect("query failed");
    assert_eq!(val, -10000, "cache_size should be -10000");
    cleanup_temp_db(&dir);
}

#[test]
fn test_create_note_inserts_row_with_correct_defaults() {
    let (conn, dir) = create_temp_db();
    let note = notes::create_note(&conn, "markdown").expect("create_note failed");

    assert!(note.id > 0, "note should have a positive id");
    assert_eq!(note.title, "", "title should be empty");
    assert_eq!(note.content, "", "content should be empty");
    assert_eq!(note.format, "markdown", "format should be markdown");
    assert!(note.workspace_id.is_none(), "workspace_id should be None");
    assert!(!note.is_trashed, "is_trashed should be false");

    // Verify ISO8601 timestamps
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

    // Verify row exists in DB
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM notes WHERE id = ?", params![note.id], |row| row.get(0))
        .expect("query failed");
    assert_eq!(count, 1, "note should exist in database");

    cleanup_temp_db(&dir);
}

#[test]
fn test_get_note_not_found_returns_not_found_error() {
    let (conn, dir) = create_temp_db();
    let result = notes::get_note(&conn, 99999);
    assert!(
        matches!(result, Err(NoteyError::NotFound)),
        "get_note with nonexistent id should return NotFound"
    );
    cleanup_temp_db(&dir);
}

#[test]
fn test_update_note_only_updates_provided_fields() {
    let (conn, dir) = create_temp_db();
    let note = notes::create_note(&conn, "markdown").expect("create_note failed");

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

    cleanup_temp_db(&dir);
}

#[test]
fn test_list_notes_filters_trashed_notes() {
    let (conn, dir) = create_temp_db();

    let note1 = notes::create_note(&conn, "markdown").expect("create note1");
    let note2 = notes::create_note(&conn, "markdown").expect("create note2");

    // Trash note1
    conn.execute(
        "UPDATE notes SET is_trashed = 1 WHERE id = ?",
        params![note1.id],
    )
    .expect("failed to trash note");

    let result = notes::list_notes(&conn).expect("list_notes failed");

    assert!(
        !result.iter().any(|n| n.id == note1.id),
        "trashed note1 should not appear in list"
    );
    assert!(
        result.iter().any(|n| n.id == note2.id),
        "non-trashed note2 should appear in list"
    );
    assert!(
        result.iter().all(|n| !n.is_trashed),
        "no trashed notes should be in list"
    );

    cleanup_temp_db(&dir);
}
