---
title: 'Convert useAutoSave module-scoped state to React refs'
type: 'refactor'
created: '2026-04-10'
status: 'done'
baseline_commit: '44dacdc'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `useAutoSave.ts` uses module-scoped `let sharedDebounceRef` and `let isCreating` shared between the `useAutoSave` hook and the exported `flushSave` function. In React 19 strict mode, the mount-unmount-remount cycle leaves stale timer IDs and guard flags in module scope because cleanup doesn't null them out. This fragility compounds when Story 4.4 introduces multi-tab editing with per-tab auto-save state.

**Approach:** Convert `sharedDebounceRef` and `isCreating` to React refs inside the hook. Extract shared save logic into a `performSave` helper. Replace the single module-scoped link between hook and `flushSave` with a `registeredFlush` function pointer that the hook sets on mount and clears on unmount. `flushSave` delegates to it when mounted, falls back to standalone `performSave()` otherwise.

## Boundaries & Constraints

**Always:**
- `flushSave` must remain a module-level export with the same signature (`() => Promise<void>`)
- All 10 existing tests must pass unchanged (test logic, not necessarily test setup)
- Strict mode cleanup must null all refs and unregister the flush pointer

**Ask First:**
- If the refactor requires changes to EditorPane.tsx beyond import paths

**Never:**
- Don't change auto-save timing (300ms debounce, 2s idle transition)
- Don't change save behavior or IPC call patterns
- Don't add new tests — existing coverage is sufficient for a pure refactor

</frozen-after-approval>

## Code Map

- `src/features/editor/hooks/useAutoSave.ts` -- Primary refactor target: module state → React refs + performSave extraction
- `src/features/editor/hooks/useAutoSave.test.ts` -- Existing tests; flushSave tests may need `renderHook` setup if standalone fallback changes behavior
- `src/features/editor/components/EditorPane.tsx` -- Imports `flushSave`; no changes expected (export signature preserved)

## Tasks & Acceptance

**Execution:**
- [x] `src/features/editor/hooks/useAutoSave.ts` -- (1) Extract `performSave(isCreatingRef?)` from the duplicated save logic in `flushSave` and the debounce callback. (2) Replace `sharedDebounceRef` and `isCreating` module-scoped `let` with `useRef` inside the hook. (3) Add `registeredFlush` module-scoped pointer set on mount, cleared on unmount. (4) `flushSave` delegates to `registeredFlush` or falls back to standalone `performSave()`. (5) Debounce callback calls `performSave(isCreatingRef)` + manages idle timer.
- [x] `src/features/editor/hooks/useAutoSave.test.ts` -- No changes needed: standalone `performSave()` fallback preserves existing test behavior -- Adjust `flushSave` test setup if needed (render hook before calling `flushSave` when the hook-registered path is required). Standalone fallback must still work for tests that don't render the hook.

**Acceptance Criteria:**
- Given React 19 strict mode mount-unmount-remount, when the cycle completes, then `registeredFlush` is properly re-registered and no stale timer IDs or guard flags persist
- Given `flushSave()` is called without the hook mounted, when content exists in the store, then save completes via the standalone `performSave` fallback
- Given `flushSave()` is called with the hook mounted and a pending debounce, when flush executes, then the debounce timer is cancelled via the ref before saving

## Spec Change Log

## Verification

**Commands:**
- `npx vitest run` -- expected: all 103 tests pass
- `npx eslint src/` -- expected: 0 errors

## Suggested Review Order

- `registeredFlush` replaces two module-scoped `let` variables with a single function pointer
  [`useAutoSave.ts:7`](../../src/features/editor/hooks/useAutoSave.ts#L7)

- `flushSave` delegates to hook instance or falls back to standalone `performSave`
  [`useAutoSave.ts:14`](../../src/features/editor/hooks/useAutoSave.ts#L14)

- `performSave` — extracted core save logic with optional `isCreatingRef` guard
  [`useAutoSave.ts:27`](../../src/features/editor/hooks/useAutoSave.ts#L27)

- Hook registration: `instanceFlush` created and assigned to `registeredFlush` on mount
  [`useAutoSave.ts:87`](../../src/features/editor/hooks/useAutoSave.ts#L87)

- Cleanup: identity-guarded unregister + timer/ref nulling
  [`useAutoSave.ts:97`](../../src/features/editor/hooks/useAutoSave.ts#L97)

- Debounce callback: uses `debounceRef.current` + delegates to `performSave`
  [`useAutoSave.ts:117`](../../src/features/editor/hooks/useAutoSave.ts#L117)
