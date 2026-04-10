# Story 3.5: Workspace-Scoped Search Toggle

Status: review

## Story

As a user,
I want to search within my current workspace or across all workspaces,
so that I can control the scope of my search.

## Acceptance Criteria

1. **Default scope is current workspace** — When the search overlay opens and a workspace is active (`useWorkspaceStore.activeWorkspaceId` is non-null and `isAllWorkspaces` is false), results are filtered to that workspace via `commands.searchNotes(query, activeWorkspaceId)`. The scope indicator shows the workspace name.

2. **Default scope is "All Workspaces" when no workspace is active** — When `isAllWorkspaces` is true or `activeWorkspaceId` is null, search defaults to all workspaces (`workspaceId: null`). The scope indicator shows "All Workspaces".

3. **Toggle broadens to all workspaces** — When the user clicks the scope indicator or presses the toggle shortcut, scope switches to "All Workspaces", search re-executes with `workspaceId: null`, and the indicator updates.

4. **Toggle narrows to active workspace** — When the user toggles back, scope returns to the active workspace, search re-executes with `workspaceId: activeWorkspaceId`, and the indicator updates.

5. **Scope indicator is accessible** — The scope toggle button has `role="button"`, `aria-label` describing the current scope and toggle action, and is keyboard-focusable. Tab cycles between the search input and the scope toggle.

6. **Scope persists within session** — Opening and closing the search overlay preserves the scope choice within the same session (per UX overlay rule: "State preserved — closing and reopening an overlay within the same session preserves its last state").

## Required Tests

| Test ID | Description | Priority | Status |
|---------|-------------|----------|--------|
| COMP-3.5-01 | Default scope is active workspace — `searchNotes` called with `activeWorkspaceId` | P0 | - |
| COMP-3.5-02 | Toggle to "All Workspaces" — `searchNotes` re-called with `null`, indicator updates | P0 | - |
| COMP-3.5-03 | Toggle back to workspace — `searchNotes` re-called with `activeWorkspaceId`, indicator updates | P0 | - |
| COMP-3.5-04 | Default scope is "All Workspaces" when `isAllWorkspaces` is true | P1 | - |
| COMP-3.5-05 | Scope indicator shows workspace name when scoped | P1 | - |
| COMP-3.5-06 | Scope indicator shows "All Workspaces" when unscoped | P1 | - |
| COMP-3.5-07 | Tab cycles between search input and scope toggle | P1 | - |
| COMP-3.5-08 | Scope persists across overlay close/reopen | P1 | - |
| COMP-3.5-09 | Toggle with empty query does not call searchNotes | P1 | - |

## Tasks / Subtasks

- [x] Task 1: Add scope state to search store (AC: 1, 2, 6)
  - [x] 1.1 Add `scopeFilter: 'workspace' | 'all'` to `useSearchStore` state — default `'workspace'`
  - [x] 1.2 Add `toggleScope()` action that flips between `'workspace'` and `'all'`
  - [x] 1.3 Do NOT reset `scopeFilter` in `openSearch()` or `closeSearch()` — scope persists across open/close (AC: 6)
  - [x] 1.4 Do NOT reset `scopeFilter` in `setQuery()` — scope is independent of query

- [x] Task 2: Wire workspace-scoped search in SearchOverlay (AC: 1, 2, 3, 4)
  - [x] 2.1 Import `useWorkspaceStore` from `'../../workspace/store'`
  - [x] 2.2 In `handleInput()`, derive effective `workspaceId`:
    ```typescript
    const { scopeFilter } = useSearchStore.getState();
    const { activeWorkspaceId, isAllWorkspaces } = useWorkspaceStore.getState();
    const workspaceId = (scopeFilter === 'all' || isAllWorkspaces || activeWorkspaceId === null) ? null : activeWorkspaceId;
    ```
  - [x] 2.3 Pass `workspaceId` to `commands.searchNotes(value, workspaceId)` instead of hardcoded `null`
  - [x] 2.4 On scope toggle: if `query` is non-empty, re-execute search with new scope. Use existing `handleInput()` pattern or call `commands.searchNotes` directly with current query and new scope.

