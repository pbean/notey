mod helpers;

use rusqlite::params;

use helpers::factories::{create_temp_db, NoteBuilder};
use tauri_app_lib::db;
use tauri_app_lib::services::notes;

// P0-INT-005b: FTS5 virtual table and all 3 triggers exist in sqlite_master
#[test]
fn test_fts5_table_and_triggers_exist() {
    let (conn, _dir) = create_temp_db();

    let table_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='notes_fts'",
            [],
            |row| row.get(0),
        )
        .expect("query failed");
    assert_eq!(table_count, 1, "notes_fts virtual table should exist");

    for trigger in &["notes_fts_ai", "notes_fts_ad", "notes_fts_au"] {
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name=?1",
                params![trigger],
                |row| row.get(0),
            )
            .expect("trigger query failed");
        assert_eq!(count, 1, "trigger '{}' should exist", trigger);
    }
}

// P0-INT-004a: FTS5 index reflects newly created note (INSERT trigger)
#[test]
fn test_fts5_insert_trigger_indexes_new_note() {
    let (conn, _dir) = create_temp_db();

    let note = NoteBuilder::new()
        .title("unique_rustacean_title")
        .content("some content here")
        .insert(&conn);

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH ?1",
            params!["unique_rustacean_title"],
            |row| row.get(0),
        )
        .expect("FTS query failed");

    assert_eq!(count, 1, "inserted note should be findable via FTS5 MATCH; note id={}", note.id);
}

// P0-INT-004b: FTS5 index reflects updated note title/content (UPDATE trigger)
#[test]
fn test_fts5_update_trigger_reindexes_note() {
    let (conn, _dir) = create_temp_db();

    let note = NoteBuilder::new()
        .title("old_title_zxcvbnm")
        .content("old content")
        .insert(&conn);

    notes::update_note(
        &conn,
        note.id,
        Some("new_title_qwertyu".to_string()),
        Some("new content".to_string()),
        None,
    )
    .expect("update_note failed");

    let old_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH ?1",
            params!["old_title_zxcvbnm"],
            |row| row.get(0),
        )
        .expect("FTS query failed");
    assert_eq!(old_count, 0, "old title should no longer be in FTS index after update");

    let new_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH ?1",
            params!["new_title_qwertyu"],
            |row| row.get(0),
        )
        .expect("FTS query failed");
    assert_eq!(new_count, 1, "new title should be findable via FTS5 MATCH after update");
}

// P0-INT-004c: FTS5 index removes hard-deleted note (DELETE trigger)
#[test]
fn test_fts5_delete_trigger_removes_from_index() {
    let (conn, _dir) = create_temp_db();

    let note = NoteBuilder::new()
        .title("deleteme_fts5_title")
        .content("content to be deleted")
        .insert(&conn);

    // Hard delete (triggers DELETE trigger)
    conn.execute("DELETE FROM notes WHERE id = ?1", params![note.id])
        .expect("hard delete failed");

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH ?1",
            params!["deleteme_fts5_title"],
            |row| row.get(0),
        )
        .expect("FTS query failed");
    assert_eq!(count, 0, "hard-deleted note should be removed from FTS5 index");
}

// P0-INT-004d: FTS5 index reflects trashed note (still searchable — trigger fires on is_trashed update)
#[test]
fn test_fts5_trashed_note_still_searchable() {
    let (conn, _dir) = create_temp_db();

    let note = NoteBuilder::new()
        .title("trashed_note_fts5_unique")
        .content("trashed content")
        .insert(&conn);

    notes::trash_note(&conn, note.id).expect("trash_note failed");

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH ?1",
            params!["trashed_note_fts5_unique"],
            |row| row.get(0),
        )
        .expect("FTS query failed");
    assert_eq!(count, 1, "trashed note should remain in FTS5 index (soft delete only)");
}

