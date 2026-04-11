---
title: 'Command Palette Action Registry'
type: 'feature'
created: '2026-04-10'
status: 'done'
baseline_commit: '926db21'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The command palette (Story 4.5) renders placeholder commands with no-op handlers. Users cannot discover or execute any real application actions through the palette, and keyboard shortcuts like Ctrl+N (new note) and Ctrl+Shift+T (toggle theme) are not wired.

**Approach:** Create a typed command registry hook (`usePaletteCommands`) that returns executable commands grouped under Actions/Settings/Navigation. Wire real handlers for all features that have backing implementations (new note, search, theme toggle, format toggle, layout mode toggle). Register stub entries for features that don't exist yet (note list panel, trash view, settings panel, export). Add global keyboard shortcut handlers for Ctrl+N and Ctrl+Shift+T.

## Boundaries & Constraints

**Always:**
- Single source of truth: command palette entries and global keyboard shortcuts share the same action functions
- Close palette and return focus to `.cm-content` after any command executes
- Platform-aware modifier display (existing `getIsMac()` helper)
- "New Note" creates a note via `commands.createNote`, opens it in a tab via `useTabStore.openTab`, and resets/loads the editor
- "Search Notes" calls `useSearchStore.openSearch()` (which closes palette via Layer 1 rule)
- "Toggle Theme" reads current config via `commands.getConfig()`, flips `theme` between `"dark"` and `"light"` via `commands.updateConfig()`, and toggles `document.documentElement.classList` accordingly
- "Toggle Format" calls `useEditorStore.setFormat()` to flip between `markdown` and `plaintext`
- Stub commands (note list, trash, settings, export) log `console.warn('Not yet implemented: <label>')` — no silent no-ops
- Fix symmetric overlay exclusion: `useSearchStore.openSearch()` should close the command palette (deferred item from 4.5 review)

**Ask First:**
- Adding commands beyond the epics-defined list
- Any new Tauri backend commands

**Never:**
- Build UI for note list panel (Story 4.8), trash view, settings panel, or export — stub only
- Create new Tauri backend commands
- Duplicate shortcut handling that already exists (Ctrl+F stays in CaptureWindow)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| New Note | Select "New Note" or Ctrl+N | Palette closes, new note created, tab opened with title "New note", editor shows empty content | createNote failure: `console.error`, no tab opened |
| New Note with unsaved content | Ctrl+N while editing | Auto-save flushes first, then creates new note in new tab | flushSave failure: log error, still create new note |
| Search Notes | Select "Search Notes" | Palette closes, search overlay opens | N/A |
| Toggle Theme (dark→light) | Select "Toggle Theme" or Ctrl+Shift+T while dark | Palette closes, theme switches to light, `dark` class removed from documentElement | updateConfig failure: revert DOM class, log error |
| Toggle Theme (light→dark) | Select while light | Palette closes, theme switches to dark, `dark` class added | Same as above |
| Toggle Format | Select "Toggle Format" while markdown | Palette closes, format switches to plaintext | N/A |
| Stub command | Select "View Trash" | Palette closes, `console.warn('Not yet implemented: View Trash')` | N/A |
| Ctrl+N with palette closed | Ctrl+N outside palette | New note created directly (no palette interaction) | Same as palette path |

</frozen-after-approval>

## Code Map

- `src/features/command-palette/hooks/usePaletteCommands.ts` -- New: hook returning typed `PaletteCommand[]` array with real action closures grouped by Actions/Settings/Navigation
- `src/features/command-palette/components/CommandPalette.tsx` -- Modify: replace static `COMMAND_GROUPS` with `usePaletteCommands()` hook, wire `onSelect` to call command's `action()`
- `src/features/command-palette/types.ts` -- New: `PaletteCommand` interface (id, label, group, shortcut, action)
- `src/features/editor/components/CaptureWindow.tsx` -- Modify: add Ctrl+N and Ctrl+Shift+T global shortcut handlers
- `src/features/search/store.ts` -- Modify: `openSearch()` closes command palette (symmetric exclusion fix)
- `src/features/command-palette/actions.ts` -- New: standalone action functions (`createNewNote`, `toggleTheme`, `toggleFormat`, `toggleLayoutMode`) importable by both palette and shortcut handlers

## Tasks & Acceptance

**Execution:**
- [x] `src/features/command-palette/types.ts` -- Create `PaletteCommand` interface with `id: string`, `label: string`, `group: 'Actions' | 'Settings' | 'Navigation'`, `shortcut: string`, `action: () => void | Promise<void>`
- [x] `src/features/command-palette/actions.ts` -- Implement action functions: `createNewNote` (flush save, createNote, openTab, loadNote), `toggleTheme` (getConfig, updateConfig, toggle DOM class), `toggleFormat` (flip editor format), `toggleLayoutMode` (getConfig, updateConfig), and stub actions for unimplemented features
- [x] `src/features/command-palette/hooks/usePaletteCommands.ts` -- Build hook that assembles `PaletteCommand[]` from actions.ts with correct labels, shortcuts, and groups per the epics spec
- [x] `src/features/command-palette/components/CommandPalette.tsx` -- Replace static `COMMAND_GROUPS` and no-op `handleSelect` with `usePaletteCommands()` hook; `onSelect` calls matched command's `action()`, closes palette, refocuses editor
- [x] `src/features/editor/components/CaptureWindow.tsx` -- Add Ctrl/Cmd+N handler (calls `createNewNote`) and Ctrl/Cmd+Shift+T handler (calls `toggleTheme`); guard against firing when overlays are open
- [x] `src/features/search/store.ts` -- Fix symmetric exclusion: `openSearch()` calls `useCommandPaletteStore.getState().close()` before setting `isOpen: true`
- [x] `src/features/command-palette/actions.test.ts` -- Test `createNewNote` (mock IPC, verify tab opened), `toggleTheme` (mock getConfig/updateConfig, verify DOM class toggle), `toggleFormat` (verify store flip), stub commands (verify console.warn)
- [x] `src/features/command-palette/hooks/usePaletteCommands.test.ts` -- Test hook returns correct command count, groups, and labels
- [x] `src/features/command-palette/components/CommandPalette.test.tsx` -- Update existing tests: verify `onSelect` calls action, verify real labels render

