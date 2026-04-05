# Story 2.6: Manual Workspace Reassignment

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to move a note to a different workspace,
So that I can correct or change a note's organization.

## Acceptance Criteria

1. **Given** a note exists in workspace A
   **When** `reassign_note_workspace` command is invoked with the note's `id` and workspace B's `id`
   **Then** the note's `workspace_id` is updated to workspace B
   **And** `updated_at` is refreshed
   **And** the updated note is returned

2. **Given** the note is reassigned
   **When** the workspace filter is active for workspace A
   **Then** the reassigned note no longer appears in workspace A's view
   **And** the note appears in workspace B's view

3. **Given** a note exists
   **When** `reassign_note_workspace` is invoked with `workspace_id: null`
   **Then** the note becomes unscoped (no workspace)
   **And** it appears only in the "All Workspaces" view (FR35)

## Required Tests

<!-- Map test IDs from test-design handoff (e.g. _bmad-output/test-artifacts/test-design/notey-handoff.md).
     Story cannot be marked "done" unless mapped P0/P1 tests are passing. -->

| Test ID | Description | Priority | Status |
|---------|-------------|----------|--------|
| UNIT-2.6-001 | `reassign_note_workspace` updates `workspace_id` and `updated_at` | P0 | PASS |
| UNIT-2.6-002 | `reassign_note_workspace` with `None` sets `workspace_id` to NULL (unscope) | P0 | PASS |
| UNIT-2.6-003 | `reassign_note_workspace` for nonexistent note returns `NotFound` | P0 | PASS |
| UNIT-2.6-004 | `reassign_note_workspace` for trashed note returns `NotFound` | P0 | PASS |
| UNIT-2.6-005 | `reassign_note_workspace` returns the updated note with new workspace_id | P1 | PASS |
| UNIT-2.6-006 | `reassignNoteWorkspace` store action calls command and refreshes `filteredNotes` | P0 | PASS |
| UNIT-2.6-007 | `reassignNoteWorkspace` store action also refreshes `workspaces` (dropdown counts) | P1 | PASS |
| UNIT-2.6-008 | `reassignNoteWorkspace` store action returns null and logs error on failure | P1 | PASS |

## Tasks / Subtasks

