---
title: 'Epic 1 Cluster 2b — Auto-Save & Format Toggle (Stories 1.9–1.10)'
type: 'feature'
created: '2026-04-03'
status: 'done'
baseline_commit: '42a7d1e425969a217994836de5568087ae6c61c6'
context:
  - '_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The CodeMirror editor captures keystrokes but never persists them — notes are lost on window close. The format indicator in the StatusBar is static text with no interactivity.

**Approach:** Add a `useAutoSave` hook that creates a note on the first keystroke and debounce-saves on every subsequent change via tauri-specta IPC, with a `SaveIndicator` sub-component reflecting live save state. Make the format label clickable to toggle between `markdown` and `plaintext`, reconfiguring the CodeMirror `langCompartment` and persisting the change via `updateNote`.

## Boundaries & Constraints

**Always:**
- 300ms debounce, reset on every keystroke
- `title` derived from first line of content, truncated to 100 chars
- "Saving..." visible only if save takes >200ms; "Saved" fades via opacity over 2s (0ms if `prefers-reduced-motion`)
- "Save failed" in `var(--warning)` persists until the next successful save
- All IPC calls via tauri-specta `commands.*` — never raw `invoke()`
- Format persisted via `updateNote(id, null, null, format)` immediately on toggle
- `langCompartment.reconfigure()` dispatched inside `EditorPane` in response to store `format` changes — StatusBar does not touch the view

**Ask First:**
- If `updateNote` signature changes (e.g. object param instead of positional)

**Never:**
- Manual date formatting — use `Intl.DateTimeFormat` if dates are displayed
- Saving empty content (no-op if `content.trim() === ''` and no active note)
- Storing `EditorView` in Zustand
- Creating a barrel `index.ts`
- Network requests

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First keystroke | `noteId: null`, non-empty content | `createNote(format)` called; returned id stored as `activeNoteId`; `updateNote` called with title + content | `saveStatus → 'failed'`; error logged |
| Subsequent keystroke | `noteId` set, content changes | 300ms debounce resets; on fire: `updateNote(id, title, content, null)` | `saveStatus → 'failed'` |
| Save <200ms | save resolves before 200ms timer | "Saving..." never appears; "Saved" appears then fades 2s | N/A |
| Save >200ms | save takes >200ms | "Saving..." shown at 200ms mark; replaced by "Saved" on resolve | `saveStatus → 'failed'` |
| Save fails | IPC returns error | "Save failed" in `var(--warning)`, persists | Cleared only on next successful save |
| Format toggle (MD→PT) | user clicks "Markdown" label | store `format → 'plaintext'`; `langCompartment` reconfigured to `[]`; `updateNote(id, null, null, "plaintext")` | N/A if no active note |
| Format toggle (PT→MD) | user clicks "Plain text" label | store `format → 'markdown'`; `langCompartment` reconfigured to `markdown()`; `updateNote(id, null, null, "markdown")` | N/A if no active note |
| No active note on toggle | `noteId: null`, user clicks format | format updates in store and editor reconfigures; IPC call skipped | N/A |

</frozen-after-approval>

## Code Map

- `src/features/editor/store.ts` — extend with `saveStatus`, `lastSavedAt`, `setSaveStatus` action
- `src/features/editor/hooks/useAutoSave.ts` — new: debounce logic, IPC calls, saveStatus transitions
- `src/features/editor/components/EditorPane.tsx` — add `viewRef`, second `useEffect` to reconfigure `langCompartment` on format change
- `src/features/editor/components/StatusBar.tsx` — clickable format toggle + `SaveIndicator` sub-component
- `src/features/editor/components/SaveIndicator.tsx` — new: save state display with 200ms visibility delay and 2s fade

## Tasks & Acceptance