// P0-INT-005a: FTS5 backfill — existing notes appear in FTS index after migration
#[test]
fn test_fts5_backfill_existing_notes() {
    use tempfile::TempDir;
    use rusqlite::Connection;

    let dir = TempDir::new().expect("failed to create temp dir");
    let db_path = dir.path().join("notey.db");

    // Phase 1: Apply only first 2 migrations (no FTS5), insert notes directly
    {
        let mut conn = Connection::open(&db_path).expect("open db");
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA synchronous=NORMAL;
             PRAGMA busy_timeout=5000;
             PRAGMA foreign_keys=ON;
             PRAGMA cache_size=-10000;",
        )
        .expect("pragmas failed");

        // Apply only migrations 1 and 2 (notes table + workspaces table).
        // SQL is duplicated here because MIGRATIONS_SLICE is a static &[M] and
        // rusqlite_migration::Migrations::from_slice cannot take a sub-slice of it.
        // The backfill test requires a two-phase setup: first apply pre-FTS5
        // migrations, insert notes, then re-open with init_db to apply migration 3.
        let pre_fts_slice = [
            rusqlite_migration::M::up(
                "CREATE TABLE IF NOT EXISTS notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL DEFAULT '',
                    content TEXT NOT NULL DEFAULT '',
                    format TEXT NOT NULL DEFAULT 'markdown' CHECK(format IN ('markdown', 'plaintext')),
                    workspace_id INTEGER NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    deleted_at TEXT NULL,
                    is_trashed INTEGER NOT NULL DEFAULT 0
                )",
            ),
            rusqlite_migration::M::up(
                "CREATE TABLE IF NOT EXISTS workspaces (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    path TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_workspaces_path ON workspaces(path);",
            ),
        ];
        let partial_migrations = rusqlite_migration::Migrations::from_slice(&pre_fts_slice);
        partial_migrations
            .to_latest(&mut conn)
            .expect("partial migrations failed");

        // Insert pre-existing notes directly
        conn.execute(
            "INSERT INTO notes (title, content, format, created_at, updated_at)
             VALUES ('pre_existing_note_alpha', 'pre content alpha', 'markdown', '2026-01-01T00:00:00+00:00', '2026-01-01T00:00:00+00:00')",
            [],
        )
        .expect("insert pre-existing note 1");
        conn.execute(
            "INSERT INTO notes (title, content, format, created_at, updated_at)
             VALUES ('pre_existing_note_beta', 'pre content beta', 'markdown', '2026-01-01T00:00:00+00:00', '2026-01-01T00:00:00+00:00')",
            [],
        )
        .expect("insert pre-existing note 2");
    }

    // Phase 2: Re-open with full init_db which applies migration 3 (FTS5 + backfill)
    let conn = db::init_db(dir.path().to_path_buf()).expect("init_db with FTS5 migration failed");

    let count_alpha: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH ?1",
            params!["pre_existing_note_alpha"],
            |row| row.get(0),
        )
        .expect("FTS query alpha failed");
    assert_eq!(count_alpha, 1, "pre-existing note alpha should be backfilled into FTS5 index");

    let count_beta: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH ?1",
            params!["pre_existing_note_beta"],
            |row| row.get(0),
        )
        .expect("FTS query beta failed");
    assert_eq!(count_beta, 1, "pre-existing note beta should be backfilled into FTS5 index");
}

