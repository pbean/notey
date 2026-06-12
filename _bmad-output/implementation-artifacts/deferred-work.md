# Deferred Work

### DW-1: Story 1.6 — Design Token System (CSS Custom Properties)

origin: migrated from legacy ledger ("Cluster 2: Frontend Core (Stories 1.6–1.10) DONE"), 2026-06-12
location: n/a
reason: Story 1.6 — Design Token System (CSS Custom Properties)
status: done 2026-04-04

### DW-2: Story 1.7 — App Shell Layout (CaptureWindow + StatusBar)

origin: migrated from legacy ledger ("Cluster 2: Frontend Core (Stories 1.6–1.10) DONE"), 2026-06-12
location: n/a
reason: Story 1.7 — App Shell Layout (CaptureWindow + StatusBar)
status: done 2026-04-04

### DW-3: Story 1.8 — CodeMirror 6 Markdown Editor

origin: migrated from legacy ledger ("Cluster 2: Frontend Core (Stories 1.6–1.10) DONE"), 2026-06-12
location: n/a
reason: Story 1.8 — CodeMirror 6 Markdown Editor
status: done 2026-04-04

### DW-4: Story 1.9 — Auto-Save with Debounce & Save Indicator

origin: migrated from legacy ledger ("Cluster 2: Frontend Core (Stories 1.6–1.10) DONE"), 2026-06-12
location: n/a
reason: Story 1.9 — Auto-Save with Debounce & Save Indicator
status: done 2026-04-04

### DW-5: Story 1.10 — Note Format Toggle (Markdown / Plain Text)

origin: migrated from legacy ledger ("Cluster 2: Frontend Core (Stories 1.6–1.10) DONE"), 2026-06-12
location: n/a
reason: Story 1.10 — Note Format Toggle (Markdown / Plain Text)
status: done 2026-04-04

### DW-6: Story 1.9 — Auto-Save with Debounce & Save Indicator (300ms debounce, SaveIndicator 3-state display, `flushSave()` for Esc)

origin: migrated from legacy ledger ("Cluster 2b: Auto-Save & Format Toggle (Stories 1.9–1.10) DONE"), 2026-06-12
location: n/a
reason: Story 1.9 — Auto-Save with Debounce & Save Indicator (300ms debounce, SaveIndicator 3-state display, `flushSave()` for Esc)
status: done 2026-04-04

### DW-7: Story 1.10 — Note Format Toggle (Markdown / Plain Text, CodeMirror compartment swap, persisted per note)

origin: migrated from legacy ledger ("Cluster 2b: Auto-Save & Format Toggle (Stories 1.9–1.10) DONE"), 2026-06-12
location: n/a
reason: Story 1.10 — Note Format Toggle (Markdown / Plain Text, CodeMirror compartment swap, persisted per note)
status: done 2026-04-04

### DW-8: `setNoteId` null-reset

origin: migrated from legacy ledger ("Deferred from: Stories 1.6–1.8 review (2026-04-03) DONE (commit 9cbaebe)"), 2026-06-12
location: n/a
reason: `setNoteId` null-reset
status: done 2026-04-03
resolution: `resetNote()` action added to editor store

### DW-9: `view.focus()` on hidden window

origin: migrated from legacy ledger ("Deferred from: Stories 1.6–1.8 review (2026-04-03) DONE (commit 9cbaebe)"), 2026-06-12
location: n/a
reason: `view.focus()` on hidden window
status: done 2026-04-03
resolution: Fixed in Story 1.11 (`useWindowFocus` hook)

### DW-10: Note content load path

origin: migrated from legacy ledger ("Deferred from: Stories 1.6–1.8 review (2026-04-03) DONE (commit 9cbaebe)"), 2026-06-12
location: n/a
reason: Note content load path
status: done 2026-04-03
resolution: `loadNote` store action + `useNoteHydration` hook (commit 2b72eb9)

### DW-11: `lastSavedAt` uses client clock

origin: migrated from legacy ledger ("Deferred from: Stories 1.9–1.10 review (2026-04-03) DONE (commit 9cbaebe)"), 2026-06-12
location: n/a
reason: `lastSavedAt` uses client clock
status: done 2026-04-03
resolution: Switched to server-side `updatedAt`

### DW-12: Cluster 3: Window & Daemon (Stories 1.11–1.14) DONE

origin: migrated from legacy ledger ("Cluster 3: Window & Daemon (Stories 1.11–1.14) DONE"), 2026-06-12
location: n/a
reason: ### Cluster 3: Window & Daemon (Stories 1.11–1.14) DONE
status: done 2026-04-04

### DW-13: Hotkey re-registration on config change

origin: migrated from legacy ledger ("Deferred from: Stories 1.11–1.14 review (2026-04-04) DONE (commit 9cbaebe)"), 2026-06-12
location: n/a
reason: Hotkey re-registration on config change
status: done 2026-04-04
resolution: Live re-registration with rollback on failure

### DW-14: Non-atomic config write

origin: migrated from legacy ledger ("Deferred from: Stories 1.11–1.14 review (2026-04-04) DONE (commit 9cbaebe)"), 2026-06-12
location: n/a
reason: Non-atomic config write
status: done 2026-04-04
resolution: Atomic write via temp+rename with cleanup on error

### DW-15: Mutex held across I/O in `update_config`

origin: migrated from legacy ledger ("Deferred from: Stories 1.11–1.14 review (2026-04-04) DONE (commit 9cbaebe)"), 2026-06-12
location: n/a
reason: Mutex held across I/O in `update_config`
status: done 2026-04-04
resolution: Lock released before filesystem I/O

### DW-16: Shortcut string validation in `update_config`

origin: migrated from legacy ledger ("Deferred from: Stories 1.11–1.14 review (2026-04-04) DONE (commit 9cbaebe)"), 2026-06-12
location: n/a
reason: Shortcut string validation in `update_config`
status: done 2026-04-04
resolution: Validated via `parse_shortcut` before persist

