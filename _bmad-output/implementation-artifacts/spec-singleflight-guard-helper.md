---
title: 'Extract a shared singleflight in-flight guard helper'
type: 'refactor'
created: '2026-06-14'
status: 'done'
context: []
baseline_commit: '540a3e582e0d17047c11ae7e1d9178752a6e7c5e'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Seven hand-rolled module-level boolean in-flight guards have accreted across the frontend (Epic 5's 6 + `refreshInFlight` from Story 6.6). Each re-implements "run once, drop concurrent duplicates" with ad-hoc `finally` resets, ambiguous returns, and asymmetric toasts (Epic 6 retro AI-2). Two retros overdue; grows with every toggle feature.

**Approach:** Add one keyed `singleflight(key, fn, opts?)` helper that dedupes concurrent calls and returns the **shared in-flight promise** — every caller awaits the same real result, no `null`/`void` "deduped" sentinel. Migrate the 7 boolean guards to it, preserving each call site's observable behavior (including `realtimeSync`'s trailing refresh).

## Boundaries & Constraints

**Always:**
- Helper in `src/lib/singleflight.ts`, fully typed (no `any`); key is the first arg; same-key concurrent calls share one in-flight promise.
- In-flight entry cleared in `finally` so a rejection never wedges the key — next call re-runs `fn` fresh.
- Coalesced callers get the genuine resolved value/rejection of the single `fn` run — never a "you were deduped" sentinel.
- Each logical operation runs `fn` (and its toast) exactly once no matter how many callers coalesce.
- `realtimeSync` trailing semantic survives: if ≥1 refresh coalesces during an in-flight one, exactly one follow-up debounced refresh runs after it settles.
- Test-only `resetSingleflight()` clears all in-flight state; called in `src/test-utils/setup.ts` global cleanup.

**Ask First:**
- Any change to a call site's dedup *outcome* (a previously-dropped call now mutating twice, or a caller's branch value changing).
- Widening scope to the Set-based trash guards or the promise-chain serializers.

**Never:**
- Don't touch the Set-keyed trash guards (`restoringIds`/`deletingIds` in `trash/store.ts`) or the serialization chains (`settingsSaveChain`/`layoutModeChangeChain` in `actions.ts`) — different semantics, out of scope.
- No timers, retries, caching, or cross-tab logic in the helper — leading-dedup + optional one-shot trailing only.
- No backend/IPC contract changes — frontend-only.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Behavior | Error Handling |
|----------|--------------|-------------------|----------------|
| First call for key | no entry | runs `fn`, stores+returns its promise | on reject, returned promise rejects; key cleared |
| Concurrent same-key call | entry in flight | returns the **same** promise (identical value); `fn` NOT re-invoked | shares the same rejection |
| Coalesced w/ `onCoalesced` | entry in flight, opt set | returns in-flight promise; after it settles `onCoalesced()` fires exactly once | trailing callback fires even after a rejection |
| Sequential call post-settle | key cleared | runs `fn` fresh | normal |
| `resetSingleflight()` | any | all entries dropped; next call starts fresh | n/a |

</frozen-after-approval>

## Code Map

