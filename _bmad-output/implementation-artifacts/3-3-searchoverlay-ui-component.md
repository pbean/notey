# Story 3.3: SearchOverlay UI Component

Status: done

## Story

As a user,
I want a search interface that shows me matching notes with context,
so that I can visually identify the note I'm looking for.

## Acceptance Criteria

1. **Zustand store created** — `useSearchStore` (Zustand v5) exists at `src/features/search/store.ts` with state: `query: string`, `results: SearchResult[]`, `isOpen: boolean`, `selectedIndex: number` and actions: `setQuery(q)`, `openSearch()`, `closeSearch()`, `selectNext()`, `selectPrev()`, `setResults(results)`.

2. **Overlay renders on open** — When `isOpen` is true (triggered via `Ctrl/Cmd+F`), the SearchOverlay renders as a full-width overlay over the editor content with a modal backdrop that dims the editor behind it using `var(--bg-elevated)` background.

3. **Input auto-focused** — The search input is auto-focused on render with placeholder `"Search notes..."`.

4. **Live search results** — When the user types a query, `commands.searchNotes({ query, workspaceId: null })` is invoked (no debounce — backend is <100ms). Results display below the input showing: title, workspace name, relative date, and snippet.

5. **Match highlighting** — Query matches in snippets (returned as `<mark>` tags from backend) are rendered safely as styled spans with `var(--accent)` text color and `var(--accent-muted)` background. **No `dangerouslySetInnerHTML`** — parse `<mark>` tags into React elements.

6. **Empty state** — When there are 0 results, `"No notes matching '[query]'"` is shown in `var(--text-muted)`.

7. **Result count header** — Header shows `"N results · ↑↓ navigate · Enter open"`.

8. **Esc closes overlay** — When the user presses Esc, the overlay closes and focus returns to the editor.

## Required Tests

<!-- Frontend component tests (Vitest + React Testing Library). No test-design handoff IDs
     mapped for this UI story — coverage tracked by co-located component tests. -->

| Test ID | Description | Priority | Status |
|---------|-------------|----------|--------|
| COMP-3.3-01 | Store initializes with correct defaults and actions work | P0 | pass |
| COMP-3.3-02 | Overlay renders when isOpen=true, input auto-focused | P0 | pass |
| COMP-3.3-03 | Typing in input calls searchNotes and displays results | P0 | pass |
| COMP-3.3-04 | Empty state shows "No notes matching" message | P1 | pass |
| COMP-3.3-05 | Esc key closes overlay | P0 | pass |
| COMP-3.3-06 | Match highlighting renders safely (no dangerouslySetInnerHTML) | P1 | pass |
| COMP-3.3-07 | Result count header displays correct count | P1 | pass |

## Tasks / Subtasks

- [x] Task 1: Create search feature directory structure (AC: all)
  - [x] 1.1 Create `src/features/search/store.ts` with `useSearchStore`
  - [x] 1.2 Create `src/features/search/components/SearchOverlay.tsx`
  - [x] 1.3 Create `src/features/search/components/SearchResultItem.tsx`
  - [x] 1.4 Create `src/features/search/components/HighlightedSnippet.tsx`
- [x] Task 2: Implement `useSearchStore` Zustand store (AC: 1)
  - [x] 2.1 Define state interface with `query`, `results`, `isOpen`, `selectedIndex`
  - [x] 2.2 Implement actions: `setQuery`, `openSearch`, `closeSearch`, `selectNext`, `selectPrev`
  - [x] 2.3 Write store unit tests in `src/features/search/store.test.ts`
- [x] Task 3: Implement `HighlightedSnippet` component (AC: 5)
  - [x] 3.1 Parse `<mark>...</mark>` tags from snippet string into React elements
  - [x] 3.2 Style matched segments with `var(--accent)` text + `var(--accent-muted)` background + `font-weight: 600`
  - [x] 3.3 Ensure NO `dangerouslySetInnerHTML` — parse string, render `<span>` elements
- [x] Task 4: Implement `SearchResultItem` component (AC: 4, 5)
  - [x] 4.1 Display title, workspace name (or "No workspace"), relative date (`Intl.DateTimeFormat`), and highlighted snippet
  - [x] 4.2 Apply `data-testid="search-result-{id}"` on each result item
