---
title: 'Epic 1 retro prep sprint — test factories, P0/P1 tests, editor hydration, CI, process updates'
type: 'chore'
created: '2026-04-04'
status: 'done'
baseline_commit: '6b13c76'
context:
  - '_bmad-output/implementation-artifacts/epic-1-retro-2026-04-04.md'
---

<frozen-after-approval>

## Intent

**Problem:** Epic 1 shipped 14 stories with 21 Rust tests but zero frontend tests, no CI pipeline, no shared test factories, and an unresolved editor hydration gap blocking Epic 2 Story 2-5. The retro identified 7 action items gating Epic 2 kickoff.

**Approach:** Execute the retro critical path in dependency order: (1) test data factories, (2) P0/P1 test suites, (3) note content load path, (4) CI pipeline, (5) process housekeeping.

## Boundaries & Constraints

**Always:**
- Rust factories in `src-tauri/tests/helpers/` as proper module (mod.rs + factories.rs)
- TS factories in `src/test-utils/factories.ts` matching generated binding types from `src/generated/bindings.ts`
- Real SQLite for all Rust tests — no DB mocking
- Mock Tauri IPC layer for frontend tests — not Zustand stores
- `trash_note` service function must be created (does not exist yet) for P0-UNIT-002
- Editor hydration via `view.dispatch(state.update({ changes }))` — not by recreating the EditorView

**Ask First:**
- P0-INT-002 (process kill durability) and P0-INT-003 (integrity_check after concurrent writes) — flag if test harness complexity is unreasonable
- P0-E2E-001 (capture loop E2E) and P0-INT-006 (ACL rejection) — require Tauri runtime; flag approach before implementing
- P1-INT-012 (window management) — requires Tauri runtime; flag approach

**Never:**
- Don't modify existing passing tests — extend only
- Don't create barrel/index.ts files
- Don't add network requests in CI (offline app — no external service calls in tests)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Hydrate existing note | activeNoteId=5, note exists with content | CodeMirror doc replaced via dispatch | N/A |
| Hydrate empty new note | activeNoteId=5, content="" | CodeMirror doc cleared | N/A |
| Hydrate note not found | activeNoteId=999, note missing | Editor cleared, saveStatus='failed' | Log error, don't crash |
| Soft-delete note | trash_note(id) | is_trashed=1, deleted_at=ISO8601, excluded from list_notes | NotFound if missing |
| Format toggle round-trip | setFormat('plaintext'), save, reload | format='plaintext' persisted and returned | N/A |
| NoteyError serialization | serialize Database variant | JSON with expected shape | N/A |

</frozen-after-approval>

## Code Map

- `src-tauri/tests/helpers/mod.rs` -- NEW: test helpers module
- `src-tauri/tests/helpers/factories.rs` -- NEW: Rust factories (NoteBuilder, setup_test_db)
- `src-tauri/src/services/notes.rs` -- EXTEND: add `trash_note()` service + P0/P1 tests
- `src-tauri/src/errors.rs` -- TEST: P1-UNIT-007 serialization
- `src-tauri/tests/db_tests.rs` -- EXTEND: P0-INT-002/003, P1-UNIT-006
- `src/test-utils/factories.ts` -- NEW: TS factories (buildNote, buildConfig)
- `src/test-utils/setup.ts` -- NEW: Vitest setup with Tauri IPC mock
- `vitest.config.ts` -- MODIFY: add setup file
- `src/features/editor/store.ts` -- EXTEND: add `loadNote(id)` action
- `src/features/editor/store.test.ts` -- NEW: P1-UNIT-008
- `src/features/editor/hooks/useNoteHydration.ts` -- NEW: CodeMirror hydration hook
- `src/features/editor/components/EditorPane.tsx` -- MODIFY: integrate hydration hook
- `src/features/editor/hooks/useAutoSave.test.ts` -- NEW: P0-INT-001, P1-INT-011
- `.github/workflows/ci.yml` -- NEW: CI pipeline
- `_bmad/bmm/4-implementation/bmad-create-story/template.md` -- MODIFY: add Required Tests section
- `patches/specta/` -- EVALUATE: document or remove

## Tasks & Acceptance

**Execution:**