- [x] Task 3: Add scope toggle UI (AC: 1, 2, 3, 4, 5)
  - [x] 3.1 Add scope toggle button next to the search input (per UX anatomy: `[scope]` element right of input)
  - [x] 3.2 Display current scope text:
    - When `scopeFilter === 'workspace'` and workspace is active: show workspace name (e.g., "startup-app")
    - When `scopeFilter === 'all'` or no active workspace: show "All Workspaces"
  - [x] 3.3 On click: call `toggleScope()`, then re-execute search if query is non-empty
  - [x] 3.4 Style with existing design tokens: `var(--text-muted)` text, `var(--bg-surface)` background, `var(--border-default)` border. On hover: `var(--bg-hover)`
  - [x] 3.5 Add `data-testid="search-scope-toggle"` for test targeting
  - [x] 3.6 Add `role="button"` and `aria-label` (e.g., `"Search scope: startup-app. Click to search all workspaces"`)

- [x] Task 4: Update focus trap for Tab cycling (AC: 5)
  - [x] 4.1 Make the scope toggle button focusable (`tabIndex={0}` or use a `<button>` element)
  - [x] 4.2 Update focus trap in `handleOverlayKeyDown` — the focusable elements list now includes the scope toggle button
  - [x] 4.3 Tab from input moves focus to scope toggle; Tab from scope toggle wraps back to input

- [x] Task 5: Write component tests (AC: all)
  - [x] 5.1 Mock `useWorkspaceStore` to provide `activeWorkspaceId`, `activeWorkspaceName`, `isAllWorkspaces`
  - [x] 5.2 Test default scope — `searchNotes` called with `activeWorkspaceId` when workspace is active (COMP-3.5-01)
  - [x] 5.3 Test toggle to all — click scope toggle, verify `searchNotes` re-called with `null` (COMP-3.5-02)
  - [x] 5.4 Test toggle back — click scope toggle twice, verify `searchNotes` re-called with `activeWorkspaceId` (COMP-3.5-03)
  - [x] 5.5 Test default when `isAllWorkspaces` — scope indicator shows "All Workspaces" (COMP-3.5-04)
  - [x] 5.6 Test scope indicator text shows workspace name (COMP-3.5-05, COMP-3.5-06)
  - [x] 5.7 Test Tab cycling between input and scope toggle (COMP-3.5-07)
  - [x] 5.8 Test scope persists after close/reopen (COMP-3.5-08)
  - [x] 5.9 Test toggle with empty query does not trigger search (COMP-3.5-09)

## Dev Notes

### Architecture Pattern

This is a **frontend-only** story. No Rust/backend changes needed. The `search_notes` command already accepts `workspace_id: Option<i64>` and the service layer already filters by workspace when provided. The frontend currently hardcodes `null`.

### Backend — Already Complete

**Command** (`src-tauri/src/commands/search.rs:12-21`):
```rust
pub fn search_notes(
    state: State<'_, Mutex<rusqlite::Connection>>,
    query: String,
    workspace_id: Option<i64>,
) -> Result<Vec<SearchResult>, NoteyError>
```

**Service** (`src-tauri/src/services/search_service.rs:35-39`):
- When `workspace_id = Some(ws_id)`: SQL includes `AND n.workspace_id = ?2` (line 69)
- When `workspace_id = None`: omits workspace filter, returns all non-trashed notes

**Generated bindings** (`src/generated/bindings.ts:33`):
```typescript
searchNotes: (query: string, workspaceId: number | null) => ...
```

No backend changes. No bindings regeneration. No new Tauri commands.

### The One-Line Core Change

The entire backend integration is replacing the hardcoded `null`:

```typescript
// SearchOverlay.tsx line 107, BEFORE:
const result = await commands.searchNotes(value, null);

// AFTER:
const { scopeFilter } = useSearchStore.getState();
const { activeWorkspaceId, isAllWorkspaces } = useWorkspaceStore.getState();
const wsId = (scopeFilter === 'all' || isAllWorkspaces || !activeWorkspaceId) ? null : activeWorkspaceId;
const result = await commands.searchNotes(value, wsId);
```

### Search Store Changes — Minimal

Add to `useSearchStore` (`src/features/search/store.ts`):

```typescript
// State — add:
scopeFilter: 'workspace' | 'all';

// Actions — add:
toggleScope: () => void;

// Implementation:
scopeFilter: 'workspace',
toggleScope: () => set((state) => ({
  scopeFilter: state.scopeFilter === 'workspace' ? 'all' : 'workspace',
})),
```

**CRITICAL:** Do NOT reset `scopeFilter` in `openSearch()` or `closeSearch()`. The UX spec requires scope to persist across overlay close/reopen within a session. Review the existing `openSearch` and `closeSearch` implementations — they reset `query`, `results`, `selectedIndex`, and `isOpen`. `scopeFilter` must NOT be in those resets.

