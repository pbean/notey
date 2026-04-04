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
