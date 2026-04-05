mod helpers;

use helpers::factories::{create_temp_db, setup_test_db, NoteBuilder};
use tauri_app_lib::errors::NoteyError;
use tauri_app_lib::services::workspace_service;
use tempfile::TempDir;

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

// ============================================================================
// Story 2.2: Git Repository Detection Service
// ============================================================================

/// Helper: create a temp dir with a .git subdirectory to simulate a git repo.
fn make_git_repo() -> TempDir {
    let dir = TempDir::new().unwrap();
    std::fs::create_dir(dir.path().join(".git")).unwrap();
    dir
}

/// Helper: create a temp git repo with nested subdirectories.
fn make_nested_git_repo() -> (TempDir, std::path::PathBuf) {
    let dir = TempDir::new().unwrap();
    std::fs::create_dir(dir.path().join(".git")).unwrap();
    let nested = dir.path().join("src").join("deep");
    std::fs::create_dir_all(&nested).unwrap();
    (dir, nested)
}

// P1-UNIT-003: detect_workspace finds git repo root from nested path
#[test]
fn test_detect_workspace_finds_git_root_from_nested_path() {
    let (dir, nested) = make_nested_git_repo();

    let result = workspace_service::detect_workspace(nested.to_str().unwrap())
        .expect("detect_workspace failed");

    let expected_path = std::fs::canonicalize(dir.path()).unwrap();
    assert_eq!(result.path, expected_path.to_string_lossy().to_string());
    assert_eq!(
        result.name,
        expected_path.file_name().unwrap().to_string_lossy().to_string()
    );
}

// P1-UNIT-004: detect_workspace falls back to given directory for non-git paths
#[test]
fn test_detect_workspace_fallback_no_git() {
    let dir = TempDir::new().unwrap();
    // No .git directory created

    let result = workspace_service::detect_workspace(dir.path().to_str().unwrap())
        .expect("detect_workspace failed");

    let expected_path = std::fs::canonicalize(dir.path()).unwrap();
    assert_eq!(result.path, expected_path.to_string_lossy().to_string());
    assert_eq!(
        result.name,
        expected_path.file_name().unwrap().to_string_lossy().to_string()
    );
}

// UNIT-2.2-003: detect_workspace returns correct name (directory basename) from git root
#[test]
fn test_detect_workspace_returns_correct_basename() {
    let dir = make_git_repo();

    let result = workspace_service::detect_workspace(dir.path().to_str().unwrap())
        .expect("detect_workspace failed");

    let expected_path = std::fs::canonicalize(dir.path()).unwrap();
    let expected_name = expected_path.file_name().unwrap().to_string_lossy().to_string();
    assert_eq!(result.name, expected_name);
}

// UNIT-2.2-004: detect_workspace canonicalizes paths (resolves symlinks/./.. )
#[test]
fn test_detect_workspace_canonicalizes_paths() {
    let (dir, _nested) = make_nested_git_repo();

    // Use a path with ".." segments
    let dotdot_path = dir.path().join("src").join("deep").join("..").join("..");
    let result = workspace_service::detect_workspace(dotdot_path.to_str().unwrap())
        .expect("detect_workspace failed");

    let expected_path = std::fs::canonicalize(dir.path()).unwrap();
    assert_eq!(result.path, expected_path.to_string_lossy().to_string());
}

// UNIT-2.2-005: detect_workspace returns Validation error for non-existent path
#[test]
fn test_detect_workspace_error_nonexistent_path() {
    let result = workspace_service::detect_workspace("/tmp/definitely-does-not-exist-xyz123");
    assert!(
        matches!(result, Err(NoteyError::Validation(_))),
        "should return Validation error for non-existent path, got: {:?}",
        result
    );
}

// UNIT-2.2-006: detect_workspace returns Validation error for path that is a file, not directory
#[test]
fn test_detect_workspace_error_file_path() {
    let dir = TempDir::new().unwrap();
    let file_path = dir.path().join("somefile.txt");
    std::fs::write(&file_path, "hello").unwrap();

    let result = workspace_service::detect_workspace(file_path.to_str().unwrap());
    assert!(
        matches!(result, Err(NoteyError::Validation(_))),
        "should return Validation error for file path, got: {:?}",
        result
    );
}

