---
title: 'Shared test reset utility + ESLint no-floating-promises'
type: 'chore'
created: '2026-04-09'
status: 'done'
baseline_commit: 'cd27c68'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Frontend test isolation is fragile — 3/5 Epic 3 stories had store state bleeding and DOM leaks caught in review. Each test file reinvents reset logic (7+ files with manual `setState()` calls that miss fields like `workspaceError`/`notesError`). Separately, unhandled IPC promises (1 existing violation in `EditorPane.tsx:53`) can cause silent failures with no lint guard.

**Approach:** (1) Add `resetAllStores()` to the global test setup that resets all Zustand stores and cleans up leaked DOM nodes in `afterEach`. Add missing reset actions to stores that lack them. Migrate existing test files to remove manual reset boilerplate. (2) Install `@typescript-eslint/eslint-plugin` with `no-floating-promises` rule to catch unhandled promise results at lint time. Fix the 1 existing violation.

## Boundaries & Constraints

**Always:**
- `resetAllStores()` must reset ALL fields of every store to their initial values — no partial resets
- DOM cleanup must remove `.cm-content` and any other CodeMirror-injected nodes
- The ESLint rule must pass CI — all existing violations fixed before merging
- Existing tests must continue to pass with no behavioral change

**Ask First:**
- If `no-floating-promises` flags more than 5 existing violations beyond `EditorPane.tsx:53`
- If installing ESLint conflicts with Trunk linting setup

**Never:**
- Write a custom ESLint rule — use the standard `@typescript-eslint/no-floating-promises`
- Change production logic in stores (only add reset actions for test use)
- Remove or weaken existing test assertions

</frozen-after-approval>

## Code Map