### Scope Toggle UI — Implementation Spec

Per UX spec (`ux-design-specification.md:1215`), the SearchOverlay anatomy shows `[scope]` next to the search input:

```
┌─────────────────────────────────────────┐
│ lens [search input___________] [scope]  │
├─────────────────────────────────────────┤
│ results...                              │
```

Implement as a `<button>` element (inherently focusable, no extra `tabIndex` needed):

```tsx
<button
  data-testid="search-scope-toggle"
  role="button"
  aria-label={scopeLabel}
  onClick={handleScopeToggle}
  className="..."
>
  {scopeText}
</button>
```

**Scope text logic:**
```typescript
const { activeWorkspaceName, isAllWorkspaces, activeWorkspaceId } = useWorkspaceStore.getState();
const { scopeFilter } = useSearchStore.getState();

const isEffectivelyAll = scopeFilter === 'all' || isAllWorkspaces || !activeWorkspaceId;
const scopeText = isEffectivelyAll ? 'All Workspaces' : (activeWorkspaceName ?? 'Workspace');
const scopeLabel = isEffectivelyAll
  ? 'Search scope: All Workspaces. Click to search current workspace'
  : `Search scope: ${activeWorkspaceName}. Click to search all workspaces`;
```

**Handle scope toggle:**
```typescript
const handleScopeToggle = useCallback(() => {
  useSearchStore.getState().toggleScope();
  // Re-execute search with new scope if query is non-empty
  const query = inputRef.current?.value ?? '';
  if (query.trim()) {
    handleInput(); // or re-trigger search directly
  }
}, [handleInput]);
```

**Note on re-executing search:** When the scope toggles, the existing `handleInput()` function reads the current input value and calls `searchNotes`. Reuse this function rather than duplicating the search logic. The `requestIdRef` stale-result guard already handles concurrent calls.

### Scope Toggle Styling

Use existing design tokens only. No new CSS variables needed:

```
Default:     text: var(--text-muted), bg: var(--bg-surface), border: var(--border-default)
Hover:       bg: var(--bg-hover)
Focus:       outline: var(--focus-ring)
Active:      text: var(--text-primary) when scoped to workspace (shows meaningful selection)
```

Keep it subtle — the scope indicator should not compete with the search input for visual attention.

### Focus Trap Update

Story 3.4 implemented focus trapping (`handleOverlayKeyDown`). The current implementation queries focusable elements:

```typescript
const focusable = overlay.querySelectorAll<HTMLElement>(
  'input, button, [tabindex]:not([tabindex="-1"])'
);
```

Since the scope toggle is a `<button>`, it will automatically be included in the focusable elements query. **No changes needed to the focus trap logic** — it already handles multiple focusable elements with wrap-around.

**Verify:** Tab from input → scope toggle button. Tab from scope toggle → wraps to input. Shift+Tab from input → wraps to scope toggle.

### Workspace Store API — Read Only

Consume from `useWorkspaceStore` (read only, do not modify):

```typescript
// src/features/workspace/store.ts — relevant state:
activeWorkspaceId: number | null;      // null if no workspace detected
activeWorkspaceName: string | null;    // human-readable workspace name
isAllWorkspaces: boolean;              // true when user selected "All Workspaces" in StatusBar
```

Import as:
```typescript
import { useWorkspaceStore } from '../../workspace/store';
```

**Do NOT:**
- Call `setActiveWorkspace()` or `setAllWorkspaces()` from SearchOverlay — workspace switching is StatusBar's responsibility
- Subscribe to workspace store changes with `useWorkspaceStore()` hook in render — use `getState()` at search time instead to avoid unnecessary re-renders
- Modify workspace store state in any way

**HOWEVER:** The scope toggle button's display text (workspace name vs "All Workspaces") DOES need to react to the current state. Use `useWorkspaceStore()` hook selectively for the display values:

```typescript
const activeWorkspaceName = useWorkspaceStore((s) => s.activeWorkspaceName);
const isAllWorkspaces = useWorkspaceStore((s) => s.isAllWorkspaces);
const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
```

### Edge Cases