*Phase 1 — Test Infrastructure*
- [x] `src-tauri/tests/helpers/mod.rs` -- Declare `pub mod factories;`
- [x] `src-tauri/tests/helpers/factories.rs` -- `NoteBuilder` (defaults: id=1, title="Test Note", content="", format="markdown", is_trashed=false, timestamps=now) with `.title()`, `.content()`, `.format()`, `.trashed()` chainable setters and `.build() -> Note`, `.insert(conn) -> Note`. Extract `setup_test_db() -> Connection` from ad-hoc patterns in existing tests.
- [x] `src/test-utils/factories.ts` -- `buildNote(overrides?)` and `buildConfig(overrides?)` returning types matching generated bindings. Sensible defaults for all fields.
- [x] `src/test-utils/setup.ts` -- Mock `@tauri-apps/api/core` invoke function. Map command names to mock responses. Export `mockInvoke` for per-test customization.
- [x] `vitest.config.ts` -- Add `setupFiles: ['./src/test-utils/setup.ts']`

*Phase 2 — P0 Tests*
- [x] `src-tauri/src/services/notes.rs` -- P0-UNIT-001: refactor existing CRUD tests to use NoteBuilder/setup_test_db from factories
- [x] `src-tauri/src/services/notes.rs` -- Add `trash_note(conn, id) -> Result<Note>` function: sets is_trashed=1 + deleted_at=Utc::now RFC3339. Then P0-UNIT-002: test trash_note sets fields correctly, list_notes excludes trashed.
- [x] `src/features/editor/hooks/useAutoSave.test.ts` -- P0-INT-001: mock timers + IPC; verify save triggers within 500ms of content change
- [x] `src-tauri/tests/db_tests.rs` -- P0-INT-002: write note, force WAL checkpoint, verify data intact after close+reopen
- [x] `src-tauri/tests/db_tests.rs` -- P0-INT-003: concurrent writes via multiple connections, then PRAGMA integrity_check = "ok"
- [x] P0-INT-006 and P0-E2E-001 — **ASK FIRST**: require Tauri runtime/WebDriver. Flag approach before implementing.

*Phase 3 — P1 Tests*
- [x] `src-tauri/src/services/notes.rs` -- P1-UNIT-005: create note as markdown, update to plaintext, get_note confirms format persisted
- [x] `src-tauri/tests/db_tests.rs` -- P1-UNIT-006: apply migrations to fresh DB, then to existing DB with prior migration — both produce identical schema
- [x] `src-tauri/src/errors.rs` -- P1-UNIT-007: serde_json::to_value each NoteyError variant, assert expected JSON shape
- [x] `src/features/editor/hooks/useAutoSave.test.ts` -- P1-INT-011: verify debounce resets on rapid keystrokes + flushSave bypasses debounce
- [x] P1-INT-012 — **ASK FIRST**: window management tests require Tauri runtime
- [x] `src/features/editor/store.test.ts` -- P1-UNIT-008: test setContent, setFormat, resetNote, markSaved state transitions using useEditorStore

*Phase 4 — Note Content Load Path*
- [x] `src/features/editor/store.ts` -- Add `loadNote(id: number)` action: call `commands.getNote(id)`, set activeNoteId/content/format/saveStatus on success, set saveStatus='failed' on error
- [x] `src/features/editor/hooks/useNoteHydration.ts` -- Create hook accepting EditorView ref + content from store. On content change (from loadNote, not typing), dispatch `view.state.update({ changes: { from: 0, to: view.state.doc.length, insert: content } })`. Use a flag/ref to distinguish load vs. user edit to avoid circular updates.
- [x] `src/features/editor/components/EditorPane.tsx` -- Integrate: pass viewRef to useNoteHydration, call with store content

*Phase 5 — CI Pipeline*
- [x] `.github/workflows/ci.yml` -- Trigger: push + PR to main. Matrix: ubuntu-latest, macos-latest, windows-latest. Steps: checkout, install Rust nightly-2026-04-03, install Node 22, cargo test, cargo clippy -- -D warnings, npm ci, npx vitest run. Linux uses `xvfb-run` prefix for display-dependent steps. Cache: cargo registry + target, node_modules.

*Phase 6 — Process Housekeeping*
- [x] `_bmad/bmm/4-implementation/bmad-create-story/template.md` -- Add `## Required Tests` section after Acceptance Criteria with placeholder: `<!-- Map test IDs from test-design handoff -->`
- [x] `patches/specta/` -- Add `patches/specta/README.md` documenting purpose (stable-Rust-compatible specta fork using wrapper struct instead of fmt::from_fn), current status (not wired into build — no [patch] in Cargo.toml), and disposition (fallback plan if nightly pin becomes untenable)

