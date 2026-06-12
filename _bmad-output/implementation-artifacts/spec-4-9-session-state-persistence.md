---
title: 'Session State Persistence (Tabs, Cursor, Workspace)'
type: 'feature'
created: '2026-04-11'
status: 'draft'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When Notey quits or restarts, all open tabs, the active tab, cursor positions, and workspace selection are lost. Users must manually reopen their notes and navigate back to where they were working.

**Approach:** Persist session state (open tabs, active tab index, per-tab cursor/scroll positions, active workspace ID) to localStorage on every state change (debounced 1s). Restore silently on app startup, skipping tabs whose notes have been deleted.

## Boundaries & Constraints

**Always:**
- Use localStorage with key `notey-session-v1` — data is small (tab metadata, not note content)
- Debounce writes to 1 second via `subscribe` on tab store and workspace store
- Validate every tab's note still exists via `getNote()` during restore — silently skip deleted notes
- Restore workspace first (via saved `activeWorkspaceId`), then restore tabs
- If all restored tabs reference deleted notes, show normal empty state (no tabs)
- Capture active tab's live cursor position from EditorView during save (not just tab-switch snapshot)

**Ask First:**
- Migrating to IndexedDB or Tauri-side file persistence
- Adding a "restore previous session?" confirmation dialog

**Never:**
- Persist note content — always load fresh from SQLite via `getNote()`
- Persist CodeMirror `EditorState` or `Compartment` objects (not serializable)
- Show error toasts for skipped deleted-note tabs during restore
- Block app startup waiting on session restore — let it be async

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Normal save | Tabs open, user types/switches | Session written to localStorage after 1s debounce | N/A |
| Normal restore | Valid session in localStorage | Tabs reopened, active tab loaded with cursor + scroll restored | N/A |
| Deleted note tab | Saved tab references noteId that no longer exists | Tab silently skipped, remaining tabs restored | N/A |
| All tabs deleted | Every saved tab references deleted notes | Empty state (no tabs, no error) | N/A |
| No saved session | First run or cleared localStorage | Normal empty state, no restore attempt | N/A |
| Corrupt JSON | Malformed data in localStorage | Treat as no session — clear key, show empty state | Console warning |
| Saved workspace deleted | `activeWorkspaceId` references workspace not in list | Fall back to `initWorkspace()` default (cwd-based resolution) | N/A |

</frozen-after-approval>

## Code Map

- `src/features/session/persistence.ts` -- Create: `saveSession()`, `restoreSession()`, `startSessionAutoSave()` functions with localStorage read/write, debounced subscribe, and note validation
- `src/features/session/persistence.test.ts` -- Create: unit tests for save, restore, validation, edge cases
- `src/features/tabs/store.ts` -- Modify: add `restoreTabs()` action for bulk tab hydration without triggering individual open/switch logic
- `src/features/editor/components/EditorPane.tsx` -- Modify: export module-level `editorViewRef` for live cursor reads; apply restored `cursorPos` after note load
- `src/features/workspace/store.ts` -- Modify: add `restoreWorkspaceId()` action that overrides active workspace if the ID exists in the loaded workspace list
- `src/App.tsx` -- Modify: call `restoreSession()` after `initWorkspace()`, then `startSessionAutoSave()`

## Tasks & Acceptance

**Execution:**
- [ ] `src/features/tabs/store.ts` -- Add `restoreTabs(tabs: { noteId: number; title: string; format?: string; scrollTop?: number; cursorPos?: number }[], activeIndex: number | null)` action that bulk-sets `tabs` and `activeTabIndex` without triggering open/switch side effects. Add optional `cursorPos?: number` field to `Tab` interface for restored cursor position.
- [ ] `src/features/editor/components/EditorPane.tsx` -- Export module-level `editorViewRef: { current: EditorView | null }`, set when view is created, nulled on destroy. In the tab-switch effect, after loading a new tab's note (the `else` branch at line 155), apply `activeTab.cursorPos` via `view.dispatch({ selection: { anchor: clampedPos } })` after setState.
- [ ] `src/features/workspace/store.ts` -- Add `restoreWorkspaceId(id: number)` action: if `id` exists in `workspaces` array, set `activeWorkspaceId` and `activeWorkspaceName` from it, then call `loadFilteredNotes()`. If not found, no-op (keep cwd-resolved workspace).
- [ ] `src/features/session/persistence.ts` -- Create module. `SerializedSession` type: `{ version: 1; tabs: { noteId, title, format, scrollTop, cursorPos }[]; activeTabIndex: number | null; activeWorkspaceId: number | null }`. `saveSession()`: read tab store state, extract active tab cursor from `editorViewRef.current?.state.selection.main.head`, write JSON to localStorage. `restoreSession()`: parse localStorage, validate each tab via `getNote()`, call `restoreWorkspaceId()` then `restoreTabs()` with valid tabs, then trigger `loadNote` for the active tab. `startSessionAutoSave()`: subscribe to tab store + workspace store with 1s debounce.
- [ ] `src/features/session/persistence.test.ts` -- Tests: save serializes correct shape with cursor from editorViewRef, restore skips deleted notes (mock getNote to reject), restore handles corrupt/missing localStorage, workspace fallback when saved ID not in workspace list, debounced subscribe fires after state change, active tab cursor is clamped to doc length.
- [ ] `src/App.tsx` -- In the existing `useEffect`, after `initWorkspace()` resolves, call `restoreSession()`, then call `startSessionAutoSave()`. Chain as: `initWorkspace().then(restoreSession).then(startSessionAutoSave)`.

**Acceptance Criteria:**
- Given tabs are open with notes, when the app restarts, then the same tabs are restored with notes loaded from the database
- Given a restored tab had a cursor position saved, when the active tab loads, then the cursor is placed at the saved position
- Given a saved tab references a deleted note, when the session restores, then that tab is silently skipped without error
- Given no previous session exists, when the app starts, then the empty state is shown without errors
- Given a workspace was active, when the app restarts, then the same workspace is active if it still exists

## Design Notes

**Cursor position for the active tab:** The active tab's cursor is only saved to the tab store on tab switch (via `saveTabState` in EditorPane). During `saveSession()`, read the live cursor from `editorViewRef.current?.state.selection.main.head` and merge it into the active tab's serialized data. On restore, clamp `cursorPos` to `doc.length` to handle content changes between sessions.

**Restore order:** `initWorkspace()` → `restoreSession()` → `startSessionAutoSave()`. Workspace init loads the workspace list so `restoreWorkspaceId()` can validate the saved ID. Tab restoration happens after workspace is set so the correct notes are visible. Auto-save starts last to avoid persisting intermediate restore state.

**Tab store `restoreTabs` vs individual `openTab`:** Bulk-setting tabs avoids N individual openTab calls which would each trigger EditorPane's tab-switch effect. `restoreTabs` sets the full `tabs` array and `activeTabIndex` in one `set()` call, letting EditorPane react once to the final active tab.

## Verification

**Commands:**
- `npx vitest run src/features/session/` -- expected: all persistence tests pass
- `npx vitest run src/features/tabs/` -- expected: tab store tests pass with new restoreTabs action
- `npx tsc --noEmit` -- expected: no type errors
- `npx vitest run` -- expected: full suite passes (no regressions)
