# Story 2.5: Workspace-Filtered Note Views

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to see only the notes in my current workspace,
So that I can focus on relevant notes.

## Acceptance Criteria

1. **Given** a workspace is active (`activeWorkspaceId` is set)
   **When** `list_notes` command is invoked with `workspace_id` parameter
   **Then** only non-trashed notes with matching `workspace_id` are returned (FR33)
   **And** results are ordered by `updated_at` DESC

2. **Given** "All Workspaces" is selected (`isAllWorkspaces: true`)
   **When** `list_notes` command is invoked without `workspace_id`
   **Then** all non-trashed notes across all workspaces are returned (FR34)

3. **Given** the workspace filter changes
   **When** the frontend receives the updated note list
   **Then** any note list or count display refreshes to reflect the current scope
   **And** the StatusBar note count updates accordingly

## Required Tests

<!-- Map test IDs from test-design handoff (e.g. _bmad-output/test-artifacts/test-design/notey-handoff.md).
     Story cannot be marked "done" unless mapped P0/P1 tests are passing. -->

| Test ID | Description | Priority | Status |
|---------|-------------|----------|--------|
| UNIT-2.5-001 | `list_notes` with `workspace_id` returns only notes in that workspace | P0 | PASS |
| UNIT-2.5-002 | `list_notes` with `None` workspace_id returns all non-trashed notes | P0 | PASS |
| UNIT-2.5-003 | `list_notes` results are ordered by `updated_at` DESC | P0 | PASS |
| UNIT-2.5-004 | `list_notes` with `workspace_id` excludes trashed notes | P0 | PASS |
| UNIT-2.5-005 | `list_notes` with `workspace_id` that has no notes returns empty vec | P1 | PASS |
| UNIT-2.5-006 | `useWorkspaceStore.loadFilteredNotes()` calls `listNotes` with active workspace id | P0 | PASS |
| UNIT-2.5-007 | `useWorkspaceStore.loadFilteredNotes()` calls `listNotes(null)` when `isAllWorkspaces` | P0 | PASS |
| UNIT-2.5-008 | `filteredNotes` state updates after workspace switch + `loadFilteredNotes()` | P1 | PASS |
| UNIT-2.5-009 | StatusBar note count reflects filtered notes count for active workspace | P1 | PASS |

## Tasks / Subtasks

