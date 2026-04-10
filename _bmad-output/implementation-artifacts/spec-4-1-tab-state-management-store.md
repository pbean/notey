---
title: 'Tab State Management Store'
type: 'feature'
created: '2026-04-10'
status: 'done'
baseline_commit: 'bbd289c'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Notey currently supports only a single active note via `useEditorStore.activeNoteId`. There is no mechanism to track multiple open notes, switch between them, or manage tab lifecycle — blocking all multi-tab features in Epic 4.

**Approach:** Create a dedicated `useTabStore` Zustand store that owns the list of open tabs and the active tab index. The store handles open (with dedup), close (with neighbor-selection logic), switch, reorder, and title update. It coordinates with `useEditorStore` by syncing `activeNoteId` on tab switch. CodeMirror state-swap integration is deferred to Story 4.4.

## Boundaries & Constraints

**Always:**
- No duplicate tabs — `openTab(noteId)` activates existing tab if already open
- Closing the active tab selects the right neighbor; falls back to left; closing last tab sets `activeTabIndex` to `null`
- Follow per-feature Zustand store pattern: named actions, immutable updates, no raw `setState` exposed
- Tab shape is minimal for 4.1: `{ noteId: number; title: string }` — EditorState/scroll fields added in 4.4

**Ask First:**
- Any changes to `useEditorStore` beyond syncing `activeNoteId`
- Adding Tauri commands or backend changes (none expected)

**Never:**
- CodeMirror integration (Story 4.4)
- TabBar UI component (Story 4.2)
- Keyboard shortcuts (Story 4.3)
- Session persistence (Story 4.9)
- Backend/database changes

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Open new tab | `openTab(5)`, no tab with noteId 5 | Tab appended, becomes active | N/A |
| Open duplicate | `openTab(5)`, tab with noteId 5 at index 2 | activeTabIndex → 2, no new tab | N/A |
| Close active (has right) | 3 tabs, active=1, `closeTab(1)` | Tab removed, active→1 (was index 2) | N/A |
| Close active (no right) | 3 tabs, active=2, `closeTab(2)` | Tab removed, active→1 | N/A |
| Close last tab | 1 tab, `closeTab(0)` | Empty tabs, activeTabIndex→null | N/A |
| Close inactive | 3 tabs, active=0, `closeTab(2)` | Tab removed, active stays 0 | N/A |
| Close inactive before active | 3 tabs, active=2, `closeTab(0)` | Tab removed, active→1 (shifted) | N/A |
| Reorder | 3 tabs [A,B,C], `reorderTabs(0,2)` | → [B,C,A], activeTabIndex follows active tab | N/A |

</frozen-after-approval>

## Code Map

- `src/features/tabs/store.ts` -- New file: `useTabStore` Zustand store with Tab type, state, and actions
- `src/features/tabs/store.test.ts` -- New file: unit tests covering I/O matrix scenarios
- `src/features/editor/store.ts` -- Existing: `useEditorStore` — verify `activeNoteId` sync integration point (read-only for 4.1)

## Tasks & Acceptance

**Execution:**
- [x] `src/features/tabs/store.ts` -- Create `useTabStore` with `Tab` interface, `tabs` array, `activeTabIndex` (number | null), and actions: `openTab`, `closeTab`, `switchTab`, `reorderTabs`, `updateTabTitle` -- Foundation store for all tab features
- [x] `src/features/tabs/store.test.ts` -- Unit tests for all I/O matrix scenarios plus: reorder preserves active tracking, updateTabTitle updates correct tab, switchTab sets activeTabIndex -- Verify correctness before UI integration

**Acceptance Criteria:**
- Given no tabs are open, when `openTab(noteId)` is called, then a new tab is added and becomes active
- Given a tab with noteId N exists, when `openTab(N)` is called again, then the existing tab is activated with no duplication
- Given the active tab is closed and a right neighbor exists, then the right neighbor becomes active
- Given the last remaining tab is closed, then `activeTabIndex` is `null` and `tabs` is empty
- Given tabs [A,B,C] with B active, when A is closed, then B remains active at its new index

## Verification

**Commands:**
- `npx vitest run src/features/tabs/store.test.ts` -- expected: all tests pass
- `npx tsc --noEmit` -- expected: no type errors

## Suggested Review Order

- Store shape and exported types — Tab interface and state definition
  [`store.ts:4`](../../src/features/tabs/store.ts#L4)

- Dedup-aware openTab with title refresh on re-open
  [`store.ts:55`](../../src/features/tabs/store.ts#L55)

- closeTab neighbor-selection logic (right-first, left-fallback, null on empty)
  [`store.ts:68`](../../src/features/tabs/store.ts#L68)

- Splice-based reorderTabs with active-index tracking
  [`store.ts:100`](../../src/features/tabs/store.ts#L100)

- Unit tests covering all 8 I/O matrix scenarios + title refresh
  [`store.test.ts:1`](../../src/features/tabs/store.test.ts#L1)