// P1-INT-002: FTS5 index handles empty title/content gracefully (no phantom matches)
#[test]
fn test_fts5_empty_content_no_phantom_matches() {
    let (conn, _dir) = create_temp_db();

    // Verify inserting a note with empty title and content succeeds without error
    let empty_note = NoteBuilder::new()
        .title("")
        .content("")
        .insert(&conn);
    assert!(empty_note.id > 0, "empty note should be inserted successfully");

    // Create a real note to search against
    NoteBuilder::new()
        .title("visible_searchable_note")
        .content("real content for matching")
        .insert(&conn);

    // Verify only the real note matches — empty note does not phantom-match
    let match_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH ?1",
            params!["visible_searchable_note"],
            |row| row.get(0),
        )
        .expect("FTS query failed");
    assert_eq!(match_count, 1, "only the real note should match; empty note should not phantom-match");

    // Verify searching for arbitrary terms returns 0 (empty note doesn't match random terms)
    let phantom_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH ?1",
            params!["nonexistentterm_xyzzy_42"],
            |row| row.get(0),
        )
        .expect("FTS query failed");
    assert_eq!(phantom_count, 0, "FTS5 should return 0 matches for a term not in any note");
}

// P1-INT-001: FTS5 MATCH query returns correct results with BM25 ranking
#[test]
fn test_fts5_match_returns_ranked_results() {
    let (conn, _dir) = create_temp_db();

    // Note with "searchterm" only in content, repeated many times (high content BM25).
    // With default equal weights (1:1), this note would rank FIRST due to high content TF.
    NoteBuilder::new()
        .title("generic note about coding")
        .content("searchterm searchterm searchterm searchterm searchterm searchterm searchterm searchterm searchterm searchterm")
        .insert(&conn);

    // Note with "searchterm" in title only (high title BM25 with 10x weight).
    // With bm25(10.0, 1.0), this note ranks first because title weight dominates.
    NoteBuilder::new()
        .title("searchterm")
        .content("a completely different topic here")
        .insert(&conn);

    let mut stmt = conn
        .prepare(
            "SELECT rowid FROM notes_fts WHERE notes_fts MATCH ?1 ORDER BY rank",
        )
        .expect("prepare failed");
    let ids: Vec<i64> = stmt
        .query_map(params!["searchterm"], |row| row.get(0))
        .expect("query_map failed")
        .collect::<Result<Vec<_>, _>>()
        .expect("collect failed");

    assert_eq!(ids.len(), 2, "both notes should match 'searchterm'");
    // With bm25(10.0, 1.0), the title-match note should rank first because
    // title weight (10x) dominates over content weight (1x), even though the
    // content-only note has many more term occurrences.
    // With default equal weights, the content-heavy note would rank first instead.
    let title_note_id: i64 = conn
        .query_row(
            "SELECT id FROM notes WHERE title = 'searchterm'",
            [],
            |row| row.get(0),
        )
        .expect("find title note");
    assert_eq!(ids[0], title_note_id, "title match should rank above content-only match (verifies BM25 10:1 weighting)");
}

