# Deferred Work

## Deferred from: Epic 1 — Instant Note Capture (2026-04-03)

### Cluster 2: Frontend Core (Stories 1.6–1.10)

Depends on: Backend Foundation (Stories 1.1–1.5)

- **Story 1.6** — Design Token System (CSS Custom Properties)
- **Story 1.7** — App Shell Layout (CaptureWindow + StatusBar)
- **Story 1.8** — CodeMirror 6 Markdown Editor
- **Story 1.9** — Auto-Save with Debounce & Save Indicator
- **Story 1.10** — Note Format Toggle (Markdown / Plain Text)

### Cluster 2b: Auto-Save & Format Toggle (Stories 1.9–1.10)

Depends on: Frontend Core Visual Foundation (Stories 1.6–1.8)

- **Story 1.9** — Auto-Save with Debounce & Save Indicator (300ms debounce, SaveIndicator 3-state display, `flushSave()` for Esc)
- **Story 1.10** — Note Format Toggle (Markdown / Plain Text, CodeMirror compartment swap, persisted per note)

### ~~Deferred from: Stories 1.6–1.8 review (2026-04-03)~~ DONE (commit 9cbaebe)

- ~~**`setNoteId` null-reset**~~ → `resetNote()` action added to editor store
- ~~**`view.focus()` on hidden window**~~ → Fixed in Story 1.11 (`useWindowFocus` hook)
- ~~**Note content load path**~~ → `loadNote` store action + `useNoteHydration` hook (commit 2b72eb9)

### ~~Deferred from: Stories 1.9–1.10 review (2026-04-03)~~ DONE (commit 9cbaebe)

- ~~**`lastSavedAt` uses client clock**~~ → Switched to server-side `updatedAt`

### ~~Cluster 3: Window & Daemon (Stories 1.11–1.14)~~ DONE

### ~~Deferred from: Stories 1.11–1.14 review (2026-04-04)~~ DONE (commit 9cbaebe)

- ~~**Hotkey re-registration on config change**~~ → Live re-registration with rollback on failure
- ~~**Non-atomic config write**~~ → Atomic write via temp+rename with cleanup on error
- ~~**Mutex held across I/O in `update_config`**~~ → Lock released before filesystem I/O
- ~~**Shortcut string validation in `update_config`**~~ → Validated via `parse_shortcut` before persist

## ~~Deferred from: Epic 1 Retro Action Items (2026-04-04)~~ DONE (commits 2b72eb9, cc8e634)

Source: `_bmad-output/implementation-artifacts/epic-1-retro-2026-04-04.md`

- ~~**Test data factories**~~ → Rust `NoteBuilder` + `setup_test_db` in `src-tauri/tests/helpers/factories.rs`, TS `buildNote`/`buildConfig` in `src/test-utils/factories.ts`
- ~~**Note content load path**~~ → `loadNote` store action + `useNoteHydration` hook + EditorPane integration
- ~~**P0 test suite (7/7)**~~ → P0-UNIT-001, P0-UNIT-002, P0-INT-001, P0-INT-002, P0-INT-003 (unit/integration), P0-INT-006 (ACL config validation), P0-E2E-001 (capture loop E2E via tauri-driver)
- ~~**P1 test suite (6/6)**~~ → P1-UNIT-005, P1-UNIT-006, P1-UNIT-007, P1-INT-011, P1-UNIT-008 (unit/integration), P1-INT-012 (window management E2E via tauri-driver)
- ~~**CI pipeline**~~ → `.github/workflows/ci.yml` — 3-platform matrix (ubuntu, macos, windows)
- ~~**Story template process update**~~ → Required Tests section added to `_bmad/bmm/4-implementation/bmad-create-story/template.md`
- ~~**Document `patches/specta/` directory**~~ → `patches/specta/README.md` documenting stable-Rust fallback plan

### ~~Remaining: Tauri-runtime tests (require E2E infrastructure)~~ DONE

