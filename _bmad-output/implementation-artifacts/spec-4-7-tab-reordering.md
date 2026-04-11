---
title: 'Tab Reordering'
type: 'feature'
created: '2026-04-10'
status: 'done'
baseline_commit: 'c977a09'
context: []
---

<frozen-after-approval reason="human-owned intent -- do not modify unless human renegotiates">

## Intent

**Problem:** Users cannot rearrange tabs by dragging. The `reorderTabs(fromIndex, toIndex)` store action exists and is tested, but there is no UI trigger -- tabs are stuck in open-order.

**Approach:** Add HTML5 Drag and Drop event handlers to TabBar. Show a 2px vertical accent-colored insertion indicator during drag. Call `reorderTabs` on drop. No external DnD library required -- single horizontal list reorder is well within the native API's capability.

## Boundaries & Constraints

**Always:**
- Use HTML5 Drag and Drop API (dragstart, dragover, dragend, drop) -- no library
- Show a thin vertical insertion indicator (2px wide, accent color) at the drop target position during drag
- Reduce dragged tab opacity to ~0.5 during drag for visual feedback
- Prevent drag when only one tab is open (nothing to reorder)
- Keep existing click-to-switch, hover close button, and middle-click close all working during/after drag
- Set `draggable="true"` only on tab elements, not close buttons
- `data-testid="tab-drop-indicator"` on the insertion indicator element

**Ask First:**
- Adding touch/pointer event support beyond mouse drag
- Any changes to the tab store or tab shape

**Never:**
- Install an external DnD library
- Modify `reorderTabs` store action (already correct)
- Add drag-and-drop for the overflow dropdown items

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Drag tab right | Drag tab 0 over tab 2 | Indicator shows at right edge of tab 2; on drop, `reorderTabs(0, 2)` called | N/A |
| Drag tab left | Drag tab 2 over tab 0 | Indicator shows at left edge of tab 0; on drop, `reorderTabs(2, 0)` called | N/A |
| Drop on same position | Drag and drop tab 1 back to index 1 | No reorder call (fromIndex === toIndex) | N/A |
| Drag active tab | Drag the active tab to new position | Active tab remains active after reorder (store handles this) | N/A |
| Drag inactive tab | Drag an inactive tab | Active tab unchanged, only dragged tab moves | N/A |
| Single tab | Only one tab open | `draggable` is false, no drag behavior | N/A |
| Drag ends outside tab bar | User drops outside the tab bar | Drag cancelled, no reorder, indicator removed | N/A |
| Click still works | Click tab during non-drag | Normal switchTab behavior, no drag interference | N/A |

</frozen-after-approval>

## Code Map

- `src/features/tabs/components/TabBar.tsx` -- Modify: add dragstart/dragover/dragend/drop handlers, insertion indicator element, dragging state
- `src/features/tabs/components/TabBar.test.tsx` -- Modify: add drag-and-drop tests (drag start sets state, drop calls reorderTabs, indicator renders during drag, single-tab not draggable)

## Tasks & Acceptance

**Execution:**
- [x] `src/features/tabs/components/TabBar.tsx` -- Add drag state tracking (`dragFromIndex`, `dropTargetIndex`) via useState. Set `draggable={tabs.length > 1}` on each tab div. Add `onDragStart` (store source index in state + `e.dataTransfer`, set effectAllowed to "move"), `onDragOver` (compute nearest insertion edge from mouse X vs tab midpoint, update `dropTargetIndex`), `onDragEnd` (clear all drag state), `onDrop` (call `reorderTabs(dragFromIndex, dropTargetIndex)`, clear state). Render a 2px-wide accent-colored indicator div when `dropTargetIndex !== null`. Apply opacity 0.5 to the dragged tab.
- [x] `src/features/tabs/components/TabBar.test.tsx` -- Add tests: (1) tabs have `draggable="true"` when multiple tabs open; (2) single tab has `draggable="false"`; (3) dragStart sets drag state; (4) drop calls `reorderTabs` with correct indices; (5) dragEnd clears indicator; (6) click-to-switch still works alongside draggable