### DW-17: Test data factories

origin: migrated from legacy ledger ("Deferred from: Epic 1 Retro Action Items (2026-04-04) DONE (commits 2b72eb9, cc8e634)"), 2026-06-12
location: src-tauri/tests/helpers/factories.rs
reason: Test data factories
status: done 2026-04-04
resolution: Rust `NoteBuilder` + `setup_test_db` in `src-tauri/tests/helpers/factories.rs`, TS `buildNote`/`buildConfig` in `src/test-utils/factories.ts`

### DW-18: Note content load path

origin: migrated from legacy ledger ("Deferred from: Epic 1 Retro Action Items (2026-04-04) DONE (commits 2b72eb9, cc8e634)"), 2026-06-12
location: n/a
reason: Note content load path
status: done 2026-04-04
resolution: `loadNote` store action + `useNoteHydration` hook + EditorPane integration

### DW-19: P0 test suite (7/7)

origin: migrated from legacy ledger ("Deferred from: Epic 1 Retro Action Items (2026-04-04) DONE (commits 2b72eb9, cc8e634)"), 2026-06-12
location: n/a
reason: P0 test suite (7/7)
status: done 2026-04-04
resolution: P0-UNIT-001, P0-UNIT-002, P0-INT-001, P0-INT-002, P0-INT-003 (unit/integration), P0-INT-006 (ACL config validation), P0-E2E-001 (capture loop E2E via tauri-driver)

### DW-20: P1 test suite (6/6)

origin: migrated from legacy ledger ("Deferred from: Epic 1 Retro Action Items (2026-04-04) DONE (commits 2b72eb9, cc8e634)"), 2026-06-12
location: n/a
reason: P1 test suite (6/6)
status: done 2026-04-04
resolution: P1-UNIT-005, P1-UNIT-006, P1-UNIT-007, P1-INT-011, P1-UNIT-008 (unit/integration), P1-INT-012 (window management E2E via tauri-driver)

### DW-21: CI pipeline

origin: migrated from legacy ledger ("Deferred from: Epic 1 Retro Action Items (2026-04-04) DONE (commits 2b72eb9, cc8e634)"), 2026-06-12
location: .github/workflows/ci.yml
reason: CI pipeline
status: done 2026-04-04
resolution: `.github/workflows/ci.yml` — 3-platform matrix (ubuntu, macos, windows)

### DW-22: Story template process update

origin: migrated from legacy ledger ("Deferred from: Epic 1 Retro Action Items (2026-04-04) DONE (commits 2b72eb9, cc8e634)"), 2026-06-12
location: _bmad/bmm/4-implementation/bmad-create-story/template.md
reason: Story template process update
status: done 2026-04-04
resolution: Required Tests section added to `_bmad/bmm/4-implementation/bmad-create-story/template.md`

### DW-23: Document `patches/specta/` directory

origin: migrated from legacy ledger ("Deferred from: Epic 1 Retro Action Items (2026-04-04) DONE (commits 2b72eb9, cc8e634)"), 2026-06-12
location: patches/specta/
reason: Document `patches/specta/` directory
status: done 2026-04-04
resolution: `patches/specta/README.md` documenting stable-Rust fallback plan

### DW-24: P0-INT-006

origin: migrated from legacy ledger ("Remaining: Tauri-runtime tests (require E2E infrastructure) DONE"), 2026-06-12
location: src-tauri/tests/acl_tests.rs
reason: P0-INT-006
status: done 2026-04-04
resolution: ACL capability validation tests (`src-tauri/tests/acl_tests.rs`) — no wildcards, single window scope, command allowlist verified

### DW-25: P0-E2E-001

origin: migrated from legacy ledger ("Remaining: Tauri-runtime tests (require E2E infrastructure) DONE"), 2026-06-12
location: e2e/run.mjs
reason: P0-E2E-001
status: done 2026-04-04
resolution: Capture loop E2E via tauri-driver (`e2e/run.mjs`) — editor visible, typed content accepted, auto-save without error, Esc dismiss

### DW-26: P1-INT-012

origin: migrated from legacy ledger ("Remaining: Tauri-runtime tests (require E2E infrastructure) DONE"), 2026-06-12
location: e2e/run.mjs
reason: P1-INT-012
status: done 2026-04-04
resolution: Window management E2E via tauri-driver (`e2e/run.mjs`) — app shell renders, editor state persists, no save errors

### DW-27: `useNoteHydration` viewRef null guard

origin: migrated from legacy ledger ("Remaining: Code quality issues surfaced by review (2026-04-04) DONE"), 2026-06-12
location: n/a
reason: `useNoteHydration` viewRef null guard
status: done 2026-04-04
resolution: Keep `isHydrating` when viewRef is null so next render retries

### DW-28: `create_temp_db` collision risk

origin: migrated from legacy ledger ("Remaining: Code quality issues surfaced by review (2026-04-04) DONE"), 2026-06-12
location: n/a
reason: `create_temp_db` collision risk
status: done 2026-04-04
resolution: Replaced with `tempfile::TempDir` (auto-cleanup on drop)

### DW-29: Esc dismiss on flushSave failure

origin: migrated from legacy ledger ("Remaining: Code quality issues surfaced by review (2026-04-04) DONE"), 2026-06-12
location: n/a
reason: Esc dismiss on flushSave failure
status: done 2026-04-04
resolution: Reordered `.then().catch()` so dismiss only fires on success

### DW-30: `flushSave` leaks `isCreating` on throw

origin: migrated from legacy ledger ("Remaining: Code quality issues surfaced by review (2026-04-04) DONE"), 2026-06-12
location: n/a
reason: `flushSave` leaks `isCreating` on throw
status: done 2026-04-04
resolution: Wrapped in `try/finally` in both flushSave and debounce callback

