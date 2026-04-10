---
title: 'Deferred search hardening — scope reset on workspace switch, trim consistency'
type: 'bugfix'
created: '2026-04-09'
status: 'done'
baseline_commit: '314cad4'
context:
  - '_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Two search UX inconsistencies from code review: (1) `scopeFilter` stays "all" after switching workspaces, so the next search-open shows stale scope state; (2) `handleInput` allows whitespace-only queries to hit the backend while `handleScopeToggle` blocks them with `.trim()`.

**Approach:** Reset `scopeFilter` to `'workspace'` when the active workspace changes. Normalize empty-query checks to use `.trim()` consistently.

## Boundaries & Constraints

**Always:** Preserve AC 6 session persistence — scope filter must survive overlay close/reopen within the same workspace session. Only reset on actual workspace switch.

**Ask First:** If resetting scope on workspace switch requires changes to workspace store (cross-store coupling), confirm approach.

**Never:** Don't add a Zustand `subscribe` cross-store listener — keep it simple with a reset call at the switch site.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Scope reset on switch | scopeFilter='all', user switches workspace via StatusBar | scopeFilter resets to 'workspace' | N/A |
| Scope preserved within session | scopeFilter='all', user closes/reopens overlay | scopeFilter stays 'all' | N/A |
| Scope reset on "All Workspaces" | scopeFilter='workspace', user selects "All Workspaces" | scopeFilter resets to 'all' (already correct — no workspace context) | N/A |
| Whitespace query via input | User types spaces only in search | Treated as empty — results cleared, no backend call | N/A |
| Whitespace query on scope toggle | User toggles scope with whitespace-only query | No re-search triggered (already correct) | N/A |

</frozen-after-approval>

## Code Map

- `src/features/search/store.ts` -- search state: `scopeFilter`, `toggleScope`, `query`, `setResults`
- `src/features/search/components/SearchOverlay.tsx` -- `handleInput` (line ~119), `handleScopeToggle` (line ~147)
- `src/features/workspace/store.ts` -- `setActiveWorkspace`, `setAllWorkspaces` — workspace switch actions

## Tasks & Acceptance

**Execution:**
- [x] `src/features/search/store.ts` -- add `resetScope` action that sets `scopeFilter` back to `'workspace'`
- [x] `src/features/workspace/store.ts` -- call `useSearchStore.getState().resetScope()` inside `setActiveWorkspace` after workspace switch completes
- [x] `src/features/search/components/SearchOverlay.tsx` -- change `handleInput` empty check from `currentQuery === ''` to `currentQuery.trim() === ''` (line ~119)
- [x] `src/features/search/store.test.ts` -- added resetScope unit tests + cross-store workspace switch integration test
- [x] `src/features/search/components/SearchOverlay.test.tsx` -- added whitespace-only input clears results without backend call

**Acceptance Criteria:**
- Given scopeFilter is "all" and the user switches workspace, when the search overlay is next opened, then scopeFilter is "workspace"
- Given scopeFilter is "all" and the user closes/reopens the overlay without switching workspace, then scopeFilter remains "all"
- Given the user types only spaces in the search input, when the debounce fires, then results are cleared and no backend search is invoked

## Verification

**Commands:**
- `npm run test -- --run src/features/search` -- expected: all search tests pass
- `npx tsc --noEmit` -- expected: no type errors
- `npm run lint` -- expected: no lint errors

## Suggested Review Order

**Scope reset on workspace switch**

- New `resetScope` action — single-purpose setter, keeps search store API clean
  [`store.ts:61`](../../src/features/search/store.ts#L61)

- Cross-store call site — fires synchronously before `loadFilteredNotes`
  [`store.ts:53`](../../src/features/workspace/store.ts#L53)

- Import that enables the cross-store call
  [`store.ts:4`](../../src/features/workspace/store.ts#L4)

**Whitespace trim consistency**

- Single-character fix aligns `handleInput` with `handleScopeToggle`'s existing `.trim()` check
  [`SearchOverlay.tsx:119`](../../src/features/search/components/SearchOverlay.tsx#L119)

**Tests**

- Unit: `resetScope` action + cross-store integration via `setActiveWorkspace`
  [`store.test.ts:106`](../../src/features/search/store.test.ts#L106)

- Component: whitespace-only input clears results without backend call
  [`SearchOverlay.test.tsx:168`](../../src/features/search/components/SearchOverlay.test.tsx#L168)
