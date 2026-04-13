---
title: 'Epic 4 Deferred Cleanup — Cmd Parity, Layout CSS, Overlay Decoupling, Validation'
type: 'bugfix'
created: '2026-04-13'
status: 'done'
context: []
baseline_commit: '55ffb0bdb05c936f716446d47c53e9de15da3eec'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Six open items remain in `_bmad-output/implementation-artifacts/deferred-work.md` from Epic 4 reviews (4-3, 4-6, 4-7, 4-8). They include a macOS Cmd-key parity gap, a no-op `toggleLayoutMode` action, a circular-import ring across three Zustand stores, missing integer validation in `reorderTabs`, and a `loadNote`-failure orphan-tab pattern. The specta `i64`→`number` item stays deferred per upstream tracking.

**Approach:** Land each fix at its proper layer. Add `metaKey` parity in `useTabKeyboardNav`. Wire `toggleLayoutMode` to a `.compact` class on `documentElement` plus minimal CSS spacing overrides. Break the circular import ring with a tiny `overlays/manager` registry the stores call into one-way. Validate integer indices in `reorderTabs`. Mirror `createNewNote`'s orphan-tab cleanup in `NoteListPanel.selectNote`.

## Boundaries & Constraints

**Always:**
- Each fix touches the minimum surface area; no incidental refactors.
- Existing test suites must continue to pass; add tests for new behavior (Cmd parity, integer guard, orphan cleanup, manager registry).
- The overlay manager must be importable by all three stores without itself importing them — register-from-store pattern only.
- Mark each closed item in `deferred-work.md` with strikethrough + a one-line completion note (matching the existing convention).

**Ask First:**
- Any change that requires modifying the Tauri config schema or ACL.
- Any decision to introduce a new top-level directory beyond `src/features/overlays/`.

**Never:**
- Touch the specta `i64` deferred item — it stays open pending upstream BigInt support.
- Add CSS overrides for `.compact` beyond spacing tokens (font sizes, line heights, etc. are out of scope).
- Refactor unrelated `console.error` patterns or `getState()` usages.
- Change the public API of any Zustand store (existing action signatures stay).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| macOS Cmd+W with active tab | `metaKey: true, key: 'w'` | Active tab closes (parity with Ctrl+W) | N/A |
| macOS Cmd+1 with 3 tabs | `metaKey: true, key: '1'` | Switches to tab index 0 | N/A |
| `reorderTabs(NaN, 1)` | NaN passed as `fromIndex` | No-op, tabs unchanged | Silent (matches existing out-of-range behavior) |
| `reorderTabs(1.5, 0)` | Non-integer index | No-op, tabs unchanged | Silent |
| `toggleLayoutMode` from `comfortable` | Config persisted as `compact` | `documentElement` gains `.compact` class; spacing tokens shrink | `getConfig`/`updateConfig` failure: console.error, no DOM mutation |
| `selectNote` when `loadNote` fails | Note ID with backend error | Tab is opened then closed; editor returns to prior state | `saveStatus === 'failed'` triggers cleanup |
| Overlay A opens while B and C open | Search open → Open command palette | Search closes via manager; only command palette visible | N/A |

</frozen-after-approval>

## Code Map

- `src/features/tabs/hooks/useTabKeyboardNav.ts` -- bare `e.ctrlKey` checks need `(e.ctrlKey || e.metaKey)`
- `src/features/tabs/hooks/useTabKeyboardNav.test.ts` -- add Cmd-variant cases
- `src/features/command-palette/actions.ts` -- `toggleLayoutMode` needs DOM toggle
- `src/features/command-palette/actions.test.ts` -- assert `documentElement.classList` toggled
- `src/index.css` -- add `.compact` rules overriding `--space-*`
- `src/features/overlays/manager.ts` -- NEW: tiny registry that breaks the circular ring
- `src/features/search/store.ts` -- replace cross-store imports with manager calls + register
- `src/features/command-palette/store.ts` -- same
- `src/features/note-list/store.ts` -- same
- `src/features/tabs/store.ts` -- `reorderTabs` integer validation
- `src/features/tabs/store.test.ts` -- add NaN / float guard tests
- `src/features/note-list/components/NoteListPanel.tsx` -- `selectNote` await + orphan cleanup
- `src/features/note-list/components/NoteListPanel.test.tsx` -- new orphan-tab test (or existing if present)
- `_bmad-output/implementation-artifacts/deferred-work.md` -- strikethrough closed items

