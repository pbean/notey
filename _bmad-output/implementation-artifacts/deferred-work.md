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

### Deferred from: Stories 1.6–1.8 review (2026-04-03)

- **`setNoteId` null-reset** — `useEditorStore.setNoteId` only accepts `number`, not `null | number`. Add a `resetNote()` action when "new note" or "close note" flows are implemented.
- **`view.focus()` on hidden window** — Currently called unconditionally on mount. Story 1.11 (Window Summon) should call `view.focus()` after the window becomes visible, not at construction time, to guarantee focus when the window is toggled.
- **Note content load path** — The editor has no mechanism to push existing content into CodeMirror after mount. Story 1.9 or the note-loading feature needs to use `view.dispatch(view.state.update({ changes: { from: 0, to: view.state.doc.length, insert: savedContent } }))` to hydrate a loaded note.

### Deferred from: Stories 1.9–1.10 review (2026-04-03)

- **`lastSavedAt` uses client clock** — `useAutoSave` sets `lastSavedAt` via `new Date().toISOString()`. The resolved `updateResult.data.updatedAt` (server-side timestamp) is available but ignored. If `lastSavedAt` is ever displayed or used for conflict detection, switch to `updateResult.data.updatedAt`.

### Cluster 3: Window & Daemon (Stories 1.11–1.14)

Depends on: Frontend Core (Stories 1.6–1.10)

- **Story 1.11** — Global Hotkey & Window Summon
- **Story 1.12** — Window Dismiss & Save Flush
- **Story 1.13** — System Tray Icon & Context Menu
- **Story 1.14** — TOML Configuration Service
