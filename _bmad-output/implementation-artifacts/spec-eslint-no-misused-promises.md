---
title: 'Enable ESLint no-misused-promises rule'
type: 'chore'
created: '2026-04-09'
status: 'done'
baseline_commit: 'f400f17'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Five async functions are passed as React event handlers or callback props, silently discarding their Promise return values. The existing `no-floating-promises` rule doesn't catch these because React's handler types expect `() => void`, which masks the mismatch. Unobserved rejections from these handlers would be swallowed silently.

**Approach:** Enable `@typescript-eslint/no-misused-promises` in the ESLint config. Fix the 5 existing violations by adding the `void` operator (the same pattern already used at `WorkspaceSelector.tsx:44`).

## Boundaries & Constraints

**Always:**
- Use the `void` operator to discard Promise returns — the minimal, idiomatic fix
- All existing tests must pass unchanged
- `npx eslint src/` must exit clean

**Ask First:**
- If the rule flags more than the 5 known violations listed below

**Never:**
- Don't refactor async logic or error handling — this is purely a lint rule + void fixes
- Don't change the `checksConditionals` option (leave at default)

</frozen-after-approval>

## Code Map

- `eslint.config.js` -- Add `no-misused-promises` rule
- `src/features/workspace/components/WorkspaceSelector.tsx` -- 2 violations (lines 87, 97)
- `src/features/search/components/SearchOverlay.tsx` -- 2 violations (lines 196, 314)
- `src/features/editor/components/StatusBar.tsx` -- 1 violation (line 48)

## Tasks & Acceptance

**Execution:**
- [x] `eslint.config.js` -- Add `'@typescript-eslint/no-misused-promises': 'error'` to rules
- [x] `src/features/workspace/components/WorkspaceSelector.tsx` -- Add `void` to `onClick` handlers at lines 87 and 97: `onClick={() => void setAllWorkspaces()}`, `onClick={() => void setActiveWorkspace(ws.id)}`
- [x] `src/features/search/components/SearchOverlay.tsx` -- Add `void` to `onChange` at line 196: `onChange={(e) => void handleInput(e.target.value)}`. Wrap `onSelect` at line 314: `onSelect={(id) => void openNote(id)}`
- [x] `src/features/editor/components/StatusBar.tsx` -- Wrap `onClick` at line 48: `onClick={() => void handleFormatToggle()}`

**Acceptance Criteria:**
- Given `no-misused-promises` is enabled, when `npx eslint src/` runs, then zero violations are reported
- Given the 5 fixed handlers, when invoked at runtime, then behavior is identical (void discards the return, does not change execution)

## Spec Change Log

## Verification

**Commands:**
- `npx eslint src/` -- expected: 0 errors, 0 warnings
- `npx vitest run` -- expected: all tests pass

## Suggested Review Order

- ESLint config: new rule alongside existing `no-floating-promises`
  [`eslint.config.js:16`](../../eslint.config.js#L16)

- Async store actions in workspace dropdown — 2 `void` fixes
  [`WorkspaceSelector.tsx:87`](../../src/features/workspace/components/WorkspaceSelector.tsx#L87)

- Search input and result selection — async `handleInput` and `openNote` wrapped
  [`SearchOverlay.tsx:196`](../../src/features/search/components/SearchOverlay.tsx#L196)

- `onSelect` prop wrapping — prevents async fn leaking through typed-as-void prop
  [`SearchOverlay.tsx:314`](../../src/features/search/components/SearchOverlay.tsx#L314)

- Format toggle — async handler wrapped in arrow + void
  [`StatusBar.tsx:48`](../../src/features/editor/components/StatusBar.tsx#L48)
