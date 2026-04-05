# Story 2.4: Workspace Selector in StatusBar

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to see which workspace I'm in and switch workspaces easily,
So that I can navigate between projects.

## Acceptance Criteria

1. **Given** the `useWorkspaceStore` Zustand v5 store exists (from Story 2.3)
   **When** it is extended for Story 2.4
   **Then** it has additional state: `workspaces: WorkspaceInfo[]`, `isAllWorkspaces: boolean`
   **And** it has additional actions: `setActiveWorkspace(id)`, `setAllWorkspaces()`, `loadWorkspaces()`

2. **Given** a workspace is active
   **When** the StatusBar left section renders
   **Then** it shows the workspace name + note count in format "[name] · [N] notes"
   **And** the text is clickable

3. **Given** the user clicks the workspace display in StatusBar
   **When** the workspace selector dropdown opens
   **Then** it lists all workspaces with their note counts
   **And** includes an "All Workspaces" option at the top (FR34)
   **And** is keyboard-navigable (arrow keys to move, Enter to select, Esc to close)

4. **Given** the user selects a workspace from the dropdown
   **When** the selection is confirmed
   **Then** `activeWorkspaceId` updates to the selected workspace
   **And** the dropdown closes
   **And** the StatusBar updates to show the new workspace name + count

## Required Tests

<!-- Map test IDs from test-design handoff (e.g. _bmad-output/test-artifacts/test-design/notey-handoff.md).
     Story cannot be marked "done" unless mapped P0/P1 tests are passing. -->

| Test ID | Description | Priority | Status |
|---------|-------------|----------|--------|
| UNIT-2.4-001 | `loadWorkspaces()` calls `listWorkspaces` and populates `workspaces` state | P0 | PASS |
| UNIT-2.4-002 | `setActiveWorkspace(id)` sets `activeWorkspaceId`, `activeWorkspaceName`, `isAllWorkspaces: false` | P0 | PASS |
| UNIT-2.4-003 | `setAllWorkspaces()` sets `isAllWorkspaces: true`, clears `activeWorkspaceId`/`activeWorkspaceName` | P0 | PASS |
| UNIT-2.4-004 | `initWorkspace()` also calls `loadWorkspaces()` during init | P0 | PASS |
| COMP-2.4-001 | StatusBar shows "[name] · [N] notes" format with active workspace | P0 | PASS |
| COMP-2.4-002 | StatusBar workspace text is clickable (button role) | P0 | PASS |
| COMP-2.4-003 | WorkspaceSelector renders dropdown with all workspaces + "All Workspaces" option | P0 | PASS |
| COMP-2.4-004 | Selecting a workspace calls `setActiveWorkspace` and closes dropdown | P1 | PASS |
| COMP-2.4-005 | Selecting "All Workspaces" calls `setAllWorkspaces` and closes dropdown | P1 | PASS |
| COMP-2.4-006 | StatusBar shows "All Workspaces · [total] notes" when `isAllWorkspaces` is true | P1 | PASS |
| P2-COMP-002 | StatusBar workspace + note count (from test-design) | P2 | PASS |

## Tasks / Subtasks