// UNIT-2.2-007: detect_workspace works at filesystem root (no infinite loop)
#[test]
fn test_detect_workspace_filesystem_root_no_infinite_loop() {
    // "/" exists and is a directory but typically has no .git — should fallback
    let result = workspace_service::detect_workspace("/");
    // This should either succeed with fallback or error — but must NOT infinite loop
    // On most systems "/" has no .git, so fallback returns "/" with name "workspace" (root has no file_name)
    match result {
        Ok(ws) => {
            assert_eq!(ws.path, "/");
            // Root path has no file_name, so name should be fallback "workspace"
            assert_eq!(ws.name, "workspace");
        }
        Err(NoteyError::Validation(_)) => {
            // Some systems might restrict access to root — Validation error is acceptable
        }
        Err(other) => {
            panic!("unexpected error type for root path: {:?}", other);
        }
    }
}

// UNIT-2.2-008: detect_workspace works when invoked ON the git root directory itself
#[test]
fn test_detect_workspace_on_git_root_itself() {
    let dir = make_git_repo();

    let result = workspace_service::detect_workspace(dir.path().to_str().unwrap())
        .expect("detect_workspace failed");

    let expected_path = std::fs::canonicalize(dir.path()).unwrap();
    assert_eq!(result.path, expected_path.to_string_lossy().to_string());
}

// Gap: inner nested git repo takes precedence over outer ancestor repo
#[test]
fn test_detect_workspace_inner_git_repo_takes_precedence() {
    let outer = TempDir::new().unwrap();
    // Outer repo has .git
    std::fs::create_dir(outer.path().join(".git")).unwrap();
    // Inner repo nested inside outer also has .git
    let inner = outer.path().join("packages").join("inner-app");
    std::fs::create_dir_all(&inner).unwrap();
    std::fs::create_dir(inner.join(".git")).unwrap();
    // Deeply nested path inside inner repo
    let deep = inner.join("src").join("lib");
    std::fs::create_dir_all(&deep).unwrap();

    let result = workspace_service::detect_workspace(deep.to_str().unwrap())
        .expect("detect_workspace failed");

    let expected_path = std::fs::canonicalize(&inner).unwrap();
    assert_eq!(
        result.path,
        expected_path.to_string_lossy().to_string(),
        "should find inner repo, not outer ancestor repo"
    );
    assert_eq!(result.name, "inner-app");
}

// Gap: .git as a file (submodule/worktree pattern) is still detected
#[test]
fn test_detect_workspace_git_file_submodule_pattern() {
    let dir = TempDir::new().unwrap();
    // Submodules and worktrees use a .git FILE (not directory)
    // containing "gitdir: /path/to/actual/git/dir"
    let git_file = dir.path().join(".git");
    std::fs::write(&git_file, "gitdir: /some/path/.git/modules/sub").unwrap();

    let result = workspace_service::detect_workspace(dir.path().to_str().unwrap())
        .expect("detect_workspace failed");

    let expected_path = std::fs::canonicalize(dir.path()).unwrap();
    assert_eq!(
        result.path,
        expected_path.to_string_lossy().to_string(),
        ".git file (submodule pattern) should be detected"
    );
}

// Gap: deeply nested non-git path fallback returns original input, not a parent
#[test]
fn test_detect_workspace_fallback_deeply_nested_returns_input_path() {
    let dir = TempDir::new().unwrap();
    // No .git anywhere — deeply nested structure
    let deep = dir.path().join("a").join("b").join("c").join("d");
    std::fs::create_dir_all(&deep).unwrap();

    let result = workspace_service::detect_workspace(deep.to_str().unwrap())
        .expect("detect_workspace failed");

    let expected_path = std::fs::canonicalize(&deep).unwrap();
    assert_eq!(
        result.path,
        expected_path.to_string_lossy().to_string(),
        "fallback should return the input directory, not any parent"
    );
    assert_eq!(result.name, "d", "fallback name should be the input directory basename");
}

// UNIT-2.2-009: tauri-specta generates detectWorkspace function and DetectedWorkspace type
#[test]
fn test_typescript_bindings_contain_detect_workspace() {
    let bindings = std::fs::read_to_string("../src/generated/bindings.ts")
        .expect("bindings.ts should exist after build");

    assert!(
        bindings.contains("detectWorkspace"),
        "bindings should contain detectWorkspace command"
    );
    assert!(
        bindings.contains("DetectedWorkspace"),
        "bindings should contain DetectedWorkspace type"
    );
}

// ============================================================================
// Story 2.3: Auto-Workspace Assignment on Note Creation
// ============================================================================