## Tasks & Acceptance

**Execution:**
- [x] `src/features/tabs/hooks/useTabKeyboardNav.ts` -- replace `e.ctrlKey &&` with `(e.ctrlKey || e.metaKey) &&` in all three branches (Tab, w, 1-9)
- [x] `src/features/tabs/hooks/useTabKeyboardNav.test.ts` -- add at least one `metaKey` case for Cmd+W and Cmd+digit
- [x] `src/features/overlays/manager.ts` -- create with `OverlayId` union (`'search' | 'commandPalette' | 'noteList'`), `registerOverlay`, `closeOtherOverlays(except)` exports
- [x] `src/features/search/store.ts` -- import only `manager`; remove `useCommandPaletteStore`/`useNoteListStore` imports; `openSearch` calls `closeOtherOverlays('search')`; register at module scope
- [x] `src/features/command-palette/store.ts` -- same conversion; `open` and `toggle`-when-closed call `closeOtherOverlays('commandPalette')`
- [x] `src/features/note-list/store.ts` -- same conversion; `open` calls `closeOtherOverlays('noteList')`
- [x] `src/features/tabs/store.ts` -- in `reorderTabs`, return early when `!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)` (place the check before the existing range guard)
- [x] `src/features/tabs/store.test.ts` -- add cases: `reorderTabs(NaN, 0)`, `reorderTabs(0, NaN)`, `reorderTabs(1.5, 0)` all no-op
- [x] `src/features/command-palette/actions.ts` -- `toggleLayoutMode`: after successful `updateConfig`, call `document.documentElement.classList.toggle('compact', next === 'compact')`
- [x] `src/features/command-palette/actions.test.ts` -- extend `toggleLayoutMode` tests to assert `classList.contains('compact')` after each toggle
- [x] `src/index.css` -- add `.compact { --space-1..--space-8 ... }` rule with halved/reduced values; place near existing token blocks
- [x] `src/features/note-list/components/NoteListPanel.tsx` -- in `selectNote`, await `loadNote`, then if `useEditorStore.getState().saveStatus === 'failed'`, find the tab by `noteId` and `closeTab` it; mirror the `createNewNote` pattern. Make `selectNote` async and wrap call sites with `void`.
- [x] `src/features/note-list/components/NoteListPanel.test.tsx` -- add test asserting orphan tab is closed when `loadNote` fails (mock `getNote` to error)
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- strike through the six items, append completion notes referencing this spec

**Acceptance Criteria:**
- Given a macOS user, when they press Cmd+W on a focused capture window with an active tab, then the active tab closes.
- Given the command palette is open and the user invokes "Toggle Layout Mode", when the action completes, then `documentElement.classList` contains `compact` (or no longer contains it on the second toggle) and visible spacing changes.
- Given any of the three overlay stores is currently open, when a different overlay's open action is invoked, then the previously-open overlay closes via the manager (not via direct cross-store imports), and `grep -r "useSearchStore\|useCommandPaletteStore\|useNoteListStore" src/features/{search,command-palette,note-list}/store.ts` shows each store importing only its own export plus the manager.
- Given `reorderTabs` is invoked with `NaN`, `Infinity`, or a non-integer numeric index, when it runs, then the tabs array is unchanged.
- Given a note in `NoteListPanel` whose `getNote` will fail, when the user clicks it, then the tab is opened and then closed (no orphan), and the editor remains usable.
- All existing Vitest and Rust test suites pass.

## Spec Change Log

