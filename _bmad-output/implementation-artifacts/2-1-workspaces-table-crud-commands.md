# Story 2.1: Workspaces Table & CRUD Commands

Status: done

## Story

As a developer,
I want a workspaces table and backend commands for workspace management,
So that notes can be associated with project workspaces.

## Acceptance Criteria

1. **Given** the existing database with notes table
   **When** a new migration is added
   **Then** it creates the `workspaces` table with columns: `id` INTEGER PRIMARY KEY, `name` TEXT NOT NULL, `path` TEXT NOT NULL UNIQUE, `created_at` TEXT NOT NULL (ISO 8601)
   **And** an index `idx_workspaces_path` is created on the `path` column

2. **Given** the workspaces table exists
   **When** `create_workspace` command is invoked with `name` and `path`
   **Then** a new workspace is inserted and returned with its assigned `id`
   **And** if a workspace with the same `path` already exists, the existing workspace is returned (upsert behavior)

3. **Given** workspaces exist
   **When** `list_workspaces` command is invoked
   **Then** all workspaces are returned with their note counts (count of non-trashed notes per workspace)
   **And** results are ordered by `name` ASC

4. **Given** a workspace exists
   **When** `get_workspace` command is invoked with a valid `id`
   **Then** the workspace record is returned with its note count

5. **Given** all commands are registered with tauri-specta
   **When** `cargo build` completes
   **Then** typed TypeScript bindings are generated for all workspace commands

## Required Tests

| Test ID | Description | Priority | Status |
|---------|-------------|----------|--------|
| UNIT-2.1-001 | `workspaces` table created with correct schema by migration | P0 | passing |
| UNIT-2.1-002 | `idx_workspaces_path` index exists after migration | P0 | passing |
| UNIT-2.1-003 | `create_workspace` inserts new workspace and returns it with `id` | P0 | passing |
| UNIT-2.1-004 | `create_workspace` returns existing workspace when `path` already exists (upsert) | P0 | passing |
| UNIT-2.1-005 | `list_workspaces` returns all workspaces with correct note counts, ordered by `name` ASC | P0 | passing |
| UNIT-2.1-006 | `list_workspaces` note count excludes trashed notes (`is_trashed = 1`) | P1 | passing |
| UNIT-2.1-007 | `get_workspace` returns workspace with note count for valid `id` | P0 | passing |
| UNIT-2.1-008 | `get_workspace` returns `NoteyError::NotFound` for invalid `id` | P1 | passing |
| UNIT-2.1-009 | Migration applies cleanly on existing DB with notes (forward-only) | P1 | passing |
| UNIT-2.1-010 | tauri-specta generates TypeScript bindings for all 3 workspace commands | P0 | passing |

## Tasks / Subtasks