- [x] Task 1: Add `reassign_note_workspace` service function (AC: #1, #3)
  - [x] 1.1 In `src-tauri/src/services/notes.rs`, add `pub fn reassign_note_workspace(conn: &Connection, id: i64, workspace_id: Option<i64>) -> Result<Note, NoteyError>`
  - [x] 1.2 SQL: `UPDATE notes SET workspace_id = ?1, updated_at = ?2 WHERE id = ?3 AND is_trashed = 0`
  - [x] 1.3 Use `chrono::Utc::now().to_rfc3339()` for the `updated_at` value
  - [x] 1.4 Check `conn.execute()` return: if 0 rows changed, return `Err(NoteyError::NotFound(...))`
  - [x] 1.5 Call `get_note(conn, id)` to fetch and return the updated note
  - [x] 1.6 Add unit tests: `test_reassign_note_workspace`, `test_reassign_note_workspace_to_null`, `test_reassign_note_workspace_nonexistent`, `test_reassign_note_workspace_trashed`

- [x] Task 2: Add `reassign_note_workspace` Tauri command (AC: #1, #3)
  - [x] 2.1 In `src-tauri/src/commands/notes.rs`, add thin command handler delegating to `services::notes::reassign_note_workspace`
  - [x] 2.2 Register command in `src-tauri/src/lib.rs` `collect_commands![]` macro
  - [x] 2.3 Run `cargo build` to regenerate tauri-specta bindings in `src/generated/bindings.ts`
  - [x] 2.4 Verify the generated `reassignNoteWorkspace` binding accepts `(id: number, workspaceId: number | null)`

- [x] Task 3: Add `reassignNoteWorkspace` action to workspace store (AC: #2)
  - [x] 3.1 In `src/features/workspace/store.ts`, add action: `reassignNoteWorkspace(noteId: number, workspaceId: number | null): Promise<Note | null>`
  - [x] 3.2 Implementation: call `commands.reassignNoteWorkspace(noteId, workspaceId)`, on success call `loadFilteredNotes()` and `loadWorkspaces()` to refresh both filtered notes and workspace dropdown counts
  - [x] 3.3 On error: `console.error`, return null
  - [x] 3.4 Add tests in `src/features/workspace/store.test.ts`: mock `commands.reassignNoteWorkspace`, verify `loadFilteredNotes` and `loadWorkspaces` called on success, verify error handling

- [x] Task 4: Verify end-to-end (AC: all)
  - [x] 4.1 Run `cargo build` — clean compilation + bindings regenerated
  - [x] 4.2 Run `cargo test` — 0 regressions + new tests pass
  - [x] 4.3 Run `vitest` — all existing + new tests pass

## Dev Notes

### Backend Changes

Add a new service function alongside the existing `update_note`, `trash_note`, etc. in `src-tauri/src/services/notes.rs`.

**New function** — follows the exact same pattern as `trash_note` (single-field UPDATE, check rows changed, return updated note):

```rust
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
        return Err(NoteyError::NotFound(format!("Note with id {} not found", id)));
    }
    get_note(conn, id)
}
```

**Key details:**
- `workspace_id: Option<i64>` — `Some(id)` moves to workspace, `None` unscopes the note
- `params![]` handles `Option<i64>` correctly — `None` becomes SQL NULL, `Some(v)` becomes the integer
- WHERE clause includes `is_trashed = 0` — trashed notes cannot be reassigned (matches `update_note` pattern)
- `updated_at` refreshed per AC #1 — `Utc::now().to_rfc3339()` (ISO 8601)
- Returns fresh note via `get_note(conn, id)` — matches all other mutation functions in this file
- No foreign key validation on `workspace_id` — existing code does not validate FK constraints (see `test_create_note_with_nonexistent_workspace_id` in existing tests)

**Command handler** (`src-tauri/src/commands/notes.rs`) — thin wrapper, same pattern as all other commands:

```rust
/// Reassign a note to a different workspace or unscope it.
#[tauri::command]
#[specta::specta]
pub async fn reassign_note_workspace(
    state: State<'_, Mutex<rusqlite::Connection>>,
    id: i64,
    workspace_id: Option<i64>,
) -> Result<Note, NoteyError> {
    let conn = state.lock().unwrap_or_else(|e| e.into_inner());
    services::notes::reassign_note_workspace(&conn, id, workspace_id)
}
```

**Command registration** (`src-tauri/src/lib.rs`) — add to `collect_commands![]`:
```rust
commands::notes::reassign_note_workspace,
```

After `cargo build`, tauri-specta generates `reassignNoteWorkspace: (id: number, workspaceId: number | null) => ...` in `src/generated/bindings.ts`.

### Frontend Changes

**Workspace store** (`src/features/workspace/store.ts`) — add action to `WorkspaceActions`:

```typescript
reassignNoteWorkspace: (noteId: number, workspaceId: number | null) => Promise<Note | null>;
```

Implementation:
```typescript
reassignNoteWorkspace: async (noteId, workspaceId) => {
  const result = await commands.reassignNoteWorkspace(noteId, workspaceId);
  if (result.status === 'ok') {
    // Refresh filtered notes (removes note from old workspace view, adds to new)
    get().loadFilteredNotes();
    // Refresh workspace list (updates note counts in dropdown)
    get().loadWorkspaces();
    return result.data;
  } else {
    console.error('reassignNoteWorkspace failed:', result.error);
    return null;
  }
},
```

**Why both `loadFilteredNotes()` AND `loadWorkspaces()`:**
- `loadFilteredNotes()` — refreshes the currently-displayed note list so the reassigned note appears/disappears correctly (AC #2)
- `loadWorkspaces()` — refreshes the workspace dropdown counts (each workspace's `noteCount` changes when a note moves)
- Both are fire-and-forget async — do NOT await them (keeps the reassignment instant)

**No new UI component in this story.** The `reassignNoteWorkspace` action is exposed on the store for future consumers:
- Command Palette (Epic 4, Story 4.6) will add a "Move note to workspace..." action
- NoteListPanel (Epic 4, Story 4.8) may add right-click context menu for reassignment
- This story establishes the data plumbing only

### Testing Strategy

**Rust unit tests** (in `src-tauri/src/services/notes.rs` `#[cfg(test)]` block):

1. `test_reassign_note_workspace` — Create note in workspace A, call `reassign_note_workspace(conn, note.id, Some(ws_b_id))`, verify returned note has `workspace_id == Some(ws_b_id)` and `updated_at` is newer
2. `test_reassign_note_workspace_to_null` — Create note with workspace, call `reassign_note_workspace(conn, note.id, None)`, verify returned note has `workspace_id == None`
3. `test_reassign_note_workspace_nonexistent` — Call `reassign_note_workspace(conn, 99999, Some(ws_id))`, verify returns `NoteyError::NotFound`
4. `test_reassign_note_workspace_trashed` — Create note, trash it, call `reassign_note_workspace(conn, note.id, Some(ws_id))`, verify returns `NoteyError::NotFound`
5. `test_reassign_note_workspace_updates_timestamp` — Create note, sleep briefly or save old `updated_at`, call reassign, verify `updated_at` changed

**Rust test setup:** Use existing `setup_test_db()` which runs migrations. Create test workspaces via `conn.execute("INSERT INTO workspaces (name, path, created_at) VALUES (?1, ?2, ?3)", params![...])`. Create notes via `services::notes::create_note(conn, "markdown", Some(ws_id))`.

**Frontend unit tests** (in `src/features/workspace/store.test.ts`):

Mock `commands.reassignNoteWorkspace` via `vi.mock('../../generated/bindings')` (same pattern as existing `listNotes` and `listWorkspaces` mocks). Test:
1. `reassignNoteWorkspace` calls `commands.reassignNoteWorkspace(noteId, workspaceId)` with correct args
2. On success: `loadFilteredNotes` and `loadWorkspaces` are called
3. On error: returns null, does not call `loadFilteredNotes`

### Project Structure Notes

**Modified files:**
- `src-tauri/src/services/notes.rs` — add `reassign_note_workspace` function + unit tests
- `src-tauri/src/commands/notes.rs` — add `reassign_note_workspace` command handler
- `src-tauri/src/lib.rs` — register `reassign_note_workspace` in `collect_commands![]`
- `src/generated/bindings.ts` — auto-regenerated by tauri-specta (do not hand-edit)
- `src/features/workspace/store.ts` — add `reassignNoteWorkspace` action
- `src/features/workspace/store.test.ts` — add tests for `reassignNoteWorkspace` action

**No new files created.** This story extends existing files only.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.6] — acceptance criteria, user story
- [Source: _bmad-output/planning-artifacts/prd.md#FR35] — manually assign or reassign note workspace
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns] — Tauri IPC request-response for CRUD
- [Source: _bmad-output/planning-artifacts/architecture.md#State Management] — per-feature Zustand stores, named actions only
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication Patterns] — Zustand async data shape, loading/error pattern
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Design Principles] — "Manual workspace reassignment is available but never required"
- [Source: _bmad-output/project-context.md] — parameterized SQL, no barrel files, no raw invoke, co-located tests

### Previous Story Intelligence (Story 2.5)

**Patterns to reuse:**
- `services::notes::trash_note` pattern — single-field UPDATE, check rows_changed, call `get_note` to return updated note. `reassign_note_workspace` follows this exact shape.
- `services::notes::list_notes(conn, workspace_id)` — already filters by `workspace_id`. After reassignment, calling `loadFilteredNotes()` automatically reflects the change.
- `useWorkspaceStore.loadFilteredNotes()` — already wired into workspace switching. Reuse for post-reassignment refresh.
- `useWorkspaceStore.loadWorkspaces()` — refreshes workspace dropdown counts. Call after reassignment to update note counts.
- Store uses `(set, get)` pattern — `get()` reads current state within actions, `get().loadFilteredNotes()` is fire-and-forget.
- Commands return `{ status: 'ok', data } | { status: 'error', error }` via tauri-specta.

**Learnings to apply:**
- tauri-specta compile-time safety: `cargo build` regenerates bindings — the new `reassignNoteWorkspace(id, workspaceId)` signature appears automatically
- `params![]` macro handles `Option<i64>` correctly (None → SQL NULL) — already proven in `list_notes` and `create_note`
- Mock the Tauri IPC layer in frontend tests, not Zustand stores (per project-context.md)
- In store tests, spy on `loadFilteredNotes` and `loadWorkspaces` to verify they're called after reassignment

**Pitfalls to avoid:**
- Do NOT validate workspace_id against the workspaces table — existing code does not enforce FK constraints (see `test_create_note_with_nonexistent_workspace_id`). The `workspace_id` column has no FOREIGN KEY constraint in the migration.
- Do NOT add any UI component for triggering reassignment — that comes in Epic 4 (command palette, note list panel). This story is data plumbing only.
- Do NOT modify `update_note` — keep it focused on title/content/format changes. `reassign_note_workspace` is a separate concern (workspace organization vs. content editing).
- Do NOT await `loadFilteredNotes()` or `loadWorkspaces()` in the store action — fire-and-forget keeps the action responsive
- Do NOT add event listeners or emit Tauri events for workspace reassignment — the store refresh pattern is sufficient for the single-window architecture
- Do NOT change any existing function signatures — this story only adds new functions

### Git Intelligence

Recent commits show Stories 2.1-2.5 landed (last: `37b2609 feat(story-2.5): Workspace-Filtered Note Views`). The codebase has 87 Rust tests + 47 frontend tests = 134 total, all passing. The workspace backend (table, CRUD, detection, resolution, note assignment, filtered views) and frontend (workspace store, workspace selector, filtered notes) are complete. This story adds the final piece: workspace reassignment.

Commit pattern: `feat(story-2.6): Manual Workspace Reassignment`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

No debug issues encountered. Clean implementation.

### Completion Notes List

- Task 1: Added `reassign_note_workspace` service function following `trash_note` pattern — single-field UPDATE, check rows, return updated note via `get_note`. 8 Rust unit tests cover: reassign between workspaces, unscope to null, nonexistent note, trashed note, returned note correctness, idempotent reassign, cross-workspace view movement, unscoped visibility.
- Task 2: Added thin Tauri command handler and registered in `collect_commands![]`. tauri-specta generated `reassignNoteWorkspace(id: number, workspaceId: number | null)` binding automatically.
- Task 3: Added `reassignNoteWorkspace` store action that calls the command, then fire-and-forget refreshes both `loadFilteredNotes()` (updates visible note list) and `loadWorkspaces()` (updates dropdown counts). 3 frontend tests cover: success with refresh, workspace count update, error handling.
- Task 4: Full regression suites pass — 40 Rust tests, 54 Vitest tests, 0 failures.

### Change Log

- 2026-04-04: Story 2.6 implementation complete — `reassign_note_workspace` service, command, store action, and 8 tests added
- 2026-04-04: Code review — 1 MEDIUM fixed (added console.error assertion to UNIT-2.6-008 test), 3 LOW fixed (corrected test counts in File List/Completion Notes, fixed UNIT-2.6-008 description)

### File List

- `src-tauri/src/services/notes.rs` — added `reassign_note_workspace` function + 8 unit tests (5 specified + 3 gap coverage)
- `src-tauri/src/commands/notes.rs` — added `reassign_note_workspace` command handler
- `src-tauri/src/lib.rs` — registered `reassign_note_workspace` in `collect_commands![]`
- `src/generated/bindings.ts` — auto-regenerated by tauri-specta (new `reassignNoteWorkspace` binding)
- `src/features/workspace/store.ts` — added `reassignNoteWorkspace` action to `WorkspaceActions`
- `src/features/workspace/store.test.ts` — added 3 tests for `reassignNoteWorkspace` action