## Design Notes

**Overlay manager pattern:** Each store file imports only `../overlays/manager` and calls `registerOverlay('search', () => useSearchStore.getState().closeSearch())` at module scope, after `useSearchStore` is defined. The manager itself imports nothing from the stores, so there is no cycle. Cross-store close calls become `closeOtherOverlays('search')`. Test cleanup (`resetSearch`, etc.) is unaffected.

**`.compact` CSS:** Halve the smaller spacing tokens, lighten the larger ones — proposal: `--space-1: 2px; --space-2: 4px; --space-3: 6px; --space-4: 10px; --space-5: 14px; --space-6: 18px; --space-7: 22px; --space-8: 26px`. Final values can be tuned in implementation; the key requirement is that spacing visibly tightens when `.compact` is set.

**Orphan tab cleanup in `selectNote`:** `loadNote` does not throw — it sets `saveStatus: 'failed'` on error. Mirror `createNewNote` exactly: await, check `saveStatus`, find tab by `noteId`, close.

## Verification

**Commands:**
- `pnpm test` -- expected: all Vitest suites pass including new cases
- `pnpm typecheck` -- expected: no TS errors (alias for `tsc --noEmit` if present; otherwise `pnpm exec tsc --noEmit`)
- `pnpm lint` -- expected: clean (`no-misused-promises` already on per memory)

**Manual checks (if no CLI):**
- Open the app, run "Toggle Layout Mode" from the command palette twice — observe spacing visibly tighten then restore.
- Inspect `document.documentElement.classList` in DevTools after each toggle.

## Suggested Review Order

**Overlay decoupling (architectural change)**

- Start here — the registry that breaks the circular ring; nothing imports the stores from it
  [`manager.ts:9`](../../src/features/overlays/manager.ts#L9)

- Search store now imports only the manager and registers itself at module scope
  [`search/store.ts:71`](../../src/features/search/store.ts#L71)

- Command palette store mirrors the same registration pattern
  [`command-palette/store.ts:42`](../../src/features/command-palette/store.ts#L42)

- Note list store completes the trio; all three stores are now leaf nodes in the import graph
  [`note-list/store.ts:46`](../../src/features/note-list/store.ts#L46)

**Race-safe orphan tab cleanup**

- `selectNote` awaits `loadNote` and uses `activeNoteId` (not the global `saveStatus`) so rapid clicks don't misfire
  [`NoteListPanel.tsx:35`](../../src/features/note-list/components/NoteListPanel.tsx#L35)

**Layout mode visible effect**

- `toggleLayoutMode` now applies the `compact` class after a successful config write
  [`actions.ts:89`](../../src/features/command-palette/actions.ts#L89)

- CSS hookup that makes the toggle visible — only spacing tokens are overridden
  [`index.css:190`](../../src/index.css#L190)

**Tab navigation hardening**

- macOS Cmd parity in three branches (Tab / W / 1-9), matching CaptureWindow's existing pattern
  [`useTabKeyboardNav.ts:24`](../../src/features/tabs/hooks/useTabKeyboardNav.ts#L24)

- `reorderTabs` integer guard placed before the existing range check
  [`tabs/store.ts:121`](../../src/features/tabs/store.ts#L121)

**Tests**

- Orphan-tab failure path with race-safe assertions
  [`NoteListPanel.test.tsx:159`](../../src/features/note-list/components/NoteListPanel.test.tsx#L159)

- `metaKey` parity coverage for Cmd+W / Cmd+digit / Cmd+Tab
  [`useTabKeyboardNav.test.ts:99`](../../src/features/tabs/hooks/useTabKeyboardNav.test.ts#L99)

- `reorderTabs` NaN/Infinity/float guards
  [`tabs/store.test.ts:185`](../../src/features/tabs/store.test.ts#L185)

- `toggleLayoutMode` DOM-class assertions plus failure-path no-mutation test
  [`actions.test.ts:117`](../../src/features/command-palette/actions.test.ts#L117)