**Acceptance Criteria:**
- Given factories exist, when Rust/TS tests import them, then valid test data is produced with one call
- Given `trash_note(conn, id)` is called, when note exists, then is_trashed=1 and deleted_at is set and list_notes excludes it
- Given P0 suite runs via `cargo test` + `vitest run`, then 5 automatable P0 tests pass (2 flagged Ask First)
- Given P1 suite runs, then ≥5 of 5 automatable P1 tests pass (1 flagged Ask First)
- Given activeNoteId changes in store via `loadNote(id)`, when EditorPane is mounted, then CodeMirror doc is hydrated with fetched content
- Given CI workflow exists, when code is pushed to main or PR opened, then tests + clippy run on 3 platforms
- Given story template updated, when new story created, then Required Tests section is present

## Spec Change Log

## Verification

**Commands:**
- `cd src-tauri && cargo test` -- expected: all existing + new Rust tests pass
- `npx vitest run` -- expected: all new TS tests pass
- `cd src-tauri && cargo clippy -- -D warnings` -- expected: no warnings
- `npx tsc --noEmit` -- expected: no type errors

## Suggested Review Order

**Note Content Load Path**

- Entry point: `loadNote` action fetches note via IPC and sets `isHydrating` flag
  [`store.ts:70`](../../src/features/editor/store.ts#L70)

- Hydration hook dispatches fetched content into CodeMirror, clears flag
  [`useNoteHydration.ts:14`](../../src/features/editor/hooks/useNoteHydration.ts#L14)

- One-line integration — hook wired into EditorPane with existing viewRef
  [`EditorPane.tsx:10`](../../src/features/editor/components/EditorPane.tsx#L10)

- Phantom-save guard: auto-save skips when content change is from hydration
  [`useAutoSave.ts:88`](../../src/features/editor/hooks/useAutoSave.ts#L88)

**Backend: trash_note + Service Tests**

- New `trash_note()` service function — soft-delete with is_trashed + deleted_at
  [`notes.rs:71`](../../src-tauri/src/services/notes.rs#L71)

- P0-UNIT-002 + edge cases: trash sets fields, not-found, already-trashed
  [`notes.rs:198`](../../src-tauri/src/services/notes.rs#L198)

- P1-UNIT-005: format toggle round-trip persistence
  [`notes.rs:257`](../../src-tauri/src/services/notes.rs#L257)

- P1-UNIT-007: all 6 NoteyError variants serialize with correct JSON shape
  [`errors.rs:59`](../../src-tauri/src/errors.rs#L59)

**Integration Tests (db_tests.rs)**

- Refactored to use NoteBuilder factory — trashed notes via builder not raw SQL
  [`db_tests.rs:124`](../../src-tauri/tests/db_tests.rs#L124)

- P0-INT-002: WAL checkpoint + reopen durability test
  [`db_tests.rs:140`](../../src-tauri/tests/db_tests.rs#L140)

- P0-INT-003: concurrent multi-connection writes + integrity_check
  [`db_tests.rs:169`](../../src-tauri/tests/db_tests.rs#L169)

- P1-UNIT-006: migration idempotency — fresh vs existing DB produce same schema
  [`db_tests.rs:206`](../../src-tauri/tests/db_tests.rs#L206)

**Test Infrastructure**

- Rust NoteBuilder: chainable builder + insert, shared DB setup helpers
  [`factories.rs:1`](../../src-tauri/tests/helpers/factories.rs#L1)

- TS factories: buildNote/buildConfig matching generated binding types
  [`factories.ts:1`](../../src/test-utils/factories.ts#L1)

- Vitest setup: Tauri IPC mock with per-test reset
  [`setup.ts:1`](../../src/test-utils/setup.ts#L1)

**Frontend Tests**

- P0-INT-001 + P1-INT-011: auto-save debounce timing, flushSave bypass, rapid keystroke reset
  [`useAutoSave.test.ts:1`](../../src/features/editor/hooks/useAutoSave.test.ts#L1)

- P1-UNIT-008: all editor store state transitions + isHydrating in resetNote
  [`store.test.ts:1`](../../src/features/editor/store.test.ts#L1)

**CI & Process**

- 3-platform GitHub Actions: cargo test + clippy + vitest, xvfb on Linux
  [`ci.yml:1`](../../.github/workflows/ci.yml#L1)

- Story template: Required Tests section with test ID mapping table
  [`template.md:17`](../../_bmad/bmm/4-implementation/bmad-create-story/template.md#L17)

- patches/specta documented as stable-Rust fallback, not wired into build
  [`README.md:1`](../../patches/specta/README.md#L1)