**Acceptance Criteria:**
- Given the palette is open, when all commands are registered, then Actions (New Note, Search Notes, Switch Workspace), Navigation (Open Note List, View Trash), and Settings (Toggle Theme, Toggle Layout Mode, Toggle Format, Open Settings, Export to Markdown, Export to JSON) are all visible
- Given the user selects "New Note", then a new note is created, opened in a tab, and the editor shows empty content
- Given the user selects "Search Notes", then the search overlay opens
- Given the user presses Ctrl/Cmd+N outside the palette, then a new note is created directly
- Given the user presses Ctrl/Cmd+Shift+T, then the theme toggles between dark and light
- Given the user selects a stub command, then a console.warn is logged

## Design Notes

**Command registry pattern:** `usePaletteCommands()` builds the command list on each render so actions close over current store state. The hook is intentionally not memoized — cmdk handles its own rendering optimizations and the command list is small (~10 items).

**Theme toggle implementation:**
```ts
async function toggleTheme() {
  const result = await commands.getConfig();
  if (result.status === 'error') return;
  const current = result.data.general?.theme ?? 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  const updateResult = await commands.updateConfig({ general: { theme: next, layoutMode: null }, editor: null, hotkey: null });
  if (updateResult.status === 'error') return;
  document.documentElement.classList.toggle('dark', next === 'dark');
}
```

**New note flow:** Must flush pending auto-save before creating a new note to avoid data loss on the current tab's content. Uses `flushSave()` from `useAutoSave.ts`, then `commands.createNote(format, workspaceId)`, then `useTabStore.openTab(noteId, 'New note')` + `useEditorStore.loadNote(noteId)`.

## Verification

**Commands:**
- `npx vitest run src/features/command-palette/` -- expected: all action, hook, and component tests pass
- `npx vitest run src/features/search/store.test.ts` -- expected: symmetric exclusion test passes
- `npx tsc --noEmit` -- expected: no type errors
- `npx vitest run` -- expected: full suite passes (no regressions)

## Spec Change Log

- **Review patch 1:** Added concurrency guard (`isCreatingNote` flag) to `createNewNote` to prevent rapid-fire from key repeat. Added tab rollback if `loadNote` fails after `openTab`.
- **Review patch 2:** Added overlay guards (palette/search open checks) and `e.repeat` guard on Ctrl+N handler. Made Ctrl+Shift+T key check case-insensitive (`e.key.toLowerCase() === 't'`).

## Suggested Review Order

**Action registry: the core pattern**

- Typed command interface — id, label, group, shortcut, action
  [`types.ts:4`](../../src/features/command-palette/types.ts#L4)

- Standalone action functions with concurrency guard and error recovery
  [`actions.ts:12`](../../src/features/command-palette/actions.ts#L12)

- Hook assembles the full command list with real + stub actions
  [`usePaletteCommands.ts:22`](../../src/features/command-palette/hooks/usePaletteCommands.ts#L22)

**UI wiring: palette and keyboard shortcuts**

- CommandPalette now consumes `usePaletteCommands()`, dispatches real actions on select
  [`CommandPalette.tsx:24`](../../src/features/command-palette/components/CommandPalette.tsx#L24)

- Ctrl+N handler with overlay and repeat guards
  [`CaptureWindow.tsx:45`](../../src/features/editor/components/CaptureWindow.tsx#L45)

- Ctrl+Shift+T handler with case-insensitive key check
  [`CaptureWindow.tsx:57`](../../src/features/editor/components/CaptureWindow.tsx#L57)

**Overlay fix: symmetric mutual exclusion**

- `openSearch()` now closes command palette (bidirectional Layer 1 enforcement)
  [`store.ts:49`](../../src/features/search/store.ts#L49)

**Tests**

- Action unit tests: createNewNote, toggleTheme, toggleFormat, toggleLayoutMode, stubAction
  [`actions.test.ts:1`](../../src/features/command-palette/actions.test.ts#L1)

- Registry hook tests: command count, groups, labels
  [`usePaletteCommands.test.ts:1`](../../src/features/command-palette/hooks/usePaletteCommands.test.ts#L1)

- Updated component tests: real labels, action dispatch on select
  [`CommandPalette.test.tsx:1`](../../src/features/command-palette/components/CommandPalette.test.tsx#L1)
