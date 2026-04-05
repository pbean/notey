---
title: 'Await post-reassign reloads in reassignNoteWorkspace'
type: 'refactor'
created: '2026-04-05'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** `reassignNoteWorkspace` calls `loadFilteredNotes()` and `loadWorkspaces()` fire-and-forget after a successful reassign. Callers receive `result.data` before reloads complete, and any unexpected throw from the reload promises would go unhandled.

**Approach:** Await both reloads via `Promise.all` with a `.catch()` guard so the function returns only after state is consistent, and unexpected throws don't prevent `result.data` from being returned.

## Suggested Review Order

**The change (one file, one line of logic)**

- Fire-and-forget reloads replaced with awaited `Promise.all` + `.catch()` guard
  [`store.ts:66`](../../src/features/workspace/store.ts#L66)

**Deferred work tracking**

- Deferred item struck through as done
  [`deferred-work.md:103`](deferred-work.md#L103)