- [x] Task 5: Implement `SearchOverlay` component (AC: 2, 3, 4, 6, 7, 8)
  - [x] 5.1 Render overlay container with `data-testid="search-overlay"` and `role="search"`
  - [x] 5.2 Render backdrop with `var(--bg-primary)` at ~80% opacity
  - [x] 5.3 Auto-focus input on mount with `data-testid="search-input"` and `aria-label="Search notes"`
  - [x] 5.4 On input change: call `setQuery()`, invoke `commands.searchNotes()`, update results
  - [x] 5.5 Render results list with `role="listbox"`, each item `role="option"` with `aria-selected`
  - [x] 5.6 Show result count header: `"N results · ↑↓ navigate · Enter open"`
  - [x] 5.7 Show empty state when query is non-empty and results are empty
  - [x] 5.8 Handle Esc keydown to close overlay
- [x] Task 6: Integrate overlay into CaptureWindow (AC: 2)
  - [x] 6.1 Import SearchOverlay in `CaptureWindow.tsx`
  - [x] 6.2 Render `<SearchOverlay />` conditionally when `useSearchStore.isOpen` is true
  - [x] 6.3 Position overlay absolutely over the editor content area
- [x] Task 7: Register `Ctrl/Cmd+F` keyboard shortcut (AC: 2)
  - [x] 7.1 Add keydown listener in CaptureWindow (or a hook) for `Ctrl+F` / `Cmd+F`
  - [x] 7.2 Prevent default browser find, call `useSearchStore.getState().openSearch()`
- [x] Task 8: Write component tests (AC: all)
  - [x] 8.1 `src/features/search/store.test.ts` — store state and actions
  - [x] 8.2 `src/features/search/components/SearchOverlay.test.tsx` — render, input, search invocation, Esc, empty state
  - [x] 8.3 `src/features/search/components/HighlightedSnippet.test.tsx` — safe HTML parsing

### Review Findings

- [x] [Review][Decision] "Enter open" hint shown but Enter key not implemented — dismissed: left as-is per AC 7 literal wording; story 3.4 owns the behavior
- [x] [Review][Decision] `cursor: pointer` on result items but no click handler — dismissed: left as-is; story 3.4 adds the handler
- [x] [Review][Decision] Font size spec contradiction — resolved: overrode Tailwind typography tokens in `@theme inline` to match UX spec (--text-base: 14px, --text-sm: 13px, --text-xs: 11px)
- [x] [Review][Patch] Race condition: stale search results — fixed: added request counter ref with staleness guard [SearchOverlay.tsx]
- [x] [Review][Patch] `selectNext` sets `selectedIndex` to -1 when results are empty — fixed: no-op when results empty [store.ts]
- [x] [Review][Patch] `setResults` does not reset `selectedIndex` — fixed: reset to 0 on setResults [store.ts]
- [x] [Review][Patch] No try/catch around `await commands.searchNotes` — fixed: wrapped in try/catch [SearchOverlay.tsx]
- [x] [Review][Patch] Esc does not return focus to the editor — fixed: focus .cm-content after closeSearch [SearchOverlay.tsx]
- [x] [Review][Patch] Missing focus ring on search input — fixed: 2px var(--focus-ring) outline with 2px offset on focus [SearchOverlay.tsx]
- [x] [Review][Patch] No hover styling on result items — fixed: added onMouseEnter/onMouseLeave with var(--bg-surface) [SearchResultItem.tsx]
- [x] [Review][Patch] `formatRelativeDate` edge cases — fixed: guard NaN and negative diffMs [SearchResultItem.tsx]
- [x] [Review][Patch] `parseSnippet` greedy regex — fixed: changed inner match to non-greedy `(.*?)` [HighlightedSnippet.tsx]
- [x] [Review][Patch] No scroll-into-view — fixed: added useEffect with scrollIntoView on selectedIndex change [SearchOverlay.tsx]

## Dev Notes

### Architecture Pattern

This is a **frontend-only** story. No Rust/backend changes. The `search_notes` Tauri command already exists from story 3.2.

**Thin Command / Thick Service pattern** — the backend is complete:
```
commands/search.rs (thin) → services/search_service.rs (logic) → FTS5 SQL
```

The frontend calls `commands.searchNotes(query, workspaceId)` via tauri-specta generated bindings.

### SearchResult API Contract

The TypeScript type is auto-generated in `src/generated/bindings.ts`:

```typescript
// Invocation:
commands.searchNotes(query: string, workspaceId: number | null): Promise<Result<SearchResult[], NoteyError>>

// Return type:
type SearchResult = {
  id: number;        // Note ID
  title: string;     // Note title
  snippet: string;   // Content snippet with <mark> tags around matches
  workspaceName: string | null;  // Workspace name (null for unscoped notes)
  updatedAt: string; // ISO 8601 timestamp
  format: string;    // "markdown" | "plaintext"
};
```

