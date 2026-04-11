---
title: 'Note List Panel (Slide-from-Left Browse)'
type: 'feature'
created: '2026-04-11'
status: 'done'
baseline_commit: 'bc8935f'
context: []
---

<frozen-after-approval reason="human-owned intent -- do not modify unless human renegotiates">

## Intent

**Problem:** Users have no way to visually browse their notes. Finding a note requires either remembering its content for search or knowing the exact title. There is no persistent list view to scan, which makes workspace-based organization invisible.

**Approach:** Add a 200px fixed-width panel that slides from the left as an overlay, showing all notes in the active workspace ordered by `updated_at` DESC. Each item displays title, relative date, and format indicator. Selecting a note opens it in a tab and dismisses the panel. Triggered via Ctrl+B or the existing "Open Note List" command palette entry.

## Boundaries & Constraints

**Always:**
- 200px fixed width, overlays editor content with dimmed background (same opacity pattern as SearchOverlay)
- Mutual exclusion with search and command palette -- `open()` closes both before showing
- Focus trapped within panel; Tab cycles through items, Esc dismisses
- `role="navigation"` with `aria-label="Note list"` on panel; `role="listbox"` on list; `role="option"` with `aria-selected` on each item
- `data-testid="note-list-panel"` on panel container, `data-testid="note-list-item-{noteId}"` on items
- Read notes from `useWorkspaceStore.filteredNotes` -- do not call IPC directly
- Return focus to `.cm-content` on close

**Ask First:**
- Adding a search/filter input within the panel
- Showing notes across all workspaces (unscoped mode)

**Never:**
- Add entry/exit animations beyond optional 50ms opacity fade
- Fetch notes on every open -- rely on workspace store's cached `filteredNotes`
- Stack this overlay with search or command palette

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Open panel | Ctrl+B or command palette action | Panel slides in from left, focus moves to first list item | N/A |
| Select note via Enter | Arrow to note, press Enter | Note opens in tab (dedup via `openTab`), panel closes, editor focused | N/A |
| Select note via click | Click a note item | Same as Enter -- opens in tab, panel closes | N/A |
| Already-open note selected | Select note that has an existing tab | Existing tab activated (no duplicate), panel closes | N/A |
| Empty workspace | No notes in active workspace | Panel shows "No notes yet" empty state | N/A |
| Esc dismissal | Press Esc while panel open | Panel closes, no note opened, focus returns to editor | N/A |
| Backdrop click | Click dimmed area outside panel | Panel closes | N/A |
| Keyboard nav wraps | Arrow down past last item | Selection wraps to first item | N/A |
| Panel open while overlay active | Search or command palette is open, then Ctrl+B | Search/palette closes, note list panel opens | N/A |

</frozen-after-approval>

## Code Map