- `src/test-utils/setup.ts` -- Global test setup; add `resetAllStores()` + DOM cleanup to `afterEach`
- `src/features/editor/store.ts` -- Has `resetNote()`; verify it resets all 6 fields
- `src/features/workspace/store.ts` -- NO reset method; add `resetWorkspace()` action
- `src/features/search/store.ts` -- `closeSearch()` skips `scopeFilter`; add full `resetSearch()`
- `src/features/editor/components/EditorPane.tsx:53` -- `dismissWindow()` result unchecked; fix
- `src/features/editor/components/StatusBar.test.tsx` -- Manual store reset (lines 13-22); replace
- `src/features/workspace/components/WorkspaceSelector.test.tsx` -- Manual store reset (lines 14-23); replace
- `src/features/search/components/SearchOverlay.test.tsx` -- Manual store + DOM reset (lines 29-42); replace
- `src/features/editor/hooks/useAutoSave.test.ts` -- Manual store reset (lines 21-26); replace
- `eslint.config.js` -- New; flat config with `@typescript-eslint/no-floating-promises`
- `package.json` -- Add `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `typescript-eslint`

## Tasks & Acceptance

**Execution:**
- [x] `src/features/workspace/store.ts` -- Add `resetWorkspace()` action that sets all 8 fields to initial values
- [x] `src/features/search/store.ts` -- Add `resetSearch()` action that resets all 5 fields including `scopeFilter`
- [x] `src/features/editor/store.ts` -- Verify `resetNote()` covers all fields; fix if incomplete
- [x] `src/test-utils/setup.ts` -- Add global `afterEach` calling `resetAllStores()` (all 3 stores) + DOM cleanup (`.cm-content`, `.cm-editor`)
- [x] `src/features/editor/components/StatusBar.test.tsx` -- Remove manual store reset from `beforeEach`
- [x] `src/features/workspace/components/WorkspaceSelector.test.tsx` -- Remove manual store reset from `beforeEach`
- [x] `src/features/search/components/SearchOverlay.test.tsx` -- Remove manual store + DOM reset from `beforeEach`/`afterEach`
- [x] `src/features/editor/hooks/useAutoSave.test.ts` -- Remove manual store reset from `beforeEach`
- [x] `package.json` -- Install `eslint`, `typescript-eslint`, `@typescript-eslint/parser`
- [x] `eslint.config.js` -- Create flat config with `no-floating-promises: 'error'` for `*.ts`/`*.tsx`
- [x] `src/features/editor/components/EditorPane.tsx:53` -- Fix `dismissWindow()` unhandled result
- [x] Run `npx eslint src/` -- Fix any additional violations surfaced (5 floating promises fixed with `void`)

**Acceptance Criteria:**
- Given any new test file imports no store directly, when it runs after another test that dirtied a store, then all stores are at initial values (global `afterEach` handles it)
- Given a `.cm-content` node is injected during a test, when the test completes, then the node is removed from `document.body`
- Given a `commands.*` call is awaited without checking `.status` or wrapping in try/catch, when `npx eslint src/` runs, then it reports an error
- Given all existing code, when `npx eslint src/` runs, then it exits with 0 (no violations)

## Design Notes

**Why `no-floating-promises` instead of a custom commands rule:** The project's IPC bindings return `Promise<{status: "ok"} | {status: "error"}>` — errors are discriminated unions, not thrown exceptions. A custom rule would need to verify `.status` is checked, which requires type-aware analysis. `no-floating-promises` catches the simpler and more dangerous case: promises whose results are completely ignored (the `dismissWindow()` pattern). It also catches non-IPC floating promises as a bonus.

**Store reset architecture:** Each store gets its own `reset*()` action (keeps stores self-contained). `resetAllStores()` in `setup.ts` calls all three. If a new store is added and not included, TypeScript won't catch it — add a comment in `setup.ts` listing all stores with a "when adding a store, add its reset here" note.

**`scopeFilter` reset:** The existing `closeSearch()` intentionally preserves `scopeFilter` (AC 6 from Story 3.5 — session persistence). The new `resetSearch()` resets ALL fields including `scopeFilter`, and is only used in test cleanup. Production code continues to use `closeSearch()`.

## Verification

**Commands:**
- `npx vitest run` -- expected: all tests pass (same count, no regressions)
- `npx eslint src/` -- expected: exit 0 (no violations)

## Suggested Review Order

**Global test reset infrastructure**

- Entry point: global afterEach resets all 3 stores + DOM cleanup
  [`setup.ts:22`](../../src/test-utils/setup.ts#L22)

- Workspace store: new resetWorkspace() action — all 8 fields
  [`store.ts:131`](../../src/features/workspace/store.ts#L131)

- Search store: new resetSearch() action — all 5 fields including scopeFilter
  [`store.ts:63`](../../src/features/search/store.ts#L63)

**Test file cleanup (manual reset boilerplate removed)**

- StatusBar: beforeEach and unused import removed entirely
  [`StatusBar.test.tsx:12`](../../src/features/editor/components/StatusBar.test.tsx#L12)

- SearchOverlay: closeSearch + afterEach DOM cleanup removed; openSearch kept
  [`SearchOverlay.test.tsx:29`](../../src/features/search/components/SearchOverlay.test.tsx#L29)

- useAutoSave: store resets removed from both describe blocks
  [`useAutoSave.test.ts:21`](../../src/features/editor/hooks/useAutoSave.test.ts#L21)

- WorkspaceSelector: beforeEach narrowed to test-specific state only
  [`WorkspaceSelector.test.tsx:14`](../../src/features/workspace/components/WorkspaceSelector.test.tsx#L14)

**ESLint no-floating-promises**

- ESLint flat config: no-floating-promises error, ignores tests + generated
  [`eslint.config.js:1`](../../eslint.config.js#L1)

- EditorPane: dismissWindow result now checked in promise chain
  [`EditorPane.tsx:52`](../../src/features/editor/components/EditorPane.tsx#L52)

- App.tsx, useWindowFocus, SearchOverlay, WorkspaceSelector: void operator on fire-and-forget calls
  [`App.tsx:8`](../../src/App.tsx#L8)
