---
title: 'Await fire-and-forget reloads across workspace store'
type: 'refactor'
created: '2026-04-05'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** Four store actions called `loadFilteredNotes()` and/or `loadWorkspaces()` fire-and-forget. Callers received results before reloads completed, and unexpected throws from reload promises went unhandled. This was flagged as a pre-existing pattern across all store actions that trigger async reloads.

**Approach:** Made all four actions async and await their reloads. `reassignNoteWorkspace` uses `Promise.all` with a `.catch()` guard (two independent reloads). The other three (`setActiveWorkspace`, `setAllWorkspaces`, `initWorkspace`) directly await their single `loadFilteredNotes()` call.

## Suggested Review Order

**Async conversions (sync → async)**

- `setActiveWorkspace` now awaits `loadFilteredNotes`
  [`store.ts:45`](../../src/features/workspace/store.ts#L45)

- `setAllWorkspaces` now awaits `loadFilteredNotes`
  [`store.ts:55`](../../src/features/workspace/store.ts#L55)

**Existing async actions — reload await**

- `reassignNoteWorkspace` awaits both reloads via `Promise.all` + `.catch()` guard
  [`store.ts:66`](../../src/features/workspace/store.ts#L66)

- `initWorkspace` awaits final `loadFilteredNotes`
  [`store.ts:125`](../../src/features/workspace/store.ts#L125)

**Type signature updates**

- `setActiveWorkspace` and `setAllWorkspaces` return `Promise<void>` instead of `void`
  [`store.ts:21`](../../src/features/workspace/store.ts#L21)

**Deferred work tracking**

- Deferred item struck through as done
  [`deferred-work.md:103`](deferred-work.md#L103)