- [x] Task 1: Add database migration for `workspaces` table (AC: #1)
  - [x] 1.1 Add second migration to `MIGRATIONS_SLICE` in `src-tauri/src/db/mod.rs` — creates `workspaces` table and `idx_workspaces_path` index
  - [x] 1.2 Verify migration applies on fresh DB and on existing DB with notes data
- [x] Task 2: Create `Workspace` and `WorkspaceInfo` models (AC: #2, #3, #4)
  - [x] 2.1 Create `src-tauri/src/models/workspace.rs` with `Workspace` struct (id, name, path, created_at) and `WorkspaceInfo` struct (workspace fields + note_count)
  - [x] 2.2 Add `pub mod workspace;` to `src-tauri/src/models/mod.rs`
- [x] Task 3: Create workspace repository (AC: #2, #3, #4)
  - [x] 3.1 Create `src-tauri/src/db/workspace_repo.rs` with parameterized SQL queries for: insert workspace, select by path, select by id with note count, select all with note counts
  - [x] 3.2 Add `pub mod workspace_repo;` to `src-tauri/src/db/mod.rs`
- [x] Task 4: Create workspace service (AC: #2, #3, #4)
  - [x] 4.1 Create `src-tauri/src/services/workspace_service.rs` with `create_workspace`, `list_workspaces`, `get_workspace` functions
  - [x] 4.2 `create_workspace` implements upsert: try insert, on UNIQUE constraint conflict for `path`, return existing
  - [x] 4.3 Add `pub mod workspace_service;` to `src-tauri/src/services/mod.rs`
- [x] Task 5: Create workspace Tauri commands (AC: #2, #3, #4, #5)
  - [x] 5.1 Create `src-tauri/src/commands/workspace.rs` with thin handlers: `create_workspace`, `list_workspaces`, `get_workspace`
  - [x] 5.2 Add `pub mod workspace;` to `src-tauri/src/commands/mod.rs`
  - [x] 5.3 Register all 3 commands in `specta_builder()` in `src-tauri/src/lib.rs`
  - [x] 5.4 Add workspace command permissions to `src-tauri/capabilities/default.json`
- [x] Task 6: Write tests (AC: all)
  - [x] 6.1 Add workspace integration tests in `src-tauri/tests/workspace_tests.rs` using existing `setup_test_db` + `NoteBuilder` factories
  - [x] 6.2 Verify tauri-specta TypeScript bindings include workspace commands and types after build
- [x] Task 7: Verify end-to-end (AC: #5)
  - [x] 7.1 Run `cargo build` — confirm clean compilation
  - [x] 7.2 Confirm `src/generated/bindings.ts` contains `createWorkspace`, `listWorkspaces`, `getWorkspace` functions and `Workspace`/`WorkspaceInfo` types

## Dev Notes

### Database Migration

**Critical:** This is the second migration. `rusqlite_migration` applies migrations in order. Add the new migration as the second element in `MIGRATIONS_SLICE` in `src-tauri/src/db/mod.rs`.

```rust
// Add as second element in MIGRATIONS_SLICE array:
M::up(
    "CREATE TABLE IF NOT EXISTS workspaces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_workspaces_path ON workspaces(path);"
)
```

**Note on `notes.workspace_id` FK:** The existing `notes` table has `workspace_id INTEGER NULL` without a REFERENCES clause. SQLite does not support `ALTER TABLE ADD CONSTRAINT`. Referential integrity for `workspace_id` must be enforced at the service layer — validate workspace exists before assigning. Do NOT attempt to recreate the notes table to add a FK constraint.

### Model Definitions

Both models need `#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]` and `#[serde(rename_all = "camelCase")]`.

**`Workspace`** — maps directly to the `workspaces` table row:
- `id: i64`
- `name: String`
- `path: String`
- `created_at: String` (ISO 8601)

**`WorkspaceInfo`** — returned by `list_workspaces` and `get_workspace`, includes aggregated data:
- All `Workspace` fields + `note_count: i64`

Design choice: Use a flat struct (not Workspace + note_count wrapper) for `WorkspaceInfo` to keep the IPC payload simple.

### Repository Layer — SQL Queries

All queries in `src-tauri/src/db/workspace_repo.rs`. All queries MUST use parameterized statements (`?1`, `?2` params). No string interpolation.

**Insert workspace:**
```sql
INSERT INTO workspaces (name, path, created_at) VALUES (?1, ?2, ?3)
```

**Select by path** (for upsert check):
```sql
SELECT id, name, path, created_at FROM workspaces WHERE path = ?1
```

**Select by id with note count:**
```sql
SELECT w.id, w.name, w.path, w.created_at,
       COUNT(n.id) AS note_count
FROM workspaces w
LEFT JOIN notes n ON n.workspace_id = w.id AND n.is_trashed = 0
WHERE w.id = ?1
GROUP BY w.id
```

**Select all with note counts:**
```sql
SELECT w.id, w.name, w.path, w.created_at,
       COUNT(n.id) AS note_count
FROM workspaces w
LEFT JOIN notes n ON n.workspace_id = w.id AND n.is_trashed = 0
GROUP BY w.id
ORDER BY w.name ASC
```

### Service Layer — Upsert Pattern

`create_workspace(conn, name, path)`:
1. Try `INSERT` — if succeeds, return new workspace
2. On `UNIQUE constraint failed: workspaces.path` error, query by path and return existing
3. Alternative: use `INSERT OR IGNORE` + `SELECT` — but explicit error handling is clearer and matches the project's error pattern

Use `chrono::Utc::now().to_rfc3339()` for `created_at` timestamp.

All service functions accept `&Connection` and return `Result<T, NoteyError>`. Follow the exact pattern established in `src-tauri/src/services/notes.rs`.

### Command Layer

Thin handlers in `src-tauri/src/commands/workspace.rs`. Each command:
1. Extracts `State<Mutex<Connection>>` from Tauri
2. Locks the mutex
3. Delegates to service function
4. Returns result

Follow the exact pattern in `src-tauri/src/commands/notes.rs`.

**Command signatures:**
- `create_workspace(name: String, path: String)` → `Result<Workspace, NoteyError>`
- `list_workspaces()` → `Result<Vec<WorkspaceInfo>, NoteyError>`
- `get_workspace(id: i64)` → `Result<WorkspaceInfo, NoteyError>`

### tauri-specta Registration

Add to `specta_builder()` in `src-tauri/src/lib.rs`:
```rust
commands::workspace::create_workspace,
commands::workspace::list_workspaces,
commands::workspace::get_workspace,
```

### Capability ACL

Add workspace command permissions to `src-tauri/capabilities/default.json`. Follow the existing pattern for note commands in that file.

### Testing Strategy

Use the existing test infrastructure:
- `setup_test_db()` from `src-tauri/tests/helpers/factories.rs` — creates temp SQLite DB with all migrations applied
- `NoteBuilder` — create test notes with specific `workspace_id` values to verify note counts
- Tests go in `src-tauri/tests/` as integration tests (service functions are the primary test target per project conventions)

**Key test scenarios:**
1. Create workspace → verify returned fields
2. Create workspace with duplicate path → verify returns existing (not error)
3. List workspaces with mixed trashed/non-trashed notes → verify counts exclude trashed
4. Get workspace by valid id → verify note count
5. Get workspace by invalid id → verify NotFound error
6. Migration on fresh DB and on DB with existing notes

### Project Structure Notes

Files to create (all new):
- `src-tauri/src/models/workspace.rs` — Workspace, WorkspaceInfo structs
- `src-tauri/src/db/workspace_repo.rs` — parameterized SQL queries
- `src-tauri/src/services/workspace_service.rs` — business logic
- `src-tauri/src/commands/workspace.rs` — thin Tauri command handlers

Files to modify:
- `src-tauri/src/db/mod.rs` — add migration #2, add `pub mod workspace_repo`
- `src-tauri/src/models/mod.rs` — add `pub mod workspace`
- `src-tauri/src/services/mod.rs` — add `pub mod workspace_service`
- `src-tauri/src/commands/mod.rs` — add `pub mod workspace`
- `src-tauri/src/lib.rs` — register 3 new commands in `specta_builder()`
- `src-tauri/capabilities/main-window.json` — add workspace command permissions

No frontend changes in this story. Frontend workspace feature (store, UI) comes in Stories 2.3-2.6.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture] — workspaces table schema, FTS5 design
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns] — database naming, Rust naming, cross-boundary serialization
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns] — module style, test organization
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns] — command naming (verb_noun), error handling
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries] — file locations for commands/, services/, db/, models/
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1] — acceptance criteria, BDD scenarios
- [Source: _bmad-output/project-context.md] — technology stack, critical rules, anti-patterns
- [Source: _bmad-output/implementation-artifacts/epic-1-retro-2026-04-04.md] — test factories, patterns established