- ~~**P0-INT-006**~~ → ACL capability validation tests (`src-tauri/tests/acl_tests.rs`) — no wildcards, single window scope, command allowlist verified
- ~~**P0-E2E-001**~~ → Capture loop E2E via tauri-driver (`e2e/run.mjs`) — editor visible, typed content accepted, auto-save without error, Esc dismiss
- ~~**P1-INT-012**~~ → Window management E2E via tauri-driver (`e2e/run.mjs`) — app shell renders, editor state persists, no save errors

### ~~Remaining: Code quality issues surfaced by review (2026-04-04)~~ DONE

- ~~**`useNoteHydration` viewRef null guard**~~ → Keep `isHydrating` when viewRef is null so next render retries
- ~~**`create_temp_db` collision risk**~~ → Replaced with `tempfile::TempDir` (auto-cleanup on drop)
- ~~**Esc dismiss on flushSave failure**~~ → Reordered `.then().catch()` so dismiss only fires on success
- ~~**`flushSave` leaks `isCreating` on throw**~~ → Wrapped in `try/finally` in both flushSave and debounce callback
- ~~**`useWindowFocus` StrictMode double-listener**~~ → Replaced ref with local `cancelled` variable scoped per effect invocation

## Deferred from: Epic 2 Retro Action Items — Group B/C/D (2026-04-05)

Source: `_bmad-output/implementation-artifacts/epic-2-action-items.md`

**~~Group B — Code fixes:~~ DONE**
- ~~**Item 3** (HIGH): Add input validation for empty name/path in `create_workspace` — `src-tauri/src/services/workspace_service.rs`~~
- ~~**Item 4** (HIGH): Audit and fix `console.error` logging gaps in frontend store actions — `src/features/workspace/store.ts`, `src/features/editor/store.ts`~~
- ~~**Item 8** (LOW): Add `buildWorkspaceInfo()` to TS test factories — `src/test-utils/factories.ts`~~

### ~~Deferred from: code review of 3-1-fts5-virtual-table-sync-triggers (2026-04-05)~~ DONE

- ~~**Workspace path format validation** — `create_workspace` rejects empty/whitespace paths but doesn't validate path format (absolute, valid chars) or existence. Scope was limited to RETRO-2-003 (empty/whitespace rejection).~~ → Added `canonicalize` + `is_dir` validation to `create_workspace`
- ~~**Workspace store error propagation** — `listWorkspaces` failure is logged via `console.error` but not surfaced to UI state. Workspace list may show stale data on failure without user feedback.~~ → `workspaceError` displayed inline in `WorkspaceSelector` dropdown
- ~~**loadNote format validation** — `loadNote` trusts the backend format value without validating it falls within the NoteFormat union. Backend SQL CHECK constraint provides the guard, but no frontend validation exists.~~ → Already implemented (editor/store.ts lines 74-77)
- ~~**`to_string_lossy` non-UTF-8 path corruption** — `create_workspace`, `detect_workspace`, and `resolve_workspace` all use `to_string_lossy()` to convert canonical paths to strings. On Linux, paths with non-UTF-8 bytes get silently mangled (U+FFFD replacement). Should use `to_str()` with a proper error on non-UTF-8 paths.~~ → Replaced all `to_string_lossy()` with `path_to_str()` helper that returns `Validation` error on non-UTF-8

**~~Group C — Research and documentation:~~ DONE**
- ~~**Item 5** (HIGH): FTS5 external content table research document — `_bmad-output/implementation-artifacts/fts5-research.md`~~
- ~~**Item 9** (LOW): Document permission TOML manual creation workaround — `_bmad-output/project-context.md`~~

**~~Group D — Test backlog:~~ DONE**
- ~~**Item 6** (MEDIUM): Add remaining Epic 1 P0 tests — auto-save debounce, DB crash recovery, ACL coverage~~
- ~~**Item 7** (MEDIUM): Add remaining Epic 1 P1 tests — error serialization, flush-on-dismiss, format toggle, migrations, state management~~
- P0-E2E-001 (capture loop E2E) and P1-INT-012 (window management E2E) deferred — require tauri-driver infrastructure not yet set up