**Execution:**
- [x] `src/features/editor/store.ts` -- add `saveStatus: 'idle' | 'saving' | 'saved' | 'failed'`, `lastSavedAt: string | null`, and `setSaveStatus(status)` action; rename `setNoteId` → `setActiveNote` to match epics spec
- [x] `src/features/editor/hooks/useAutoSave.ts` -- create hook: watches `content` from store; on first non-empty content with `activeNoteId === null`, calls `commands.createNote(format)` then `commands.updateNote`; otherwise debounces 300ms then calls `commands.updateNote(id, title, content, null)`; manages `saveStatus` transitions including 200ms show-delay and 2s idle-return timer
- [x] `src/features/editor/components/SaveIndicator.tsx` -- create component: reads `saveStatus` from store; idle → hidden; saving → "Saving..." in `var(--text-muted)` after 200ms local delay; saved → "Saved" in `var(--success)` with 2s opacity fade (0ms if `prefers-reduced-motion`); failed → "Save failed" in `var(--warning)` persistent; include `data-testid="save-indicator"`
- [x] `src/features/editor/components/EditorPane.tsx` -- store view in `viewRef`; add second `useEffect([format])` that dispatches `langCompartment.reconfigure(format === 'markdown' ? markdown() : [])` when format changes; integrate `useAutoSave()` call at top of component
- [x] `src/features/editor/components/StatusBar.tsx` -- replace static format `<span>` with clickable `<button>` that calls `setFormat` toggle + dispatches `updateNote(id, null, null, newFormat)` if `activeNoteId` is non-null; render `<SaveIndicator />` in right section; add `data-testid="status-bar"` on root, `data-testid="workspace-name"` on left span

**Acceptance Criteria:**
- Given the editor is empty, when the user types the first character, then `createNote` is called once and `activeNoteId` is set; subsequent keystrokes do not call `createNote` again
- Given a note is active, when the user types continuously, then `updateNote` is called at most once per 300ms idle gap
- Given a save completes in <200ms, when the save resolves, then "Saving..." never appears and "Saved" is visible briefly
- Given a save takes >200ms, when >200ms elapses before the save resolves, then "Saving..." is visible; it is replaced by "Saved" on resolve
- Given a save fails, when the error is returned, then "Save failed" persists until the next successful save clears it
- Given `prefers-reduced-motion` is active, when the "Saved" indicator appears, then it disappears without opacity animation
- Given the format is "Markdown", when the user clicks the format label, then CodeMirror loses syntax highlighting and the label reads "Plain text"
- Given the format is "Plain text", when the user clicks the format label, then CodeMirror gains Markdown highlighting and the label reads "Markdown"
- Given no active note, when the user clicks the format label, then only the store and editor reconfigure — no IPC call is made

## Spec Change Log

## Design Notes

**200ms "Saving..." delay:** Implement in `SaveIndicator` using a local `showSaving` boolean managed by a `useEffect` + `setTimeout(200)`. When `saveStatus` leaves `'saving'`, clear the timer and reset `showSaving`. This avoids CSS animation-delay races where a fast save would still briefly flash the label.

**Format toggle with no active note:** The store and `langCompartment` should always update (user may be setting up before typing). Only the IPC call is conditioned on `noteId !== null`.

**`useAutoSave` placement:** Called inside `EditorPane` (not `CaptureWindow`) so the hook co-locates with the editor logic. StatusBar handles only the display side.

## Verification

**Commands:**
- `cd /home/pinkyd/dev/notey && npm run typecheck` -- expected: zero TypeScript errors
- `cd /home/pinkyd/dev/notey && npm run lint` -- expected: zero ESLint errors
- `cd /home/pinkyd/dev/notey && cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` -- expected: zero warnings

## Suggested Review Order

**Auto-save orchestration**

- Entry point: debounce loop, in-flight guard, create-then-update IPC flow
  [`useAutoSave.ts:35`](../../src/features/editor/hooks/useAutoSave.ts#L35)

- State shape: activeNoteId, saveStatus, lastSavedAt; markSaved atomically sets both
  [`store.ts:7`](../../src/features/editor/store.ts#L7)

- Hook call site — co-located in EditorPane, not CaptureWindow
  [`EditorPane.tsx:28`](../../src/features/editor/components/EditorPane.tsx#L28)

**Save status display**

- 200ms local delay prevents "Saving..." flash on fast saves
  [`SaveIndicator.tsx:19`](../../src/features/editor/components/SaveIndicator.tsx#L19)

- `save-fade` keyframe + `animation: none` override for reduced-motion
  [`index.css:265`](../../src/index.css#L265)

- SaveIndicator rendered in StatusBar right section
  [`StatusBar.tsx:50`](../../src/features/editor/components/StatusBar.tsx#L50)

**Format toggle**

- Optimistic setFormat with rollback on IPC failure
  [`StatusBar.tsx:15`](../../src/features/editor/components/StatusBar.tsx#L15)

- Format-change effect reconfigures langCompartment on existing view
  [`EditorPane.tsx:77`](../../src/features/editor/components/EditorPane.tsx#L77)

- initialFormat seeds langCompartment at mount, avoiding stale-format on re-mount
  [`EditorPane.tsx:33`](../../src/features/editor/components/EditorPane.tsx#L33)
