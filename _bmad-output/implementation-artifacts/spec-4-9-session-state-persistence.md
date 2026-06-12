---
title: 'Session State Persistence (Tabs, Cursor, Workspace)'
type: 'feature'
created: '2026-04-11'
status: 'done'
context: []
baseline_commit: 'fbf379eeec41c1504537e7609cbd345634b1a63f'
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

- `src/features/session/persistence.ts` -- Create: `saveSession()`, `restoreSession()`, `startSessionAutoSave()` plus `SerializedSession`/`SerializedTab` types. Reads/writes localStorage, validates notes via `commands.getNote`, subscribes both stores with a 1s debounce.
- `src/features/session/persistence.test.ts` -- Create: unit tests for serialize shape, restore + deleted-note skipping, corrupt/missing localStorage, workspace fallback, debounced subscribe.
- `src/features/editor/components/EditorPane.tsx` -- Modify: export a module-level `editorViewRef` (kept in sync with the private `viewRef`); in the new-tab `else` branch, seed the fresh `EditorState` selection from `activeTab.cursorPos` (clamped to doc length).
- `src/features/tabs/store.ts` -- Modify: add `cursorPos?: number` to `Tab`; add `restoreTabs(tabs, activeIndex)` action for bulk hydration (no editorState/langCompartment).
- `src/features/workspace/store.ts` -- Modify: add `restoreWorkspaceId(id)` action that delegates to `setActiveWorkspace(id)` only when the id exists in the loaded `workspaces` list, otherwise no-ops.
- `src/App.tsx` -- Modify: chain `initWorkspace()` → `restoreSession()` → `startSessionAutoSave()` in the mount effect.

## Tasks & Acceptance

**Execution:**

