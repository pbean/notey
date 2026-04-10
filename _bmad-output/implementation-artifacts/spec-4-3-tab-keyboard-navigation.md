---
title: 'Tab Keyboard Navigation'
type: 'feature'
created: '2026-04-10'
status: 'done'
baseline_commit: '55eacaf'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Tabs can only be managed via mouse clicks. Power users expect keyboard shortcuts for cycling, jumping, and closing tabs — standard in every tabbed interface (VS Code, browsers).

**Approach:** Add a `useTabKeyboardNav` hook that registers global keyboard listeners for tab shortcuts. Follows the existing pattern (`window.addEventListener('keydown')` in useEffect) used by CaptureWindow and SearchOverlay. All shortcuts delegate to existing `useTabStore` actions.

## Boundaries & Constraints

**Always:**
- Ctrl+Tab → next tab (wraps from last to first)
- Ctrl+Shift+Tab → previous tab (wraps from first to last)
- Ctrl+1 through Ctrl+9 → jump to Nth tab (Ctrl+9 always jumps to last tab)
- Ctrl+W → close active tab
- All shortcuts use `e.preventDefault()` to suppress browser/Tauri defaults
- Shortcuts are no-ops when no tabs are open
- Shortcuts must not fire when search overlay is open (check `useSearchStore.isOpen`)

**Ask First:**
- Adding arrow key navigation within the tab bar (focus management concern)
- Changes to `useTabStore` actions

**Never:**
- Tab reordering via keyboard (Story 4.7)
- Command palette shortcuts (Story 4.5/4.6)
- Modifying CodeMirror keymaps
- Tauri global shortcut changes

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Next tab | Ctrl+Tab, 3 tabs, active=0 | active→1 | N/A |
| Next tab wrap | Ctrl+Tab, 3 tabs, active=2 | active→0 | N/A |
| Prev tab | Ctrl+Shift+Tab, 3 tabs, active=1 | active→0 | N/A |
| Prev tab wrap | Ctrl+Shift+Tab, 3 tabs, active=0 | active→2 | N/A |
| Jump Ctrl+3 | Ctrl+3, 5 tabs | active→2 | N/A |
| Jump out of range | Ctrl+5, 3 tabs | No change | N/A |
| Ctrl+9 always last | Ctrl+9, 5 tabs | active→4 | N/A |
| Close active | Ctrl+W, 3 tabs, active=1 | Tab closed, neighbor selected | N/A |
| No tabs | Any shortcut, 0 tabs | No-op | N/A |
| Search open | Ctrl+Tab, search overlay open | No-op (search handles keys) | N/A |

</frozen-after-approval>

## Code Map

- `src/features/tabs/hooks/useTabKeyboardNav.ts` -- New: hook registering global keyboard listeners
- `src/features/tabs/hooks/useTabKeyboardNav.test.ts` -- New: unit tests for all shortcuts and edge cases
- `src/features/editor/components/CaptureWindow.tsx` -- Existing: call `useTabKeyboardNav()` to activate the hook

## Tasks & Acceptance

**Execution:**
- [x] `src/features/tabs/hooks/useTabKeyboardNav.ts` -- Create hook: register keydown listener for Ctrl+Tab, Ctrl+Shift+Tab, Ctrl+1-9, Ctrl+W; delegate to `useTabStore` actions; guard against search overlay open
- [x] `src/features/tabs/hooks/useTabKeyboardNav.test.ts` -- Test all I/O matrix scenarios: cycling, wrapping, jump, out-of-range, Ctrl+9 last, close, no-tabs no-op, search-open guard
- [x] `src/features/editor/components/CaptureWindow.tsx` -- Add `useTabKeyboardNav()` call

**Acceptance Criteria:**
- Given multiple tabs, when Ctrl+Tab is pressed, then the next tab is activated (wrapping at end)
- Given multiple tabs, when Ctrl+Shift+Tab is pressed, then the previous tab is activated (wrapping at start)
- Given 5 tabs, when Ctrl+3 is pressed, then tab at index 2 becomes active
- Given 3 tabs, when Ctrl+W is pressed, then the active tab is closed
- Given search overlay is open, when any tab shortcut is pressed, then it is ignored

## Verification

**Commands:**
- `npx vitest run src/features/tabs/hooks/useTabKeyboardNav.test.ts` -- expected: all tests pass
- `npx tsc --noEmit` -- expected: no type errors

## Suggested Review Order

- Keyboard handler with search-open guard and no-tabs guard
  [`useTabKeyboardNav.ts:11`](../../src/features/tabs/hooks/useTabKeyboardNav.ts#L11)

- Ctrl+Tab/Ctrl+Shift+Tab cycling with wrap logic
  [`useTabKeyboardNav.ts:23`](../../src/features/tabs/hooks/useTabKeyboardNav.ts#L23)

- Ctrl+W close active and Ctrl+1-9 jump (Ctrl+9 special case)
  [`useTabKeyboardNav.ts:37`](../../src/features/tabs/hooks/useTabKeyboardNav.ts#L37)

- CaptureWindow integration — hook activation
  [`CaptureWindow.tsx:15`](../../src/features/editor/components/CaptureWindow.tsx#L15)

- Tests covering all 10 I/O matrix scenarios
  [`useTabKeyboardNav.test.ts:1`](../../src/features/tabs/hooks/useTabKeyboardNav.test.ts#L1)