### DW-31: `useWindowFocus` StrictMode double-listener

origin: migrated from legacy ledger ("Remaining: Code quality issues surfaced by review (2026-04-04) DONE"), 2026-06-12
location: n/a
reason: `useWindowFocus` StrictMode double-listener
status: done 2026-04-04
resolution: Replaced ref with local `cancelled` variable scoped per effect invocation

### DW-32: Item 3 (HIGH): Add input validation for empty name/path in `create_workspace` — `src-tauri/src/services/workspace_service.rs`

origin: migrated from legacy ledger ("Deferred from: Epic 2 Retro Action Items — Group B/C/D (2026-04-05) DONE"), 2026-06-12
location: src-tauri/src/services/workspace_service.rs
reason: Item 3 (HIGH): Add input validation for empty name/path in `create_workspace` — `src-tauri/src/services/workspace_service.rs`
status: done 2026-04-05

### DW-33: Item 4 (HIGH): Audit and fix `console.error` logging gaps in frontend store actions — `src/features/workspace/store.ts`, `src/features/editor/store.ts`

origin: migrated from legacy ledger ("Deferred from: Epic 2 Retro Action Items — Group B/C/D (2026-04-05) DONE"), 2026-06-12
location: src/features/workspace/store.ts
reason: Item 4 (HIGH): Audit and fix `console.error` logging gaps in frontend store actions — `src/features/workspace/store.ts`, `src/features/editor/store.ts`
status: done 2026-04-05

### DW-34: Item 8 (LOW): Add `buildWorkspaceInfo()` to TS test factories — `src/test-utils/factories.ts`

origin: migrated from legacy ledger ("Deferred from: Epic 2 Retro Action Items — Group B/C/D (2026-04-05) DONE"), 2026-06-12
location: src/test-utils/factories.ts
reason: Item 8 (LOW): Add `buildWorkspaceInfo()` to TS test factories — `src/test-utils/factories.ts`
status: done 2026-04-05

### DW-35: Workspace path format validation

origin: migrated from legacy ledger ("Deferred from: code review of 3-1-fts5-virtual-table-sync-triggers (2026-04-05) DONE"), 2026-06-12
location: n/a
reason: Workspace path format validation — `create_workspace` rejects empty/whitespace paths but doesn't validate path format (absolute, valid chars) or existence. Scope was limited to RETRO-2-003 (empty/whitespace rejection).
status: done 2026-04-05
resolution: Added `canonicalize` + `is_dir` validation to `create_workspace`

### DW-36: Workspace store error propagation

origin: migrated from legacy ledger ("Deferred from: code review of 3-1-fts5-virtual-table-sync-triggers (2026-04-05) DONE"), 2026-06-12
location: n/a
reason: Workspace store error propagation — `listWorkspaces` failure is logged via `console.error` but not surfaced to UI state. Workspace list may show stale data on failure without user feedback.
status: done 2026-04-05
resolution: `workspaceError` displayed inline in `WorkspaceSelector` dropdown

### DW-37: loadNote format validation

origin: migrated from legacy ledger ("Deferred from: code review of 3-1-fts5-virtual-table-sync-triggers (2026-04-05) DONE"), 2026-06-12
location: editor/store.ts
reason: loadNote format validation — `loadNote` trusts the backend format value without validating it falls within the NoteFormat union. Backend SQL CHECK constraint provides the guard, but no frontend validation exists.
status: done 2026-04-05
resolution: Already implemented (editor/store.ts lines 74-77)

### DW-38: `to_string_lossy` non-UTF-8 path corruption

origin: migrated from legacy ledger ("Deferred from: code review of 3-1-fts5-virtual-table-sync-triggers (2026-04-05) DONE"), 2026-06-12
location: n/a
reason: `to_string_lossy` non-UTF-8 path corruption — `create_workspace`, `detect_workspace`, and `resolve_workspace` all use `to_string_lossy()` to convert canonical paths to strings. On Linux, paths with non-UTF-8 bytes get silently mangled (U+FFFD replacement). Should use `to_str()` with a proper error on non-UTF-8 paths.
status: done 2026-04-05
resolution: Replaced all `to_string_lossy()` with `path_to_str()` helper that returns `Validation` error on non-UTF-8

### DW-39: Double-canonicalize in resolve_workspace chain

origin: migrated from legacy ledger ("Deferred from: code review pass 2 of 3-1-fts5-virtual-table-sync-triggers (2026-04-05) DONE"), 2026-06-12
location: n/a
reason: Double-canonicalize in resolve_workspace chain — `resolve_workspace` calls `detect_workspace` (which canonicalizes) then `create_workspace` (which canonicalizes again). Pre-existing architecture, redundant syscall, tiny TOCTOU window.
status: done 2026-04-05
resolution: Extracted `upsert_workspace` internal function; `resolve_workspace` bypasses re-canonicalization

### DW-40: FTS5 external content drift risk

origin: migrated from legacy ledger ("Deferred from: code review pass 2 of 3-1-fts5-virtual-table-sync-triggers (2026-04-05) DONE"), 2026-06-12
location: n/a
reason: FTS5 external content drift risk — No `INSERT INTO notes_fts(notes_fts) VALUES('rebuild')` or periodic integrity check. If notes are ever modified bypassing triggers, the FTS index silently desyncs with no recovery mechanism.
status: done 2026-04-05
resolution: Added `rebuild_fts_index` service function + Tauri command

### DW-41: FTS5 migration has no down migration

origin: migrated from legacy ledger ("Deferred from: code review pass 2 of 3-1-fts5-virtual-table-sync-triggers (2026-04-05) DONE"), 2026-06-12
location: n/a
reason: FTS5 migration has no down migration — None of the 3 migrations define `M::down()`. If migration 3 partially applies despite transaction wrapping, recovery requires manual DB intervention.
status: done 2026-04-05
resolution: Closed: by-design forward-only migration strategy, SQLite transaction wrapping prevents partial application

