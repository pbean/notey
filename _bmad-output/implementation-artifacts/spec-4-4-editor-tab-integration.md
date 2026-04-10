---
title: 'Editor-Tab Integration (Multi-Instance CodeMirror)'
type: 'feature'
created: '2026-04-10'
status: 'done'
baseline_commit: '4fde8ac'
context: ['_bmad-output/implementation-artifacts/codemirror-multi-instance-research.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The editor supports only one note at a time. Tab store and TabBar exist but switching tabs doesn't change the editor content. There's no mechanism to save/restore CodeMirror state per tab or flush auto-save before switching.

**Approach:** Wire EditorPane to react to tab switches using the single-view + state-swap strategy (`view.setState()`). Extend Tab shape with EditorState and scrollTop. Extract a `buildExtensions()` helper so each tab gets its own `langCompartment`. Flush pending auto-save before every switch. Sync `useEditorStore.activeNoteId` from the active tab.

## Boundaries & Constraints

**Always:**
- Single `EditorView` instance — swap `EditorState` via `view.setState()`, never create/destroy views
- `flushSave()` must complete before loading the next tab's state
- Each tab stores its own `EditorState` and `scrollTop` in `useTabStore`
- Each tab gets its own `Compartment` instance for language switching (no shared module-scoped compartment)
- `isHydrating` flag must be set before `setState()` to prevent false auto-save triggers from the update listener
- Scroll position: save before switch, restore after switch via `requestAnimationFrame`
- Editor store's `activeNoteId`, `content`, `format` synced from active tab on switch

**Ask First:**
- Changes to auto-save hook internals beyond calling `flushSave()`
- New Tauri commands

**Never:**
- Multiple `EditorView` DOM instances
- Breaking existing single-note flow (no tabs open = current behavior)
- Session persistence (Story 4.9)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Switch tab | Active tab A, click tab B | Flush save A, save A's EditorState+scroll, load B's state, restore scroll, sync editor store | N/A |
| Open new tab | `openTab(noteId)` for unseen note | Fetch note, create EditorState with `buildExtensions()`, activate | loadNote error → `saveStatus: 'failed'` |
| Open existing tab | `openTab(noteId)` for already-open note | Activate existing tab (dedup), swap state | N/A |
| Close active tab | `closeTab(activeIndex)` | Flush save, remove state, neighbor tab loaded | N/A |
| No tabs → editor | All tabs closed | Editor shows empty state (reset), no EditorState swap | N/A |
| Format differs | Switch from markdown tab to plaintext tab | `langCompartment` correctly reflects each tab's format | N/A |

</frozen-after-approval>

## Code Map

- `src/features/editor/extensions.ts` -- New: `buildExtensions(format, callbacks)` extracted from EditorPane, returns extensions array with per-call `Compartment`
- `src/features/tabs/store.ts` -- Modify: extend `Tab` with optional `editorState` (CodeMirror `EditorState`) and `scrollTop` fields; add `saveTabState` and `getActiveTab` helpers
- `src/features/editor/components/EditorPane.tsx` -- Modify: use `buildExtensions()`, react to `activeTabIndex` changes, implement state-swap flow
- `src/features/editor/hooks/useAutoSave.ts` -- Existing: `flushSave()` called before switch (read-only for 4.4)
- `src/features/editor/hooks/useNoteHydration.ts` -- Existing: may need guard adjustment if `setState()` triggers update listener

## Tasks & Acceptance

**Execution:**
- [x] `src/features/editor/extensions.ts` -- Extract `buildExtensions()` from EditorPane: accepts format and callbacks, returns extensions array with a fresh `Compartment` per invocation. Export the compartment for format toggling.
- [x] `src/features/tabs/store.ts` -- Extend `Tab` type with `editorState?: EditorState`, `scrollTop?: number`, `langCompartment?: Compartment`, `format?`; add `saveTabState(index, editorState, scrollTop, langCompartment)` action and `getActiveTab()` selector
- [x] `src/features/editor/components/EditorPane.tsx` -- Refactor: use `buildExtensions()`, watch `activeTabIndex`, implement tab-switch flow (flush → save state → swap → restore scroll → sync editor store)
- [x] `src/features/editor/extensions.test.ts` -- Test `buildExtensions()` returns valid extensions array with unique compartment per call
- [x] `src/features/tabs/store.test.ts` -- Add tests for `saveTabState` and `getActiveTab`

**Acceptance Criteria:**
- Given tab A is active with unsaved changes, when switching to tab B, then A's content is saved before B loads
- Given tab B was previously viewed, when switching back to B, then B's editor state and scroll position are restored
- Given a markdown tab and a plaintext tab, when switching between them, then each tab renders with its correct language mode
- Given all tabs are closed, then the editor resets to empty state

## Design Notes

**TypeScript alias:** Import CodeMirror's `EditorState` as `CMEditorState` to avoid collision with the Zustand store's state interface:
```ts
import { EditorState as CMEditorState } from '@codemirror/state';
```

**Tab switch sequence:**
1. `flushSave()` (await)
2. Save current tab: `saveTabState(activeIndex, view.state, view.scrollDOM.scrollTop)`
3. Set `isHydrating = true`
4. `view.setState(nextTab.editorState)` or create new state
5. `requestAnimationFrame(() => view.scrollDOM.scrollTop = nextTab.scrollTop)`
6. Sync editor store: `activeNoteId`, `content`, `format`
7. Clear `isHydrating`

## Verification

**Commands:**
- `npx vitest run src/features/editor/extensions.test.ts src/features/tabs/store.test.ts` -- expected: all tests pass
- `npx tsc --noEmit` -- expected: no type errors
- `npx vitest run` -- expected: full suite passes (no regressions)

## Spec Change Log

- **Review patch 1:** Fixed `prevTabIndexRef` update ordering — moved after guards to prevent stale ref on bail.
- **Review patch 2:** Replaced `isSwitchingRef` bail-and-drop with `switchIdRef` cancellation pattern — rapid tab switches no longer silently dropped; stale switches abort after each await point.
- **Review patch 3:** Added staleness checks after `getNote` await — prevents writing to wrong tab slot when user switches during fetch.

## Suggested Review Order

**Architecture: extension extraction**

- `buildExtensions()` creates per-tab Compartment, decoupled from EditorPane
  [`extensions.ts:28`](../../src/features/editor/extensions.ts#L28)

**State management: tab store extensions**

- Tab type extended with `editorState`, `scrollTop`, `langCompartment`, `format`
  [`store.ts:4`](../../src/features/tabs/store.ts#L4)

- `saveTabState` and `getActiveTab` actions
  [`store.ts:160`](../../src/features/tabs/store.ts#L160)

**Core: tab switch flow**

- Cancellation-based switch with `switchIdRef` — the key architectural pattern
  [`EditorPane.tsx:96`](../../src/features/editor/components/EditorPane.tsx#L96)

- Flush save → save state → swap or create → sync stores → restore scroll
  [`EditorPane.tsx:105`](../../src/features/editor/components/EditorPane.tsx#L105)

- `onDocChanged` guard against update listener during switch
  [`EditorPane.tsx:54`](../../src/features/editor/components/EditorPane.tsx#L54)

**Tests**

- `buildExtensions` uniqueness and format tests
  [`extensions.test.ts:1`](../../src/features/editor/extensions.test.ts#L1)

- `saveTabState` and `getActiveTab` store tests
  [`store.test.ts:199`](../../src/features/tabs/store.test.ts#L199)