### Previous Story Intelligence (Epic 1)

**Patterns to reuse:**
- Service functions accept `&Connection` — established in `services/notes.rs`
- Command handlers use `State<Mutex<Connection>>` — established in `commands/notes.rs`
- `NoteBuilder` test factory + `setup_test_db()` — for integration tests with workspace data
- `chrono::Utc::now().to_rfc3339()` for timestamps — consistent with notes
- `NoteyError::NotFound` for missing records — same pattern as `get_note`

**Learnings to apply:**
- tauri-specta compile-time safety catches type mismatches immediately — trust it, don't manually verify TS types
- All IPC structs MUST have `#[serde(rename_all = "camelCase")]` — Epic 1 had zero mismatches because of this
- Test with real SQLite (temp DB) not mocks — established pattern, works well
- `rusqlite_migration` applies migrations sequentially — just append to the slice

**Pitfalls to avoid:**
- Do NOT create barrel/index files — import from source directly
- Do NOT put business logic in command handlers — delegate to service layer
- Do NOT use string interpolation in SQL — parameterized queries only
- Do NOT add a FK constraint migration for `notes.workspace_id` — SQLite can't ALTER ADD CONSTRAINT

### Git Intelligence

Recent commits show Epic 1 is fully complete with all P0/P1 tests passing, CI pipeline operational, and all deferred work resolved. The codebase is clean and ready for Epic 2.