### DW-42: FTS5 MATCH syntax error on special characters

origin: migrated from legacy ledger ("Deferred from: code review pass 2 of 3-1-fts5-virtual-table-sync-triggers (2026-04-05) DONE"), 2026-06-12
location: n/a
reason: FTS5 MATCH syntax error on special characters — When search is added (story 3.2), queries with `*`, `"`, `(`, `)`, `NEAR`, `OR`, `AND`, `NOT` will cause `fts5: syntax error`. Input escaping or query sanitization needed in the search command.
status: done 2026-04-05
resolution: Fixed in story 3.2: allowlist-based `sanitize_fts_query` strips all non-alphanumeric characters

### DW-43: `loadFilteredNotes` error handling inconsistency

origin: migrated from legacy ledger ("Deferred from: code review pass 2 of 3-1-fts5-virtual-table-sync-triggers (2026-04-05) DONE"), 2026-06-12
location: n/a
reason: `loadFilteredNotes` error handling inconsistency — On error, `loadFilteredNotes` clears `filteredNotes` to `[]` (causing UI flash), while `loadWorkspaces` retains stale data. Asymmetric error UX.
status: done 2026-04-05
resolution: Aligned to retain stale data + `notesError` field

### DW-44: Windows `canonicalize` UNC prefix

origin: migrated from legacy ledger ("Deferred from: code review pass 2 of 3-1-fts5-virtual-table-sync-triggers (2026-04-05) DONE"), 2026-06-12
location: n/a
reason: Windows `canonicalize` UNC prefix — `std::fs::canonicalize` on Windows returns `\\?\C:\...` paths, which display in the UI. All lookups are consistent (both use canonical form) so no functional bug, but UX issue on Windows.
status: done 2026-04-05
resolution: Replaced with `dunce::canonicalize` which strips UNC prefixes on Windows

### DW-45: Item 5 (HIGH): FTS5 external content table research document — `_bmad-output/implementation-artifacts/fts5-research.md`

origin: migrated from legacy ledger ("Deferred from: code review pass 2 of 3-1-fts5-virtual-table-sync-triggers (2026-04-05) DONE"), 2026-06-12
location: _bmad-output/implementation-artifacts/fts5-research.md
reason: Item 5 (HIGH): FTS5 external content table research document — `_bmad-output/implementation-artifacts/fts5-research.md`
status: done 2026-04-05

### DW-46: Item 9 (LOW): Document permission TOML manual creation workaround — `_bmad-output/project-context.md`

origin: migrated from legacy ledger ("Deferred from: code review pass 2 of 3-1-fts5-virtual-table-sync-triggers (2026-04-05) DONE"), 2026-06-12
location: _bmad-output/project-context.md
reason: Item 9 (LOW): Document permission TOML manual creation workaround — `_bmad-output/project-context.md`
status: done 2026-04-05

### DW-47: Item 6 (MEDIUM): Add remaining Epic 1 P0 tests — auto-save debounce, DB crash recovery, ACL coverage

origin: migrated from legacy ledger ("Deferred from: code review pass 2 of 3-1-fts5-virtual-table-sync-triggers (2026-04-05) DONE"), 2026-06-12
location: n/a
reason: Item 6 (MEDIUM): Add remaining Epic 1 P0 tests — auto-save debounce, DB crash recovery, ACL coverage
status: done 2026-04-05

### DW-48: Item 7 (MEDIUM): Add remaining Epic 1 P1 tests — error serialization, flush-on-dismiss, format toggle, migrations, state management

origin: migrated from legacy ledger ("Deferred from: code review pass 2 of 3-1-fts5-virtual-table-sync-triggers (2026-04-05) DONE"), 2026-06-12
location: n/a
reason: Item 7 (MEDIUM): Add remaining Epic 1 P1 tests — error serialization, flush-on-dismiss, format toggle, migrations, state management
status: done 2026-04-05

### DW-49: P0-E2E-001 (capture loop E2E) and P1-INT-012 (window management E2E)

origin: migrated from legacy ledger ("Deferred from: code review pass 2 of 3-1-fts5-virtual-table-sync-triggers (2026-04-05) DONE"), 2026-06-12
location: e2e/run.mjs
reason: P0-E2E-001 (capture loop E2E) and P1-INT-012 (window management E2E)
status: done 2026-04-05
resolution: `e2e/run.mjs` via tauri-driver, 7/7 tests pass (requires `npx tauri build --debug` for embedded frontend binary)

### DW-50: `reassignNoteWorkspace` fire-and-forget error recovery

origin: migrated from legacy ledger ("Deferred from: review-pass2-cleanup code review (2026-04-05) DONE"), 2026-06-12
location: n/a
reason: `reassignNoteWorkspace` fire-and-forget error recovery — `reassignNoteWorkspace` calls `loadFilteredNotes()` and `loadWorkspaces()` fire-and-forget after a successful reassign. If either reload fails, the UI shows stale data with no error feedback. Pre-existing pattern across all store actions that trigger async reloads.
status: done 2026-04-05
resolution: Awaited with `Promise.all` + `.catch()` guard so reloads complete before returning and unexpected throws don't swallow `result.data`

### DW-51: CI/E2E/bindings changes beyond story scope

origin: migrated from legacy ledger ("Deferred from: code review pass 3 of 3-1-fts5-virtual-table-sync-triggers (2026-04-06) DONE"), 2026-06-12
location: n/a
reason: CI/E2E/bindings changes beyond story scope — Infrastructure fixes tangential to story 3.1, bindings change is consequence of rebuild_fts_index command addition.
status: done 2026-04-06
resolution: Closed: no action needed — bindings auto-generated, CI stable, ACL configured

### DW-52: `upsert_workspace` TOCTOU gap