// FTS5 rebuild restores index from content table
#[test]
fn test_fts5_rebuild_restores_index() {
    let (conn, _dir) = create_temp_db();

    let note1 = NoteBuilder::new()
        .title("rebuild_alpha_unique")
        .content("content alpha")
        .insert(&conn);
    let _note2 = NoteBuilder::new()
        .title("rebuild_beta_unique")
        .content("content beta")
        .insert(&conn);

    // Verify both notes are in the FTS index before rebuild
    let pre_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH ?1",
            params!["rebuild_alpha_unique"],
            |row| row.get(0),
        )
        .expect("pre-rebuild FTS query failed");
    assert_eq!(pre_count, 1, "note should be in FTS before rebuild");

    // Simulate FTS drift: drop the insert trigger, add a note bypassing FTS,
    // then restore the trigger. The new note will be in `notes` but not in `notes_fts`.
    conn.execute_batch("DROP TRIGGER notes_fts_ai").expect("drop trigger failed");
    conn.execute(
        "INSERT INTO notes (title, content, format, created_at, updated_at)
         VALUES ('drift_note_unique', 'drifted content', 'markdown', '2026-01-01T00:00:00+00:00', '2026-01-01T00:00:00+00:00')",
        [],
    ).expect("insert bypassing FTS failed");
    conn.execute_batch(
        "CREATE TRIGGER notes_fts_ai AFTER INSERT ON notes BEGIN
            INSERT INTO notes_fts(rowid, title, content)
            VALUES (NEW.id, NEW.title, NEW.content);
        END"
    ).expect("recreate trigger failed");

    // Verify drift: the bypassed note should NOT be in FTS
    let drift_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH ?1",
            params!["drift_note_unique"],
            |row| row.get(0),
        )
        .expect("drift check query failed");
    assert_eq!(drift_count, 0, "note inserted while trigger was dropped should NOT be in FTS");

    // Rebuild the FTS index — should recover the drifted note
    notes::rebuild_fts_index(&conn).expect("rebuild_fts_index failed");

    // Verify all notes are searchable after rebuild (including the drifted one)
    let drift_recovered: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH ?1",
            params!["drift_note_unique"],
            |row| row.get(0),
        )
        .expect("drift recovery query failed");
    assert_eq!(drift_recovered, 1, "drifted note should be recoverable via FTS rebuild");
    let alpha_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH ?1",
            params!["rebuild_alpha_unique"],
            |row| row.get(0),
        )
        .expect("FTS query alpha failed");
    assert_eq!(alpha_count, 1, "note alpha should be findable after FTS rebuild");

    let beta_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH ?1",
            params!["rebuild_beta_unique"],
            |row| row.get(0),
        )
        .expect("FTS query beta failed");
    assert_eq!(beta_count, 1, "note beta should be findable after FTS rebuild");

    // Update a note and rebuild again to verify triggers + rebuild coexist
    notes::update_note(&conn, note1.id, Some("rebuild_gamma_unique".to_string()), None, None)
        .expect("update note failed");
    notes::rebuild_fts_index(&conn).expect("second rebuild failed");

    let gamma_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH ?1",
            params!["rebuild_gamma_unique"],
            |row| row.get(0),
        )
        .expect("FTS query gamma failed");
    assert_eq!(gamma_count, 1, "updated note should be findable after second FTS rebuild");
}

// P1-INT-003: FTS5 index stays consistent after multiple rapid create/update/delete cycles
#[test]
fn test_fts5_rapid_crud_consistency() {
    let (conn, _dir) = create_temp_db();

    // Create several notes
    let note_a = NoteBuilder::new().title("rapid_alpha_term").content("a").insert(&conn);
    let note_b = NoteBuilder::new().title("rapid_beta_term").content("b").insert(&conn);
    let note_c = NoteBuilder::new().title("rapid_gamma_term").content("c").insert(&conn);

    // Update note_a title
    notes::update_note(&conn, note_a.id, Some("rapid_alpha_updated".to_string()), None, None)
        .expect("update note_a");

    // Trash note_b (soft delete — stays in FTS)
    notes::trash_note(&conn, note_b.id).expect("trash note_b");

    // Hard delete note_c
    conn.execute("DELETE FROM notes WHERE id = ?1", params![note_c.id])
        .expect("hard delete note_c");

    // Verify FTS state matches expected final state:
    // note_a: old title gone, new title present
    let old_a: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH ?1",
            params!["rapid_alpha_term"],
            |row| row.get(0),
        )
        .expect("query");
    assert_eq!(old_a, 0, "old title of note_a should not be in FTS after update");

    let new_a: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH ?1",
            params!["rapid_alpha_updated"],
            |row| row.get(0),
        )
        .expect("query");
    assert_eq!(new_a, 1, "updated title of note_a should be in FTS");

    // note_b: still in FTS (soft delete)
    let b_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH ?1",
            params!["rapid_beta_term"],
            |row| row.get(0),
        )
        .expect("query");
    assert_eq!(b_count, 1, "trashed note_b should still be in FTS");

    // note_c: removed from FTS (hard delete)
    let c_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH ?1",
            params!["rapid_gamma_term"],
            |row| row.get(0),
        )
        .expect("query");
    assert_eq!(c_count, 0, "hard-deleted note_c should be removed from FTS");
}
