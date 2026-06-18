---
title: "Timeout-bound the Tauri IPC layer so a hung invoke can't wedge a singleflight key (DW-90)"
type: "bugfix"
created: "2026-06-16"
status: "done"
context: ["{project-root}/_bmad-output/project-context.md"]
baseline_commit: "37471978963b56eccb473987a93e49b610be1c5a"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The shared `singleflight` helper only clears an in-flight key in `started.finally(...)`. If a wrapped operation never settles — e.g. a Tauri IPC promise that hangs — the key stays in the `inFlight` map forever, so every later same-key call (`create-note`, `toggle-theme`, `toggle-layout-mode`, `trash-active-note`, `export-json`, `export-markdown`, `note-list-refresh`) coalesces onto the dead promise and that command is disabled until the app reloads. `singleflight` is deliberately timer-free (its "Never" boundary), so the bound must live elsewhere.

**Approach:** Per the human decision (DW-90, option 1 — *Timeout at the IPC layer*), add a small `withTimeout` wrapper around the Tauri invoke calls, mirroring the CLI's 5s round-trip timeout from Story 6.7. Every IPC call made inside a singleflight-wrapped operation is raced against a timeout that rejects if the invoke never settles; the rejection flows back through the operation, so `singleflight`'s `finally` always runs and the key is released. `singleflight` itself is not touched.

## Boundaries & Constraints

**Always:**
- The bound lives at the IPC invoke layer (frontend), not inside `singleflight` — `singleflight` stays timer-free.
- A timed-out invoke rejects with a distinct `IpcTimeoutError` so callers' existing `try/catch` / `result.status` paths log and recover exactly as they do for any other invoke failure.
- The timer is always cleared once the invoke settles (win or lose the race) — no leaked `setTimeout`, no late unhandled rejection from the losing branch.
- Keep mirroring Story 6.7: a quick local-SQLite round-trip is bounded at 5s by default.