origin: migrated from legacy ledger ("Deferred from: code review pass 3 of 3-1-fts5-virtual-table-sync-triggers (2026-04-06) DONE"), 2026-06-12
location: n/a
reason: `upsert_workspace` TOCTOU gap — Directory could be deleted between `detect_workspace` canonicalizing and `upsert_workspace` inserting.
status: done 2026-04-06
resolution: Added `is_dir()` re-check in `upsert_workspace` (commit 77e6337)

### DW-53: Mutex poisoning recovery pattern

origin: migrated from legacy ledger ("Deferred from: code review pass 3 of 3-1-fts5-virtual-table-sync-triggers (2026-04-06) DONE"), 2026-06-12
location: n/a
reason: Mutex poisoning recovery pattern — `unwrap_or_else(|e| e.into_inner())` pre-existing across all Tauri commands.
status: done 2026-04-06
resolution: Added `eprintln!` warning before recovery across 13 instances (commit 77e6337)

### DW-54: `reassignNoteWorkspace` .catch() swallows reload errors

origin: migrated from legacy ledger ("Deferred from: code review pass 3 of 3-1-fts5-virtual-table-sync-triggers (2026-04-06) DONE"), 2026-06-12
location: n/a
reason: `reassignNoteWorkspace` .catch() swallows reload errors — Store functions return `{status}` and handle errors internally, so `Promise.all` only rejects on unexpected exceptions. Safety net pattern.
status: done 2026-04-06
resolution: Closed: correct safety net — both reload functions handle errors internally via workspaceError/notesError state

### DW-55: `detect_workspace` walks to root without depth limit

origin: migrated from legacy ledger ("Deferred from: code review pass 3 of 3-1-fts5-virtual-table-sync-triggers (2026-04-06) DONE"), 2026-06-12
location: n/a
reason: `detect_workspace` walks to root without depth limit
status: done 2026-04-06
resolution: Capped at MAX_DETECT_DEPTH (20 levels) (commit 77e6337)

### DW-56: `detect_workspace` fallback to "workspace" for root/non-UTF-8 dirs

origin: migrated from legacy ledger ("Deferred from: code review pass 3 of 3-1-fts5-virtual-table-sync-triggers (2026-04-06) DONE"), 2026-06-12
location: n/a
reason: `detect_workspace` fallback to "workspace" for root/non-UTF-8 dirs
status: done 2026-04-06
resolution: Replaced with deterministic FNV-1a `workspace_<hex8>` hash (commit 77e6337)

### DW-57: `initWorkspace` continues after `listWorkspaces` failure

origin: migrated from legacy ledger ("Deferred from: code review pass 3 of 3-1-fts5-virtual-table-sync-triggers (2026-04-06) DONE"), 2026-06-12
location: n/a
reason: `initWorkspace` continues after `listWorkspaces` failure
status: done 2026-04-06
resolution: Closed: graceful degradation is intentional — dropdown auto-retries on open (`onOpenChange` calls `loadWorkspaces`). Error messages updated with retry hints.

### DW-58: `scopeFilter` persists across workspace switches without resync

origin: migrated from legacy ledger ("Deferred from: code review of story 3-5-workspace-scoped-search-toggle (2026-04-09) DONE"), 2026-06-12
location: n/a
reason: `scopeFilter` persists across workspace switches without resync — When user toggles scope to "All Workspaces", then switches workspace via StatusBar, the scope filter remains "all" on next search open. AC 6 mandates session persistence, but resync on workspace switch could improve UX.
status: done 2026-04-09
resolution: Fixed: `resetScope()` called from `setActiveWorkspace`

### DW-59: Whitespace-only query: inconsistent `trim` handling

origin: migrated from legacy ledger ("Deferred from: code review of story 3-5-workspace-scoped-search-toggle (2026-04-09) DONE"), 2026-06-12
location: n/a
reason: Whitespace-only query: inconsistent `trim` handling — `handleInput` checks `currentQuery === ''` (permits whitespace-only queries to hit backend), while `handleScopeToggle` checks `currentQuery.trim()` (blocks whitespace-only re-search on toggle). Pre-existing inconsistency.
status: done 2026-04-09
resolution: Fixed: `handleInput` now uses `currentQuery.trim() === ''` consistently

### DW-60: Whitespace-only query shows "No notes matching ' '" in empty state

origin: migrated from legacy ledger ("Deferred from: code review of story 3-5-workspace-scoped-search-toggle (2026-04-09) DONE"), 2026-06-12
location: n/a
reason: Whitespace-only query shows "No notes matching ' '" in empty state — When user types only spaces, `setQuery` stores the raw whitespace. JSX checks `query !== ''` (not trimmed) for empty-state display, showing literal spaces in the message. Pre-existing UX artifact — our trim fix prevents the backend call but doesn't address the display.
status: done 2026-04-09
resolution: Fixed: JSX conditions use `query.trim()` for both visibility checks and display text

### DW-61: Async event handlers bypass `no-floating-promises`

origin: migrated from legacy ledger ("Deferred from: test-reset + ESLint code review (2026-04-09) DONE"), 2026-06-12
location: WorkspaceSelector.ts
reason: Async event handlers bypass `no-floating-promises` — `onClick={() => setActiveWorkspace(ws.id)}` and `onClick={() => setAllWorkspaces()}` in `WorkspaceSelector.tsx` (lines 87, 97), and `onChange={(e) => handleInput(e.target.value)}` in `SearchOverlay.tsx` (line 196) return async results that are silently discarded. The `no-floating-promises` rule doesn't flag these because React's event handler types expect `() => void`. The `no-misused-promises` rule would catch them. Consider enabling `no-misused-promises` in the ESLint config.
status: done 2026-04-09
resolution: Enabled `no-misused-promises`, fixed 5 violations with `void` operator (WorkspaceSelector 2, SearchOverlay 2, StatusBar 1)