- [x] `src/features/tabs/store.ts` -- Add `cursorPos?: number` to the `Tab` interface (restored cursor for a tab whose `editorState` hasn't been built yet). Add `restoreTabs: (tabs: Pick<Tab, 'noteId' | 'title' | 'format' | 'scrollTop' | 'cursorPos'>[], activeIndex: number | null) => void` to the actions interface and implementation: `set({ tabs, activeTabIndex: tabs.length === 0 ? null : activeIndex })`. Do not carry `editorState`/`langCompartment` — EditorPane rebuilds them on first activation.
- [x] `src/features/editor/components/EditorPane.tsx` -- Add a module-level `export const editorViewRef: { current: EditorView | null } = { current: null }`. In the create-view effect set `editorViewRef.current = view` right after `viewRef.current = view`, and `editorViewRef.current = null` in its cleanup. In the new-tab `else` branch (currently builds `CMEditorState.create({ doc: note.content, extensions })`), seed the selection when `activeTab.cursorPos != null`: `selection: { anchor: Math.min(Math.max(activeTab.cursorPos, 0), note.content.length) }`.
- [x] `src/features/workspace/store.ts` -- Add `restoreWorkspaceId: (id: number) => Promise<void>` to the actions interface and implementation: if `get().workspaces.some((w) => w.id === id)`, `await get().setActiveWorkspace(id)`; otherwise no-op (keep the cwd-resolved default from `initWorkspace`).
- [x] `src/features/session/persistence.ts` -- Create module. Types: `SerializedTab = { noteId: number; title: string; format?: 'markdown' | 'plaintext'; scrollTop?: number; cursorPos?: number }`; `SerializedSession = { version: 1; tabs: SerializedTab[]; activeTabIndex: number | null; activeWorkspaceId: number | null }`. `saveSession()`: read tab + workspace state; for each tab derive `cursorPos`/`scrollTop` — for the active tab from `editorViewRef.current` (`state.selection.main.head` / `scrollDOM.scrollTop`), otherwise from `tab.editorState?.selection.main.head` falling back to `tab.cursorPos`, and `tab.scrollTop`; write `JSON.stringify` to `localStorage[notey-session-v1]`. `restoreSession()`: read the key (return on absent), `JSON.parse` inside try/catch (on throw or `version !== 1`, `removeItem` and return), call `restoreWorkspaceId` when `activeWorkspaceId != null`, validate each tab via `await commands.getNote(noteId)` keeping only `status === 'ok'`, remap `activeTabIndex` to the surviving active tab (fall back to `0` if it survived nothing but other tabs remain, `null` if none), then `restoreTabs(validTabs, remappedIndex)`. `startSessionAutoSave()`: idempotent; subscribe `useTabStore` and `useWorkspaceStore` with a shared 1s debounce calling `saveSession`; return an unsubscribe function.
- [x] `src/features/session/persistence.test.ts` -- Tests (mock `commands.getNote` from generated bindings, use jsdom localStorage, fake timers for debounce): save writes the correct serialized shape with the active-tab cursor taken from `editorViewRef`; restore skips tabs whose `getNote` resolves `{ status: 'error' }` and keeps the rest; restore on missing/corrupt JSON clears the key and makes no store changes; restore with an `activeWorkspaceId` absent from `workspaces` leaves the default workspace untouched; the subscribe debounce writes once ~1s after a burst of state changes.
- [x] `src/App.tsx` -- In the existing mount `useEffect`, chain `void useWorkspaceStore.getState().initWorkspace().then(() => restoreSession()).then(() => { startSessionAutoSave(); })`.

**Acceptance Criteria:**

- Given tabs are open with notes, when the app restarts, then the same tabs are restored with notes loaded fresh from the database
- Given a restored tab had a cursor position saved, when that tab is loaded, then the cursor is placed at the saved position (clamped to the current document length)
- Given a saved tab references a deleted note, when the session restores, then that tab is silently skipped without an error toast
- Given no previous session exists (or localStorage is corrupt), when the app starts, then the empty state is shown without errors
- Given a workspace was active and still exists, when the app restarts, then that workspace is active and its notes are loaded; if it no longer exists the cwd-resolved default is kept

## Design Notes

**Active-tab cursor is live, others come from their snapshot.** The tab store only refreshes a tab's `editorState` on tab-switch (`saveTabState`), so the active tab's stored state is stale. During `saveSession`, read the active tab's cursor/scroll from `editorViewRef.current`; for every other tab read `editorState?.selection.main.head` (its last switch snapshot), falling back to the `cursorPos` carried over from a prior restore for tabs the user never activated. This satisfies the frozen "per-tab cursor/scroll positions" intent, not just the active tab.

**Restore drives EditorPane through its existing effect.** `restoreTabs` bulk-sets `tabs` + `activeTabIndex` in one `set()`. EditorPane's tab-switch effect fires on the `null → activeTabIndex` transition and, finding no `editorState`, runs the new-tab `else` branch which fetches the note and (now) seeds the saved cursor — and already restores `scrollTop` at the end. No separate "trigger loadNote" call is needed.

**`getNote` returns a Result, never throws.** Validation checks `result.status === 'ok'` (a missing note yields `{ status: 'error', error: { type: 'NotFound' } }`). Do not wrap it in try/catch expecting a rejection.

**Restore order:** `initWorkspace()` (loads the workspace list so `restoreWorkspaceId` can validate) → `restoreSession()` → `startSessionAutoSave()` last, so the auto-save subscription never persists intermediate restore state. `startSessionAutoSave` is idempotent (guards against React StrictMode double-invoke) and returns an unsubscribe used by tests.

## Verification

**Commands:**

- `npx vitest run src/features/session/` -- expected: all persistence tests pass
- `npx vitest run src/features/tabs/ src/features/workspace/` -- expected: store tests pass with new `restoreTabs`/`restoreWorkspaceId`
- `npx tsc --noEmit` -- expected: no type errors
- `npx vitest run` -- expected: full suite passes (no regressions)

### Review Findings

- [x] [Review][Patch] Trigger session saves from editor-only activity and scroll/selection updates [src/features/session/persistence.ts:217]
- [x] [Review][Patch] Reject malformed session payloads before hydrating tabs [src/features/session/persistence.ts:41]
- [x] [Review][Patch] Preserve tabs on transient note-validation failures and refresh restored metadata from the database [src/features/session/persistence.ts:160]
- [x] [Review][Patch] Avoid binding the previous live editor view to a newly active tab during async switches [src/features/session/persistence.ts:107]
- [x] [Review][Patch] Load workspaces on demand before applying a saved workspace id [src/features/workspace/store.ts:138]
- [x] [Review][Patch] Keep startup session restore resilient and unsubscribe auto-save on unmount [src/App.tsx:8]

#### Review Ledger (2026-06-12)

patch: Trigger session saves from editor-only activity and scroll/selection updates [src/features/session/persistence.ts:217] — typing, selection, and scroll changes were not scheduling the 1s session write.
patch: Reject malformed session payloads before hydrating tabs [src/features/session/persistence.ts:41] — parseable garbage in `localStorage` could survive JSON parsing and reach tab restore.
patch: Preserve tabs on transient note-validation failures and refresh restored metadata from the database [src/features/session/persistence.ts:160] — non-`NotFound` lookup failures were silently dropping tabs and discarding fresh title/format data.
patch: Avoid binding the previous live editor view to a newly active tab during async switches [src/features/session/persistence.ts:107] — a slow tab load could save the old editor cursor/scroll onto the newly active tab.
patch: Load workspaces on demand before applying a saved workspace id [src/features/workspace/store.ts:138] — workspace restore could no-op when startup had not preloaded the workspace list.
patch: Keep startup session restore resilient and unsubscribe auto-save on unmount [src/App.tsx:8] — thrown init/restore errors could abort auto-save setup, and the mount effect dropped the unsubscribe.
dismiss: Clear the saved session key when every restored tab is deleted [src/features/session/persistence.ts:201] — the story only requires returning to the empty state, and the saved workspace context should remain available.
dismiss: Deleted-note tests mismatch the generated bindings contract [src/features/session/persistence.test.ts:84] — the tests mock raw Tauri invoke behavior, which the generated wrapper intentionally normalizes into Result values.
dismiss: Session persistence tests are order-dependent [src/features/session/persistence.test.ts:33] — shared stores and invoke mocks are reset globally after every test case.
dismiss: Restoring a null active index with surviving tabs should preserve null [src/features/tabs/store.ts:183] — the app never produces open tabs without an active tab, so the reported state is not user-reachable.
dismiss: Session writes should subscribe only to workspace-selection fields [src/features/session/persistence.ts:240] — the story explicitly requires subscribing the workspace store, so broader workspace-triggered writes are acceptable.
dismiss: Restart should restore the All Workspaces scope [src/features/workspace/store.ts:65] — this story only persists `activeWorkspaceId`; global scope persistence is outside the approved intent.
