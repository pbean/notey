# Epic 2 Retrospective — Action Items for Epic 3 Readiness

**Source:** Epic 2 Retrospective (2026-04-04)
**Status:** All items must be completed before Epic 3 begins
**Total Items:** 9 (2 Critical, 3 High, 2 Medium, 2 Low)

Each item is self-contained with full context for quick-dev execution.

---

## ITEM 1 — CRITICAL: Verify Note Opening End-to-End

### What

Verify that `loadNote(id)` successfully loads an existing note's content into the CodeMirror editor. This is a **manual smoke test + optional automated test** to confirm the `useNoteHydration` pipeline works.

### Why

Epic 1's retrospective flagged "note content load path" as a **critical blocker** for Epic 2 Story 2-5. The code exists now (`useNoteHydration.ts` + `loadNote` in editor store), but it was never explicitly verified end-to-end. **Epic 3 Story 3.4** (Search Result Keyboard Navigation & Note Opening) depends entirely on this working — users select a search result and the note must open in the editor.

### Current State

- `src/features/editor/store.ts:66-82` — `loadNote(id)` calls `commands.getNote(id)`, sets `content`, `format`, `activeNoteId`, and `isHydrating: true`
- `src/features/editor/hooks/useNoteHydration.ts` — watches `isHydrating`, dispatches `view.state.update({ changes })` to push content into CodeMirror
- `src/features/editor/components/EditorPane.tsx` — uses `useNoteHydration`

### What to Do

1. **Manual verification:** Launch the app (`cargo tauri dev`), create a note with some content, dismiss the window (Esc), reopen, then trigger `loadNote` for that note's ID. Verify the content appears in the editor.

2. **Automated test (recommended):** Add a test in `src/features/editor/store.test.ts`:

```typescript
// Test: loadNote fetches note and sets hydration state
it('loadNote sets content and isHydrating for existing note', async () => {
  // Mock getNote to return a note with content
  // Call loadNote(1)
  // Assert: content matches, isHydrating is true, activeNoteId is set
});
```

