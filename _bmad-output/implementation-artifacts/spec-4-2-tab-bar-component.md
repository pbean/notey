---
title: 'TabBar Component'
type: 'feature'
created: '2026-04-10'
status: 'done'
baseline_commit: '3afa724'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** There is no visual tab bar — users cannot see which notes are open, switch between them, or close tabs. The `useTabStore` (Story 4.1) exists but has no UI consumer.

**Approach:** Create a `TabBar` component that renders open tabs from `useTabStore`, integrates into `CaptureWindow` above the editor, and supports click-to-switch, hover close button, middle-click close, active tab indicator, title truncation, and overflow dropdown. Follow the existing inline-styles-with-CSS-variables pattern (StatusBar, SearchOverlay).

## Boundaries & Constraints

**Always:**
- 32px fixed height, `flexShrink: 0`
- Active tab: 2px bottom border using `var(--accent)`, no background change
- Tab titles truncated at ~20 chars with ellipsis; untitled notes show "New note"
- Close button visible on hover only; middle-click on tab also closes
- Accessibility: `role="tablist"` on bar, `role="tab"` + `aria-selected` on each tab
- `data-testid="tab-bar"` on container, `data-testid="tab-{noteId}"` on each tab
- Inline styles with CSS variables (match StatusBar/SearchOverlay pattern)
- Hidden when no tabs are open (render nothing)

**Ask First:**
- Changes to `useTabStore` shape or actions
- Adding new CSS variables to `index.css`

**Never:**
- Keyboard navigation (Story 4.3)
- Tab reordering / drag-and-drop (Story 4.7)
- CodeMirror integration (Story 4.4)
- Calling Tauri commands directly — TabBar only talks to `useTabStore`

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No tabs | `tabs: [], activeTabIndex: null` | TabBar not rendered | N/A |
| Single active tab | 1 tab, active | Tab shown with accent border, close button on hover | N/A |
| Multiple tabs | 3 tabs, middle active | All rendered, only active has accent border | N/A |
| Long title | Title > 20 chars | Truncated with "..." via CSS `text-overflow: ellipsis` | N/A |
| Empty title | `title: ""` | Display "New note" | N/A |
| Tab click | Click inactive tab | `switchTab(index)` called | N/A |
| Close click | Click close button | `closeTab(index)` called, event stops propagation | N/A |
| Middle-click | Middle mouse on tab | `closeTab(index)` called | N/A |
| Overflow | Tabs exceed bar width | "..." button visible, opens dropdown listing all tabs | N/A |

</frozen-after-approval>

## Code Map

- `src/features/tabs/components/TabBar.tsx` -- New: TabBar component consuming `useTabStore`
- `src/features/tabs/components/TabBar.test.tsx` -- New: RTL tests for rendering, interactions, accessibility
- `src/features/editor/components/CaptureWindow.tsx` -- Existing: insert `<TabBar />` above EditorPane
- `src/features/tabs/store.ts` -- Existing: consumed read-only by TabBar

## Tasks & Acceptance

**Execution:**
- [x] `src/features/tabs/components/TabBar.tsx` -- Create TabBar component: renders tabs from store with active indicator, hover close, middle-click close, title truncation, overflow dropdown, accessibility roles and testids
- [x] `src/features/tabs/components/TabBar.test.tsx` -- RTL tests: renders tabs, active indicator, click switches, close button works, middle-click closes, empty title fallback, hidden when no tabs, accessibility attributes
- [x] `src/features/editor/components/CaptureWindow.tsx` -- Import and render `<TabBar />` above the editor pane div

**Acceptance Criteria:**
- Given tabs are open, when TabBar renders, then each tab shows its title with `role="tab"` and `aria-selected`
- Given a tab is clicked, when it's not active, then `switchTab` is called and the tab gains the accent border
- Given a tab's close button is clicked, then `closeTab` is called and the click does not also switch tabs
- Given no tabs are open, when CaptureWindow renders, then TabBar is not present in the DOM
- Given a tab title exceeds 20 characters, when rendered, then it is truncated with ellipsis

## Verification

**Commands:**
- `npx vitest run src/features/tabs/components/TabBar.test.tsx` -- expected: all tests pass
- `npx tsc --noEmit` -- expected: no type errors

## Suggested Review Order

**Tab component**

- Core displayTitle helper — handles truncation, empty, and whitespace-only titles
  [`TabBar.tsx:11`](../../src/features/tabs/components/TabBar.tsx#L11)

- Tab rendering with active indicator, hover close, middle-click close
  [`TabBar.tsx:72`](../../src/features/tabs/components/TabBar.tsx#L72)

- Overflow detection via ResizeObserver with jsdom guard
  [`TabBar.tsx:38`](../../src/features/tabs/components/TabBar.tsx#L38)

- Overflow dropdown using DropdownMenu component
  [`TabBar.tsx:142`](../../src/features/tabs/components/TabBar.tsx#L142)

**Integration**

- CaptureWindow layout — TabBar inserted above EditorPane
  [`CaptureWindow.tsx:29`](../../src/features/editor/components/CaptureWindow.tsx#L29)

- Test setup — tab store reset added to global cleanup
  [`setup.ts:33`](../../src/test-utils/setup.ts#L33)

**Tests**

- RTL tests covering rendering, interactions, accessibility, overflow
  [`TabBar.test.tsx:1`](../../src/features/tabs/components/TabBar.test.tsx#L1)
