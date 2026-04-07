# Story 3.4: Search Result Keyboard Navigation & Note Opening

Status: ready-for-dev

## Story

As a user,
I want to navigate search results with my keyboard and open notes,
so that I can find and access notes without touching my mouse.

## Acceptance Criteria

1. **Arrow Down navigates to next result** — When search results are displayed and the user presses the Down arrow key, the next result is highlighted with `var(--accent-muted)` background and `selectedIndex` increments.

2. **Arrow Up navigates to previous result** — When search results are displayed and the user presses the Up arrow key, the previous result is highlighted and `selectedIndex` decrements.

3. **Enter opens selected note** — When a result is highlighted and the user presses Enter, the selected note opens in the editor via `useEditorStore.loadNote(id)`, the search overlay closes, and the editor receives focus.

4. **Focus trapped within overlay** — When the search overlay is open, focus is trapped within the overlay. Tab cycles within the overlay (never escapes to editor). Esc is the only way to dismiss without selecting.

5. **Accessible markup** — The container has `role="search"`, the results list has `role="listbox"`, each result has `role="option"` with `aria-selected` on the highlighted result, and the input has `aria-label="Search notes"`.

6. **Click opens note** — When the user clicks a search result, the clicked note opens in the editor, the search overlay closes, and the editor receives focus.

## Required Tests

| Test ID | Description | Priority | Status |
|---------|-------------|----------|--------|
| COMP-3.4-01 | Enter key on selected result calls loadNote and closes overlay | P0 | pending |
| COMP-3.4-02 | Click on result item calls loadNote and closes overlay | P0 | pending |
| COMP-3.4-03 | Focus is trapped within overlay — Tab does not escape to editor | P0 | pending |
| COMP-3.4-04 | Arrow Down/Up navigation updates selectedIndex and highlight | P1 | pending |
| COMP-3.4-05 | Enter with no results does nothing | P1 | pending |
| COMP-3.4-06 | After opening note, editor receives focus (.cm-content focused) | P1 | pending |
| COMP-3.4-07 | Mouse click sets selectedIndex to clicked item before opening | P1 | pending |

## Tasks / Subtasks

- [ ] Task 1: Add Enter key handler to open selected note (AC: 3)
  - [ ] 1.1 In `SearchOverlay.tsx`, add Enter key case to the existing keydown handler
  - [ ] 1.2 When Enter is pressed and `results.length > 0`: get `results[selectedIndex]`, call `useEditorStore.getState().loadNote(result.id)`, call `useSearchStore.getState().closeSearch()`, focus `.cm-content`
  - [ ] 1.3 Guard: if `results.length === 0` or `selectedIndex` is out of bounds, do nothing on Enter
- [ ] Task 2: Add click handler to SearchResultItem (AC: 6)
  - [ ] 2.1 Add `onSelect` callback prop to `SearchResultItem` — `onSelect: (id: number) => void`
  - [ ] 2.2 Attach `onClick` to the result item div that calls `onSelect(result.id)`
  - [ ] 2.3 In `SearchOverlay.tsx`, pass an `onSelect` handler that calls `loadNote(id)`, `closeSearch()`, and focuses `.cm-content`
- [ ] Task 3: Implement focus trapping within overlay (AC: 4)
  - [ ] 3.1 Add `onKeyDown` handler at the overlay container level to intercept Tab/Shift+Tab
  - [ ] 3.2 Collect all focusable elements within the overlay (`input`, `[role="option"]`, any buttons)
  - [ ] 3.3 On Tab at last focusable element: wrap to first. On Shift+Tab at first: wrap to last
  - [ ] 3.4 Ensure Tab never escapes the overlay div
- [ ] Task 4: Write/update component tests (AC: all)
  - [ ] 4.1 Update `SearchOverlay.test.tsx` — test Enter key opens note and closes overlay
  - [ ] 4.2 Update `SearchOverlay.test.tsx` — test click on result item opens note and closes overlay
  - [ ] 4.3 Add focus trap tests — Tab at last element wraps to first, Shift+Tab at first wraps to last
  - [ ] 4.4 Test Enter with empty results does nothing
  - [ ] 4.5 Test that after opening a note, focus target is `.cm-content`

## Dev Notes

### Architecture Pattern

This is a **frontend-only** story. No Rust/backend changes. All required Tauri commands and store infrastructure already exist.

**Existing infrastructure from story 3.3 that this story extends:**
- `useSearchStore` — already has `selectNext()`, `selectPrev()`, `selectedIndex`, `closeSearch()`
- Arrow Down/Up handlers already implemented in `SearchOverlay.tsx` (lines 32-37)
- Scroll-into-view on selection change already works (lines 45-49)
- All ARIA attributes already in place (`role="search"`, `role="listbox"`, `role="option"`, `aria-selected`)
- `cursor: pointer` already on result items (review finding: deferred click handler to this story)
- Result count header already shows "Enter open" hint (review finding: deferred Enter behavior to this story)

