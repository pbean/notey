# Story 2.2: Git Repository Detection Service

Status: done

## Story

As a developer,
I want to detect git repositories from file system paths,
So that workspaces can be automatically identified.

## Acceptance Criteria

1. **Given** a file system path
   **When** `detect_workspace` Tauri command is invoked with that path
   **Then** the service walks up from the given path looking for a `.git` directory
   **And** if found, returns the repository root path and directory name as workspace name

2. **Given** a path inside a git repository (e.g., `/home/user/projects/myapp/src/`)
   **When** `detect_workspace` is invoked
   **Then** it returns `{ name: "myapp", path: "/home/user/projects/myapp" }`

3. **Given** a path that is NOT inside a git repository
   **When** `detect_workspace` is invoked
   **Then** it falls back to the given directory itself as the workspace (FR31)
   **And** returns `{ name: "dirname", path: "/the/given/path" }`

4. **Given** the detected path
   **When** it is validated
   **Then** `std::fs::canonicalize()` is used to resolve the real path
   **And** the path must resolve to an existing directory

5. **Given** the command is registered with tauri-specta
   **When** `cargo build` completes
   **Then** typed TypeScript bindings are generated for `detectWorkspace`

## Required Tests

| Test ID | Description | Priority | Status |
|---------|-------------|----------|--------|
| P1-UNIT-003 | `detect_workspace` finds git repo root from nested path | P0 | pass |
| P1-UNIT-004 | `detect_workspace` falls back to given directory for non-git paths | P0 | pass |
| UNIT-2.2-003 | `detect_workspace` returns correct name (directory basename) from git root | P0 | pass |
| UNIT-2.2-004 | `detect_workspace` canonicalizes paths (resolves symlinks/`.`/`..`) | P1 | pass |
| UNIT-2.2-005 | `detect_workspace` returns `Validation` error for non-existent path | P1 | pass |
| UNIT-2.2-006 | `detect_workspace` returns `Validation` error for path that is a file, not directory | P1 | pass |
| UNIT-2.2-007 | `detect_workspace` works at filesystem root (no infinite loop) | P1 | pass |
| UNIT-2.2-008 | `detect_workspace` works when invoked ON the git root directory itself | P0 | pass |
| UNIT-2.2-009 | tauri-specta generates `detectWorkspace` function and `DetectedWorkspace` type | P0 | pass |

## Tasks / Subtasks

