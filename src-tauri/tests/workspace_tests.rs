mod helpers;

use helpers::factories::{create_temp_db, setup_test_db, NoteBuilder};
use tauri_app_lib::errors::NoteyError;
use tauri_app_lib::services::workspace_service;

// UNIT-2.1-001: workspaces table created with correct schema by migration
#[test]
fn test_workspaces_table_exists_with_correct_schema() {
    let conn = setup_test_db();
    let sql: String = conn
        .query_row(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='workspaces'",
            [],
            |row| row.get(0),
        )
        .expect("workspaces table should exist");

    assert!(sql.contains("id INTEGER PRIMARY KEY AUTOINCREMENT"));
    assert!(sql.contains("name TEXT NOT NULL"));
    assert!(sql.contains("path TEXT NOT NULL UNIQUE"));
    assert!(sql.contains("created_at TEXT NOT NULL"));
}

// UNIT-2.1-002: idx_workspaces_path index exists after migration
#[test]
fn test_workspaces_path_index_exists() {
    let conn = setup_test_db();
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_workspaces_path'",
            [],
            |row| row.get(0),
        )
        .expect("index query failed");
    assert_eq!(count, 1, "idx_workspaces_path index should exist");
}

// UNIT-2.1-003: create_workspace inserts new workspace and returns it with id
#[test]
fn test_create_workspace_returns_workspace_with_id() {
    let conn = setup_test_db();
    let ws = workspace_service::create_workspace(&conn, "My Project", "/home/user/project")
        .expect("create_workspace failed");

    assert!(ws.id > 0, "workspace should have a positive id");
    assert_eq!(ws.name, "My Project");
    assert_eq!(ws.path, "/home/user/project");
    assert!(ws.created_at.contains('T'), "created_at should be ISO 8601");
}

// UNIT-2.1-004: create_workspace returns existing workspace when path already exists (upsert)
#[test]
fn test_create_workspace_upsert_returns_existing() {
    let conn = setup_test_db();
    let ws1 = workspace_service::create_workspace(&conn, "Project A", "/home/user/project")
        .expect("first create_workspace failed");
    let ws2 = workspace_service::create_workspace(&conn, "Project B", "/home/user/project")
        .expect("second create_workspace (upsert) failed");

    assert_eq!(ws1.id, ws2.id, "upsert should return same workspace id");
    assert_eq!(ws2.name, "Project A", "upsert should return original name");
    assert_eq!(ws2.path, "/home/user/project");
}

// UNIT-2.1-005: list_workspaces returns all workspaces with correct note counts, ordered by name ASC
#[test]
fn test_list_workspaces_with_note_counts_ordered_by_name() {
    let conn = setup_test_db();
    let ws_b = workspace_service::create_workspace(&conn, "Bravo", "/path/bravo")
        .expect("create bravo");
    let ws_a = workspace_service::create_workspace(&conn, "Alpha", "/path/alpha")
        .expect("create alpha");

    // Add notes to workspaces
    NoteBuilder::new().workspace_id(ws_a.id).insert(&conn);
    NoteBuilder::new().workspace_id(ws_a.id).insert(&conn);
    NoteBuilder::new().workspace_id(ws_b.id).insert(&conn);

    let list = workspace_service::list_workspaces(&conn).expect("list_workspaces failed");
    assert_eq!(list.len(), 2);

    // Ordered by name ASC: Alpha first
    assert_eq!(list[0].name, "Alpha");
    assert_eq!(list[0].note_count, 2);
    assert_eq!(list[1].name, "Bravo");
    assert_eq!(list[1].note_count, 1);
}

// UNIT-2.1-006: list_workspaces note count excludes trashed notes
#[test]
fn test_list_workspaces_note_count_excludes_trashed() {
    let conn = setup_test_db();
    let ws = workspace_service::create_workspace(&conn, "Project", "/path/project")
        .expect("create_workspace failed");

    NoteBuilder::new().workspace_id(ws.id).insert(&conn);
    NoteBuilder::new().workspace_id(ws.id).trashed().insert(&conn);

    let list = workspace_service::list_workspaces(&conn).expect("list_workspaces failed");
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].note_count, 1, "trashed notes should not be counted");
}

