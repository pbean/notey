---
title: 'Code review pass 2 cleanup — canonicalize, FTS rebuild, error consistency, Windows UNC'
type: 'refactor'
created: '2026-04-05'
status: 'done'
baseline_commit: '549d7b0'
context:
  - '_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Five findings from the story 3.1 code review pass 2 remain open: (1) `resolve_workspace` double-canonicalizes paths — `detect_workspace` canonicalizes, then `create_workspace` canonicalizes again; (2) FTS5 external content index has no rebuild mechanism for drift recovery; (3) `loadFilteredNotes` clears `filteredNotes` to `[]` on error (UI flash) while `loadWorkspaces` retains stale data — asymmetric error UX; (4) `std::fs::canonicalize` on Windows produces `\\?\` UNC-prefixed paths that display raw in UI. A sixth finding (down migrations) is closed as by-design — the project uses forward-only migrations and SQLite transaction wrapping prevents partial application.

**Approach:** Extract `create_workspace_trusted` internal function that skips canonicalization for `resolve_workspace`. Add `rebuild_fts_index` service function + Tauri command. Align `loadFilteredNotes` to retain stale data on error with a `notesError` field. Replace `std::fs::canonicalize` with `dunce::canonicalize` to strip UNC prefixes on Windows.

## Boundaries & Constraints

**Always:**
- Keep public `create_workspace` API and its defensive canonicalization unchanged.
- `rebuild_fts_index` is a standalone maintenance command — never auto-run on startup.
- Use `dunce` crate for all `canonicalize` calls — it returns simple paths on Windows, no-ops on Unix.

**Ask First:**
- Running FTS rebuild automatically on app startup or schedule.
- Surfacing `notesError` in UI beyond the store field (e.g., toast or inline message).