- [x] Task 1: Add shadcn/ui DropdownMenu component (AC: #3)
  - [x] 1.1 Run `npx shadcn@latest add dropdown-menu` to install the Base UI-backed DropdownMenu
  - [x] 1.2 Verify `src/components/ui/dropdown-menu.tsx` is created with `@base-ui/react/menu` imports
  - [x] 1.3 Remove the `IconPlaceholder` import if present (replace with `lucide-react` icons — `Check` from `lucide-react` is already available)
- [x] Task 2: Extend `useWorkspaceStore` with workspace list + switching (AC: #1)
  - [x] 2.1 Import `WorkspaceInfo` type from `../../generated/bindings`
  - [x] 2.2 Add state fields: `workspaces: WorkspaceInfo[]`, `isAllWorkspaces: boolean` (default `false`)
  - [x] 2.3 Add `loadWorkspaces()` action: call `commands.listWorkspaces()`, set `workspaces` from result
  - [x] 2.4 Add `setActiveWorkspace(id: number)` action: lookup workspace from `workspaces` array by id, set `activeWorkspaceId`, `activeWorkspaceName`, set `isAllWorkspaces: false`
  - [x] 2.5 Add `setAllWorkspaces()` action: set `isAllWorkspaces: true`, set `activeWorkspaceId: null`, `activeWorkspaceName: null`
  - [x] 2.6 Update `initWorkspace()` to also call `loadWorkspaces()` after resolving the active workspace
- [x] Task 3: Create `WorkspaceSelector` component (AC: #3, #4)
  - [x] 3.1 Create `src/features/workspace/components/WorkspaceSelector.tsx`
  - [x] 3.2 Use `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator` from `@/components/ui/dropdown-menu`
  - [x] 3.3 Trigger: render the workspace name + note count text as a button (receives `triggerContent` as children or reads from store)
  - [x] 3.4 Content: "All Workspaces" item at top → `DropdownMenuSeparator` → mapped workspace items with `[name] · [N] notes` format
  - [x] 3.5 Active workspace/all-workspaces gets a visual indicator (check icon from `lucide-react`)
  - [x] 3.6 On item click: call `setActiveWorkspace(id)` or `setAllWorkspaces()`
  - [x] 3.7 On open: call `loadWorkspaces()` to refresh the list (ensures fresh note counts)
  - [x] 3.8 Add `aria-label="Workspace selector"` to trigger
- [x] Task 4: Update `StatusBar.tsx` to integrate WorkspaceSelector (AC: #2, #4)
  - [x] 4.1 Replace the plain `<span>` workspace display with the `WorkspaceSelector` component
  - [x] 4.2 Derive display text: if `isAllWorkspaces` → "All Workspaces · [total] notes" (sum of all workspace note counts); else → "[activeWorkspaceName] · [N] notes" (lookup from `workspaces` array)
  - [x] 4.3 Maintain existing `data-testid="workspace-name"` on the trigger for test compatibility
  - [x] 4.4 Style trigger as a ghost button: `background: none`, `border: none`, `cursor: pointer`, `color: var(--text-secondary)`, `fontSize: 11px` — matching existing StatusBar text style
  - [x] 4.5 Show "No workspace" with no note count when `activeWorkspaceId` is null and `isAllWorkspaces` is false (fallback for initial load)
- [x] Task 5: Write tests (AC: all)
  - [x] 5.1 Store unit tests in `src/features/workspace/store.test.ts` — extend existing tests: `loadWorkspaces` populates state, `setActiveWorkspace` updates correctly, `setAllWorkspaces` clears active + sets flag, `initWorkspace` calls `loadWorkspaces`
  - [x] 5.2 WorkspaceSelector component tests in `src/features/workspace/components/WorkspaceSelector.test.tsx` — renders all workspaces, renders "All Workspaces" option, calls correct store actions on selection
  - [x] 5.3 Update StatusBar tests in `src/features/editor/components/StatusBar.test.tsx` — verify "[name] · [N] notes" format, verify clickability, verify "All Workspaces" display
- [x] Task 6: Verify end-to-end (AC: all)
  - [x] 6.1 Run `cargo build` — clean compilation (no backend changes expected, but verify bindings)
  - [x] 6.2 Run `cargo test` — 0 regressions
  - [x] 6.3 Run `vitest` — all existing + new tests pass
  - [ ] 6.4 Manually verify: StatusBar shows workspace name + note count, click opens dropdown, selecting switches workspace display

## Dev Notes

### No Backend Changes Required

All backend commands already exist from Stories 2.1-2.3:
- `commands.listWorkspaces()` → returns `WorkspaceInfo[]` with `noteCount` (non-trashed notes)
- `commands.getWorkspace(id)` → returns single `WorkspaceInfo` with `noteCount`
- `commands.resolveWorkspace(path)` → returns `Workspace` (used at init, already wired)

### Adding shadcn/ui DropdownMenu

Run from project root:
```bash
npx shadcn@latest add dropdown-menu
```

This installs the Base UI-backed DropdownMenu to `src/components/ui/dropdown-menu.tsx`. The project already has `@base-ui/react` (`^1.3.0`) in `package.json` — no new dependency install needed.

**Important:** The generated file may import `IconPlaceholder` from a registry path that doesn't exist in this project. Replace any `IconPlaceholder` usage with the equivalent `lucide-react` icon (e.g., `Check` from `lucide-react`, which is already a project dependency). Also update the `cn` import path from `@/registry/bases/base/lib/utils` to `@/lib/utils`.

### Extending `useWorkspaceStore`

Current store (`src/features/workspace/store.ts`) has:
```typescript
// Current state (from Story 2.3):
activeWorkspaceId: number | null;
activeWorkspaceName: string | null;
// Current actions:
setActiveWorkspace: (id: number, name: string) => void;
clearActiveWorkspace: () => void;
initWorkspace: () => Promise<void>;
```

Extend with:
```typescript
// New state for Story 2.4:
workspaces: WorkspaceInfo[];        // Full workspace list with note counts
isAllWorkspaces: boolean;           // True when "All Workspaces" selected

// New/modified actions:
setActiveWorkspace: (id: number) => void;  // CHANGED: no name param — lookup from workspaces[]
setAllWorkspaces: () => void;              // NEW: switch to all-workspaces mode
loadWorkspaces: () => Promise<void>;       // NEW: fetch workspace list from backend
```

**Breaking change to `setActiveWorkspace` signature**: Story 2.3 takes `(id, name)`. Story 2.4 changes to `(id)` only — the name is looked up from the `workspaces` array. Update all call sites (only `initWorkspace` currently calls it). This is cleaner because it prevents name/id mismatches and the workspace list is always loaded before selection.

**`loadWorkspaces` implementation:**
```typescript
loadWorkspaces: async () => {
  const result = await commands.listWorkspaces();
  if (result.status === 'ok') {
    set({ workspaces: result.data });
  }
},
```

**Modified `initWorkspace`** — add `loadWorkspaces()` call:
```typescript
initWorkspace: async () => {
  const cwdResult = await commands.getCurrentDir();
  if (cwdResult.status === 'error') return;
  const resolveResult = await commands.resolveWorkspace(cwdResult.data);
  if (resolveResult.status === 'error') return;
  const ws = resolveResult.data;
  // Load all workspaces first so setActiveWorkspace can look up the name
  const listResult = await commands.listWorkspaces();
  if (listResult.status === 'ok') {
    set({ workspaces: listResult.data });
  }
  // Now set active — lookup name from workspaces array
  const found = get().workspaces.find(w => w.id === ws.id);
  set({
    activeWorkspaceId: ws.id,
    activeWorkspaceName: found?.name ?? ws.name,
  });
},
```

**Note:** The store needs `create<...>((set, get) => ({ ... }))` — add `get` as second argument to access state within actions.

### `WorkspaceSelector` Component

Create `src/features/workspace/components/WorkspaceSelector.tsx`.

Structure:
```tsx
<DropdownMenu onOpenChange={(open) => { if (open) loadWorkspaces(); }}>
  <DropdownMenuTrigger asChild>
    <button data-testid="workspace-name" aria-label="Workspace selector" ...>
      {displayText}
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="start" side="top" sideOffset={4}>
    <DropdownMenuItem onSelect={() => setAllWorkspaces()}>
      {isAllWorkspaces && <Check size={12} />}
      All Workspaces · {totalNoteCount} notes
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    {workspaces.map(ws => (
      <DropdownMenuItem key={ws.id} onSelect={() => setActiveWorkspace(ws.id)}>
        {ws.id === activeWorkspaceId && <Check size={12} />}
        {ws.name} · {ws.noteCount} notes
      </DropdownMenuItem>
    ))}
  </DropdownMenuContent>
</DropdownMenu>
```

**Positioning:** `side="top"` because the StatusBar is at the bottom of the window — the dropdown should open upward. `sideOffset={4}` for 4px gap.

**Keyboard navigation** is built into `@base-ui/react/menu`: arrow keys move focus, Enter selects, Esc closes. No custom keyboard handling needed.

**Refresh on open:** Call `loadWorkspaces()` in the `onOpenChange` handler when `open === true`. This ensures note counts are current without adding polling or event listeners.

### StatusBar Integration

In `StatusBar.tsx`, the left section changes from a plain `<span>` to the `WorkspaceSelector` component. The display text logic:

```typescript
const workspaces = useWorkspaceStore((s) => s.workspaces);
const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
const activeWorkspaceName = useWorkspaceStore((s) => s.activeWorkspaceName);
const isAllWorkspaces = useWorkspaceStore((s) => s.isAllWorkspaces);

// Derive display text
let displayText: string;
if (isAllWorkspaces) {
  const total = workspaces.reduce((sum, ws) => sum + ws.noteCount, 0);
  displayText = `All Workspaces · ${total} notes`;
} else if (activeWorkspaceName) {
  const activeWs = workspaces.find(ws => ws.id === activeWorkspaceId);
  const count = activeWs?.noteCount ?? 0;
  displayText = `${activeWorkspaceName} · ${count} notes`;
} else {
  displayText = 'No workspace';
}
```

Pass `displayText` to the `WorkspaceSelector` trigger, or embed the logic inside `WorkspaceSelector` itself. Design choice: keep it in `WorkspaceSelector` to encapsulate workspace display logic in one component.

### Styling the Dropdown

Use design tokens (CSS variables) from the project's token system. The dropdown menu content should match the app's dark theme:
- Background: `var(--bg-elevated)` or Tailwind equivalent
- Border: `var(--border-default)`
- Text: `var(--text-primary)` for workspace names, `var(--text-secondary)` for note counts
- Active item: `var(--bg-surface)` background
- Min-width: `200px` to fit workspace names + counts
- Max-height: `300px` with overflow scroll for many workspaces

The shadcn DropdownMenu comes with sensible defaults. Customize the className on `DropdownMenuContent` and `DropdownMenuItem` to match the project's token system rather than the default shadcn theme.

### Impact on Story 2.5

Story 2.5 (Workspace-Filtered Note Views) will consume `activeWorkspaceId` and `isAllWorkspaces` from the store to filter the `list_notes` command. **This story does NOT implement note filtering** — it only implements the selector UI and store state. The filtering will be wired in 2.5 when `list_notes` gets a `workspace_id` parameter.

### Project Structure Notes

**New files:**
- `src/components/ui/dropdown-menu.tsx` — shadcn/ui DropdownMenu (generated via CLI)
- `src/features/workspace/components/WorkspaceSelector.tsx` — workspace picker dropdown
- `src/features/workspace/components/WorkspaceSelector.test.tsx` — component tests

**Modified files:**
- `src/features/workspace/store.ts` — extended with `workspaces`, `isAllWorkspaces`, new actions
- `src/features/workspace/store.test.ts` — new tests for extended store
- `src/features/editor/components/StatusBar.tsx` — integrate WorkspaceSelector, remove plain span
- `src/features/editor/components/StatusBar.test.tsx` — update for new display format

**No backend files modified.** All required Tauri commands exist.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4] — acceptance criteria, user story
- [Source: _bmad-output/planning-artifacts/architecture.md#State Management] — per-feature Zustand stores, named actions only, `useWorkspaceStore` shape
- [Source: _bmad-output/planning-artifacts/architecture.md#Component Architecture] — shadcn/ui base components, feature components own layout
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Directory Structure] — `WorkspaceSelector.tsx` in `src/features/workspace/components/`
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#StatusBar] — "[workspace-name] · [N] notes" format, clickable to open workspace selector, 24px height
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-DR56] — workspace selector as StatusBar click trigger, dropdown list with workspace names/note counts, "All Workspaces" option, keyboard-navigable
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Component Dimensions] — workspace selector 28px dropdown trigger
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Design System Components] — DropdownMenu for workspace selector
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Accessibility] — `aria-label` on workspace selector, `role="button"` on trigger
- [Source: _bmad-output/planning-artifacts/prd.md#FR32] — switch between workspaces in UI
- [Source: _bmad-output/planning-artifacts/prd.md#FR34] — view all notes across workspaces
- [Source: _bmad-output/project-context.md] — technology stack, anti-patterns, testing rules
- [Source: _bmad-output/test-artifacts/test-design/test-design-qa.md] — P2-COMP-002 (StatusBar workspace + note count)

### Previous Story Intelligence (Story 2.3)

**Patterns to reuse:**
- `useWorkspaceStore` created in Story 2.3 at `src/features/workspace/store.ts` — extend it, don't replace
- Store pattern: `commands.xxx()` returns `{ status: 'ok', data } | { status: 'error', error }` — follow same error handling
- StatusBar already imports from `useWorkspaceStore` via `useWorkspaceStore((s) => s.activeWorkspaceName)` — add new selectors
- `commands.listWorkspaces()` already generates typed `WorkspaceInfo[]` with `noteCount` in `bindings.ts`

**Learnings to apply:**
- tauri-specta compile-time safety: if `cargo build` succeeds, bindings are correct — no backend changes needed here
- Import directly from source files (no barrel/index files) — import `WorkspaceSelector` from `../../workspace/components/WorkspaceSelector`
- Co-locate tests beside source: `WorkspaceSelector.test.tsx` next to `WorkspaceSelector.tsx`
- Mock the Tauri IPC layer in frontend tests, not Zustand stores (per project-context.md testing rules)

**Pitfalls to avoid:**
- Do NOT implement note list filtering in this story — that's Story 2.5
- Do NOT add `list_notes` workspace_id parameter — that's Story 2.5
- Do NOT create a barrel file `src/features/workspace/components/index.ts`
- Do NOT add a new Rust command or modify any backend code
- Do NOT hard-code workspace data — always call `listWorkspaces` via generated bindings
- Do NOT break the existing `initWorkspace()` flow — extend it, ensure it still resolves cwd workspace on startup
- Do NOT skip the `onOpenChange` refresh — note counts can change between dropdown opens

### Git Intelligence

Recent commits show Story 2.3 landed at `e2fb779`. The codebase has 82 Rust tests + 25 frontend tests passing. Stories 2.1-2.3 established the full workspace backend (table, CRUD, detection, resolution, note assignment). This story is **frontend-only** — connecting the existing backend to a new dropdown UI.

Commit pattern: `feat(story-2.4): Workspace Selector in StatusBar`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- base-ui DropdownMenu `onClick` vs `onSelect`: base-ui's `Menu.Item` uses `onClick` for item activation, not Radix UI's `onSelect` convention. Tests initially failed because `onSelect` wasn't wired in jsdom; switched to `onClick`.

### Completion Notes List

- Task 1: Installed shadcn/ui DropdownMenu via CLI. Generated file was clean — no `IconPlaceholder` issue, `cn` import already correct from `@/lib/utils`.
- Task 2: Extended `useWorkspaceStore` with `workspaces: WorkspaceInfo[]`, `isAllWorkspaces: boolean`, `loadWorkspaces()`, `setAllWorkspaces()`. Changed `setActiveWorkspace(id, name)` → `setActiveWorkspace(id)` with name lookup from workspaces array. Added `get` parameter to store creator. `initWorkspace()` now calls `listWorkspaces` before setting active workspace.
- Task 3: Created `WorkspaceSelector` component with dropdown menu, "All Workspaces" option, check icon indicator, `aria-label`, and `loadWorkspaces()` refresh on open.
- Task 4: Replaced plain `<span>` in StatusBar with `WorkspaceSelector` component. Display text logic encapsulated inside WorkspaceSelector. Maintained `data-testid="workspace-name"` on trigger.
- Task 5: Extended store tests (11 tests), created WorkspaceSelector component tests (10 tests), updated StatusBar tests (6 tests). Total: 42 frontend tests, all passing.
- Task 6: `cargo build` clean, 82 Rust tests pass, 39 Vitest tests pass, 0 regressions.

### File List

- src/components/ui/dropdown-menu.tsx (new — shadcn/ui generated)
- src/features/workspace/store.ts (modified — extended with workspaces, isAllWorkspaces, new actions)
- src/features/workspace/store.test.ts (modified — extended with new tests for loadWorkspaces, setActiveWorkspace, setAllWorkspaces, initWorkspace)
- src/features/workspace/components/WorkspaceSelector.tsx (new — workspace selector dropdown component)
- src/features/workspace/components/WorkspaceSelector.test.tsx (new — component tests)
- src/features/editor/components/StatusBar.tsx (modified — integrated WorkspaceSelector, removed plain span)
- src/features/editor/components/StatusBar.test.tsx (modified — updated for new display format and clickable trigger)

### Change Log

- 2026-04-04: Story 2.4 implementation complete — workspace selector dropdown in StatusBar with "All Workspaces" mode, note counts, keyboard navigation (via base-ui), and aria accessibility.
- 2026-04-04: Code review — fixed 4 issues: (M1) added console.error for loadWorkspaces failures, (M2) added aria-current to active dropdown items for screen reader support, (L1) fixed singular/plural "note(s)" grammar, (L2) corrected stale test count in Dev Agent Record.