// UNIT-2.1-007: get_workspace returns workspace with note count for valid id
#[test]
fn test_get_workspace_returns_info_with_note_count() {
    let conn = setup_test_db();
    let ws = workspace_service::create_workspace(&conn, "Project", "/path/project")
        .expect("create_workspace failed");

    NoteBuilder::new().workspace_id(ws.id).insert(&conn);
    NoteBuilder::new().workspace_id(ws.id).insert(&conn);

    let info = workspace_service::get_workspace(&conn, ws.id).expect("get_workspace failed");
    assert_eq!(info.id, ws.id);
    assert_eq!(info.name, "Project");
    assert_eq!(info.path, "/path/project");
    assert_eq!(info.note_count, 2);
}

// UNIT-2.1-008: get_workspace returns NoteyError::NotFound for invalid id
#[test]
fn test_get_workspace_not_found() {
    let conn = setup_test_db();
    let result = workspace_service::get_workspace(&conn, 99999);
    assert!(
        matches!(result, Err(NoteyError::NotFound)),
        "get_workspace with nonexistent id should return NotFound"
    );
}

// UNIT-2.1-009: Migration applies cleanly on existing DB with notes (forward-only)
#[test]
fn test_migration_applies_on_existing_db_with_notes() {
    let (conn, dir) = create_temp_db();

    // Insert a note first (DB already has both migrations applied via create_temp_db)
    NoteBuilder::new().title("Existing Note").insert(&conn);

    // Verify notes survived and workspaces table exists
    let note_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))
        .expect("count notes");
    assert!(note_count >= 1, "existing notes should still be present");

    let ws_table: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='workspaces'",
            [],
            |row| row.get(0),
        )
        .expect("check workspaces table");
    assert_eq!(ws_table, 1, "workspaces table should exist alongside notes");

    // Verify re-init doesn't break anything
    drop(conn);
    let conn2 = tauri_app_lib::db::init_db(dir.path().to_path_buf()).expect("re-init failed");
    let note_count2: i64 = conn2
        .query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))
        .expect("count notes after re-init");
    assert_eq!(note_count, note_count2, "notes should survive re-init");
}

// Additional: workspace with zero notes returns note_count 0
#[test]
fn test_get_workspace_with_zero_notes() {
    let conn = setup_test_db();
    let ws = workspace_service::create_workspace(&conn, "Empty", "/path/empty")
        .expect("create_workspace failed");

    let info = workspace_service::get_workspace(&conn, ws.id).expect("get_workspace failed");
    assert_eq!(info.note_count, 0, "workspace with no notes should have count 0");
}

// Additional: list_workspaces returns empty vec when no workspaces exist
#[test]
fn test_list_workspaces_empty() {
    let conn = setup_test_db();
    let list = workspace_service::list_workspaces(&conn).expect("list_workspaces failed");
    assert!(list.is_empty(), "should return empty list when no workspaces exist");
}

// Gap: get_workspace note count excludes trashed notes (mirrors UNIT-2.1-006 for get_workspace)
#[test]
fn test_get_workspace_note_count_excludes_trashed() {
    let conn = setup_test_db();
    let ws = workspace_service::create_workspace(&conn, "Project", "/path/project")
        .expect("create_workspace failed");

    NoteBuilder::new().workspace_id(ws.id).insert(&conn);
    NoteBuilder::new().workspace_id(ws.id).insert(&conn);
    NoteBuilder::new().workspace_id(ws.id).trashed().insert(&conn);

    let info = workspace_service::get_workspace(&conn, ws.id).expect("get_workspace failed");
    assert_eq!(info.note_count, 2, "get_workspace should exclude trashed notes from count");
}