### DW-62: `history()` extension not installed

origin: migrated from legacy ledger ("Deferred from: Epic 3 retrospective review findings (2026-04-09) DONE"), 2026-06-12
location: src/features/editor/components/EditorPane.tsx]~~
reason: `history()` extension not installed — notey's CodeMirror setup does not include the `history()` extension from `@codemirror/commands`. Undo/redo relies on browser-native behavior. Must be added before/during Story 4.4 (multi-tab) since undo history needs to persist per-tab via `EditorState`. [src/features/editor/components/EditorPane.tsx]
status: done 2026-04-09
resolution: Added `history()` + `historyKeymap` to EditorPane extensions

### DW-63: `sharedDebounceRef` module-scoped mutable state vs React 19 strict mode

origin: migrated from legacy ledger ("Deferred from: Epic 3 retrospective review findings (2026-04-09) DONE"), 2026-06-12
location: useAutoSave.ts
reason: `sharedDebounceRef` module-scoped mutable state vs React 19 strict mode — `useAutoSave.ts` uses a module-scoped `sharedDebounceRef` (not a React ref). In React 19 strict mode (dev only), the mount-unmount-remount cycle can cause the first mount's cleanup to clear a timer set by the second mount. Pre-existing fragility, becomes higher risk when multi-tab flush logic compounds on top. [src/features/editor/hooks/useAutoSave.ts]
status: done 2026-04-09
resolution: Converted `sharedDebounceRef` and `isCreating` to React refs; extracted `performSave` helper; `registeredFlush` module pointer for hook↔export link

### DW-64: Snippet `<mark>` HTML tags — XSS risk

origin: migrated from legacy ledger ("Deferred from: code review of 3-2-full-text-search-tauri-command (2026-04-06) — 1 open item remaining"), 2026-06-12
location: HighlightedSnippet.test.ts
reason: Snippet `<mark>` HTML tags — XSS risk — `snippet()` injects raw `<mark>` HTML into the snippet field. If story 3.3's frontend renders with innerHTML, note content containing malicious HTML could execute in the webview. Story 3.3 must use safe rendering.
status: done 2026-04-06
resolution: Verified safe: `HighlightedSnippet` component parses `<mark>` tags via regex, renders only extracted text as React text nodes — explicit XSS test exists at `HighlightedSnippet.test.tsx:43-52`

### DW-65: `std::Mutex` held across I/O in async handler

origin: migrated from legacy ledger ("Deferred from: code review of 3-2-full-text-search-tauri-command (2026-04-06) — 1 open item remaining"), 2026-06-12
location: n/a
reason: `std::Mutex` held across I/O in async handler — Blocking mutex lock spans the full FTS5 query duration in an async context. Pre-existing pattern across all Tauri commands.
status: done 2026-04-06
resolution: Fixed: removed `async` from all 16 command handlers; Tauri now runs them on its blocking thread pool

### DW-66: `i64`-to-`number` precision loss

origin: migrated from legacy ledger ("Deferred from: code review of 3-2-full-text-search-tauri-command (2026-04-06) — 1 open item remaining"), 2026-06-12
location: n/a
reason: `i64`-to-`number` precision loss — Specta 2.0.0-rc.24 maps Rust `i64` to JS `number` (IEEE 754 float). IDs beyond 2^53 lose precision silently. No BigInt support in current specta version; fixing would break 5 frontend files for zero practical risk in a notes app.
status: open
decision: 2026-06-12 Keep open, monitor specta

### DW-67: Title-only matches produce empty snippets

origin: migrated from legacy ledger ("Deferred from: code review of 3-2-full-text-search-tauri-command (2026-04-06) — 1 open item remaining"), 2026-06-12
location: n/a
reason: Title-only matches produce empty snippets — `snippet(notes_fts, 1, ...)` targets the content column. When a match is title-only with empty content, the snippet field returns `"..."`.
status: done 2026-04-06
resolution: Fixed: SQL CASE fallback to title snippet when content snippet is empty or `...`

### DW-68: `reassign_note_workspace` not in capabilities/ACL

origin: migrated from legacy ledger ("Deferred from: code review of 3-2-full-text-search-tauri-command (2026-04-06) — 1 open item remaining"), 2026-06-12
location: default.json
reason: `reassign_note_workspace` not in capabilities/ACL — Pre-existing: command registered in `collect_commands!` but missing from `default.json` and `EXPECTED_COMMANDS` in ACL tests.
status: done 2026-04-06
resolution: Fixed: added permission TOML, capability entry, and ACL test entry

### DW-69: Mutex poison recovery on inconsistent DB state

origin: migrated from legacy ledger ("Deferred from: backend robustness review (2026-04-06) DONE"), 2026-06-12
location: src-tauri/src/commands/notes.rs,
reason: Mutex poison recovery on inconsistent DB state — After a panic that poisons the DB mutex, `into_inner()` recovery may yield a connection with an open/partial transaction. No `ROLLBACK` or connection health check is performed before reuse. Pre-existing pattern across all Tauri commands. [src-tauri/src/commands/notes.rs, workspace.rs, config.rs]
status: done 2026-04-06
resolution: Extracted `recover_poisoned_db` helper with fire-and-forget ROLLBACK across all 10 DB command handlers

### DW-70: `cargo install tauri-driver || true` swallows install failures

origin: migrated from legacy ledger ("Deferred from: fix-linux-ci-e2e-timeout review (2026-04-05) DONE"), 2026-06-12
location: ci.yml:97
reason: `cargo install tauri-driver || true` swallows install failures — If cargo install fails (network, compilation), the CI silently proceeds and E2E times out with no diagnostic. Remove `|| true` or add `which tauri-driver` post-install check. (`ci.yml:97`)
status: done 2026-04-05
resolution: Removed `|| true`

### DW-71: `npx tauri build --debug || true` swallows build failures