**New behavior this story adds:**
1. Enter key → opens selected note in editor
2. Click on result → opens note in editor
3. Focus trapping within overlay (Tab cycles, never escapes)

### Note Opening Pattern — CRITICAL

Use `useEditorStore.getState().loadNote(id)` to open a note. This is the existing pattern established in story 1.9:

```typescript
// In SearchOverlay.tsx — the openNote handler:
const openNote = async (noteId: number) => {
  useSearchStore.getState().closeSearch();
  await useEditorStore.getState().loadNote(noteId);
  // Return focus to editor after overlay closes
  const editor = document.querySelector<HTMLElement>('.cm-content');
  editor?.focus();
};
```

**`loadNote` does everything:**
- Fetches the note via `commands.getNote(id)`
- Sets `activeNoteId`, `content`, `format`, `lastSavedAt` in the editor store
- Sets `isHydrating: true` so CodeMirror picks up the new content
- Handles errors with `console.error` and sets `saveStatus: 'failed'`

**Do NOT:**
- Manually call `commands.getNote()` and `setContent()` separately — that bypasses the hydration flow
- Create a new store action — `loadNote` already exists
- Add loading states — `loadNote` handles its own error state internally

### SearchResult API Contract

Already defined in `src/generated/bindings.ts`:

```typescript
export type SearchResult = {
  id: number;        // Note ID — pass this to loadNote
  title: string;
  snippet: string;
  workspaceName: string | null;
  updatedAt: string;
  format: string;
};
```

### Enter Key Handler — Implementation Spec

Add to the existing `useEffect` keydown handler in `SearchOverlay.tsx` (the one that handles Escape, ArrowDown, ArrowUp):

```typescript
} else if (e.key === 'Enter') {
  e.preventDefault();
  const { results, selectedIndex } = useSearchStore.getState();
  if (results.length === 0) return;
  const selected = results[selectedIndex];
  if (!selected) return;
  openNote(selected.id);
}
```

### Click Handler — Implementation Spec

Add an `onSelect` callback prop to `SearchResultItem`:

```typescript
interface SearchResultItemProps {
  result: SearchResult;
  isSelected: boolean;
  onSelect: (id: number) => void;  // NEW
}
```

Attach to the result item div:
```typescript
<div
  data-testid={`search-result-${result.id}`}
  role="option"
  aria-selected={isSelected}
  onClick={() => onSelect(result.id)}
  // ... existing props
>
```

In `SearchOverlay.tsx`, pass the handler:
```typescript
<SearchResultItem
  key={result.id}
  result={result}
  isSelected={index === selectedIndex}
  onSelect={openNote}
/>
```

### Focus Trapping — Implementation Spec

Implement at the overlay container's `onKeyDown`:

```typescript
const handleOverlayKeyDown = (e: React.KeyboardEvent) => {
  if (e.key !== 'Tab') return;
  const overlay = e.currentTarget;
  const focusable = overlay.querySelectorAll<HTMLElement>(
    'input, button, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
};
```

Attach to the outer overlay div:
```tsx
<div
  data-testid="search-overlay"
  role="search"
  onKeyDown={handleOverlayKeyDown}
  // ... existing props
>
```

**Note:** The search input is currently the only naturally focusable element. The focus trap ensures Tab stays on the input. If result items become focusable in the future, the trap handles that automatically.

### Files to Modify

```
src/features/search/components/SearchOverlay.tsx      # Add Enter handler, focus trap, pass onSelect
src/features/search/components/SearchResultItem.tsx   # Add onSelect prop + onClick handler
src/features/search/components/SearchOverlay.test.tsx  # Add Enter/click/focus-trap tests
```

**No new files needed.**

### Design Token Usage

All visual tokens already established in story 3.3. This story adds no new visual elements — it adds behavior to existing elements.

| Element | Token | Already in place? |
|---------|-------|--------------------|
| Selected result background | `var(--accent-muted)` | Yes (via `isSelected` → `var(--bg-surface)`) |
| Focus ring on input | `var(--focus-ring)` | Yes |
| Cursor on result items | `cursor: pointer` | Yes |

**Note:** The epics AC says highlighted result should use `var(--accent-muted)` background, but story 3.3 implemented it as `var(--bg-surface)`. Check if this needs to change — the epics AC is authoritative. Update `SearchResultItem` to use `var(--accent-muted)` for `isSelected` state if it differs from `var(--bg-surface)`.

### Testing Approach

Follow the co-located test pattern from story 3.3. Tests live in `SearchOverlay.test.tsx`.

**Mock pattern for `loadNote`:**
```typescript
import { useEditorStore } from '../../../features/editor/store';

// Mock loadNote
vi.spyOn(useEditorStore.getState(), 'loadNote').mockResolvedValue(undefined);
```

