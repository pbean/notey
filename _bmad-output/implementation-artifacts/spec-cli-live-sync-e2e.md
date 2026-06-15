---
title: 'CLI→desktop live-sync E2E (note-created seam)'
type: 'chore'
created: '2026-06-15'
status: 'done'
context: []
baseline_commit: '4f05dce08e77e6b0ae095a2e51409878687e8e33'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 6 crossed a process boundary (CLI → IPC socket → `note-created` event → desktop note-list refresh), but no automated E2E exercises that live seam — it is verified by hand only. The Epic 6 retro (Insight #3) named this "structurally dangerous," most acute for Epic 7. The trash-lifecycle E2E retired the *zero-feature-E2E* gap but never drives the cross-process path.

**Approach:** Add a `cliLiveSyncTests()` suite to the existing `tauri-driver` harness (`e2e/run.mjs`). With the note-list panel already open in the running desktop app, invoke the real `notey add` CLI binary; assert the new note appears in the list **driven solely by the live `note-created` event** (no UI-triggered refresh). Rendezvous the CLI and app on a single per-run socket and a single workspace, then clean up the created note.

## Boundaries & Constraints

**Always:**
- Drive the real `notey` debug binary (`notey-cli/target/debug/notey`) via `child_process` — a genuine separate process, not an in-app shim.
- Rendezvous deterministically: set `NOTEY_SOCKET_PATH` to a unique per-run temp path in `run.mjs` **before** `startDriver()` so it inherits down node → tauri-driver → app, and pass the same env to the spawned CLI.
- Align workspaces by construction: spawn the CLI with `cwd: process.cwd()` (the same cwd the app inherited), so both resolve to the identical workspace and the note passes the desktop's active-workspace filter.
- Open the note-list panel **before** the CLI add, so the only thing that can surface the new row is the event-driven refresh — that is the assertion under test.
- Run in its own fresh WebDriver session; clean up the CLI-created note (trash → permanent delete) in a `finally`, mirroring the trash suite's DW-91 safety-net.
- Keep `run.mjs` a pure runner: building the CLI/app binaries stays a documented prerequisite, not an action the script performs.

**Ask First:**
- Adding any backend/CLI/app *source* change to make the test pass (the seam already exists; this is test-only). If the seam appears broken, HALT and report rather than patching product code under a test spec.

**Never:**
- No new Tauri commands, IPC actions, event names, or product-code edits.
- Don't assert by opening the panel *after* the add (that self-refreshes and would not test the live event).
- No `pause()`-only "wait and hope" assertion — poll for the row with a timeout, fail-fast on a dead session.
- Don't leave the marker note in the shared dev DB.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | App running, note-list panel open; `notey add "<marker>"` exits 0 | Within ~5s a `note-list-item-*` row whose text contains `<marker>` appears via the `note-created` event (no manual refresh) | n/a |
| CLI binary missing | `notey-cli/target/debug/notey` absent | Test fails with a clear "build the CLI first" message | Fail fast, do not silently skip |
| CLI non-zero exit | socket unreachable / validation error | Test fails, surfacing CLI exit code + captured stderr | assert exit === 0 |
| Row never appears | event/refresh seam broken | Poll times out → test fails (seam regression caught) | bounded timeout, fatal-session aware |

</frozen-after-approval>

## Code Map

- `e2e/run.mjs` -- add `runCli()` spawn helper + `cliLiveSyncTests()`; set `NOTEY_SOCKET_PATH`; wire a fresh session into `main()`
- `e2e/driver.mjs` -- reuse as-is (no change); existing `findElements`/`getElementProperty` cover the row lookup
- `notey-cli/` -- source of the `notey` binary under test (built as a prerequisite; not edited)
- `src-tauri/src/ipc/` (`protocol.rs`, `events.rs`) -- the seam being verified (emits `note-created` after `create_note`); read-only reference
- `src/features/note-list/realtimeSync.ts` -- live listener that refreshes on `note-created`; read-only reference

## Tasks & Acceptance

**Execution:**
- [x] `e2e/run.mjs` -- set `process.env.NOTEY_SOCKET_PATH ??=` a unique `os.tmpdir()/notey-e2e-<pid>.sock` alongside the existing WEBKIT env block -- isolate the test app+CLI from any real running instance
- [x] `e2e/run.mjs` -- add `runCli(args, { timeoutMs })` that spawns `notey-cli/target/debug/notey` with `cwd: process.cwd()` and inherited env, capturing exit code + stdout/stderr; clear error if the binary is missing -- reusable, debuggable CLI invocation
- [x] `e2e/run.mjs` -- add `cliLiveSyncTests()`: open note list (Ctrl+B) → `runCli(['add', marker])` assert exit 0 → poll `[data-testid^="note-list-item-"]` via `testIdContaining` until it contains the unique marker → `finally` trash + purge the note -- the live-seam assertion + cleanup
- [x] `e2e/run.mjs` -- in `main()`, add a fresh session for `cliLiveSyncTests()` after the trash suite (same delete/create/pause pattern) -- isolated run, no cross-suite state
- [x] `e2e/run.mjs` -- update the top-of-file prerequisites comment to include building the CLI (`cargo build` in `notey-cli/`) -- reproducible setup

**Acceptance Criteria:**
- Given the desktop app is running with the note-list panel open, when `notey add "<marker>"` exits 0, then within 5s a note-list row containing `<marker>` appears with no UI-initiated refresh.
- Given the suite finishes (pass or mid-failure), then the marker note is removed from the dev DB (trash → permanent delete).
- Given `node e2e/run.mjs`, when the full file runs, then the capture-loop, window, trash-lifecycle, and new CLI live-sync suites all pass and the process exits 0.

### Review Findings

- [x] [Review][Patch] Cold-start race — first `notey add` could precede the app's IPC-socket bind → added `waitForSocket()` gate before the add [e2e/run.mjs]
- [x] [Review][Patch] Misleading double-failure — a failed CLI add still ran the 5s appear-wait, misreporting a CLI cause as an event-pipeline failure → short-circuit via `addSucceeded` [e2e/run.mjs]
- [x] [Review][Patch] Unhandled stream `error` (EPIPE on SIGKILL) → no-op `stdout`/`stderr` error handlers in `runCli` [e2e/run.mjs]
- [x] [Review][Patch] Silent teardown — `purgeCliNote` catch swallowed everything → log non-fatal cleanup failures [e2e/run.mjs]
- [→] [Review][Defer] Workspace-alignment assertion rests on un-asserted cwd/localStorage state → logged as **DW-93** (frozen-approach tradeoff; hardening needs spec renegotiation)
- [×] [Review][Reject] `??=` socket override (spec-explicit, mirrors WEBKIT vars); `os.tmpdir()` length (default 27 B); active-tab cleanup (mirrors `reopenNoteByMarker`); `waitForToast` substring & `createSession` throw (match existing suites); "null stdout on ENOENT" (incorrect — `spawn` always creates pipes)

## Design Notes

Workspace alignment is the crux. Desktop `initWorkspace()` (`workspace/store.ts`) sets the active workspace to `resolveWorkspace(app_cwd)`; the CLI sends `workspacePath = its cwd`; both run the same `detect_workspace` git-root walk + `upsert_workspace`. Spawning the CLI with `cwd: process.cwd()` (the cwd the app inherited from the runner) makes both resolve to the **same** workspace id, so `loadFilteredNotes(activeWorkspaceId)` includes the CLI note. If a future change decouples the app's cwd from the runner's, the row never appears and the test fails *visibly* rather than passing silently.

Why panel-open-first matters: `realtimeSync` listens app-wide, so `note-created` updates the store regardless — but the DOM row only renders when the panel is open. Opening it *before* the add makes the appearing row proof of the event-driven refresh, not of the panel's own load. `runCli` should reject with a build-the-CLI hint on `spawn` `error`, kill on timeout, and resolve `{ code, stdout, stderr }`.

## Verification

**Commands:**
- `cargo build` (run in `notey-cli/`) -- expected: produces `notey-cli/target/debug/notey`
- `npx tauri build --debug --no-bundle` -- expected: produces `src-tauri/target/debug/tauri-app`
- `node e2e/run.mjs` -- expected: all suites pass incl. "P1-E2E-003: CLI Live Sync"; exit 0

**Manual checks (if no CLI):**
- E2E requires `tauri-driver` + `WebKitWebDriver` (Linux/WebKitGTK); on a host without them the run is harness-gated — confirm the suite is wired into `main()` and the assertions read as above.

## Suggested Review Order

**The live-seam assertion (start here)**

- The whole design in one place: panel-open-first → CLI add → event-driven appear → finally-cleanup
  [`run.mjs:488`](../../e2e/run.mjs#L488)
- The proof: the row must appear with no UI-initiated refresh — and a failed add short-circuits here, not a misleading 5s wait
  [`run.mjs:517`](../../e2e/run.mjs#L517)
- The poll backing that assertion (bounded, throws on timeout)
  [`run.mjs:253`](../../e2e/run.mjs#L253)

**Process rendezvous (CLI ↔ app)**

- Per-run socket pinned before the driver spawns so app + CLI meet on one isolated endpoint
  [`run.mjs:41`](../../e2e/run.mjs#L41)
- Real `notey` binary spawned with `cwd: process.cwd()` for workspace alignment; friendly missing-binary error
  [`run.mjs:221`](../../e2e/run.mjs#L221)
- Socket-readiness gate closes the cold-start exit-2 race before the first add
  [`run.mjs:269`](../../e2e/run.mjs#L269)

**Cleanup & wiring (peripherals)**

- Panel-agnostic teardown: trash + purge the marker note, log non-fatal failures (addresses DW-91 for this suite)
  [`run.mjs:462`](../../e2e/run.mjs#L462)
- Fresh WebDriver session wired in after the trash suite
  [`run.mjs:566`](../../e2e/run.mjs#L566)