### Review Follow-ups (AI)

- [ ] [AI-Review][LOW] Add input validation for empty `name`/`path` in `create_workspace` service [workspace_service.rs:9-31] — empty strings create semantically invalid workspaces

## Change Log

- 2026-04-04: Implemented workspaces table migration, CRUD commands, service layer, repository layer, models, Tauri command registration, capability ACL, and comprehensive integration tests (11 tests covering all ACs)
- 2026-04-04: [Review] Fixed Required Tests table status (all → passing), added UNIT-2.1-010 automated test, fixed capability filename reference in Dev Notes

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Tauri v2 requires commands registered in both `specta_builder()` (lib.rs) and `AppManifest::commands()` (build.rs) for permission TOML generation. Capabilities can only reference permissions after build generates the TOML files.

### Completion Notes List

- AC #1: Migration #2 adds `workspaces` table with correct schema + `idx_workspaces_path` index. Verified on fresh and existing DBs.
- AC #2: `create_workspace` inserts new workspace; upsert returns existing on duplicate `path` (UNIQUE constraint catch).
- AC #3: `list_workspaces` returns all workspaces with non-trashed note counts, ordered by `name` ASC.
- AC #4: `get_workspace` returns workspace info with note count; returns `NoteyError::NotFound` for invalid id.
- AC #5: All 3 commands registered in tauri-specta; TypeScript bindings generated with `createWorkspace`, `listWorkspaces`, `getWorkspace` functions and `Workspace`/`WorkspaceInfo` types.
- All 11 workspace integration tests pass. Full test suite (38+ tests) passes with zero regressions. Clippy clean.

### File List

New files:
- src-tauri/src/models/workspace.rs
- src-tauri/src/db/workspace_repo.rs
- src-tauri/src/services/workspace_service.rs
- src-tauri/src/commands/workspace.rs
- src-tauri/tests/workspace_tests.rs
- src-tauri/permissions/autogenerated/create_workspace.toml
- src-tauri/permissions/autogenerated/list_workspaces.toml
- src-tauri/permissions/autogenerated/get_workspace.toml

Modified files:
- src-tauri/src/db/mod.rs
- src-tauri/src/models/mod.rs
- src-tauri/src/services/mod.rs
- src-tauri/src/commands/mod.rs
- src-tauri/src/lib.rs
- src-tauri/build.rs
- src-tauri/capabilities/default.json
- src-tauri/tests/acl_tests.rs
- src/generated/bindings.ts