- `src/features/note-list/store.ts` -- Create: `useNoteListStore` with `isOpen`, `selectedIndex`, `open()`, `close()`, `selectNext(noteCount)`, `selectPrev(noteCount)`
- `src/features/note-list/components/NoteListPanel.tsx` -- Create: panel component with header (workspace name + count), scrollable note list, keyboard handling, focus trap
- `src/features/note-list/components/NoteListPanel.test.tsx` -- Create: tests for rendering, keyboard nav, selection, empty state, mutual exclusion
- `src/features/note-list/store.test.ts` -- Create: store unit tests
- `src/features/editor/components/CaptureWindow.tsx` -- Modify: render `NoteListPanel` alongside SearchOverlay
- `src/features/command-palette/hooks/usePaletteCommands.ts` -- Modify: replace "Open Note List" stub with real action + Ctrl+B shortcut
- `src/lib/format-relative-date.ts` -- Create: extract `formatRelativeDate` from SearchResultItem into shared utility
- `src/features/search/components/SearchResultItem.tsx` -- Modify: import `formatRelativeDate` from shared utility

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/format-relative-date.ts` -- Extract `formatRelativeDate` from `SearchResultItem.tsx` into a shared utility function. Export it.
- [x] `src/features/search/components/SearchResultItem.tsx` -- Replace local `formatRelativeDate` with import from `src/lib/format-relative-date.ts`. Verify search tests still pass.
- [x] `src/features/note-list/store.ts` -- Create `useNoteListStore` Zustand store: `isOpen` boolean, `selectedIndex` number (default 0). Actions: `open()` (closes search + command palette, sets isOpen true, resets selectedIndex to 0), `close()` (sets isOpen false), `selectNext(noteCount)` / `selectPrev(noteCount)` (wrapping arrow navigation).
- [x] `src/features/note-list/store.test.ts` -- Test open/close toggle, mutual exclusion (verify search/palette close calls), selectNext/selectPrev wrapping, selectedIndex reset on open.
- [x] `src/features/note-list/components/NoteListPanel.tsx` -- Create panel: 200px fixed width, absolute positioned left:0, z-index 50, dimmed backdrop. Header shows `activeWorkspaceName + " \u00b7 " + count + " notes"`. Scrollable list of notes from `useWorkspaceStore.filteredNotes`. Each item: title (truncated ~30 chars with ellipsis), relative date via shared utility, format badge ("MD"/"TXT"). Keyboard: ArrowUp/Down move selection, Enter opens note (`openTab` + `loadNote` + close panel), Esc closes. Focus trap via onKeyDown. Click handler on items. Empty state when no notes.
- [x] `src/features/note-list/components/NoteListPanel.test.tsx` -- Test: renders notes from workspace store, keyboard navigation (arrows, Enter, Esc), click selection, empty state message, focus trap, mutual exclusion on open, backdrop click closes, `data-testid` attributes present.
- [x] `src/features/editor/components/CaptureWindow.tsx` -- Add conditional render of `NoteListPanel` inside the relative container, gated on `useNoteListStore.isOpen`.
- [x] `src/features/command-palette/hooks/usePaletteCommands.ts` -- Replace `stubAction('Open Note List')` with `useNoteListStore.getState().open()`. Set shortcut to `'Ctrl+B'`.

**Acceptance Criteria:**
- Given notes exist in the active workspace, when user presses Ctrl+B, then the note list panel slides in from the left showing notes ordered by updated_at DESC with title, relative date, and format indicator
- Given the panel is open, when user presses ArrowDown/ArrowUp and Enter, then the selected note opens in a tab and the panel closes
- Given the panel is open, when user presses Esc or clicks the backdrop, then the panel closes without opening a note
- Given search overlay is open, when user presses Ctrl+B, then search closes and note list panel opens
- Given the active workspace has no notes, when user opens the panel, then an empty state message is displayed

## Design Notes

**Note selection and tab opening:** On Enter or click, call `useTabStore.getState().openTab(noteId, title)` followed by `useEditorStore.getState().loadNote(noteId)`. The `openTab` action handles deduplication -- if the note is already open, it activates the existing tab.

**Focus management:** On open, focus the first list item (or the panel container if empty). On close, query `.cm-content` and call `.focus()` to return to editor, matching the SearchOverlay pattern.

**Wrapping navigation:** `selectNext` uses `(selectedIndex + 1) % noteCount`; `selectPrev` uses `(selectedIndex - 1 + noteCount) % noteCount`. When noteCount is 0, navigation is a no-op.

## Spec Change Log

- **Review patch 1:** Added toggle behavior to Ctrl+B handler in CaptureWindow (was open-only, now toggles open/close). Prevents selectedIndex reset when panel is already open.
- **Review patch 2:** Added `clampedIndex` in NoteListPanel render to prevent out-of-bounds selectedIndex if filteredNotes shrinks while panel is open.
- **Review patch 3:** Extended Ctrl+N and Ctrl+Shift+T overlay guards to include `useNoteListStore.getState().isOpen`, preventing accidental new-note creation or theme toggle while browsing the note list.
- **Review defer 1:** Circular dependency ring (three stores importing each other via lazy getState) -- pre-existing pattern, tracked in deferred-work.md.
- **Review defer 2:** loadNote failure leaves orphan tab -- pre-existing fire-and-forget pattern shared with SearchOverlay, tracked in deferred-work.md.

## Verification

**Commands:**
- `npx vitest run src/features/note-list/` -- expected: all store and component tests pass
- `npx vitest run src/features/search/` -- expected: search tests still pass after formatRelativeDate extraction
- `npx tsc --noEmit` -- expected: no type errors
- `npx vitest run` -- expected: full suite passes (no regressions)

## Suggested Review Order

**Core: store and panel component**

- Zustand store with mutual exclusion -- `open()` closes search + command palette
  [`store.ts:31`](../../src/features/note-list/store.ts#L31)

- Panel component entry point -- 200px overlay with backdrop, keyboard nav, and note selection
  [`NoteListPanel.tsx:12`](../../src/features/note-list/components/NoteListPanel.tsx#L12)

- `clampedIndex` guards against stale selectedIndex when filteredNotes shrinks
  [`NoteListPanel.tsx:21`](../../src/features/note-list/components/NoteListPanel.tsx#L21)

- `selectNote` opens tab + loads note + closes panel + returns focus to editor
  [`NoteListPanel.tsx:30`](../../src/features/note-list/components/NoteListPanel.tsx#L30)

**Wiring: app shell and mutual exclusion**

- Ctrl+B toggle handler with open/close branching (review patch 1)
  [`CaptureWindow.tsx:63`](../../src/features/editor/components/CaptureWindow.tsx#L63)

- Ctrl+N and Ctrl+Shift+T guards extended to check note list panel (review patch 3)
  [`CaptureWindow.tsx:52`](../../src/features/editor/components/CaptureWindow.tsx#L52)

- Conditional render of NoteListPanel alongside SearchOverlay
  [`CaptureWindow.tsx:97`](../../src/features/editor/components/CaptureWindow.tsx#L97)

- Search store `openSearch` now also closes note list panel
  [`search/store.ts:50`](../../src/features/search/store.ts#L50)

- Command palette `open`/`toggle` now also close note list panel
  [`command-palette/store.ts:27`](../../src/features/command-palette/store.ts#L27)

**Command palette integration**

- Stub replaced with real `open()` action + Ctrl+B shortcut display
  [`usePaletteCommands.ts:53`](../../src/features/command-palette/hooks/usePaletteCommands.ts#L53)

**Shared utility extraction**

- `formatRelativeDate` extracted from SearchResultItem into shared lib
  [`format-relative-date.ts:4`](../../src/lib/format-relative-date.ts#L4)

- SearchResultItem now imports from shared utility
  [`SearchResultItem.tsx:3`](../../src/features/search/components/SearchResultItem.tsx#L3)

**Tests**

- Store unit tests: open/close, mutual exclusion, wrapping navigation
  [`store.test.ts:1`](../../src/features/note-list/store.test.ts#L1)

- Component tests: rendering, keyboard nav, click, empty state, backdrop, ARIA
  [`NoteListPanel.test.tsx:1`](../../src/features/note-list/components/NoteListPanel.test.tsx#L1)

- Global test setup: resetNoteList added to afterEach cleanup
  [`setup.ts:37`](../../src/test-utils/setup.ts#L37)