- [x] Task 1: Add `workspace_id` parameter to `list_notes` service layer (AC: #1, #2)
  - [x] 1.1 Modify `services::notes::list_notes(conn)` signature to `list_notes(conn, workspace_id: Option<i64>)`
  - [x] 1.2 When `workspace_id` is `Some(id)`: add `AND workspace_id = ?` to the SQL WHERE clause, pass `id` as parameter
  - [x] 1.3 When `workspace_id` is `None`: keep existing behavior — return all non-trashed notes
  - [x] 1.4 Ordering remains `ORDER BY updated_at DESC` in both cases
  - [x] 1.5 Add unit tests: `test_list_notes_filtered_by_workspace`, `test_list_notes_filtered_excludes_trashed`, `test_list_notes_filtered_empty_workspace`, `test_list_notes_unfiltered_returns_all`

- [x] Task 2: Add `workspace_id` parameter to `list_notes` Tauri command (AC: #1, #2)
  - [x] 2.1 Modify `commands::notes::list_notes` to accept `workspace_id: Option<i64>` parameter
  - [x] 2.2 Pass `workspace_id` through to `services::notes::list_notes(conn, workspace_id)`
  - [x] 2.3 Run `cargo build` to regenerate tauri-specta bindings in `src/generated/bindings.ts`
  - [x] 2.4 Verify the generated `listNotes` binding now accepts `workspaceId: number | null`

- [x] Task 3: Extend `useWorkspaceStore` with filtered notes state (AC: #3)
  - [x] 3.1 Add state: `filteredNotes: Note[]` (imported from `../../generated/bindings`), `isLoadingNotes: boolean`
  - [x] 3.2 Add action: `loadFilteredNotes(): Promise<void>` — reads `activeWorkspaceId` and `isAllWorkspaces` from store, calls `commands.listNotes(workspaceId)` where `workspaceId` is `activeWorkspaceId` when a specific workspace is active, or `null` when `isAllWorkspaces` is true
  - [x] 3.3 On `loadFilteredNotes` success: set `filteredNotes` from result, set `isLoadingNotes: false`
  - [x] 3.4 On `loadFilteredNotes` error: console.error, set `isLoadingNotes: false`
  - [x] 3.5 Call `loadFilteredNotes()` at the end of `initWorkspace()` (after active workspace is set)
  - [x] 3.6 Call `loadFilteredNotes()` inside `setActiveWorkspace(id)` (after state update)
  - [x] 3.7 Call `loadFilteredNotes()` inside `setAllWorkspaces()` (after state update)

- [x] Task 4: Update StatusBar note count to use filtered notes (AC: #3)
  - [x] 4.1 In `WorkspaceSelector.tsx`: read `filteredNotes` from `useWorkspaceStore` for the displayed note count
  - [x] 4.2 When `isAllWorkspaces`: display count as `filteredNotes.length` (total filtered notes)
  - [x] 4.3 When specific workspace active: display count as `filteredNotes.length` (workspace-scoped)
  - [x] 4.4 Keep the existing `loadWorkspaces()` call on dropdown open (for workspace-level counts in the dropdown items)

- [x] Task 5: Update existing tests + add new tests (AC: all)
  - [x] 5.1 Update existing `test_list_notes_filters_trashed` and `test_list_notes_ordered_by_updated_at_desc` in `src-tauri/src/services/notes.rs` to pass `None` as workspace_id (no behavior change)
  - [x] 5.2 Add new Rust tests in `services/notes.rs`: `test_list_notes_filtered_by_workspace`, `test_list_notes_filtered_excludes_trashed`, `test_list_notes_filtered_empty_workspace`
  - [x] 5.3 Extend store tests in `src/features/workspace/store.test.ts`: test `loadFilteredNotes` with active workspace, with all workspaces, and on workspace switch
  - [x] 5.4 Update `WorkspaceSelector.test.tsx` if the note count source changed

- [x] Task 6: Verify end-to-end (AC: all)
  - [x] 6.1 Run `cargo build` — clean compilation + bindings regenerated
  - [x] 6.2 Run `cargo test` — 0 regressions + new tests pass
  - [x] 6.3 Run `vitest` — all existing + new tests pass
  - [ ] 6.4 Manual: switch workspace in StatusBar → note count updates to reflect only that workspace's notes

## Dev Notes

### Backend Changes

The current `list_notes` takes no parameters and returns ALL non-trashed notes. This story adds an optional `workspace_id` filter.

**Current signature** (`src-tauri/src/services/notes.rs:85`):
```rust
pub fn list_notes(conn: &Connection) -> Result<Vec<Note>, NoteyError> {
```

**New signature:**
```rust
pub fn list_notes(conn: &Connection, workspace_id: Option<i64>) -> Result<Vec<Note>, NoteyError> {
```

**SQL change** — use two query paths (not dynamic SQL string building):
```rust
pub fn list_notes(conn: &Connection, workspace_id: Option<i64>) -> Result<Vec<Note>, NoteyError> {
    let mut stmt = match workspace_id {
        Some(ws_id) => {
            let mut s = conn.prepare(
                "SELECT id, title, content, format, workspace_id, created_at, updated_at, deleted_at, is_trashed
                 FROM notes
                 WHERE is_trashed = 0 AND workspace_id = ?1
                 ORDER BY updated_at DESC"
            )?;
            // Need to return from here with the result
            // See implementation note below
        }
        None => {
            conn.prepare(
                "SELECT id, title, content, format, workspace_id, created_at, updated_at, deleted_at, is_trashed
                 FROM notes
                 WHERE is_trashed = 0
                 ORDER BY updated_at DESC"
            )?
        }
    };
```

**IMPORTANT implementation note:** Because `rusqlite::Statement` borrows `conn`, and the `query_map` call needs the statement + params, the cleanest approach is to use a helper closure or duplicate the row-mapping logic. The recommended pattern:

```rust
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
            stmt.query_map(params![ws_id], row_mapper)?
                .collect::<Result<Vec<_>, _>>()?
        }
        None => {
            let mut stmt = conn.prepare(
                "SELECT id, title, content, format, workspace_id, created_at, updated_at, deleted_at, is_trashed
                 FROM notes WHERE is_trashed = 0
                 ORDER BY updated_at DESC",
            )?;
            stmt.query_map([], row_mapper)?
                .collect::<Result<Vec<_>, _>>()?
        }
    };

    Ok(notes)
}
```

Use `rusqlite::params!` macro for the workspace_id parameter — **never** string interpolation. The `params!` macro is already imported in this file.

**Command layer** (`src-tauri/src/commands/notes.rs:45`):
```rust
#[tauri::command]
#[specta::specta]
pub async fn list_notes(
    state: State<'_, Mutex<rusqlite::Connection>>,
    workspace_id: Option<i64>,
) -> Result<Vec<Note>, NoteyError> {
    let conn = state.lock().unwrap_or_else(|e| e.into_inner());
    services::notes::list_notes(&conn, workspace_id)
}
```

After `cargo build`, tauri-specta will regenerate `src/generated/bindings.ts`. The `listNotes` binding will change from `listNotes: () => ...` to `listNotes: (workspaceId: number | null) => ...`.

### Frontend Changes

**Workspace store extension** (`src/features/workspace/store.ts`):

Add to `WorkspaceState`:
```typescript
filteredNotes: Note[];
isLoadingNotes: boolean;
```

Add to `WorkspaceActions`:
```typescript
loadFilteredNotes: () => Promise<void>;
```

Implementation:
```typescript
filteredNotes: [],
isLoadingNotes: false,

loadFilteredNotes: async () => {
  set({ isLoadingNotes: true });
  const { activeWorkspaceId, isAllWorkspaces } = get();
  const workspaceId = isAllWorkspaces ? null : activeWorkspaceId;
  const result = await commands.listNotes(workspaceId);
  if (result.status === 'ok') {
    set({ filteredNotes: result.data, isLoadingNotes: false });
  } else {
    console.error('listNotes failed:', result.error);
    set({ isLoadingNotes: false });
  }
},
```

**Wire `loadFilteredNotes` into workspace switches:**

In `setActiveWorkspace(id)`:
```typescript
setActiveWorkspace: (id) => {
  const found = get().workspaces.find((w) => w.id === id);
  set({
    activeWorkspaceId: id,
    activeWorkspaceName: found?.name ?? null,
    isAllWorkspaces: false,
  });
  get().loadFilteredNotes();
},
```

In `setAllWorkspaces()`:
```typescript
setAllWorkspaces: () => {
  set({ isAllWorkspaces: true, activeWorkspaceId: null, activeWorkspaceName: null });
  get().loadFilteredNotes();
},
```

In `initWorkspace()` — add at the end, after setting the active workspace:
```typescript
// After set({ activeWorkspaceId, activeWorkspaceName })
get().loadFilteredNotes();
```

**WorkspaceSelector note count** (`src/features/workspace/components/WorkspaceSelector.tsx`):

The trigger text's note count should come from `filteredNotes.length` instead of looking up from the `workspaces` array's `noteCount`. This ensures the displayed count matches the actual filtered note set:

```typescript
const filteredNotes = useWorkspaceStore((s) => s.filteredNotes);
// Display: "Workspace Name · {filteredNotes.length} note(s)"
```

**Keep the dropdown items showing per-workspace `noteCount`** from `WorkspaceInfo` — those counts are loaded via `loadWorkspaces()` on dropdown open and represent total notes per workspace (useful for the selector list).

The trigger text uses `filteredNotes.length` (the actual filtered count), while dropdown items use `ws.noteCount` (per-workspace totals). This is intentional — the trigger shows "how many notes you're looking at now" while the dropdown shows "how many notes each workspace has."

### Import Notes

- Import `Note` type from `../../generated/bindings` (alongside existing `WorkspaceInfo` import)
- Import `commands` is already present in the workspace store
- No new dependencies needed

### Testing Strategy

**Rust unit tests** (in `src-tauri/src/services/notes.rs` `#[cfg(test)]` block):

1. `test_list_notes_filtered_by_workspace` — Create notes in two workspaces, call `list_notes(conn, Some(ws1_id))`, verify only ws1 notes returned
2. `test_list_notes_filtered_excludes_trashed` — Create note in ws1, trash it, call `list_notes(conn, Some(ws1_id))`, verify empty
3. `test_list_notes_filtered_empty_workspace` — Create workspace with no notes, call `list_notes(conn, Some(ws_id))`, verify empty vec (not error)
4. Update existing `test_list_notes_filters_trashed` and `test_list_notes_ordered_by_updated_at_desc` to pass `None` as second arg

**Rust test setup:** Existing `setup_test_db()` runs migrations which create the `workspaces` table. Create test workspaces via direct SQL INSERT (the workspace service functions are in a different module — use `conn.execute("INSERT INTO workspaces ...")` with parameterized queries). Then create notes with `workspace_id` set.

**Frontend unit tests** (in `src/features/workspace/store.test.ts`):

Mock `commands.listNotes` in the same way `commands.listWorkspaces` is mocked (via `vi.mock('../../generated/bindings')`). Test:
1. `loadFilteredNotes` calls `listNotes(activeWorkspaceId)` when workspace active
2. `loadFilteredNotes` calls `listNotes(null)` when `isAllWorkspaces` is true
3. `setActiveWorkspace` triggers `loadFilteredNotes`
4. `setAllWorkspaces` triggers `loadFilteredNotes`

### Project Structure Notes

**Modified files:**
- `src-tauri/src/services/notes.rs` — add `workspace_id: Option<i64>` param to `list_notes`, add tests
- `src-tauri/src/commands/notes.rs` — add `workspace_id: Option<i64>` param to `list_notes` command
- `src/generated/bindings.ts` — auto-regenerated by tauri-specta (do not hand-edit)
- `src/features/workspace/store.ts` — add `filteredNotes`, `isLoadingNotes`, `loadFilteredNotes` action
- `src/features/workspace/store.test.ts` — add tests for `loadFilteredNotes`
- `src/features/workspace/components/WorkspaceSelector.tsx` — use `filteredNotes.length` for trigger count
- `src/features/workspace/components/WorkspaceSelector.test.tsx` — update if trigger count source changed

**No new files created.** This story extends existing files only.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5] — acceptance criteria, user story
- [Source: _bmad-output/planning-artifacts/prd.md#FR33] — view notes filtered by workspace
- [Source: _bmad-output/planning-artifacts/prd.md#FR34] — view all notes across workspaces
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication Patterns] — Zustand async data shape: `{ data, isLoading, error }`
- [Source: _bmad-output/planning-artifacts/architecture.md#State Management] — per-feature Zustand stores, named actions only
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#StatusBar] — workspace name + note count in StatusBar
- [Source: _bmad-output/project-context.md] — parameterized SQL, no barrel files, no raw invoke, co-located tests

### Previous Story Intelligence (Story 2.4)

**Patterns to reuse:**
- `useWorkspaceStore` at `src/features/workspace/store.ts` — extend with `filteredNotes` state and `loadFilteredNotes` action
- Store uses `(set, get)` — `get()` is already available for reading state within actions
- `commands.listWorkspaces()` returns `{ status: 'ok', data } | { status: 'error', error }` — `listNotes` follows the same pattern
- WorkspaceSelector at `src/features/workspace/components/WorkspaceSelector.tsx` — update trigger note count source
- StatusBar at `src/features/editor/components/StatusBar.tsx` — no changes needed (delegates to WorkspaceSelector)

**Learnings to apply:**
- tauri-specta compile-time safety: `cargo build` regenerates bindings — the updated `listNotes(workspaceId)` signature will appear automatically
- base-ui DropdownMenu uses `onClick`, not `onSelect` — no change needed here, but remember for test mocking
- Mock the Tauri IPC layer in frontend tests, not Zustand stores (per project-context.md)
- Import `Note` type from `../../generated/bindings` — same import path as `WorkspaceInfo`

**Pitfalls to avoid:**
- Do NOT use string interpolation in SQL — use `params![ws_id]` for the workspace_id filter
- Do NOT create a new `notes` store — extend `useWorkspaceStore` since filtered notes are workspace-scoped state
- Do NOT add a NoteListPanel UI component — that's Epic 4 (Story 4.8). This story only adds the data layer
- Do NOT change `create_note` or `update_note` signatures — only `list_notes` changes
- Do NOT break existing calls to `listNotes()` in tests — update them to pass `null` for the new parameter
- Do NOT implement note selection or note opening from the filtered list — that's future stories
- Do NOT add event listeners or polling for note changes — `loadFilteredNotes()` is called explicitly on workspace switch and init
- The `loadFilteredNotes()` calls in `setActiveWorkspace` and `setAllWorkspaces` are fire-and-forget async — do NOT await them (this keeps the workspace switch instant while notes load in background)

### Git Intelligence

Recent commits show Stories 2.1-2.4 landed (last: `03d34ff feat(story-2.4): Workspace Selector in StatusBar`). The codebase has 82 Rust tests + 42 frontend tests passing. The workspace backend (table, CRUD, detection, resolution, note assignment, workspace selector UI) is complete. This story bridges backend filtering to frontend consumption.

Commit pattern: `feat(story-2.5): Workspace-Filtered Note Views`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Borrow checker error on `stmt.query_map()` in match arms — fixed by binding result to local variable before block end

### Completion Notes List

- Task 1: Added `workspace_id: Option<i64>` param to `list_notes` service with two SQL query paths (parameterized, never string interpolation). Added 5 new unit tests + updated 2 existing tests to pass `None`.
- Task 2: Added `workspace_id: Option<i64>` param to `list_notes` Tauri command. Ran `export_bindings` test to regenerate `bindings.ts`.
- Task 3: Extended `useWorkspaceStore` with `filteredNotes: Note[]`, `isLoadingNotes: boolean`, and `loadFilteredNotes()` action. Wired into `setActiveWorkspace`, `setAllWorkspaces`, and `initWorkspace`.
- Task 4: Updated `WorkspaceSelector` trigger text to use `filteredNotes.length` instead of workspace `noteCount`. Dropdown items still use per-workspace `noteCount` from `WorkspaceInfo`.
- Task 5: Updated all existing callers (3 Rust test files, 3 frontend test files) to work with new `workspace_id` param. Added 6 new store tests for `loadFilteredNotes`. Updated StatusBar tests and WorkspaceSelector tests for `filteredNotes`-based counts. Fixed `useAutoSave.test.ts` to mock `list_notes`.
- Task 6: 87 Rust tests + 47 frontend tests = 134 total, 0 failures, 0 regressions.

### Change Log

- 2026-04-04: Implemented workspace-filtered note views — backend filtering, frontend state, StatusBar integration, full test coverage
- 2026-04-04: [AI-Review] Fixed 3 MEDIUM issues: (1) Clear filteredNotes on listNotes error to prevent stale data; (2) Clear filteredNotes in clearActiveWorkspace for consistency; (3) Fix setActiveWorkspace call arity in useAutoSave.test.ts (was passing 2 args to 1-param function)

### File List

- `src-tauri/src/services/notes.rs` — Added `workspace_id: Option<i64>` param to `list_notes`, row_mapper closure, two SQL query paths, 5 new unit tests
- `src-tauri/src/commands/notes.rs` — Added `workspace_id: Option<i64>` param to `list_notes` command
- `src-tauri/tests/db_tests.rs` — Updated `list_notes` call to pass `None`
- `src-tauri/tests/workspace_tests.rs` — Updated `list_notes` call to pass `None`
- `src/generated/bindings.ts` — Auto-regenerated: `listNotes` now accepts `workspaceId: number | null`
- `src/features/workspace/store.ts` — Added `filteredNotes`, `isLoadingNotes`, `loadFilteredNotes` action; wired into workspace switch actions
- `src/features/workspace/store.test.ts` — Added 6 new tests for `loadFilteredNotes`; updated existing tests for new state fields
- `src/features/workspace/components/WorkspaceSelector.tsx` — Trigger count now uses `filteredNotes.length`
- `src/features/workspace/components/WorkspaceSelector.test.tsx` — Updated tests for `filteredNotes`-based counts
- `src/features/editor/components/StatusBar.test.tsx` — Updated tests for `filteredNotes`-based counts
- `src/features/editor/hooks/useAutoSave.test.ts` — Added `list_notes` to mock handler