// UNIT-2.3-003: resolve_workspace detects + upserts → returns Workspace with DB id
#[test]
fn test_resolve_workspace_creates_new_workspace() {
    let conn = setup_test_db();
    let dir = make_git_repo();

    let ws = workspace_service::resolve_workspace(&conn, dir.path().to_str().unwrap())
        .expect("resolve_workspace failed");

    assert!(ws.id > 0, "workspace should have a positive DB id");
    let expected_path = std::fs::canonicalize(dir.path()).unwrap();
    assert_eq!(ws.path, expected_path.to_string_lossy().to_string());
    assert!(ws.created_at.contains('T'), "created_at should be ISO 8601");
}

// UNIT-2.3-004: resolve_workspace for already-known path returns existing workspace
#[test]
fn test_resolve_workspace_returns_existing_for_known_path() {
    let conn = setup_test_db();
    let dir = make_git_repo();

    let ws1 = workspace_service::resolve_workspace(&conn, dir.path().to_str().unwrap())
        .expect("first resolve_workspace failed");
    let ws2 = workspace_service::resolve_workspace(&conn, dir.path().to_str().unwrap())
        .expect("second resolve_workspace failed");

    assert_eq!(ws1.id, ws2.id, "should return same workspace on repeated calls");
    assert_eq!(ws1.path, ws2.path);
}

// UNIT-2.3-005: resolve_workspace for non-git path falls back to directory itself
#[test]
fn test_resolve_workspace_fallback_non_git() {
    let conn = setup_test_db();
    let dir = TempDir::new().unwrap();
    // No .git directory

    let ws = workspace_service::resolve_workspace(&conn, dir.path().to_str().unwrap())
        .expect("resolve_workspace failed");

    assert!(ws.id > 0);
    let expected_path = std::fs::canonicalize(dir.path()).unwrap();
    assert_eq!(ws.path, expected_path.to_string_lossy().to_string());
}

// UNIT-2.3-003 extended: resolve_workspace from nested path resolves to git root
#[test]
fn test_resolve_workspace_from_nested_path() {
    let conn = setup_test_db();
    let (dir, nested) = make_nested_git_repo();

    let ws = workspace_service::resolve_workspace(&conn, nested.to_str().unwrap())
        .expect("resolve_workspace failed");

    let expected_path = std::fs::canonicalize(dir.path()).unwrap();
    assert_eq!(ws.path, expected_path.to_string_lossy().to_string());
}

// UNIT-2.3-007: tauri-specta generates updated createNote(format, workspaceId) binding
#[test]
fn test_typescript_bindings_create_note_has_workspace_id() {
    let bindings = std::fs::read_to_string("../src/generated/bindings.ts")
        .expect("bindings.ts should exist after build");

    assert!(
        bindings.contains("workspaceId"),
        "createNote binding should include workspaceId parameter"
    );
}

// Gap: resolve_workspace propagates Validation error for invalid path
#[test]
fn test_resolve_workspace_error_invalid_path() {
    let conn = setup_test_db();
    let result = workspace_service::resolve_workspace(&conn, "/tmp/definitely-does-not-exist-xyz123");
    assert!(
        matches!(result, Err(NoteyError::Validation(_))),
        "resolve_workspace should propagate Validation error for non-existent path, got: {:?}",
        result
    );
}

// Gap: end-to-end resolve_workspace → create_note with workspace_id
#[test]
fn test_resolve_workspace_then_create_note_with_workspace_id() {
    let conn = setup_test_db();
    let dir = make_git_repo();

    let ws = workspace_service::resolve_workspace(&conn, dir.path().to_str().unwrap())
        .expect("resolve_workspace failed");

    let note = tauri_app_lib::services::notes::create_note(&conn, "markdown", Some(ws.id))
        .expect("create_note failed");

    assert_eq!(note.workspace_id, Some(ws.id), "note should be assigned to the resolved workspace");

    // Verify via independent get_note
    let fetched = tauri_app_lib::services::notes::get_note(&conn, note.id)
        .expect("get_note failed");
    assert_eq!(fetched.workspace_id, Some(ws.id), "workspace_id should persist in DB");
}

// ============================================================================
// Story 2.5: Workspace-Filtered Note Views — Integration Tests
// ============================================================================