**Result behavior:**
- Ranked by FTS5 BM25 relevance (title weighted 10x)
- Limited to top 50 results
- Only non-trashed notes returned
- Empty query returns `[]` (not an error)
- Snippet contains `<mark>` and `</mark>` HTML tags around matched text
- When content snippet is empty, falls back to title excerpt

### XSS-Safe Snippet Rendering (CRITICAL — deferred from story 3.2 review)

The `snippet` field contains raw `<mark>` tags from FTS5. **You MUST NOT use `dangerouslySetInnerHTML`.**

**Required approach — string parsing into React elements:**

```typescript
// HighlightedSnippet.tsx
function parseSnippet(snippet: string): React.ReactNode[] {
  const parts = snippet.split(/(<mark>.*?<\/mark>)/g);
  return parts.map((part, i) => {
    const match = part.match(/^<mark>(.*)<\/mark>$/);
    if (match) {
      return (
        <span key={i} style={{
          color: 'var(--accent)',
          background: 'var(--accent-muted)',
          fontWeight: 600,
        }}>
          {match[1]}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
```

This approach:
- Treats snippet as plain text (safe by default)
- Only recognizes the known `<mark>` pattern
- Renders all other content as textContent (XSS-proof)
- Satisfies the story 3.2 code review deferral

### Zustand v5 Store Pattern

Follow the exact pattern established in `src/features/editor/store.ts`:

```typescript
import { create } from 'zustand';
import type { SearchResult } from '../../generated/bindings';

interface SearchState {
  query: string;
  results: SearchResult[];
  isOpen: boolean;
  selectedIndex: number;
}

interface SearchActions {
  setQuery: (q: string) => void;
  openSearch: () => void;
  closeSearch: () => void;
  selectNext: () => void;
  selectPrev: () => void;
  setResults: (results: SearchResult[]) => void;
}

export const useSearchStore = create<SearchState & SearchActions>((set, get) => ({
  query: '',
  results: [],
  isOpen: false,
  selectedIndex: 0,
  setQuery: (query) => set({ query, selectedIndex: 0 }),
  openSearch: () => set({ isOpen: true, query: '', results: [], selectedIndex: 0 }),
  closeSearch: () => set({ isOpen: false, query: '', results: [], selectedIndex: 0 }),
  selectNext: () => {
    const { selectedIndex, results } = get();
    set({ selectedIndex: Math.min(selectedIndex + 1, results.length - 1) });
  },
  selectPrev: () => {
    const { selectedIndex } = get();
    set({ selectedIndex: Math.max(selectedIndex - 1, 0) });
  },
  setResults: (results) => set({ results }),
}));
```

**Key patterns:**
- `create<State & Actions>((set, get) => ({...}))` — single generic with state + actions
- Named actions only — NEVER expose raw `setState` to components
- Use `get()` inside actions to read current state
- Import types from `../../generated/bindings` (NEVER manually define IPC types)

### Command Invocation Pattern

Follow the exact error-handling pattern from existing stores:

```typescript
const result = await commands.searchNotes(query, workspaceId);
if (result.status === 'ok') {
  useSearchStore.getState().setResults(result.data);
} else {
  console.error('searchNotes failed:', result.error);
  useSearchStore.getState().setResults([]);
}
```

**No debounce needed** — backend returns in <100ms per NFR3. The epics AC explicitly states "no debounce needed at <100ms."

### Keyboard Shortcut Registration

Register `Ctrl+F` / `Cmd+F` as a window-level keydown listener. Do NOT use the Tauri global-shortcut plugin (that's for system-wide shortcuts when app is in background). This is an in-app shortcut.

```typescript
// In CaptureWindow or a useEffect hook:
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault(); // Prevent browser's native find
      useSearchStore.getState().openSearch();
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

### CaptureWindow Integration

Current `CaptureWindow.tsx` layout:
```tsx
<div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--bg-primary)]">
  <EditorPane className="flex-1 min-h-0" />
  <StatusBar />
</div>
```

Add SearchOverlay as a sibling positioned absolutely over the editor:
```tsx
<div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--bg-primary)]">
  <div className="relative flex-1 min-h-0">
    <EditorPane className="h-full" />
    {isSearchOpen && <SearchOverlay />}
  </div>
  <StatusBar />