**Or mock the entire editor store** if importing directly causes issues:
```typescript
vi.mock('../../../features/editor/store', () => ({
  useEditorStore: {
    getState: () => ({
      loadNote: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));
```

**Test `.cm-content` focus:** In JSDOM, create a div with `class="cm-content"` and assert `document.activeElement` after the openNote flow.

### Accessibility Requirements (WCAG 2.1 AA)

All ARIA attributes already in place from story 3.3. This story adds:

| Behavior | Requirement | Implementation |
|----------|-------------|----------------|
| Focus trapping | WCAG 2.1.2 — No keyboard trap (Esc exits) | Tab cycles within overlay, Esc dismisses |
| Enter activation | WCAG 2.1.1 — Keyboard accessible | Enter on selected result opens note |
| aria-activedescendant | Optional enhancement | Consider adding `aria-activedescendant` on the listbox pointing to selected result ID |

### Anti-Patterns to Avoid

1. **Do NOT create a new Zustand store or actions** — `useSearchStore` already has everything needed. Use `useEditorStore.loadNote(id)` directly.
2. **Do NOT import from `../../generated/bindings` for `getNote`** — use `useEditorStore.loadNote(id)` which wraps the command call.
3. **Do NOT add a new route or page** — note opening replaces the current editor content via `loadNote`.
4. **Do NOT use `tabIndex` on result items** — they are navigated via Arrow keys + `selectedIndex`, not Tab. Tab stays on the input.
5. **Do NOT add debounce to Enter or click handlers** — these are instant actions.
6. **Do NOT use external focus-trap library** — implement with a simple `onKeyDown` handler as shown above.
7. **Do NOT add animations** — overlay closes instantly per UX spec.

### Previous Story Intelligence (Story 3.3)

**Key learnings and review findings directly relevant to this story:**

- **"Enter open" hint shown but Enter key not implemented** — This story implements the behavior. The hint text already exists in `SearchOverlay.tsx` line 149.
- **`cursor: pointer` on result items but no click handler** — This story adds the click handler. The cursor style already exists in `SearchResultItem.tsx` line 30.
- **Race condition guard** — `requestIdRef` prevents stale results. Keep this pattern — do not remove or change it.
- **`selectNext` no-ops when results are empty** — Already fixed in store. Enter handler should still guard `results.length === 0`.
- **`setResults` resets `selectedIndex` to 0** — Already fixed. New results always start at index 0.
- **Focus `.cm-content` after close** — Already implemented for Esc close (line 30-31). Use the same pattern for Enter/click.

**Files created in story 3.3 (context — extend, don't recreate):**
- `src/features/search/store.ts` — useSearchStore (do not modify unless absolutely necessary)
- `src/features/search/components/SearchOverlay.tsx` — main overlay (primary modification target)
- `src/features/search/components/SearchResultItem.tsx` — result display (add onSelect prop)
- `src/features/search/components/HighlightedSnippet.tsx` — safe mark parser (no changes needed)
- `src/features/search/components/SearchOverlay.test.tsx` — existing tests (extend with new tests)

### Git Intelligence

Recent commit patterns:
- `feat: add SearchOverlay UI with Zustand store, safe snippet highlighting, and Ctrl+F shortcut (story 3.3)`
- `fix: code review findings for story 3.3 — race guard, store fixes, a11y, typography tokens`
- Conventional Commits format: `feat:`, `fix:`, `chore:`, `refactor:`
- Story reference in commit message parenthetical: `(story 3.4)`

### Project Structure Notes

- All changes are within `src/features/search/components/` — aligns with feature-based organization
- No new directories or barrel files needed
- Tests co-located next to source files (no `__tests__/` directory)
- Import `useEditorStore` from `../../../features/editor/store` (relative path from search components)

### References

- [Story 3.4 AC: _bmad-output/planning-artifacts/epics.md#Story-3.4 (lines 1129-1161)]
- [Story 3.3 implementation: _bmad-output/implementation-artifacts/3-3-searchoverlay-ui-component.md]
- [SearchOverlay current source: src/features/search/components/SearchOverlay.tsx]
- [SearchResultItem current source: src/features/search/components/SearchResultItem.tsx]
- [Editor store loadNote: src/features/editor/store.ts (lines 66-89)]
- [Search store: src/features/search/store.ts]
- [Generated bindings: src/generated/bindings.ts (SearchResult type lines 107-114, getNote line 8)]
- [UX search overlay spec: _bmad-output/planning-artifacts/ux-design-specification.md#SearchOverlay (lines 1208-1238)]
- [Accessibility strategy: _bmad-output/planning-artifacts/ux-design-specification.md#Accessibility-Strategy (lines 1599-1665)]
- [Project conventions: _bmad-output/project-context.md]
- [Deferred work from 3.3 review: _bmad-output/implementation-artifacts/deferred-work.md (lines 115-121)]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