**Never:**
- Do NOT add a timeout, timer, retry, or abort to `src/lib/singleflight.ts` — its "Never" boundary stands.
- Do NOT wrap the native dialog promises (`save`/`open` from `@tauri-apps/plugin-dialog`): those legitimately wait on the user and must not be killed by a 5s bound.
- Do NOT hand-edit `src/generated/bindings.ts` (tauri-specta output) and do NOT introduce raw `invoke(...)` calls — keep using the generated `commands`, wrapping the promise they return.
- Do NOT change the resolved-value contract of the `commands.*` calls on the success path.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| -------- | ------------- | -------------------------- | -------------- |
| Invoke settles fast | `commands.x()` resolves before timeout | `withTimeout` resolves with the same value; timer cleared | N/A |
| Invoke rejects fast | `commands.x()` rejects before timeout | `withTimeout` rejects with that same reason; timer cleared | propagate original error |
| Invoke hangs | promise never settles, timeout elapses | `withTimeout` rejects with `IpcTimeoutError`; singleflight key released so the next call runs fresh | caller's existing catch/log path runs |
| Late settle after timeout | invoke settles *after* the timeout already won | no unhandled rejection, no double-settle, timer already cleared | swallowed (race already lost) |
| Custom bound | `withTimeout(p, { timeoutMs })` | uses the supplied bound instead of the 5s default | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/withTimeout.ts` -- NEW. The IPC timeout primitive: `withTimeout`, `IpcTimeoutError`, `IPC_TIMEOUT_MS` (5000), `EXPORT_IPC_TIMEOUT_MS` (generous bound for the long-running exports). No `singleflight` dependency.
- `src/lib/withTimeout.test.ts` -- NEW. Unit tests for the I/O matrix above (fake timers).
- `src/lib/singleflight.ts` -- UNCHANGED reference: the helper whose key gets wedged; confirms the "timer-free" boundary it must keep.
- `src/features/command-palette/actions.ts` -- wrap the IPC calls behind `create-note` / `toggle-theme` / `toggle-layout-mode`: `commands.createNote`, `commands.getConfig`, plus the shared `persistSettingsUpdate` (`commands.updateConfig`) and `applyLayoutModeToWindow` (`commands.applyLayoutMode`) helpers.
- `src/features/workspace/store.ts` -- wrap `commands.trashNote` (backs `trash-active-note`) and `commands.listNotes` in `loadFilteredNotes` (backs `note-list-refresh` and trash's follow-up reload).
- `src/features/export/exportJson.ts` -- wrap `commands.exportJson` with the export bound (dialog left unwrapped).
- `src/features/export/exportMarkdown.ts` -- wrap `commands.exportMarkdown` with the export bound (dialog/progress listener left unwrapped).

## Tasks & Acceptance

**Execution:**

- [x] `src/lib/withTimeout.ts` -- create `withTimeout<T>(operation: Promise<T>, opts?: { timeoutMs?: number; label?: string }): Promise<T>` that races `operation` against a `setTimeout`, rejecting with `IpcTimeoutError` on elapse and clearing the timer once `operation` settles; export `IpcTimeoutError`, `IPC_TIMEOUT_MS = 5000`, `EXPORT_IPC_TIMEOUT_MS` (generous, e.g. 60000). JSDoc on all exports. -- the IPC bound that guarantees every wrapped invoke settles.
- [x] `src/lib/withTimeout.test.ts` -- cover the I/O & Edge-Case Matrix with `vi.useFakeTimers()`: fast resolve, fast reject, hang→`IpcTimeoutError`, late settle (no unhandled rejection / no double-settle), custom `timeoutMs`. -- proves the primitive and prevents timer leaks.
- [x] `src/features/command-palette/actions.ts` -- wrap `commands.createNote`, `commands.getConfig` (both toggle flows), the inline `commands.updateConfig` awaits in `toggleTheme`/`toggleLayoutMode`, the `commands.updateConfig` await in the shared `persistSettingsUpdate`, and the `commands.applyLayoutMode` await in `applyLayoutModeToWindow` with `withTimeout(...)` (default bound). -- bounds the `create-note` / `toggle-theme` / `toggle-layout-mode` flights (and the shared settings-panel setters).
- [x] `src/features/workspace/store.ts` -- wrap `commands.trashNote` and the `commands.listNotes` await in `loadFilteredNotes` with `withTimeout(...)` (default bound). -- bounds the `trash-active-note` and `note-list-refresh` flights.
- [x] `src/features/export/exportJson.ts` -- wrap `commands.exportJson(path)` with `withTimeout(..., { timeoutMs: EXPORT_IPC_TIMEOUT_MS })`; leave the `save` dialog unwrapped. -- bounds the `export-json` flight without killing the picker.
- [x] `src/features/export/exportMarkdown.ts` -- wrap `commands.exportMarkdown(directory)` with `withTimeout(..., { timeoutMs: EXPORT_IPC_TIMEOUT_MS })`; leave the `open` dialog and progress listener unwrapped. -- bounds the `export-markdown` flight without killing the picker.

**Acceptance Criteria:**

- Given a `singleflight`-wrapped operation whose underlying invoke never settles, when the timeout elapses, then the wrapper rejects with `IpcTimeoutError`, the operation's existing error path runs, the `singleflight` key is released, and a subsequent same-key call invokes `fn` afresh (no permanent wedge).
- Given an invoke that resolves or rejects before the timeout, when it settles, then `withTimeout` settles with the identical value/reason and the pending timer is cleared (verified: no leaked timers, no late unhandled rejection).
- Given the native file dialogs (`save`/`open`), when an export runs, then the dialog promise is NOT timeout-bounded and the user can take arbitrarily long to choose a path/folder.
- Given `src/lib/singleflight.ts`, when this change is complete, then it contains no timer/timeout/retry/abort logic (diff shows it unchanged).

## Verification

**Commands:**

- `npm run test -- src/lib/withTimeout.test.ts` -- expected: all new unit tests pass.
- `npm run test` -- expected: full Vitest suite green (existing actions/export/workspace/singleflight tests unaffected).
- `npm run build` -- expected: `tsc` typechecks clean (strict mode) and Vite build succeeds.
- `git diff --stat src/lib/singleflight.ts` -- expected: empty (singleflight untouched).

### Review Findings

- [x] [Review][Patch] Unbounded helper IPC could still wedge guarded create/trash flows [src/features/editor/hooks/useAutoSave.ts:46] — fixed by timeout-bounding `flushSave`'s create/update IPC and `loadNote`'s `getNote` IPC, so helper calls awaited inside `create-note` / `trash-active-note` singleflight operations now settle through `withTimeout`.
- [x] [Review][Patch] Timeout rejections bypassed existing recovery paths [src/features/workspace/store.ts:96] — fixed by catching timeout rejections in command-palette toggles, workspace trash/list loads, editor save, and note load paths so failures log and update existing failure state instead of escaping.

#### Review Ledger (2026-06-16)

- patch: Unbounded helper IPC could still wedge guarded create/trash flows [src/features/editor/hooks/useAutoSave.ts:46] — fixed by wrapping `commands.createNote`, `commands.updateNote`, and `commands.getNote` helper IPC with `withTimeout`.
- patch: Timeout rejections bypassed existing recovery paths [src/features/workspace/store.ts:96] — fixed by routing thrown `IpcTimeoutError` through existing log/error-state paths for toggles, trash, note-list refresh, save, and load.
- dismiss: Timed-out mutating IPC can still complete after retry [src/lib/withTimeout.ts:41] — frozen spec chose a frontend IPC timeout and explicitly documents that it cannot cancel backend commands.
- dismiss: Dialog hang path remains unresolved [src/features/export/exportJson.ts:25] — frozen spec explicitly says native `save`/`open` dialog promises must not be timeout-bounded.
- dismiss: Fixed timeout bounds may false-timeout slow valid work [src/lib/withTimeout.ts:7] — frozen spec mandates the 5s Story 6.7 mirror and a generous export bound; changing these is outside review scope.