**Never:**
- Modify existing `M::up()` migration content.
- Clear list data to `[]` on load failure — stale data with an error indicator is the pattern.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| resolve_workspace | Path from detect_workspace (already canonical) | Single canonicalize syscall total | N/A |
| FTS rebuild on clean index | `rebuild_fts_index` called | Index rebuilt from content table, search unchanged | N/A |
| FTS rebuild on drifted index | notes_fts out of sync with notes | Index fully reconstructed, correct results restored | N/A |
| loadFilteredNotes error | Backend returns error | `filteredNotes` retains previous value, `notesError` set | Error logged to console |
| loadFilteredNotes recovery | Next call succeeds | `filteredNotes` updated, `notesError` cleared | N/A |
| Windows canonicalize | `C:\Users\foo` | Stored as `C:\Users\foo` (no `\\?\` prefix) | N/A |

</frozen-after-approval>

## Code Map

- `src-tauri/Cargo.toml` -- Add `dunce` as direct dependency
- `src-tauri/src/services/workspace_service.rs` -- Double-canonicalize fix + dunce replacement
- `src-tauri/src/services/notes.rs` -- Add `rebuild_fts_index` function
- `src-tauri/src/commands/notes.rs` -- Add `rebuild_fts_index` command handler
- `src-tauri/src/lib.rs` -- Register new command in specta_builder
- `src/features/workspace/store.ts` -- Align `loadFilteredNotes` error handling
- `_bmad-output/implementation-artifacts/deferred-work.md` -- Mark items done

## Tasks & Acceptance

**Execution:**
- [x] `src-tauri/Cargo.toml` -- Add `dunce = "1"` under `[dependencies]`
- [x] `src-tauri/src/services/workspace_service.rs` -- (1) Replace both `std::fs::canonicalize` calls with `dunce::canonicalize`. (2) Extract `create_workspace_trusted(conn, name, canonical_path)` — same as `create_workspace` but accepts an already-canonical path string (skips canonicalize + is_dir). (3) `resolve_workspace` calls `create_workspace_trusted` instead of `create_workspace`.
- [x] `src-tauri/src/services/notes.rs` -- Add `pub fn rebuild_fts_index(conn: &Connection) -> Result<(), NoteyError>` that executes `INSERT INTO notes_fts(notes_fts) VALUES('rebuild')`
- [x] `src-tauri/src/commands/notes.rs` -- Add `rebuild_fts_index` command handler following existing pattern (lock mutex, call service). Register in `lib.rs` specta_builder. Add ACL permission to `capabilities/default.json`. Add to `EXPECTED_COMMANDS` in `acl_tests.rs`.
- [x] `src/features/workspace/store.ts` -- (1) Add `notesError: string | null` to `WorkspaceState` and initial state. (2) In `loadFilteredNotes` error branch: remove `filteredNotes: []`, add `notesError: 'Failed to load notes'`. (3) In `loadFilteredNotes` success branch: add `notesError: null`.
- [x] `src-tauri/tests/search_tests.rs` -- Add test: insert notes, call `rebuild_fts_index`, verify FTS query returns correct results
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- Strike through the 5 addressed items + the down-migration item (by-design). Mark Cluster 2 and 2b headers as DONE. Note item 4 (MATCH syntax) stays deferred to story 3.2.

**Acceptance Criteria:**
- Given `resolve_workspace` is called, when tracing the code path, then only `detect_workspace` canonicalizes — `create_workspace_trusted` does not re-canonicalize
- Given `rebuild_fts_index` is called, then the FTS index is rebuilt from the content table without error
- Given `loadFilteredNotes` fails, when the error occurs, then the previous note list is retained and `notesError` is set
- Given a path canonicalized with `dunce::canonicalize`, then no `\\?\` prefix appears in the result

## Verification

**Commands:**
- `cd src-tauri && cargo test` -- expected: all tests pass including new FTS rebuild test
- `cd src-tauri && cargo clippy` -- expected: no warnings
- `npm run build` -- expected: TypeScript compiles cleanly
- `npx vitest run` -- expected: all frontend tests pass

## Suggested Review Order

**Double-canonicalize fix (start here)**

- `resolve_workspace` now calls `upsert_workspace` — skips re-canonicalization
  [`workspace_service.rs:131`](../../src-tauri/src/services/workspace_service.rs#L131)

- Internal `upsert_workspace` extracted from `create_workspace` — trusts pre-validated path
  [`workspace_service.rs:57`](../../src-tauri/src/services/workspace_service.rs#L57)

- `dunce::canonicalize` replaces `std::fs::canonicalize` in `create_workspace`
  [`workspace_service.rs:43`](../../src-tauri/src/services/workspace_service.rs#L43)

- Same replacement in `detect_workspace`
  [`workspace_service.rs:85`](../../src-tauri/src/services/workspace_service.rs#L85)

**FTS5 rebuild mechanism**

- Service function: single SQL statement rebuilds index from content table
  [`notes.rs:103`](../../src-tauri/src/services/notes.rs#L103)

- Thin command handler delegates to service
  [`notes.rs:55`](../../src-tauri/src/commands/notes.rs#L55)

- Test simulates real FTS drift (drop trigger, insert, rebuild, verify recovery)
  [`search_tests.rs:317`](../../src-tauri/tests/search_tests.rs#L317)

**Frontend error consistency**

- `loadFilteredNotes` retains stale data on error, clears `notesError` eagerly on load start
  [`store.ts:78`](../../src/features/workspace/store.ts#L78)

- `clearActiveWorkspace` resets `notesError` alongside other state
  [`store.ts:60`](../../src/features/workspace/store.ts#L60)

**Peripherals**

- `dunce` added as direct dependency
  [`Cargo.toml:42`](../../src-tauri/Cargo.toml#L42)

- Command registered in specta builder
  [`lib.rs:24`](../../src-tauri/src/lib.rs#L24)

- ACL permission added to default capability
  [`default.json:25`](../../src-tauri/capabilities/default.json#L25)

- EXPECTED_COMMANDS updated in ACL tests
  [`acl_tests.rs:20`](../../src-tauri/tests/acl_tests.rs#L20)