**Acceptance Criteria:**
- Given multiple tabs are open, when user drags a tab to a new position, then a vertical accent indicator shows the insertion point and the tab reorders on drop
- Given a single tab is open, when user tries to drag, then nothing happens (not draggable)
- Given user drags and drops outside the tab bar, then no reorder occurs and indicator disappears
- Given user drags the active tab, then it remains active after reordering

## Design Notes

**Insertion edge calculation:** On `dragover`, compare `e.clientX` to each tab's bounding rect midpoint. If cursor is in the left half, insert before that tab; right half, insert after. This gives natural "snap to nearest gap" behavior.

**Indicator positioning:** Use absolute positioning within the tab container. The indicator is a 2px-wide, 70%-height div with `background: var(--accent)`, positioned at the left edge of the drop target tab (or right edge of the last tab for end-of-list drops).

**Preventing click interference:** HTML5 DnD naturally handles this -- a short click without movement fires `onClick` normally; only a sustained drag initiates the DnD flow.

## Verification

**Commands:**
- `npx vitest run src/features/tabs/` -- expected: all tab store and TabBar tests pass including new DnD tests
- `npx tsc --noEmit` -- expected: no type errors
- `npx vitest run` -- expected: full suite passes (no regressions)

## Spec Change Log

- **Review patch 1:** Fixed `getDropIndex` to return `tabCount` (not `tabCount - 1`) when cursor is past all tabs, enabling drag-to-end. Added clamping in `handleDrop` before calling `reorderTabs`. KEEP: the `tabCount` return enables the indicator's "after last tab" positioning branch.
- **Review patch 2:** Refactored `handleDrop` to read source index from `e.dataTransfer.getData('text/plain')` and compute drop position via `getDropIndex(container, e.clientX)` directly, eliminating stale closure dependency on `dragFromIndex`/`dropTargetIndex` state. KEEP: this pattern is more robust than relying on React state in event handlers.
- **Review patch 3:** Added `dragFromIndex === null` guard in `handleDragOver` to prevent drop indicator rendering when drag originates from outside the tab bar.
- **Review patch 4:** Added missing test coverage: same-position drop (no reorder), active tab stays active after reorder. Used manual `MouseEvent` dispatch with `clientX` since jsdom lacks `DragEvent` support.

## Suggested Review Order

**DnD logic: position computation and drop handling**

- Midpoint-based insertion index — returns `tabCount` for "after last tab" position
  [`TabBar.tsx:11`](../../src/features/tabs/components/TabBar.tsx#L11)

- `handleDrop` reads source from dataTransfer, computes target position at drop time
  [`TabBar.tsx:91`](../../src/features/tabs/components/TabBar.tsx#L91)

- External drag guard prevents indicator when drag originates outside tab bar
  [`TabBar.tsx:80`](../../src/features/tabs/components/TabBar.tsx#L80)

**UI: drag feedback and indicator rendering**

- `draggable` gated on `tabs.length > 1`, opacity 0.5 on dragged tab
  [`TabBar.tsx:148`](../../src/features/tabs/components/TabBar.tsx#L148)

- Drop indicator: 2px accent bar, positioned via ref callback with `getBoundingClientRect`
  [`TabBar.tsx:210`](../../src/features/tabs/components/TabBar.tsx#L210)

**Tests**

- Manual `dispatchDrag` helper for jsdom (no DragEvent support = no clientX on fireEvent)
  [`TabBar.test.tsx:42`](../../src/features/tabs/components/TabBar.test.tsx#L42)

- Position-dependent tests: reorder, same-position no-op, active tab preservation
  [`TabBar.test.tsx:238`](../../src/features/tabs/components/TabBar.test.tsx#L238)