</div>
```

The overlay should be `position: absolute; inset: 0; z-index: 50;` to cover the editor area but NOT the status bar.

### Relative Date Formatting

Use `Intl.DateTimeFormat` as per project-context.md (never format manually):

```typescript
function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}
```

### Design Token Usage

All visual values MUST use CSS custom properties — NO hardcoded colors:

| Element | Token | Purpose |
|---------|-------|---------|
| Overlay background | `var(--bg-elevated)` | Elevated surface |
| Result hover/surface | `var(--bg-surface)` | Surface layer |
| Backdrop | `var(--bg-primary)` at 80% opacity | Dim editor behind overlay |
| Input border | `var(--border-default)` | Input field border |
| Primary text | `var(--text-primary)` | Titles, input text |
| Secondary text | `var(--text-secondary)` | Workspace name, date |
| Muted text | `var(--text-muted)` | Placeholder, empty state, hints |
| Match highlight text | `var(--accent)` | Highlighted match text color |
| Match highlight bg | `var(--accent-muted)` | Highlighted match background |
| Focus ring | `var(--focus-ring)` | Input focus indicator |
| Font | `var(--font-mono)` | Monospace text |
| Spacing | `var(--space-1)` through `var(--space-8)` | 4px grid spacing |

### Typography & Spacing (UX Spec)

| Element | Size | Notes |
|---------|------|-------|
| Search input text | 14px (`--text-base`) | Monospace, line-height 22px |
| Result title | 14px (`--text-base`), weight 400 | Primary text color |
| Workspace name | 13px (`--text-sm`) | Secondary text color |
| Relative date | 13px (`--text-sm`) | Secondary text color |
| Snippet text | 14px (`--text-base`) | With bold (600) match highlight |
| Hint text | 11px (`--text-xs`) | "↑↓ navigate · Enter open" |
| Input padding | 8px horizontal, 12px vertical | |
| Result item gap | 16px between items | Dense but readable |
| Overlay padding | 24px | Content maximized |

### Animations

**NO animations.** Overlay appears and disappears instantly (0ms). Results update instantly on keystroke. Respects `prefers-reduced-motion`.

### Accessibility Requirements (WCAG 2.1 AA)

| Attribute | Element | Value |
|-----------|---------|-------|
| `role` | Overlay container | `"search"` |
| `role` | Results list | `"listbox"` |
| `role` | Each result item | `"option"` |
| `aria-selected` | Highlighted result | `true` on selected, `false` on others |
| `aria-label` | Search input | `"Search notes"` |
| Focus ring | All focusable elements | 2px `var(--focus-ring)` outline, 2px offset |

**Match highlighting** uses BOTH color AND bold weight (not color alone) for color vision deficiency support.

**data-testid attributes (required for E2E):**
- `data-testid="search-overlay"` — overlay container
- `data-testid="search-input"` — input field
- `data-testid="search-result-{id}"` — each result (where `{id}` is the note ID)

### Project Structure Notes

**New files (all frontend):**
```
src/features/search/
├── store.ts                              # useSearchStore (Zustand v5)
├── store.test.ts                         # Store unit tests
├── components/
│   ├── SearchOverlay.tsx                 # Main overlay component
│   ├── SearchOverlay.test.tsx            # Component tests
│   ├── SearchResultItem.tsx              # Individual result display
│   ├── HighlightedSnippet.tsx            # Safe <mark> tag parser
│   └── HighlightedSnippet.test.tsx       # Snippet parsing tests
```

**Modified files:**
```
src/features/editor/components/CaptureWindow.tsx  # Add SearchOverlay integration + Ctrl+F handler
```

**No changes to:**
- Backend (Rust) — search command complete from story 3.2
- Database/migrations — FTS5 infrastructure complete from story 3.1
- `src/generated/bindings.ts` — already has `searchNotes` and `SearchResult`

### Anti-Patterns to Avoid

1. **NO `dangerouslySetInnerHTML`** — parse `<mark>` tags into React elements instead
2. **NO manual TypeScript types for IPC** — import `SearchResult` from `../../generated/bindings`
3. **NO barrel files (`index.ts`)** — import directly from source files
4. **NO debounce on search input** — backend is <100ms, epics explicitly say no debounce
5. **NO `useState` for search state** — use the Zustand store for all search state
6. **NO Tauri global-shortcut plugin for Ctrl+F** — this is a window-level keydown, not a system hotkey
7. **NO animations** — instant appear/disappear per UX spec
8. **NO hardcoded colors** — all visual values via CSS custom properties
9. **NO separate `__tests__/` directories** — co-locate tests next to source files

### Previous Story Intelligence (Story 3.2)

**Key learnings:**
- The `result.status === 'ok' / 'error'` pattern is the standard for all tauri-specta command calls
- `SearchResult.snippet` contains `<mark>` HTML tags — XSS concern was explicitly deferred to this story
- `SearchResult.workspaceName` is `null` for unscoped notes — handle with fallback text
- Empty queries return `[]` without error — the input handler should still call searchNotes even for short queries
- All 137 backend tests pass — search backend is stable

**Files created in 3.2 (reference only, do not modify):**
- `src-tauri/src/commands/search.rs`
- `src-tauri/src/services/search_service.rs`
- `src-tauri/src/models/mod.rs` (SearchResult struct)

### Git Intelligence

Recent commits show consistent patterns:
- Conventional Commits format: `feat:`, `fix:`, `chore:`, `refactor:`
- Story 3.2 commit: `feat: add search_notes Tauri command with FTS5 full-text search (story 3.2)`
- Code review fixes committed separately: `fix: code review findings for story 3.2`

### References

- [Epic 3 acceptance criteria: _bmad-output/planning-artifacts/epics.md#Epic-3]
- [Architecture frontend patterns: _bmad-output/planning-artifacts/architecture.md#Frontend-Architecture]
- [UX search overlay spec: _bmad-output/planning-artifacts/ux-design-specification.md#Search]
- [Design tokens: src/index.css (lines 157-181, 248-263)]
- [Editor store pattern: src/features/editor/store.ts]
- [Workspace store pattern: src/features/workspace/store.ts]
- [CaptureWindow layout: src/features/editor/components/CaptureWindow.tsx]
- [SearchResult TypeScript type: src/generated/bindings.ts (lines 107-114)]
- [searchNotes command binding: src/generated/bindings.ts (line 33)]
- [Test mock setup: src/test-utils/setup.ts]
- [data-testid requirements: _bmad-output/test-artifacts/test-design/notey-handoff.md]
- [Project conventions: _bmad-output/project-context.md]
- [Story 3.2 implementation: _bmad-output/implementation-artifacts/3-2-full-text-search-tauri-command.md]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- Fixed unused `userEvent` import in SearchOverlay.test.tsx (caught by `tsc --noEmit`)

### Completion Notes List
- Created `useSearchStore` Zustand v5 store with state (query, results, isOpen, selectedIndex) and 6 named actions following existing editor/workspace store patterns
- Implemented `HighlightedSnippet` component that parses `<mark>` tags from FTS5 into React elements — no `dangerouslySetInnerHTML`, XSS-safe by construction
- Implemented `SearchResultItem` with title, workspace name (with null fallback), relative date (Intl.DateTimeFormat), and highlighted snippet
- Implemented `SearchOverlay` with auto-focused input, live search via `commands.searchNotes()` (no debounce), result count header, empty state, Esc-to-close, and full ARIA accessibility (role=search, listbox, option, aria-selected)
- Integrated overlay into `CaptureWindow.tsx` with absolute positioning over editor area (below status bar)
- Registered `Ctrl/Cmd+F` as window-level keydown listener in CaptureWindow (prevents browser native find)
- All design tokens used (no hardcoded colors): --bg-elevated, --bg-primary, --bg-surface, --text-primary, --text-secondary, --text-muted, --accent, --accent-muted, --border-default, --font-mono
- 24 new frontend tests: 8 store tests, 5 HighlightedSnippet tests, 11 SearchOverlay tests
- Full test suite: 81 tests pass (0 regressions), TypeScript compiles clean

### Change Log
- 2026-04-07: Implemented story 3.3 — SearchOverlay UI component with Zustand store, HighlightedSnippet, SearchResultItem, CaptureWindow integration, Ctrl+F shortcut, and 24 component tests

### File List
- `src/features/search/store.ts` (new) — useSearchStore Zustand v5 store
- `src/features/search/store.test.ts` (new) — Store unit tests (8 tests)
- `src/features/search/components/SearchOverlay.tsx` (new) — Main search overlay component
- `src/features/search/components/SearchOverlay.test.tsx` (new) — Overlay component tests (11 tests)
- `src/features/search/components/SearchResultItem.tsx` (new) — Individual result display
- `src/features/search/components/HighlightedSnippet.tsx` (new) — Safe mark tag parser
- `src/features/search/components/HighlightedSnippet.test.tsx` (new) — Snippet parsing tests (5 tests)
- `src/features/editor/components/CaptureWindow.tsx` (modified) — Added SearchOverlay integration + Ctrl+F handler