// Gap: list_workspaces with multiple workspaces each having mixed trashed/non-trashed notes
#[test]
fn test_list_workspaces_per_workspace_trashed_isolation() {
    let conn = setup_test_db();
    let ws_a = workspace_service::create_workspace(&conn, "Alpha", "/path/alpha")
        .expect("create alpha");
    let ws_b = workspace_service::create_workspace(&conn, "Bravo", "/path/bravo")
        .expect("create bravo");

    // Alpha: 2 active, 1 trashed
    NoteBuilder::new().workspace_id(ws_a.id).insert(&conn);
    NoteBuilder::new().workspace_id(ws_a.id).insert(&conn);
    NoteBuilder::new().workspace_id(ws_a.id).trashed().insert(&conn);

    // Bravo: 1 active, 2 trashed
    NoteBuilder::new().workspace_id(ws_b.id).insert(&conn);
    NoteBuilder::new().workspace_id(ws_b.id).trashed().insert(&conn);
    NoteBuilder::new().workspace_id(ws_b.id).trashed().insert(&conn);

    let list = workspace_service::list_workspaces(&conn).expect("list_workspaces failed");
    assert_eq!(list.len(), 2);
    assert_eq!(list[0].name, "Alpha");
    assert_eq!(list[0].note_count, 2, "Alpha should count only non-trashed");
    assert_eq!(list[1].name, "Bravo");
    assert_eq!(list[1].note_count, 1, "Bravo should count only non-trashed");
}

// Gap: upsert preserves original created_at timestamp
#[test]
fn test_create_workspace_upsert_preserves_created_at() {
    let conn = setup_test_db();
    let ws1 = workspace_service::create_workspace(&conn, "Original", "/path/same")
        .expect("first create failed");
    let original_created_at = ws1.created_at.clone();

    // Second create with same path should return original, preserving created_at
    let ws2 = workspace_service::create_workspace(&conn, "Different Name", "/path/same")
        .expect("upsert failed");

    assert_eq!(ws2.created_at, original_created_at, "upsert should preserve original created_at");
}

// UNIT-2.1-010: tauri-specta generates TypeScript bindings for all 3 workspace commands
#[test]
fn test_typescript_bindings_contain_workspace_commands_and_types() {
    let bindings = std::fs::read_to_string("../src/generated/bindings.ts")
        .expect("bindings.ts should exist after build");

    // Verify command functions exist
    assert!(
        bindings.contains("createWorkspace"),
        "bindings should contain createWorkspace command"
    );
    assert!(
        bindings.contains("listWorkspaces"),
        "bindings should contain listWorkspaces command"
    );
    assert!(
        bindings.contains("getWorkspace"),
        "bindings should contain getWorkspace command"
    );

    // Verify types exist
    assert!(
        bindings.contains("export type Workspace"),
        "bindings should contain Workspace type"
    );
    assert!(
        bindings.contains("export type WorkspaceInfo"),
        "bindings should contain WorkspaceInfo type"
    );
}

// Gap: notes with workspace_id = NULL don't pollute workspace note counts
#[test]
fn test_unassigned_notes_not_counted_in_workspaces() {
    let conn = setup_test_db();
    let ws = workspace_service::create_workspace(&conn, "Project", "/path/project")
        .expect("create_workspace failed");

    // One note assigned to workspace, two unassigned (workspace_id = NULL)
    NoteBuilder::new().workspace_id(ws.id).insert(&conn);
    NoteBuilder::new().insert(&conn);
    NoteBuilder::new().insert(&conn);

    let info = workspace_service::get_workspace(&conn, ws.id).expect("get_workspace failed");
    assert_eq!(info.note_count, 1, "unassigned notes should not be counted");

    let list = workspace_service::list_workspaces(&conn).expect("list_workspaces failed");
    assert_eq!(list[0].note_count, 1, "unassigned notes should not appear in list counts");
}