- `src/lib/singleflight.ts` -- NEW: `singleflight(key, fn, opts?)` + `resetSingleflight()`
- `src/lib/singleflight.test.ts` -- NEW: unit tests for the I/O matrix
- `src/features/note-list/realtimeSync.ts` -- guard #7: `refreshInFlight`+`refreshQueued` → `singleflight('note-list-refresh', …, { onCoalesced: scheduleRefresh })`
- `src/features/command-palette/actions.ts` -- `isCreatingNote`, `isTrashingNote`, `isTogglingTheme`, `isTogglingLayoutMode` → singleflight keys; keep promise-chains; update `resetActionGuards`/`resetToggleTracking`
- `src/features/export/exportJson.ts`, `exportMarkdown.ts` -- `isExporting` → singleflight keys; update `resetExportGuard`
- `src/test-utils/setup.ts` -- call `resetSingleflight()` in global afterEach

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/singleflight.ts` -- implement `singleflight<T>(key, fn, opts?: { onCoalesced?: () => void }): Promise<T>` over a `Map<string, Promise<unknown>>`, clearing the key in `finally`, plus `resetSingleflight()` -- single source of truth
- [x] `src/lib/singleflight.test.ts` -- cover every I/O-matrix row (first call, shared concurrent result, sync-throw, reject clears key, sequential re-run, onCoalesced fires once, reset) -- lock the contract
- [x] `src/features/note-list/realtimeSync.ts` -- replaced both module booleans with `singleflight` + `onCoalesced` (stop()-aware `scheduleRefresh`) -- killed guard #7, kept trailing refresh
- [x] `src/features/command-palette/actions.ts` -- migrated the 4 booleans to singleflight keys; promise-chains untouched; deleted dead `resetActionGuards` -- dedup without disturbing serialization
- [x] `src/features/export/exportJson.ts` & `src/features/export/exportMarkdown.ts` -- migrated `isExporting`; each `resetExportGuard` now delegates to `resetSingleflight` -- unified export guards
- [x] `src/test-utils/setup.ts` -- calls `resetSingleflight()` in global afterEach -- prevents cross-test leakage

**Acceptance Criteria:**
- Given the work lands, when `grep -rn "InFlight\|refreshQueued\|isExporting\|isCreatingNote\|isTrashingNote\|isTogglingTheme\|isTogglingLayoutMode" src` runs, then there are zero hits outside `singleflight.ts`/tests.
- Given two `note-created` events arrive while a refresh is in flight, when it settles, then exactly one additional debounced refresh runs (no lost update).
- Given a toast-bearing op (trash/export) fired twice concurrently, then `fn` runs once and exactly one toast appears (no duplicate/false toast).
- Given the full frontend suite, when it runs, then it passes with no new flakes.

## Design Notes

The 6 simple guards currently return `void` synchronously on the dropped call; after migration the coalesced caller awaits and receives the first call's real result. All 7 sites are fire-and-forget (return value unused), so this is a safe, intended improvement that retires the dedup→false-toast / ambiguous-null bug class.

Helper sketch (illustrative):

```ts
const inflight = new Map<string, Promise<unknown>>();
const coalesced = new Set<string>();
export function singleflight<T>(key: string, fn: () => Promise<T>,
    opts?: { onCoalesced?: () => void }): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) { if (opts?.onCoalesced) coalesced.add(key); return existing; }
  const p = Promise.resolve().then(fn).finally(() => {
    inflight.delete(key);
    if (coalesced.delete(key)) opts?.onCoalesced?.();
  });
  inflight.set(key, p);
  return p;
}
```

## Verification

**Commands:**
- `npx vitest run src/lib/singleflight.test.ts` -- expected: helper unit tests pass
- `npx vitest run` -- expected: full frontend suite (≥360 tests) green, no new failures
- `npx tsc --noEmit` -- expected: no type errors
- `grep -rn "refreshInFlight\|refreshQueued\|isExporting\|isCreatingNote\|isTrashingNote\|isTogglingTheme\|isTogglingLayoutMode" src` -- expected: zero hits outside `singleflight.ts`/tests

## Suggested Review Order

**The helper (design intent)**

- Start here: the keyed dedup contract — shared in-flight promise, `finally` cleanup, eager `fn()` + sync-throw handling
  [`singleflight.ts:35`](../../src/lib/singleflight.ts#L35)
- The cleanup + one-shot `onCoalesced` trailing hook that the note-list refresh relies on
  [`singleflight.ts:54`](../../src/lib/singleflight.ts#L54)

**Trailing-refresh seam (highest-risk migration)**

- `runRefresh` now coalesces via singleflight; `onCoalesced` re-arms one debounced pass, generation-gated
  [`realtimeSync.ts:37`](../../src/features/note-list/realtimeSync.ts#L37)
- The `syncGeneration` guard replaces the old `refreshQueued = false`, suppressing post-stop/restart trailing refreshes
  [`realtimeSync.ts:103`](../../src/features/note-list/realtimeSync.ts#L103)

**Boolean-guard migrations (mechanical)**

- Create/trash flows wrapped in singleflight; promise-chains left untouched
  [`actions.ts:18`](../../src/features/command-palette/actions.ts#L18)
- Theme/layout toggles — read-modify-write dedup preserved
  [`actions.ts:372`](../../src/features/command-palette/actions.ts#L372)
- Export guards unified; `resetExportGuard` now delegates to the shared reset
  [`exportJson.ts:22`](../../src/features/export/exportJson.ts#L22)
  [`exportMarkdown.ts:32`](../../src/features/export/exportMarkdown.ts#L32)

**Test wiring & coverage (peripherals)**

- Global in-flight reset added to per-test cleanup
  [`setup.ts:51`](../../src/test-utils/setup.ts#L51)
- Helper contract tests (concurrent share, reject-clears-key, onCoalesced-once)
  [`singleflight.test.ts:15`](../../src/lib/singleflight.test.ts#L15)
- Regression tests: mid-flight coalesce trailing + restart-after-stop suppression
  [`realtimeSync.test.ts:92`](../../src/features/note-list/realtimeSync.test.ts#L92)
