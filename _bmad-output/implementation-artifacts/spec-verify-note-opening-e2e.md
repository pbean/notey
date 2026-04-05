---
title: 'Verify Note Opening End-to-End'
type: 'chore'
created: '2026-04-05'
status: 'done'
baseline_commit: 'ddb8024'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The `loadNote(id)` → `isHydrating` → CodeMirror dispatch pipeline was built in Epic 1 but never verified with automated tests. Epic 3 Story 3.4 (Search Result Note Opening) depends entirely on this path working. The code exists and looks correct, but zero test coverage means regressions could silently break it.

**Approach:** Add unit tests for the `loadNote` store action covering the happy path (content + hydration state set correctly) and error path (graceful failure with logging). Verify the existing implementation is correct — fix only if tests reveal a bug.

## Boundaries & Constraints

**Always:** Test the store action in isolation using command mocks (consistent with existing `store.test.ts` patterns). Assert on all state fields set by `loadNote`.

**Ask First:** If `loadNote` or `useNoteHydration` has a bug requiring a code fix beyond the test scope.

**Never:** Refactor existing working code. Add E2E/integration tests (those are separate backlog items). Mock CodeMirror internals.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | `loadNote(1)` with existing note | `content`, `format`, `activeNoteId`, `isHydrating: true`, `lastSavedAt` all set from response | N/A |
| Command error | `getNote` returns `status: 'error'` | State unchanged except `saveStatus: 'failed'`, `isHydrating: false` | `console.error` logged |

</frozen-after-approval>

## Code Map

- `src/features/editor/store.ts:66-82` — `loadNote` action under test
- `src/features/editor/store.test.ts` — test file (7 existing tests, none for `loadNote`)
- `src/generated/bindings.ts:8` — `getNote` command signature and `Note` type

## Tasks & Acceptance

**Execution:**
- [x] `src/features/editor/store.test.ts` — Add `loadNote` happy-path test: mock `getNote` to return a Note, call `loadNote(1)`, assert all state fields match
- [x] `src/features/editor/store.test.ts` — Add `loadNote` error-path test: mock `getNote` to return error, call `loadNote(1)`, assert `saveStatus: 'failed'`, `isHydrating: false`, `console.error` called

**Acceptance Criteria:**
- Given a mocked `getNote` returning a valid Note, when `loadNote(id)` completes, then `content`, `format`, `activeNoteId`, `isHydrating`, `lastSavedAt`, and `saveStatus` match the response
- Given a mocked `getNote` returning an error, when `loadNote(id)` completes, then `saveStatus` is `'failed'`, `isHydrating` is `false`, and the error is logged

## Verification

**Commands:**
- `npx vitest run src/features/editor/store.test.ts` — expected: all tests pass including 2 new `loadNote` tests

## Suggested Review Order

- Happy path: mocks `getNote`, asserts all 6 state fields match the response
  [`store.test.ts:76`](../../src/features/editor/store.test.ts#L76)

- Error path: verifies `saveStatus: 'failed'`, `isHydrating: false`, `console.error` called
  [`store.test.ts:105`](../../src/features/editor/store.test.ts#L105)

- Implementation under test — `loadNote` action for reference
  [`store.ts:66`](../../src/features/editor/store.ts#L66)