3. If `loadNote` does NOT work (content doesn't appear in editor), the fix is in `useNoteHydration.ts` — ensure the `view.dispatch` call runs after the CodeMirror `EditorView` is mounted. Check if the `viewRef.current` is populated when `isHydrating` becomes true.

### Definition of Done

- `loadNote(id)` loads an existing note's content into the editor
- Content is visible in CodeMirror after load
- At least one automated test covers the `loadNote` -> `isHydrating` -> state pipeline

### Files

- `src/features/editor/store.ts` — `loadNote` action (read, possibly fix)
- `src/features/editor/store.test.ts` — add test
- `src/features/editor/hooks/useNoteHydration.ts` — verify/fix if needed
- `src/features/editor/components/EditorPane.tsx` — verify integration if needed

---

## ITEM 2 — CRITICAL: Add Retro Action Item Tracking to sprint-status.yaml

### What

Add a `retro_action_items` section to `_bmad-output/implementation-artifacts/sprint-status.yaml` that tracks retrospective commitments with status, just like stories are tracked.

### Why

The team identified this as the **biggest systemic gap** in the retrospective. Epic 1 produced 8 action items. Most were actually completed by agents, but there was zero visibility — Pinkyd had no way to know what was done and what wasn't. Retro commitments lived in a markdown file that nobody checked again. This tracking mechanism prevents the same pattern from repeating after Epic 2's retro.

### What to Do

Add the following section to `_bmad-output/implementation-artifacts/sprint-status.yaml`, after the `development_status` section but before any closing content. Preserve ALL existing comments and structure including STATUS DEFINITIONS.

```yaml
  # ═══════════════════════════════════════════════
  # RETRO ACTION ITEMS
  # ═══════════════════════════════════════════════
  #
  # Tracks commitments from retrospectives.
  # Status: backlog | in-progress | done
  # Source format: epic-{N}-retro-item-{M}
  #
  # Epic 1 Retro Items (all resolved):
  epic-1-retro-item-1-test-design-in-stories: done
  epic-1-retro-item-2-test-compliance-done-criteria: done
  epic-1-retro-item-3-project-context-nightly-rust: done
  epic-1-retro-item-4-note-content-load-path: done
  epic-1-retro-item-5-rust-test-factories: done
  epic-1-retro-item-6-ts-test-factories: done
  epic-1-retro-item-7-ci-pipeline: done
  epic-1-retro-item-8-p0-p1-test-gaps: in-progress

  # Epic 2 Retro Items:
  epic-2-retro-item-1-verify-note-opening-e2e: backlog
  epic-2-retro-item-2-retro-tracking-in-sprint-status: backlog
  epic-2-retro-item-3-workspace-input-validation: backlog
  epic-2-retro-item-4-console-error-logging-audit: backlog
  epic-2-retro-item-5-fts5-research: backlog
  epic-2-retro-item-6-epic1-p0-tests: backlog
  epic-2-retro-item-7-epic1-p1-tests: backlog
  epic-2-retro-item-8-workspace-test-factory: backlog
  epic-2-retro-item-9-permission-toml-docs: backlog
```

### Definition of Done

- `sprint-status.yaml` has a `retro_action_items` section with all Epic 1 and Epic 2 items listed
- Each item has a status (backlog, in-progress, done)
- Epic 1 items are retroactively marked with their correct status
- All existing content and comments in the file are preserved

### Files

- `_bmad-output/implementation-artifacts/sprint-status.yaml` — add section

---

## ITEM 3 — HIGH: Add Input Validation for Empty name/path in create_workspace

### What

Add validation in `create_workspace` service to reject empty strings for `name` and `path` parameters.

### Why

Flagged as `[AI-Review][LOW]` in Story 2.1 code review. Currently, calling `create_workspace("", "")` succeeds and inserts a semantically invalid workspace. Epic 3's search features will surface workspaces in search results — empty-named workspaces would be confusing. Fix now before the search UI exposes them.

### Current State

`src-tauri/src/services/workspace_service.rs` — `create_workspace` function does no input validation:

```rust
pub fn create_workspace(conn: &Connection, name: &str, path: &str) -> Result<Workspace, NoteyError> {
    // Goes straight to INSERT, no validation
```

### What to Do

1. Add validation at the top of `create_workspace` in `src-tauri/src/services/workspace_service.rs`:

```rust
pub fn create_workspace(conn: &Connection, name: &str, path: &str) -> Result<Workspace, NoteyError> {
    if name.trim().is_empty() {
        return Err(NoteyError::Validation("Workspace name cannot be empty".to_string()));
    }
    if path.trim().is_empty() {
        return Err(NoteyError::Validation("Workspace path cannot be empty".to_string()));
    }
    // ... existing INSERT logic
```

2. Add unit tests in the same file's `#[cfg(test)]` block (or in `src-tauri/tests/workspace_tests.rs`):

```rust
#[test]
fn test_create_workspace_rejects_empty_name() {
    let conn = setup_test_db();
    let result = create_workspace(&conn, "", "/some/path");
    assert!(matches!(result, Err(NoteyError::Validation(_))));
}

#[test]
fn test_create_workspace_rejects_empty_path() {
    let conn = setup_test_db();
    let result = create_workspace(&conn, "name", "");
    assert!(matches!(result, Err(NoteyError::Validation(_))));
}

#[test]
fn test_create_workspace_rejects_whitespace_only_name() {
    let conn = setup_test_db();
    let result = create_workspace(&conn, "   ", "/some/path");
    assert!(matches!(result, Err(NoteyError::Validation(_))));
}
```

3. Run `cargo test` — ensure no regressions. The existing `resolve_workspace` calls `create_workspace` with values from `detect_workspace`, which always returns non-empty names/paths from filesystem basename. So no existing code path should be affected.

### Definition of Done

- `create_workspace` rejects empty and whitespace-only `name` and `path`
- Returns `NoteyError::Validation` with descriptive message
- 3+ tests covering empty string, whitespace-only, for both parameters
- `cargo test` passes with 0 regressions

### Files

- `src-tauri/src/services/workspace_service.rs` — add validation + tests (or tests in `src-tauri/tests/workspace_tests.rs`)

---

## ITEM 4 — HIGH: Audit and Fix console.error Logging Gaps in Frontend Store Actions

### What

Review every async store action that calls a Tauri command and ensure all error paths have `console.error` logging.

### Why

Code review flagged missing `console.error` logging in **3 of 6 Epic 2 stories** (Stories 2.4, 2.5, 2.6). This is a systemic pattern — async store actions silently swallow errors when the IPC call fails. Epic 3 adds `useSearchStore` with more async actions (`searchNotes`). Fix the habit now.

### What to Do

1. Open each store file and check every async action that calls `commands.*`:

**`src/features/workspace/store.ts`** — check these actions:
- `initWorkspace()` — has error logging? (Story 2.3 added it, but verify)
- `loadWorkspaces()` — should log on error (Story 2.4 review added this — verify it's there)
- `loadFilteredNotes()` — should log on error (Story 2.5 review may have added this — verify)
- `setActiveWorkspace(id)` — calls `loadFilteredNotes()` internally, but verify
- `setAllWorkspaces()` — calls `loadFilteredNotes()` internally, but verify
- `reassignNoteWorkspace()` — has error logging? (Story 2.6 added it — verify)

**`src/features/editor/store.ts`** — check these actions:
- `loadNote(id)` — has `console.error('loadNote failed:', result.error)` on line 69 — verified

2. For any action missing error logging, add:
```typescript
if (result.status === 'error') {
  console.error('{actionName} failed:', result.error);
  // ... existing error handling
}
```

3. The pattern should be consistent: every `commands.*` call that checks `result.status === 'error'` should have a `console.error` before any other error handling.

4. Run `vitest` to confirm no test regressions.

### Definition of Done

- Every async store action that calls a Tauri command logs errors via `console.error`
- Pattern is consistent across all store files
- `vitest` passes with 0 regressions

### Files

- `src/features/workspace/store.ts` — audit and fix
- `src/features/editor/store.ts` — audit (likely already correct)

---

## ITEM 5 — HIGH: FTS5 External Content Table Research Document

### What

Create a research/reference document covering SQLite FTS5 external content tables, specifically the patterns needed for Epic 3 Story 3.1.

### Why

Elena flagged FTS5 as a knowledge gap. Story 3.1 requires creating an FTS5 virtual table with `external content=notes`, sync triggers, and a backfill migration. This is flagged as **RISK-003 (Score 4)** in the planning docs. FTS5 external content mode has non-obvious gotchas — getting the trigger SQL wrong means silent search index corruption. Research now, implement confidently later.

### What to Do

Research and document the following in a markdown file at `_bmad-output/implementation-artifacts/fts5-research.md`:

1. **FTS5 External Content Table creation syntax:**
   - `CREATE VIRTUAL TABLE notes_fts USING fts5(title, content, content=notes, content_rowid=id)`
   - What `external content` mode means (FTS table doesn't store content, reads from source table)
   - Implications: queries work, but INSERT/UPDATE/DELETE on the FTS table require explicit trigger management

2. **Required sync triggers (exact SQL):**
   - INSERT trigger on `notes` → INSERT into `notes_fts`
   - UPDATE trigger on `notes` → DELETE old row from `notes_fts`, INSERT new row
   - DELETE trigger on `notes` → DELETE from `notes_fts`
   - **Critical:** The UPDATE trigger must DELETE-then-INSERT because FTS5 external content tables don't support UPDATE. The DELETE must use `notes_fts` special `rowid` column.
   - Provide the exact SQL for each trigger that will work with the `notes` table schema (columns: `id`, `title`, `content`, `format`, `workspace_id`, `created_at`, `updated_at`, `deleted_at`, `is_trashed`)

3. **Backfill statement:**
   - `INSERT INTO notes_fts(rowid, title, content) SELECT id, title, content FROM notes`
   - Must run as part of the migration after table + triggers are created

4. **FTS5 query functions:**
   - `MATCH` syntax for searching
   - `rank` function for relevance ordering
   - `snippet(notes_fts, column_index, '<mark>', '</mark>', '...', max_tokens)` for result snippets with highlighting
   - `bm25()` vs default `rank` — which to use

5. **Gotchas and edge cases:**
   - What happens if triggers are missing and a note is updated? (FTS index goes stale silently)
   - What happens with trashed notes? (Triggers fire on UPDATE to `is_trashed`, FTS still indexes trashed notes — need to handle in search query with `WHERE is_trashed = 0` JOIN)
   - What about NULL content or empty titles?
   - Performance: FTS5 is fast for reads but triggers add overhead to every write. Impact on auto-save <500ms budget?

6. **Integration with existing codebase:**
   - Migration goes as 3rd element in `MIGRATIONS_SLICE` in `src-tauri/src/db/mod.rs`
   - Search service function goes in `src-tauri/src/services/` (new file `search_service.rs` or in `notes.rs`)
   - Search command in `src-tauri/src/commands/` (new file `search.rs`)
   - Result type: `SearchResult` struct with `id`, `title`, `snippet`, `workspace_name`, `updated_at`, `format`

**Important:** Retrieve current SQLite FTS5 documentation rather than relying on training data. FTS5 syntax and behavior may have nuances that are version-specific.

### Definition of Done

- `_bmad-output/implementation-artifacts/fts5-research.md` exists with all 6 sections covered
- Exact SQL for table creation, all 3 triggers, and backfill statement are included
- Query patterns for `MATCH`, `rank`, `snippet()` are documented with examples
- Gotchas section covers edge cases relevant to notey's schema

### Files

- `_bmad-output/implementation-artifacts/fts5-research.md` — create new

---

## ITEM 6 — MEDIUM: Add Remaining Epic 1 P0 Tests

### What

Implement the P0 tests that were identified in Epic 1's retrospective and test design handoff but never automated.

### Why

These are **P0 priority** tests — the highest risk scenarios. They've been deferred for two epics. Epic 3 adds FTS5 on top of SQLite, increasing database complexity. The DB resilience tests (P0-INT-002, P0-INT-003) become more important with another migration and triggers.

### Tests to Implement

**P0-INT-001: Auto-save persists within 500ms debounced**
- Location: `src/features/editor/hooks/useAutoSave.test.ts`
- Test: Set up editor store with content, trigger auto-save, advance timers by 300ms (debounce period), verify `commands.updateNote` was called
- Uses: `vi.useFakeTimers()`, existing command mocks
- Note: The debounce is 300ms per project-context.md. Test that save fires after debounce, not before.

**P0-INT-002: DB survives process kill during write**
- Location: `src-tauri/tests/db_tests.rs`
- Test: Open DB, begin a write operation, drop the connection mid-write (simulating process kill), reopen DB, verify it's not corrupted
- Pattern: WAL mode should handle this gracefully. Use `conn.execute()` then `drop(conn)` before commit.
- Note: SQLite WAL mode is designed for crash recovery. This test confirms our PRAGMA configuration works.

**P0-INT-003: DB passes integrity_check after power loss sim**
- Location: `src-tauri/tests/db_tests.rs`
- Test: After P0-INT-002 scenario, run `PRAGMA integrity_check` on the reopened DB, assert it returns "ok"
- Can be combined with P0-INT-002 as a single test function.

**P0-E2E-001: Capture loop E2E (hotkey -> type -> save -> Esc -> focus)**
- Location: `src-tauri/tests/e2e/` (new directory)
- Framework: `tauri-driver` with WebDriver protocol
- **This is the most complex item.** It requires:
  1. Setting up `tauri-driver` as a dev dependency
  2. A WebDriver client (e.g., `fantoccini` crate)
  3. Building the app in test mode
  4. Driving the full capture loop: trigger hotkey, type text, wait for save, press Esc, verify focus returns
- **Recommendation:** If `tauri-driver` setup is too heavy, defer this single test and document why. The other 3 P0 tests are more straightforward.

**P0-INT-006: Tauri ACL rejects unauthorized commands**
- Location: `src-tauri/tests/acl_tests.rs`
- Status: **Already partially implemented.** The existing `acl_tests.rs` verifies `EXPECTED_COMMANDS` match the capability file. Verify this covers the intent of P0-INT-006 (that only explicitly allowed commands are permitted). If the current test only checks the allowlist matches, add a test that verifies NO unexpected commands are present in capabilities.

### Definition of Done

- P0-INT-001: Auto-save debounce test passes in vitest
- P0-INT-002 + P0-INT-003: DB crash recovery + integrity test passes in cargo test
- P0-INT-006: ACL test coverage verified as sufficient (or extended)
- P0-E2E-001: Either implemented with tauri-driver OR explicitly deferred with documented reasoning
- `cargo test` and `vitest` pass with 0 regressions

### Files

- `src/features/editor/hooks/useAutoSave.test.ts` — add P0-INT-001
- `src-tauri/tests/db_tests.rs` — add P0-INT-002, P0-INT-003
- `src-tauri/tests/acl_tests.rs` — verify P0-INT-006 coverage
- `src-tauri/tests/e2e/` — new directory for P0-E2E-001 (if implemented)

---

## ITEM 7 — MEDIUM: Add Remaining Epic 1 P1 Tests

### What

Implement the P1 tests identified in Epic 1's retrospective that are still missing.

### Why

P1 tests cover important-but-not-critical scenarios. They've been deferred for two epics. Completing them before Epic 3 ensures a solid regression safety net as new features are added.

### Tests to Implement

**P1-UNIT-007: NoteyError serializes across IPC**
- Location: `src-tauri/tests/db_tests.rs` or a new `src-tauri/tests/error_tests.rs`
- Test: Create each `NoteyError` variant (`Database`, `NotFound`, `Workspace`, `Io`, `Validation`, `Config`), serialize with `serde_json::to_string()`, verify the JSON structure is parseable and contains the expected error message
- Why: Ensures frontend receives well-formed error objects for all 6 variants

**P1-INT-011: Auto-save debounce and flush on dismiss**
- Location: `src/features/editor/hooks/useAutoSave.test.ts`
- Test: Simulate typing (content change), then trigger `flushSave()` before debounce timer fires. Verify: (1) the pending debounce is cancelled, (2) `flushSave` saves immediately, (3) content is persisted
- This tests the Esc-dismiss flow: user types, hits Esc, `flushSave()` runs, save completes before window hides

**P1-INT-012: Window management (hide, focus restore, state)**
- Location: This likely needs a Tauri integration test or E2E test
- Test scope: Window starts hidden, show command makes it visible, Esc hides it, window is NOT destroyed (re-showable)
- **Note:** This may be difficult to test without `tauri-driver`. If so, document as requiring E2E infrastructure and defer alongside P0-E2E-001.

**P1-UNIT-005: Note format toggle persists**
- Location: `src/features/editor/store.test.ts`
- Test: Set format to "plaintext", trigger save, reload note, verify format is still "plaintext"
- Uses existing `commands.updateNote` mock

**P1-UNIT-006: Migration applies on fresh + existing DB**
- Location: `src-tauri/tests/db_tests.rs`
- Test: (1) Apply all migrations on empty DB — verify success. (2) Create a DB with only migration 1, apply migration 2 — verify success and data preserved.
- Note: `setup_test_db()` already applies all migrations on a fresh DB, so test (1) may be implicitly covered. Test (2) requires applying migrations incrementally.

**P1-UNIT-008: useEditorStore state management**
- Location: `src/features/editor/store.test.ts`
- Test: Verify all state transitions: `resetNote()` clears all fields, `setContent()` updates content + marks dirty, `setFormat()` updates format, `loadNote()` sets all fields from API response
- Check if these tests already exist in `store.test.ts` and extend if needed.

### Definition of Done

- All P1 tests listed above either pass or are explicitly deferred with documented reasoning
- Tests that require E2E infrastructure (P1-INT-012) may be deferred alongside P0-E2E-001
- `cargo test` and `vitest` pass with 0 regressions

### Files

- `src-tauri/tests/db_tests.rs` — P1-UNIT-007, P1-UNIT-006
- `src/features/editor/hooks/useAutoSave.test.ts` — P1-INT-011
- `src/features/editor/store.test.ts` — P1-UNIT-005, P1-UNIT-008

---

## ITEM 8 — LOW: Add WorkspaceInfo to TypeScript Test Factories

### What

Add a `buildWorkspaceInfo()` factory function to `src/test-utils/factories.ts`.

### Why

Epic 3 Story 3.5 (Workspace-Scoped Search Toggle) will need `WorkspaceInfo` mocks in frontend tests. The existing factory file has `buildNote` and `buildConfig` but no workspace factories. Having it ready saves time during Epic 3 story implementation.

### What to Do

Add to `src/test-utils/factories.ts`:

```typescript
import type { Note, AppConfig, WorkspaceInfo } from '../generated/bindings';

/** Build a WorkspaceInfo with sensible defaults. Override any field via the partial. */
export function buildWorkspaceInfo(overrides: Partial<WorkspaceInfo> = {}): WorkspaceInfo {
  return {
    id: 1,
    name: 'Test Workspace',
    path: '/home/user/projects/test',
    createdAt: '2026-01-01T00:00:00+00:00',
    noteCount: 5,
    ...overrides,
  };
}
```

Verify the `WorkspaceInfo` type fields by checking `src/generated/bindings.ts` — the fields should be `id`, `name`, `path`, `createdAt`, `noteCount` (camelCase from serde rename).

Also consider adding `buildSearchResult()` if a `SearchResult` type will exist in Epic 3 — but only if the type is already generated in bindings. If not, skip and add it during Story 3.2.

### Definition of Done

- `buildWorkspaceInfo()` function exists in `src/test-utils/factories.ts`
- Import includes `WorkspaceInfo` from generated bindings
- Existing tests still pass (`vitest`)

### Files

- `src/test-utils/factories.ts` — add function
- `src/generated/bindings.ts` — reference for `WorkspaceInfo` field names

---

## ITEM 9 — LOW: Document Permission TOML Manual Creation Workaround

### What

Add a note to `_bmad-output/project-context.md` documenting that Tauri v2 permission TOML files may need manual creation.

### Why

Hit in Epic 2 Stories 2.1 and 2.2 — the auto-generation didn't fire and permission files had to be manually created in `src-tauri/permissions/autogenerated/`. By Story 2.3, the dev notes documented the workaround, but it's not in `project-context.md` where all agents read it. Epic 3 Story 3.2 adds a `search_notes` command which will need the same treatment.

### What to Do

Add the following to the "Framework-Specific Rules > Tauri" section of `_bmad-output/project-context.md` (after the existing Tauri rules around line 108):

```markdown
#### Tauri Command Permission Files
- When adding a new Tauri command, the permission TOML file may NOT auto-generate
- If `cargo build` does not create `src-tauri/permissions/autogenerated/{command_name}.toml`, create it manually:
  ```toml
  # Automatically generated - DO NOT EDIT
  # This permission set is auto-generated

  [[permission]]
  identifier = "allow-{command-name-kebab-case}"
  description = "Allows the {command_name} command"

  [[permission.commands]]
  name = "{command_name_snake_case}"
  ```
- Add the permission identifier (e.g., `"allow-search-notes"`) to `src-tauri/capabilities/default.json`
- Add the permission identifier to `EXPECTED_COMMANDS` in `src-tauri/tests/acl_tests.rs`
- This is a known Tauri v2 issue — the build system sometimes skips TOML generation for new commands
```

### Definition of Done

- `_bmad-output/project-context.md` documents the permission TOML workaround in the Tauri section
- The documentation includes the TOML template, the capability file update, and the ACL test update
- No code changes needed

### Files

- `_bmad-output/project-context.md` — add documentation section

---

## Execution Order (Recommended)

For maximum efficiency, items can be grouped:

**Group A — Do first (unblocks everything):**
- Item 2: Sprint-status tracking (process foundation)
- Item 1: Verify note opening (confirms no blocker for Epic 3)

**Group B — Code fixes (independent, parallelizable):**
- Item 3: Workspace input validation
- Item 4: Console.error logging audit
- Item 8: WorkspaceInfo test factory

**Group C — Research and documentation (independent):**
- Item 5: FTS5 research document
- Item 9: Permission TOML documentation

**Group D — Test backlog (dependent on test infrastructure):**
- Item 6: Epic 1 P0 tests
- Item 7: Epic 1 P1 tests

Groups B, C, and D can run in parallel after Group A is complete.
