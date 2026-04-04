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
- **Note content load path** — The editor has no mechanism to push existing content into CodeMirror after mount. Needs `view.dispatch(view.state.update({ changes: { from: 0, to: view.state.doc.length, insert: savedContent } }))` to hydrate a loaded note. (Depends on note-loading UI.)

### ~~Deferred from: Stories 1.9–1.10 review (2026-04-03)~~ DONE (commit 9cbaebe)

- ~~**`lastSavedAt` uses client clock**~~ → Switched to server-side `updatedAt`

### ~~Cluster 3: Window & Daemon (Stories 1.11–1.14)~~ DONE

### ~~Deferred from: Stories 1.11–1.14 review (2026-04-04)~~ DONE (commit 9cbaebe)

- ~~**Hotkey re-registration on config change**~~ → Live re-registration with rollback on failure
- ~~**Non-atomic config write**~~ → Atomic write via temp+rename with cleanup on error
- ~~**Mutex held across I/O in `update_config`**~~ → Lock released before filesystem I/O
- ~~**Shortcut string validation in `update_config`**~~ → Validated via `parse_shortcut` before persist

## Deferred from: Epic 1 Retro Action Items (2026-04-04)

Source: `_bmad-output/implementation-artifacts/epic-1-retro-2026-04-04.md`

- **Test data factories** — Rust (`src-tauri/tests/helpers/factories.rs`) + TypeScript (`src/test-utils/factories.ts`). Blocks all other test work.
- **Note content load path** — Editor hydration for existing notes via `view.dispatch(view.state.update({ changes: ... }))`. Blocks Epic 2 Story 2-5.
- **P0 test suite** — 7 tests (P0-UNIT-001, P0-UNIT-002, P0-INT-001, P0-INT-002, P0-INT-003, P0-INT-006, P0-E2E-001). Must pass 100% before Epic 2.
- **P1 test suite** — 6 tests (P1-UNIT-005, P1-UNIT-006, P1-UNIT-007, P1-INT-011, P1-INT-012, P1-UNIT-008). Must pass ≥95% before Epic 2.
- **CI pipeline** — GitHub Actions with xvfb + multi-platform matrix (Windows x64, macOS x64+ARM64, Linux x64+ARM64).
- **Story template process update** — Each story file must include "Required Tests" section mapping to test IDs from test design handoff.
- **Document `patches/specta/` directory** — Dead artifact containing a stable-Rust-compatible fork of specta (replaces `fmt::from_fn` with wrapper struct pattern). Not wired into build (`Cargo.toml` has no `[patch]` section). Either document as fallback plan or remove.

### Deferred from: Epic 1 Retro Prep Sprint review (2026-04-04)

- **`useNoteHydration` viewRef null guard** — When `viewRef.current` is null during hydration, the hook clears `isHydrating` and silently drops the content push. Currently safe (EditorPane is always mounted), but will need retry logic when note-loading UI is built.
- **`create_temp_db` collision risk** — Uses `SystemTime::now().as_nanos()` for temp dir names. On Windows (coarse timers) under parallel test execution, collisions are possible. Consider `tempfile::TempDir` or UUID.
- **Esc dismiss on flushSave failure** — `EditorPane.tsx` Escape handler chains `.catch().then(dismissWindow)` — window dismisses even when save fails. Should only dismiss on success.
- **`flushSave` leaks `isCreating` on throw** — If `commands.createNote` throws (vs. returning error status), `isCreating` is permanently stuck `true`, blocking all subsequent saves.
- **`useWindowFocus` StrictMode double-listener** — Async `appWindow.listen()` can create duplicate listeners under React StrictMode double-invoke.