origin: migrated from legacy ledger ("Deferred from: fix-linux-ci-e2e-timeout review (2026-04-05) DONE"), 2026-06-12
location: ci.yml:101
reason: `npx tauri build --debug || true` swallows build failures — Same pattern. The `test -f` guard catches missing binaries but loses all build diagnostics. Remove `|| true` and let the step fail noisily. (`ci.yml:101`)
status: done 2026-04-05
resolution: Removed `|| true` and redundant `test -f` guard

### DW-72: Stale comment references webkitgtk-6.0

origin: migrated from legacy ledger ("Deferred from: fix-linux-ci-e2e-timeout review (2026-04-05) DONE"), 2026-06-12
location: e2e/run.mjs:9
reason: Stale comment references webkitgtk-6.0 — `e2e/run.mjs:9` says "webkitgtk-6.0 package" but the project uses WebKitGTK 4.1. Update to reference `webkit2gtk-driver`.
status: done 2026-04-05
resolution: Updated to `webkit2gtk-driver`

### DW-73: macOS Cmd key parity for keyboard shortcuts

origin: migrated from legacy ledger ("Deferred from: 4-3-tab-keyboard-navigation review (2026-04-10) DONE"), 2026-06-12
location: src/features/tabs/hooks/useTabKeyboardNav.ts
reason: macOS Cmd key parity for keyboard shortcuts — Tab keyboard shortcuts only check `e.ctrlKey`, but CaptureWindow's Ctrl+F handler checks `(e.ctrlKey || e.metaKey)`. On macOS, users expect Cmd-based shortcuts. Cmd+Tab is consumed by the OS app switcher so it's moot, but Cmd+W and Cmd+1-9 may need platform-aware handling. Needs holistic treatment across all keyboard shortcuts, not just tab navigation. (`src/features/tabs/hooks/useTabKeyboardNav.ts`)
status: done 2026-04-10
resolution: Updated all three checks (Tab/W/1-9) to `(e.ctrlKey || e.metaKey)`; CaptureWindow shortcuts already had parity

### DW-74: Symmetric overlay mutual exclusion

origin: migrated from legacy ledger ("Deferred from: 4-5-command-palette-core review (2026-04-10) DONE"), 2026-06-12
location: n/a
reason: Symmetric overlay mutual exclusion — `useCommandPaletteStore.open()` closes search, and CaptureWindow's Ctrl+F handler closes the palette before opening search. However, `useSearchStore.openSearch()` does not close the command palette itself. If `openSearch()` is called from a future integration point (e.g., a button, a command palette action in 4.6), overlays could stack. Consider centralizing mutual exclusion in a shared overlay manager or having each store close the other.
status: done 2026-04-10
resolution: Fixed: `openSearch()` now calls `useCommandPaletteStore.getState().close()` (bidirectional exclusion)

### DW-75: `toggleLayoutMode` has no visible UI effect

origin: migrated from legacy ledger ("Deferred from: 4-6-command-palette-action-registry review (2026-04-10) DONE"), 2026-06-12
location: src/features/command-palette/actions.ts
reason: `toggleLayoutMode` has no visible UI effect — `toggleLayoutMode` persists the layout mode config change to the backend but performs no client-side DOM or state change. The UI won't visually react until layout mode rendering is implemented. (`src/features/command-palette/actions.ts`)
status: done 2026-04-10
resolution: Toggles `.compact` class on `documentElement`; `.compact` selector in `index.css` overrides `--space-1`–`--space-8` so spacing visibly tightens

### DW-76: Circular import between search and command-palette stores

origin: migrated from legacy ledger ("Deferred from: 4-6-command-palette-action-registry review (2026-04-10) DONE"), 2026-06-12
location: search/store.ts
reason: Circular import between search and command-palette stores — `search/store.ts` imports `command-palette/store.ts` and vice versa. Works at runtime because Zustand stores use lazy `getState()` in action callbacks, but fragile — any refactor adding top-level side effects could cause a runtime crash. Consider a shared overlay manager. (`src/features/search/store.ts`, `src/features/command-palette/store.ts`)
status: done 2026-04-10
resolution: Extracted `src/features/overlays/manager.ts` (register-from-store pattern); all three overlay stores now import only the manager, breaking the cycle

### DW-77: `reorderTabs` store action doesn't validate integer inputs

origin: migrated from legacy ledger ("Deferred from: 4-7-tab-reordering review (2026-04-10) DONE"), 2026-06-12
location: src/features/tabs/store.ts
reason: `reorderTabs` store action doesn't validate integer inputs — Passing `NaN` (e.g., from a failed `parseInt`) passes the bounds check (`NaN < 0` is false, `NaN >= length` is false) and reaches `splice(NaN, 1)`, which splices at index 0 — silently moving the wrong tab. Add integer validation. (`src/features/tabs/store.ts`)
status: done 2026-04-10
resolution: Added `Number.isInteger` guard at the top of `reorderTabs`; tests cover NaN/Infinity/float inputs

### DW-78: Circular dependency ring expanded to three stores

origin: migrated from legacy ledger ("Deferred from: 4-8-note-list-panel review (2026-04-11) DONE"), 2026-06-12
location: src/features/note-list/store.ts
reason: Circular dependency ring expanded to three stores — `note-list/store` imports `search/store` and `command-palette/store`; both reciprocate. Three-way circular import graph works via Zustand's lazy `getState()` but any refactor adding top-level side effects will break. Pre-existing pattern extended. Consider a shared overlay manager. (`src/features/note-list/store.ts`, `src/features/search/store.ts`, `src/features/command-palette/store.ts`)
status: done 2026-04-11
resolution: Resolved by the same `src/features/overlays/manager.ts` extraction; all three stores now use `closeOtherOverlays` + `registerOverlay` and import nothing from each other

### DW-79: `loadNote` failure leaves orphan tab