1. **No active workspace** — When `activeWorkspaceId` is null (e.g., app opened from non-git directory), the scope toggle should show "All Workspaces" and the toggle button should either be disabled or hidden (toggling has no effect since there's no workspace to scope to).

2. **Workspace changes while overlay is open** — If the user changes workspace via StatusBar while search is open (unlikely but possible via keyboard), the scope indicator should reflect the new workspace name on next render. Use `useWorkspaceStore()` selector for display values (not just `getState()`).

3. **`isAllWorkspaces` in workspace store vs `scopeFilter` in search store** — These are independent. `isAllWorkspaces` reflects the StatusBar's workspace selection. `scopeFilter` reflects the search overlay's local toggle. When `isAllWorkspaces` is true, the search should always be unscoped regardless of `scopeFilter`.

### Files to Modify

```
src/features/search/store.ts                          # Add scopeFilter state + toggleScope action
src/features/search/components/SearchOverlay.tsx       # Scope toggle UI, workspace-filtered search, re-execute on toggle
src/features/search/components/SearchOverlay.test.tsx  # 9 new tests
```

**No new files needed.**

### Anti-Patterns to Avoid

1. **Do NOT add workspace filtering to the backend** — it already exists. Do not touch `search_service.rs`, `search.rs`, or any Rust code.
2. **Do NOT create a separate `ScopeToggle` component file** — inline the button in `SearchOverlay.tsx`. It's a single button, not worth a separate file.
3. **Do NOT debounce the scope toggle** — toggling is an instant action, same as Enter/click handlers.
4. **Do NOT use `useEffect` to watch `scopeFilter` changes** — re-execute search in the toggle handler directly, not reactively.
5. **Do NOT reset `scopeFilter` on overlay close** — scope persists within session per UX spec.
6. **Do NOT add a keyboard shortcut (`Ctrl+Shift+S`) in this story** — the UX spec mentions it as a possibility ("e.g., Ctrl+Shift+S") but the epics AC only mentions "keyboard shortcut or clickable scope indicator". The click target + Tab-focusable button satisfies both. A dedicated shortcut can be added with the command palette (Epic 4).
7. **Do NOT import `commands` separately for `searchNotes`** — it's already imported in SearchOverlay. Reuse the existing import.
8. **Do NOT mock `useWorkspaceStore` with `vi.mock()` at module level** — use `vi.spyOn` on individual selectors or set state directly via `useWorkspaceStore.setState()` in tests.

### Previous Story Intelligence (Story 3.4)

**Review findings resolved in 3.4 that affect this story:**
- `openNote` now has error handling, reentrancy guard, and `useCallback` memoization — follow the same pattern for `handleScopeToggle`
- Focus trap tests assert `preventDefault` was called (not `document.activeElement` which is unreliable in jsdom) — use the same approach for Tab cycling tests
- Test isolation: `afterEach` cleans up `.cm-content` nodes, `beforeEach` resets editor store — maintain these patterns

**`scrollIntoView` optional chain** — `selected?.scrollIntoView?.()` is intentional (jsdom guard). Do not remove.

**`requestIdRef` stale-result guard** — Already in `handleInput()`. When scope toggle re-executes search, reuse `handleInput()` so the stale guard is active.

### Testing Approach

Extend `SearchOverlay.test.tsx`. Follow co-located test pattern.

**Mock workspace store for tests:**
```typescript
// Set workspace store state for tests:
beforeEach(() => {
  useWorkspaceStore.setState({
    activeWorkspaceId: 1,
    activeWorkspaceName: 'test-workspace',
    isAllWorkspaces: false,
    workspaces: [],
    filteredNotes: [],
    isLoadingNotes: false,
    workspaceError: null,
    notesError: null,
  });
  useSearchStore.getState().closeSearch();
});
```

**Mock `searchNotes` to capture args:**
```typescript
const searchNotesSpy = vi.fn().mockResolvedValue([]);
vi.spyOn(commands, 'searchNotes').mockImplementation(searchNotesSpy);
```

**Assert workspace ID passed:**
```typescript
// After typing a query:
expect(searchNotesSpy).toHaveBeenCalledWith('test query', 1); // workspace-scoped

// After toggling scope:
fireEvent.click(screen.getByTestId('search-scope-toggle'));
// Re-type or re-trigger search
expect(searchNotesSpy).toHaveBeenCalledWith('test query', null); // all workspaces
```

### Design Token Usage

No new tokens needed. All tokens already established:

| Element | Token | Already exists? |
|---------|-------|--------------------|
| Scope toggle text | `var(--text-muted)` | Yes |
| Scope toggle background | `var(--bg-surface)` | Yes |
| Scope toggle border | `var(--border-default)` | Yes |
| Scope toggle hover bg | `var(--bg-hover)` | Yes |
| Scope toggle focus ring | `var(--focus-ring)` | Yes |

### Accessibility Requirements (WCAG 2.1 AA)

| Behavior | Requirement | Implementation |
|----------|-------------|----------------|
| Scope toggle keyboard accessible | WCAG 2.1.1 | `<button>` element, Tab-focusable |
| Scope state announced | WCAG 4.1.2 | `aria-label` describes current scope and action |
| Focus trap includes toggle | WCAG 2.1.2 | Tab cycles input ↔ scope toggle |
| No keyboard trap | WCAG 2.1.2 | Esc exits overlay (existing behavior) |

### Git Intelligence

Recent commit patterns:
- `feat: add SearchOverlay UI with Zustand store, safe snippet highlighting, and Ctrl+F shortcut (story 3.3)`
- `fix: code review findings for story 3.4 — error handling, test isolation, stale closure`
- Conventional Commits format: `feat:`, `fix:`, `chore:`, `refactor:`
- Story reference in commit message parenthetical: `(story 3.5)`

### Project Structure Notes

- All changes within `src/features/search/` — aligns with feature-based organization
- No new directories or barrel files
- Tests co-located next to source files
- Import `useWorkspaceStore` from `../../workspace/store` (relative path from search components)

### References

- [Story 3.5 AC: _bmad-output/planning-artifacts/epics.md#Story-3.5 (lines 1163-1186)]
- [SearchOverlay UX anatomy: _bmad-output/planning-artifacts/ux-design-specification.md#SearchOverlay (lines 1208-1238)]
- [Scope toggle UX: _bmad-output/planning-artifacts/ux-design-specification.md (line 1236)]
- [Tab cycling shortcut: _bmad-output/planning-artifacts/ux-design-specification.md (line 1384)]
- [Search journey workspace scope: _bmad-output/planning-artifacts/ux-design-specification.md (lines 917-923)]
- [FR12 workspace-scoped search: _bmad-output/planning-artifacts/prd.md (line 463)]
- [FR34 all-workspaces view: _bmad-output/planning-artifacts/prd.md (line 497)]
- [Story 3.4 implementation: _bmad-output/implementation-artifacts/3-4-search-result-keyboard-navigation-note-opening.md]
- [Search store: src/features/search/store.ts]
- [SearchOverlay current source: src/features/search/components/SearchOverlay.tsx (line 107 — hardcoded null)]
- [Workspace store: src/features/workspace/store.ts]
- [Search command: src-tauri/src/commands/search.rs (lines 12-21)]
- [Search service: src-tauri/src/services/search_service.rs (lines 35-121)]
- [Generated bindings: src/generated/bindings.ts (line 33 — searchNotes signature)]
- [Project conventions: _bmad-output/project-context.md]

## Change Log

- Implemented workspace-scoped search toggle — scope indicator, store state, workspace-filtered search, 9 new tests (Date: 2026-04-08)
- Updated existing focus trap test to account for new scope toggle button element

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Initial test run: 4 failures — old focus trap test broke because button added a second focusable element; scope state leaked between tests due to intentional non-reset in closeSearch/openSearch. Fixed by updating focus trap test assertions and adding scopeFilter reset in nested beforeEach.

### Completion Notes List

- Task 1: Added `scopeFilter: 'workspace' | 'all'` state and `toggleScope()` action to `useSearchStore`. Verified `openSearch`/`closeSearch`/`setQuery` do not reset `scopeFilter` (session persistence per AC 6).
- Task 2: Updated `handleInput()` to derive effective `workspaceId` from search store's `scopeFilter` and workspace store's `activeWorkspaceId`/`isAllWorkspaces`. Replaced hardcoded `null` with derived value. Made `handleInput` accept optional value param so scope toggle can re-trigger search with current query.
- Task 3: Added scope toggle `<button>` next to search input with `data-testid`, `aria-label`, design token styling (bg-surface, text-muted, border-default, bg-hover), and scope text showing workspace name or "All Workspaces".
- Task 4: No focus trap code changes needed — existing `querySelectorAll('input, button, ...')` automatically includes the new `<button>`. Verified Tab cycling works: input -> toggle -> wrap to input.
- Task 5: Added 9 new tests (COMP-3.5-01 through COMP-3.5-09) covering default workspace scope, toggle to all, toggle back, isAllWorkspaces default, scope indicator text, Tab cycling, scope persistence, and empty query guard.

### File List

- src/features/search/store.ts (modified)
- src/features/search/components/SearchOverlay.tsx (modified)
- src/features/search/components/SearchOverlay.test.tsx (modified)