- [x] Task 1: Create `DetectedWorkspace` model (AC: #1, #2, #3)
  - [x] 1.1 Add `DetectedWorkspace` struct to `src-tauri/src/models/workspace.rs` with fields: `name: String`, `path: String`
  - [x] 1.2 Apply `#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]` and `#[serde(rename_all = "camelCase")]`
- [x] Task 2: Implement `detect_workspace` service function (AC: #1, #2, #3, #4)
  - [x] 2.1 Add `detect_workspace(path: &str) -> Result<DetectedWorkspace, NoteyError>` to `src-tauri/src/services/workspace_service.rs`
  - [x] 2.2 Validate input: canonicalize path with `std::fs::canonicalize()`, verify it resolves to an existing directory
  - [x] 2.3 Walk-up algorithm: starting from canonicalized path, check for `.git` directory at each level; move to parent; stop at filesystem root
  - [x] 2.4 If `.git` found: return `DetectedWorkspace { name: dir_name, path: repo_root }`
  - [x] 2.5 If no `.git` found (reached root): fallback to the original canonicalized path as workspace (FR31)
  - [x] 2.6 Extract workspace name from directory basename via `Path::file_name()`
- [x] Task 3: Create `detect_workspace` Tauri command (AC: #1, #5)
  - [x] 3.1 Add `detect_workspace(path: String)` command to `src-tauri/src/commands/workspace.rs`
  - [x] 3.2 This command does NOT need `State<Mutex<Connection>>` — it is purely filesystem-based
  - [x] 3.3 Delegate to `services::workspace_service::detect_workspace`
- [x] Task 4: Register command and update capabilities (AC: #5)
  - [x] 4.1 Add `commands::workspace::detect_workspace` to `specta_builder()` in `src-tauri/src/lib.rs`
  - [x] 4.2 Add `"allow-detect-workspace"` to `src-tauri/capabilities/default.json`
- [x] Task 5: Write tests (AC: all)
  - [x] 5.1 Add git detection tests in `src-tauri/tests/workspace_tests.rs` — create temp dirs with `.git` subdirectories to simulate repos
  - [x] 5.2 Test nested path resolution: create `tmp/repo/.git/` and `tmp/repo/src/deep/`, call `detect_workspace("tmp/repo/src/deep/")`, verify returns repo root
  - [x] 5.3 Test fallback: create `tmp/no-git-dir/`, call `detect_workspace`, verify returns the directory itself
  - [x] 5.4 Test canonicalization: path with `..` segments resolves correctly
  - [x] 5.5 Test error cases: non-existent path, file path (not directory)
  - [x] 5.6 Test git root itself: `.git` in same directory as input
  - [x] 5.7 Verify tauri-specta bindings contain `detectWorkspace` function and `DetectedWorkspace` type
- [x] Task 6: Verify end-to-end (AC: #5)
  - [x] 6.1 Run `cargo build` — confirm clean compilation
  - [x] 6.2 Confirm `src/generated/bindings.ts` contains `detectWorkspace` function and `DetectedWorkspace` type

## Dev Notes

### DetectedWorkspace Model

Add to `src-tauri/src/models/workspace.rs` alongside existing `Workspace` and `WorkspaceInfo`:

```rust
/// Result of workspace detection from a filesystem path.
/// Contains the detected workspace name and canonical path, but no database id.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DetectedWorkspace {
    pub name: String,
    pub path: String,
}
```

This is NOT a database record — it has no `id` or `created_at`. It's the result of filesystem detection that Story 2.3 will later use to call `create_workspace` to persist.

### Service Implementation

Add to existing `src-tauri/src/services/workspace_service.rs`. This function is **pure filesystem** — it does NOT take `&Connection`.

```rust
use std::path::Path;

/// Detect a workspace by walking up from the given path looking for a `.git` directory.
/// Falls back to the given directory itself if no git repository is found (FR31).
pub fn detect_workspace(path: &str) -> Result<DetectedWorkspace, NoteyError> {
    let canonical = std::fs::canonicalize(path)
        .map_err(|_| NoteyError::Validation(format!("Path does not exist: {}", path)))?;

    if !canonical.is_dir() {
        return Err(NoteyError::Validation(format!(
            "Path is not a directory: {}",
            canonical.display()
        )));
    }

    // Walk up from canonical path looking for .git
    let mut current = canonical.clone();
    loop {
        if current.join(".git").exists() {
            let name = current
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "workspace".to_string());
            return Ok(DetectedWorkspace {
                name,
                path: current.to_string_lossy().to_string(),
            });
        }
        match current.parent() {
            Some(parent) if parent != current => current = parent.to_path_buf(),
            _ => break, // Reached filesystem root
        }
    }

    // Fallback: use the original directory itself (FR31)
    let name = canonical
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "workspace".to_string());
    Ok(DetectedWorkspace {
        name,
        path: canonical.to_string_lossy().to_string(),
    })
}
```

**Critical details:**
- `std::fs::canonicalize()` resolves symlinks, `.`, `..` — returns absolute real path
- `canonicalize` fails with IO error if path doesn't exist — we convert to `Validation` error for clearer IPC message
- `is_dir()` check prevents detecting from a file path
- Loop termination: `parent()` returns `None` at root on Unix; on some platforms `parent() == current` at root — guard both
- `file_name()` returns `None` for root path `/` — fallback name "workspace" handles this edge case
- No new crate dependencies — pure `std::path` and `std::fs`

### Command Handler

The command does **not** need database state. It's purely filesystem.

```rust
#[tauri::command]
#[specta::specta]
pub async fn detect_workspace(
    path: String,
) -> Result<DetectedWorkspace, NoteyError> {
    services::workspace_service::detect_workspace(&path)
}
```

Import `DetectedWorkspace` from `crate::models::workspace::DetectedWorkspace` in the command file.

### tauri-specta Registration

Add to `specta_builder()` in `src-tauri/src/lib.rs`:
```rust
commands::workspace::detect_workspace,
```

### Capability ACL

Add to `src-tauri/capabilities/default.json`:
```json
"allow-detect-workspace"
```

### Testing Strategy

Tests go in the existing `src-tauri/tests/workspace_tests.rs` file. Use `tempfile::TempDir` (already a dev-dependency) to create temporary directory structures.

**Test setup pattern:**
```rust
use tempfile::TempDir;

fn make_git_repo() -> TempDir {
    let dir = TempDir::new().unwrap();
    std::fs::create_dir(dir.path().join(".git")).unwrap();
    dir
}

fn make_nested_git_repo() -> (TempDir, std::path::PathBuf) {
    let dir = TempDir::new().unwrap();
    std::fs::create_dir(dir.path().join(".git")).unwrap();
    let nested = dir.path().join("src").join("deep");
    std::fs::create_dir_all(&nested).unwrap();
    (dir, nested)
}
```

**Key test scenarios:**
1. Nested path → finds `.git` at ancestor → returns ancestor path + name
2. No `.git` anywhere → returns the input directory itself (FR31 fallback)
3. `.git` in same directory → returns that directory
4. Path with `..` segments → canonicalized correctly
5. Non-existent path → `NoteyError::Validation`
6. File path (not dir) → `NoteyError::Validation`
7. Binding verification: `detectWorkspace` and `DetectedWorkspace` in `bindings.ts`

**Verify `tempfile` is available:**
Check `src-tauri/Cargo.toml` `[dev-dependencies]` for `tempfile`. If not present, add it. (Story 2.1 test `create_temp_db` already uses `tempdir` from the test helpers — confirm the exact crate.)

### Project Structure Notes

Files to modify:
- `src-tauri/src/models/workspace.rs` — add `DetectedWorkspace` struct
- `src-tauri/src/services/workspace_service.rs` — add `detect_workspace` function
- `src-tauri/src/commands/workspace.rs` — add `detect_workspace` command handler
- `src-tauri/src/lib.rs` — register `detect_workspace` in `specta_builder()`
- `src-tauri/capabilities/default.json` — add `"allow-detect-workspace"`
- `src-tauri/tests/workspace_tests.rs` — add detection tests

No new files created. No frontend changes. No new crate dependencies (pure `std::fs` + `std::path`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2] — acceptance criteria, BDD scenarios
- [Source: _bmad-output/planning-artifacts/architecture.md#Security] — path validation with `std::fs::canonicalize()`, workspace path must resolve to existing directory
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns] — command naming (verb_noun), error handling via NoteyError
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns] — module organization, test co-location
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns] — cross-boundary serialization with camelCase
- [Source: _bmad-output/project-context.md] — technology stack, critical rules, anti-patterns
- [Source: _bmad-output/test-artifacts/test-design/test-design-qa.md] — P1-UNIT-003 (git detection), P1-UNIT-004 (fallback)

### Previous Story Intelligence (Story 2.1)

**Patterns to reuse:**
- `DetectedWorkspace` model follows same derive pattern as `Workspace` and `WorkspaceInfo` in `models/workspace.rs`
- Command handler pattern from `commands/workspace.rs` — but this one skips the `State<Mutex<Connection>>` parameter since no DB needed
- Test file already exists at `src-tauri/tests/workspace_tests.rs` — append new tests there
- `NoteyError::Validation(String)` variant already exists for input validation errors

**Learnings to apply:**
- tauri-specta compile-time safety catches type mismatches immediately — if it compiles, bindings are correct
- All IPC structs MUST have `#[serde(rename_all = "camelCase")]` — zero exceptions
- Test with real filesystem (temp dirs) not mocks — consistent with the "real SQLite" testing philosophy
- Capability ACL must include the new permission or the command silently fails from frontend

**Pitfalls to avoid:**
- Do NOT use the `git2` crate — the AC specifies walking up looking for `.git` directory, which is pure `std::fs`. Adding `git2` would be a heavy dependency (~4MB) for a simple directory check.
- Do NOT create a new test file — add to existing `workspace_tests.rs`
- Do NOT put walk-up logic in the command handler — delegate to service layer
- Do NOT use string interpolation in path construction — use `Path::join()`
- Do NOT forget `#[specta::specta]` attribute on the command

### Git Intelligence

Recent commits show Story 2.1 is complete with all tests passing. The codebase has workspace CRUD in place. This story builds on that foundation by adding the detection mechanism. The pattern of service → command → registration → capability → test is well-established.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- ACL test `test_no_unexpected_custom_commands` failed initially — needed to add `allow-detect-workspace` to `EXPECTED_COMMANDS` in `acl_tests.rs`
- Permission file `detect_workspace.toml` was not auto-generated — created manually in `permissions/autogenerated/`

### Completion Notes List

- Added `DetectedWorkspace` struct to `models/workspace.rs` alongside existing `Workspace` and `WorkspaceInfo`
- Implemented `detect_workspace` service function with walk-up `.git` detection and FR31 fallback, using pure `std::fs` and `std::path`
- Added thin Tauri command handler (no DB state needed — purely filesystem)
- Registered in `specta_builder()`, added capability ACL permission, and created permission TOML
- Updated ACL guard test to include new command
- All 9 required tests implemented and passing: nested path detection, fallback, basename, canonicalization, error cases, root safety, git-root-itself, bindings verification
- Full regression suite: 69 tests, 0 failures
- TypeScript bindings confirmed: `detectWorkspace` function and `DetectedWorkspace` type in `bindings.ts`

### Change Log

- 2026-04-04: Story 2.2 implemented — git repository detection service with all ACs satisfied
- 2026-04-04: Code review — fixed misleading canonicalize error message (MEDIUM), improved root path test error specificity (LOW), corrected test count in completion notes (LOW). 0 CRITICAL, all ACs verified.

### File List

- `src-tauri/src/models/workspace.rs` — added `DetectedWorkspace` struct
- `src-tauri/src/services/workspace_service.rs` — added `detect_workspace` function
- `src-tauri/src/commands/workspace.rs` — added `detect_workspace` command handler
- `src-tauri/src/lib.rs` — registered `detect_workspace` in `specta_builder()`
- `src-tauri/capabilities/default.json` — added `allow-detect-workspace`
- `src-tauri/permissions/autogenerated/detect_workspace.toml` — new permission definition
- `src-tauri/tests/workspace_tests.rs` — added 9 detection tests
- `src-tauri/tests/acl_tests.rs` — added `allow-detect-workspace` to expected commands
- `src/generated/bindings.ts` — regenerated with `detectWorkspace` and `DetectedWorkspace`