origin: migrated from legacy ledger ("Deferred from: 4-8-note-list-panel review (2026-04-11) DONE"), 2026-06-12
location: src/features/note-list/components/NoteListPanel.tsx
reason: `loadNote` failure leaves orphan tab — `selectNote` calls `openTab` synchronously then `loadNote` fire-and-forget. If `loadNote` fails, the tab exists but shows stale editor content. Pre-existing pattern shared with `SearchOverlay.openNote`. (`src/features/note-list/components/NoteListPanel.tsx`)
status: done 2026-04-11
resolution: `selectNote` now awaits `loadNote` and closes the orphan tab when the load did not make `noteId` the active note; race-safe under rapid clicks. SearchOverlay.openNote is unaffected — it never opens a tab itself.

### DW-80: Persisted `layoutMode` not applied at app startup

origin: migrated from legacy ledger ("Deferred from: spec-deferred-cleanup-epic-4-open-items review (2026-04-13) DONE (Epic 4 retro Action Items 1 & 2, `spec-layout-theme-persistence-fix.md`)"), 2026-06-12
location: main.ts
reason: Persisted `layoutMode` not applied at app startup — `toggleLayoutMode` toggles `.compact` on `documentElement` correctly, but `main.tsx` only applies `.dark` at boot and never reads `layoutMode` from the persisted config. After a restart, the saved `compact` state is lost from the DOM but kept in config, so the next toggle is a no-op until invoked twice. Theme has the same latent gap (boot is hard-coded to `dark`). Both should be addressed together by a single startup-config-application step in `src/main.tsx`. (`src/main.tsx`)
status: done 2026-04-13
resolution: Added `applyStartupConfig()` in `actions.ts`, called from `main.tsx`; reads config once and applies persisted theme + layout via shared class helpers

### DW-81: `toggleLayoutMode` / `toggleTheme` lack a concurrent-call guard

origin: migrated from legacy ledger ("Deferred from: spec-deferred-cleanup-epic-4-open-items review (2026-04-13) DONE (Epic 4 retro Action Items 1 & 2, `spec-layout-theme-persistence-fix.md`)"), 2026-06-12
location: src/features/command-palette/actions.ts
reason: `toggleLayoutMode` / `toggleTheme` lack a concurrent-call guard — Two rapid invocations (e.g. key-repeat on a future hotkey-bound action, or palette double-fire) both read `getConfig` before either writes, then both write to the same target value. Net effect: one intended toggle is lost. Mirrors the unguarded `toggleTheme` pattern; `createNewNote` uses an `isCreatingNote` flag for the same reason. Add the same guard to both toggle actions. (`src/features/command-palette/actions.ts`)
status: done 2026-04-13
resolution: Added `isTogglingTheme` / `isTogglingLayoutMode` in-flight boolean guards mirroring `isCreatingNote` (early-return + `finally` reset)

### DW-82: Startup-vs-toggle race (LOW)

origin: migrated from legacy ledger ("Deferred from: spec-layout-theme-persistence-fix review (2026-06-12)"), 2026-06-12
location: src/main.tsx
reason: Startup-vs-toggle race (LOW) — `applyStartupConfig` and the `toggleTheme`/`toggleLayoutMode` guards are independent, so a user toggle fired during the brief boot window before `applyStartupConfig`'s `getConfig` resolves could race the two `applyThemeClass` calls and leave the DOM disagreeing with persisted config until next restart. Reachability is near-zero (no interactive UI mounts until after `applyStartupConfig` is kicked off, and `getConfig` is a fast local TOML read), so not patched. If hardened later: have `applyStartupConfig` skip applying a dimension whose toggle guard is set, or share the guards. (`src/main.tsx`, `src/features/command-palette/actions.ts`)
status: open

### DW-83: No OS `system` theme resolution (LOW)

origin: migrated from legacy ledger ("Deferred from: spec-layout-theme-persistence-fix review (2026-06-12)"), 2026-06-12
location: src/features/command-palette/actions.ts
reason: No OS `system` theme resolution (LOW) — `theme: 'system'` (a value the backend `String` field permits, and the `buildConfig` test-factory default) is mapped to light visuals rather than resolved against `prefers-color-scheme`. There is no `matchMedia` logic anywhere. Intentionally out of scope per the spec's Ask-First boundary; revisit if real system-theme support is wanted. (`src/features/command-palette/actions.ts`)
status: open
decision: 2026-06-12 Build system-theme resolution — Add `matchMedia('(prefers-color-scheme: dark)')` resolution so a persisted `theme: 'system'` tracks the OS appearance live (apply on startup in `applyStartupConfig`, subscribe to changes, and resolve 'system' to dark/light in `applyThemeClass`).

### DW-84: `layoutMode: 'floating'` has no distinct styling (LOW, pre-existing)

origin: migrated from legacy ledger ("Deferred from: spec-layout-theme-persistence-fix review (2026-06-12)"), 2026-06-12
location: src-tauri/src/models/config.rs
reason: `layoutMode: 'floating'` has no distinct styling (LOW, pre-existing) — The backend default `layout_mode` is `"floating"` (`src-tauri/src/models/config.rs`), but `index.css` defines only `.compact`; `floating`/`comfortable`/any non-compact value all render as the comfortable base. A saved `floating` preference is indistinguishable from comfortable. Pre-existing vocabulary mismatch between backend default and frontend toggle (`comfortable`↔`compact`). (`src-tauri/src/models/config.rs`, `src/index.css`, `src/features/command-palette/actions.ts`)
status: open
decision: 2026-06-12 Align default to 'comfortable' — Change the backend `GeneralConfig` default `layout_mode` from 'floating' to 'comfortable' so the persisted vocabulary matches the frontend's comfortable/compact toggle, removing the dead 'floating' value and the double-toggle wart. Verify no other code depends on the literal 'floating'.