// Gap: list_notes filtered by workspace_id returns only scoped notes (integration test)
#[test]
fn test_list_notes_filtered_by_workspace_integration() {
    let conn = setup_test_db();
    let ws_a = workspace_service::create_workspace(&conn, "Alpha", "/path/alpha")
        .expect("create alpha");
    let ws_b = workspace_service::create_workspace(&conn, "Bravo", "/path/bravo")
        .expect("create bravo");

    let note_a1 = NoteBuilder::new().title("A1").workspace_id(ws_a.id).insert(&conn);
    let _note_a2 = NoteBuilder::new().title("A2").workspace_id(ws_a.id).insert(&conn);
    let _note_b1 = NoteBuilder::new().title("B1").workspace_id(ws_b.id).insert(&conn);
    let _note_null = NoteBuilder::new().title("Unscoped").insert(&conn); // workspace_id = NULL

    let result = tauri_app_lib::services::notes::list_notes(&conn, Some(ws_a.id))
        .expect("list_notes filtered");
    assert_eq!(result.len(), 2, "should return only notes in ws_a");
    assert!(
        result.iter().all(|n| n.workspace_id == Some(ws_a.id)),
        "all returned notes should belong to ws_a"
    );
    // Verify ws_b notes and NULL workspace_id notes are excluded
    assert!(
        !result.iter().any(|n| n.title == "B1"),
        "ws_b notes should be excluded"
    );
    assert!(
        !result.iter().any(|n| n.title == "Unscoped"),
        "NULL workspace_id notes should be excluded"
    );
}

// Gap: list_notes filtered by workspace excludes trashed notes (integration test)
#[test]
fn test_list_notes_filtered_excludes_trashed_integration() {
    let conn = setup_test_db();
    let ws = workspace_service::create_workspace(&conn, "Project", "/path/project")
        .expect("create workspace");

    NoteBuilder::new().title("Active").workspace_id(ws.id).insert(&conn);
    NoteBuilder::new().title("Trashed").workspace_id(ws.id).trashed().insert(&conn);

    let result = tauri_app_lib::services::notes::list_notes(&conn, Some(ws.id))
        .expect("list_notes filtered");
    assert_eq!(result.len(), 1, "trashed note should be excluded");
    assert_eq!(result[0].title, "Active");
}

// Gap: list_notes returns notes with workspace_id populated
#[test]
fn test_list_notes_preserves_workspace_id() {
    let conn = setup_test_db();
    let ws = workspace_service::create_workspace(&conn, "Project", "/path/project")
        .expect("create_workspace failed");

    // One note with workspace, one without
    NoteBuilder::new().workspace_id(ws.id).title("Scoped").insert(&conn);
    NoteBuilder::new().title("Unscoped").insert(&conn);

    let notes = tauri_app_lib::services::notes::list_notes(&conn, None).expect("list_notes failed");
    assert_eq!(notes.len(), 2);

    let scoped = notes.iter().find(|n| n.title == "Scoped").expect("scoped note missing");
    let unscoped = notes.iter().find(|n| n.title == "Unscoped").expect("unscoped note missing");

    assert_eq!(scoped.workspace_id, Some(ws.id), "scoped note should have workspace_id");
    assert!(unscoped.workspace_id.is_none(), "unscoped note should have NULL workspace_id");
}

// Gap: update_note does not clobber workspace_id
#[test]
fn test_update_note_preserves_workspace_id() {
    let conn = setup_test_db();
    let ws = workspace_service::create_workspace(&conn, "Project", "/path/project")
        .expect("create_workspace failed");

    let note = tauri_app_lib::services::notes::create_note(&conn, "markdown", Some(ws.id))
        .expect("create_note failed");
    assert_eq!(note.workspace_id, Some(ws.id));

    // Update title and content — workspace_id should remain unchanged
    let updated = tauri_app_lib::services::notes::update_note(
        &conn,
        note.id,
        Some("Updated Title".to_string()),
        Some("Updated content".to_string()),
        None,
    )
    .expect("update_note failed");

    assert_eq!(updated.workspace_id, Some(ws.id), "update_note should not clobber workspace_id");
}

// UNIT-2.3-008: tauri-specta generates resolveWorkspace binding
#[test]
fn test_typescript_bindings_contain_resolve_workspace() {
    let bindings = std::fs::read_to_string("../src/generated/bindings.ts")
        .expect("bindings.ts should exist after build");

    assert!(
        bindings.contains("resolveWorkspace"),
        "bindings should contain resolveWorkspace command"
    );
    assert!(
        bindings.contains("getCurrentDir"),
        "bindings should contain getCurrentDir command"
    );
}
