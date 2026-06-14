---
title: "Story 6.7: CLI Error Handling & User Isolation"
type: "feature"
created: "2026-06-13"
status: done
baseline_commit: "33b5659adeb434b37aee13f40c39a9219e07987e"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md"
  - "{project-root}/_bmad-output/test-artifacts/test-design-epic-6.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The CLI's connection error handling is mostly in place (not-running → exit 2, app-error → exit 1, success → exit 0), but the **5-second connection timeout is not implemented at all**: `client::send_request` does a fully blocking connect+write+read, so a hung/slow-loris server (socket exists, accepts, never replies) makes `notey` hang forever instead of timing out and exiting 2 (AC5 / 6.7-INT-004, RISK-E6-003/004). Separately, the `list`/`search` dispatch paths map transport errors inline and would mis-map a future `Timeout` to exit 1, and AC4 (per-user isolation) lacks a CLI-side assertion that the resolved socket path is user-scoped.

**Approach:** Add a bounded round-trip to the CLI socket client — run the existing blocking `send_request` body on a worker thread and `recv_timeout` on it (default 5 s, overridable via a `NOTEY_CONNECT_TIMEOUT_MS` test seam mirroring the existing `NOTEY_SOCKET_PATH` seam); on expiry return a new `ClientError::Timeout`. Unify the three command dispatchers (`add`/`list`/`search`) onto a single `ClientError → CommandOutcome` mapping so timeout consistently yields exit 2 + a timeout message and not-running/app-error keep their existing exit codes and messages. Add a CLI-side unit test pinning the user-scoped socket path (AC4); server-side isolation (0600 + per-user path) is already covered by `6.2-INT-002/008`.

## Boundaries & Constraints

**Always:**
- The 5 s timeout bounds the **entire** round-trip (connect + write + read response), because the realistic hang is a server that accepts but never frames a reply. Default exactly 5 s. `NOTEY_CONNECT_TIMEOUT_MS` (unsigned millis) overrides it for tests only; an unset/garbage value falls back to 5 s.
- Timeout maps to `CommandOutcome::Timeout` → exit code **2** for **every** command (TTY-aware red `✕`, plain when piped — reuse `error_line`). Because the 5 s bound covers the *whole* round-trip, a timeout can fire **after** the request was already written to the server, which for a mutating command means the server may have **already applied it**. The protocol is fire-request/read-response with no ack or idempotency key (adding one is out of scope — see **Never**), so the CLI cannot know. The stderr message therefore depends on the command class:
  - **Read-only** (`list`, `search`): `Notey did not respond in time.`
  - **Mutating** (`add` → `create_note`): the outcome is **indeterminate** — the note may or may not have been saved server-side — so the message MUST say so and point at a cheap verification: `Notey did not respond in time; your note may or may not have been saved. Run 'notey list' to check.` The CLI MUST NOT claim the note failed, and MUST NOT auto-retry.
- Preserve existing observable behavior exactly: app not running / connection refused / stale socket → exit **2** + `✕ Notey is not running. Start the application first.`; app returns `{success:false,error}` → exit **1** + `✕ [error]`; success → exit **0**. These are pinned by existing tests and must stay green.
- All three commands (`add`, `list`, `search`) route transport errors through ONE shared `ClientError → CommandOutcome` classifier so the exit-code/message mapping cannot diverge between commands.
- On timeout the orphaned worker thread (still blocked on the dead socket) must never panic the process: a late send on the closed channel is ignored (`let _`). A worker-thread disconnect without a value maps to a transport `Io` error, not a false success.
- The socket-path resolution stays byte-for-byte the duplicated logic already in `client::socket_path` (AC6: no shared code with `src-tauri/`). Do not "fix" or refactor path resolution.
- rustdoc on new public items; `cargo clippy --all-targets` warning-clean; Conventional Commits.

**Ask First:**
- Adding any new runtime dependency (e.g. an async runtime or a socket-timeout crate) — the std `mpsc` + `thread` approach needs none.
- Changing the timeout default away from 5 s, or making the timeout cover only part of the round-trip.
- Adding an auth token or any isolation mechanism beyond the existing user-scoped path + 0600 file mode.

**Never:**
- Do NOT add a Cargo workspace, share code with `src-tauri/`, or make `notey-cli` depend on `src-tauri/`.
- Do NOT make a network connection or change the wire framing / protocol shape.
- Do NOT alter the success output of `add`/`list`/`search` or their formatting (titles, snippets, relative dates, no-match line).
- Do NOT build a live-runtime E2E here; the CLI integration tests stub the socket server (consistent with 6.3–6.5).
- Do NOT report a mutating-command (`add`) timeout as a definite failure, and do NOT auto-retry a timed-out mutating request — there is no idempotency key and adding one (or any ack to the wire protocol) is out of scope. A retry could duplicate a note that already committed.
- Do NOT block the timeout test on a real 5 s wait — use the `NOTEY_CONNECT_TIMEOUT_MS` seam to keep it sub-second.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| App not running (no socket) | nothing bound at socket path | exit 2, stderr `✕ Notey is not running. Start the application first.` | `connect` NotFound → `NotRunning` |
| Stale socket / refused | socket file exists, no live server | exit 2, same not-running message | `connect` ConnectionRefused → `NotRunning` |
| App processing error | server returns `{success:false,error:"db locked"}` | exit 1, stderr `✕ db locked` | `AppError` |
| Server hangs, read-only cmd | `list`/`search`: server accepts, never frames a reply, elapsed > timeout | exit 2, stderr `✕ Notey did not respond in time.` | `recv_timeout` Timeout → `Timeout` |
| Server hangs, mutating cmd | `add`: server accepts (may have committed the note), never frames a reply, elapsed > timeout | exit 2, stderr `✕ Notey did not respond in time; your note may or may not have been saved. Run 'notey list' to check.` (indeterminate — never claim failure, never auto-retry) | `recv_timeout` Timeout → `Timeout` |
| Success | server returns `{success:true,...}` | exit 0, normal command output | N/A |
| Timeout classifier | `outcome_for_client_error(Timeout)` | `CommandOutcome::Timeout` | — |
| Not-running classifier | `outcome_for_client_error(NotRunning)` | `CommandOutcome::NotRunning` | — |
| Transport-io classifier | `outcome_for_client_error(Io/Decode)` | `CommandOutcome::AppError(msg)` (exit 1) | — |
| Timeout seam parse | `NOTEY_CONNECT_TIMEOUT_MS` unset / `"abc"` / `"250"` | 5000 ms / 5000 ms / 250 ms | garbage → default |
| User-scoped path (Linux) | default resolution, `runtime_dir()` present | path under `$XDG_RUNTIME_DIR`, file name `notey.sock` | — |
| Worker disconnect | worker thread drops sender without sending | `ClientError::Io` (not a false success) | Disconnected → Io |

</frozen-after-approval>

## Code Map

- `notey-cli/src/client.rs` -- MODIFY. Add `ClientError::Timeout` (+ `Display`). Split the current blocking body of `send_request` into a private `send_request_blocking`; make `send_request` spawn it on a worker thread and `recv_timeout(connect_timeout())`. Add `fn connect_timeout() -> Duration` reading `NOTEY_CONNECT_TIMEOUT_MS` (default `DEFAULT_CONNECT_TIMEOUT = 5s`). `#[cfg(test)]`: timeout-seam parsing (unset/garbage→5s, valid→parsed) and a user-scoped `socket_path()` assertion (AC4 CLI-side, mirroring server `6.2-INT-002/008`).
- `notey-cli/src/lib.rs` -- MODIFY. Add `fn outcome_for_client_error(err: client::ClientError) -> CommandOutcome` (NotRunning→NotRunning, Timeout→Timeout, else→AppError(to_string)). Route `dispatch` (add) and the `Err(..)` arms of `dispatch_list`/`dispatch_search` through it — list/search emit the error via the shared `emit_outcome` so timeout→exit 2 is consistent. The `Timeout` stderr line is **command-class-specific**: read-only commands print `Notey did not respond in time.`; the mutating `add` prints the indeterminate variant `Notey did not respond in time; your note may or may not have been saved. Run 'notey list' to check.` (the Timeout outcome must carry enough context — e.g. a mutating/read-only flag or a distinct payload — for `emit_outcome` to pick the right line; do not auto-retry). Keep success/app-error output identical. `#[cfg(test)]`: `outcome_for_client_error` mapping table **and** the per-command-class timeout message.
- `notey-cli/tests/cli_errors.rs` -- NEW. Integration tests 6.7-INT-001..004 driving the real `notey` binary via `CARGO_BIN_EXE_notey` + `NOTEY_SOCKET_PATH`: (001) no socket → exit 2 + not-running; (002) stale/refused socket file → exit 2 + not-running; (003) stub returns `success:false` → exit 1 + `✕ error`; (004) stub accepts then sleeps past a short `NOTEY_CONNECT_TIMEOUT_MS` → exit 2, asserting it returns well under the real 5 s — covering BOTH a read-only command (`list`/`search` → `✕ Notey did not respond in time.`) and the mutating `add` (→ the indeterminate `✕ Notey did not respond in time; your note may or may not have been saved. Run 'notey list' to check.`).
- `notey-cli/tests/cli_atdd.rs` -- REFERENCE ONLY. `exit_code_timeout_is_two` already pins `Timeout`→2; the new `Timeout` variant must keep `exit_code_for` exhaustive.
- `src-tauri/tests/ipc_tests.rs` -- REFERENCE ONLY. `int_002_*`/`int_002_008_*` already cover server-side isolation (AC4); do not modify.

## Tasks & Acceptance

**Execution:**

- [x] `notey-cli/src/client.rs` -- add `ClientError::Timeout`; refactor `send_request` to run `send_request_blocking` on a worker thread bounded by `recv_timeout(connect_timeout())`; add `connect_timeout()` + `DEFAULT_CONNECT_TIMEOUT`; ignore late worker sends, map worker disconnect to `Io`. Unit-test the seam parsing and user-scoped path.
- [x] `notey-cli/src/lib.rs` -- add `outcome_for_client_error` and route all three dispatchers' transport-error arms through it so timeout→exit 2 is uniform; keep not-running/app-error/success behavior byte-identical. Unit-test the classifier mapping.
- [x] `notey-cli/tests/cli_errors.rs` -- new integration tests 6.7-INT-001..004 (not-running, stale/refused, app-error, timeout-via-short-seam), each asserting exit code + the exact stderr line.

### Review Findings

- [x] [Review][Patch] Surface worker-thread spawn failures as transport errors [`notey-cli/src/client.rs:192`]
- [x] [Review][Patch] Make the CLI socket-path/env unit tests deterministic and restore inherited env state [`notey-cli/src/client.rs:239`]
- [x] [Review][Patch] Isolate CLI integration tests from inherited timeout seams and tighten the timeout bound [`notey-cli/tests/cli_errors.rs:94`]
- [x] [Review][Patch] Assert exact stderr lines in CLI error integration tests [`notey-cli/tests/cli_errors.rs:151`]
- [x] [Review][Resolved] Timed-out mutating requests can still commit server-side [`notey-cli/src/client.rs:192`] — RESOLVED 2026-06-13 by human (bmad-auto-resolve): accept at-least-once semantics; a mutating timeout is reported as **indeterminate** (exit 2 + "your note may or may not have been saved. Run 'notey list' to check."), never a definite failure and never auto-retried. Exactly-once (idempotency key / protocol ack) is out of scope. Encoded in the frozen `Always`/`Never` rules + I/O matrix.

#### Review Ledger (2026-06-13)

- patch: Surface worker-thread spawn failures as transport errors [`notey-cli/src/client.rs:192`] — fixed by mapping `thread::Builder::spawn` failures to `ClientError::Io` instead of panicking.
- patch: Make the CLI socket-path/env unit tests deterministic and restore inherited env state [`notey-cli/src/client.rs:239`] — fixed with per-test env guards and a forced `$XDG_RUNTIME_DIR` assertion for the Linux AC4 path.
- patch: Isolate CLI integration tests from inherited timeout seams and tighten the timeout bound [`notey-cli/tests/cli_errors.rs:94`] — fixed by clearing `NOTEY_CONNECT_TIMEOUT_MS` in the CLI test harnesses and tightening the short-timeout assertion to 2 seconds.
- patch: Assert exact stderr lines in CLI error integration tests [`notey-cli/tests/cli_errors.rs:151`] — fixed by trimming the piped stderr line and asserting exact equality for not-running, app-error, and timeout scenarios.
- resolved: Timed-out mutating requests can still commit server-side [`notey-cli/src/client.rs:192`] — human decision (2026-06-13, bmad-auto-resolve): keep exit 2 but report a mutating-command timeout as indeterminate ("note may or may not have been saved; run `notey list` to check"); never claim failure, never auto-retry. Exactly-once is out of scope (no protocol/server change). Frozen intent + acceptance criteria + I/O matrix updated accordingly.
- dismiss: Full round-trip timeout can fail legitimate long-running requests [`notey-cli/src/client.rs:179`] — the approved spec explicitly requires the 5-second bound across connect, write, and read.
- dismiss: Timed-out worker threads outlive the timeout until process exit [`notey-cli/src/client.rs:179`] — the one-shot CLI exits immediately and the approved design notes explicitly accept this tradeoff.
- dismiss: `NOTEY_CONNECT_TIMEOUT_MS=0` should be rejected [`notey-cli/src/client.rs:42`] — zero-millisecond behavior is part of an opt-in test seam and is not constrained by the approved spec.
- dismiss: Missing `add` timeout integration coverage [`notey-cli/src/lib.rs:453`] — the shared classifier unit tests plus existing `add` error-path integration coverage already exercise the transport mapping introduced here.
- dismiss: Module-local env locking is insufficient across the crate [`notey-cli/src/client.rs:236`] — no other crate tests mutate these parent-process env vars, and the new guards now restore prior values after each test.
- dismiss: `StubServer::drop` can hang on a pre-connect panic [`notey-cli/tests/cli_errors.rs:85`] — speculative failure-path harness concern only; it was not reproducible in the deterministic suite.
- dismiss: AC4 should assert fallback and Windows user-scope branches [`notey-cli/src/client.rs:288`] — Story 6.7 only requires the Linux `$XDG_RUNTIME_DIR` path assertion mirrored from the server tests.
- dismiss: CLI integration helpers need an external watchdog timeout [`notey-cli/tests/cli_errors.rs:94`] — this is an existing repo-wide harness pattern, not a story-specific correctness defect after the in-process timeout checks.
- dismiss: Test-only timeout seam is exposed in production [`notey-cli/src/client.rs:72`] — the approved code map explicitly called for `connect_timeout()` to read `NOTEY_CONNECT_TIMEOUT_MS`, mirroring the existing `NOTEY_SOCKET_PATH` seam; no runtime gating was specified.
- dismiss: Unbounded `NOTEY_CONNECT_TIMEOUT_MS` overrides can distort behavior [`notey-cli/src/client.rs:72`] — previously dismissed in the ledger; zero/edge values are part of the opt-in seam and remain outside the approved constraints.
- dismiss: Timeout workers accumulate in long-lived callers [`notey-cli/src/client.rs:196`] — previously dismissed in the ledger; the approved design explicitly accepts orphaned workers because the CLI exits immediately after reporting the timeout.
- dismiss: Mutating timeout wording overstates uncertainty before request write completes [`notey-cli/src/lib.rs:487`] — previously resolved by human decision; the frozen spec requires the indeterminate mutating timeout message.
- dismiss: `CommandClass` timeout selection is easy to misuse later [`notey-cli/src/lib.rs:460`] — speculative maintainability concern only; the changed call sites pass the correct class and the unit tests pin both timeout variants.
- dismiss: `cli_errors` socket harness is Unix-specific / path-fragile [`notey-cli/tests/cli_errors.rs:29`] — same existing CLI integration harness pattern used across this crate; no new reproducible story-specific defect was shown.
- dismiss: `socket_path_honors_the_override_seam` is non-portable [`notey-cli/src/client.rs:308`] — contradicted by the code: the override branch returns the raw env path before any platform-specific socket resolution.
- dismiss: Module-local env locking is insufficient across the crate [`notey-cli/src/client.rs:249`] — previously dismissed in the ledger; no new evidence showed another test mutating those process env vars.
- dismiss: `StubServer::drop` can hang if the CLI never connects [`notey-cli/tests/cli_errors.rs:85`] — previously dismissed in the ledger; no new evidence changed that adjudication.
- dismiss: `HangServer` leaks a detached background thread [`notey-cli/tests/cli_errors.rs:114`] — previously dismissed in the ledger; the test intentionally mirrors the accepted one-shot timeout design.

**Acceptance Criteria:**

- Given the desktop app is not running (no socket) or the socket exists but the connection is refused, when any CLI command runs, then it exits 2 and stderr is `✕ Notey is not running. Start the application first.` (red on a TTY, plain when piped) (6.7-INT-001/002, AC1/AC2).
- Given the server returns `{success:false,error:"..."}`, when any CLI command runs, then it exits 1 and stderr is `✕ [error message]` (6.7-INT-003, AC3).
- Given the server accepts a connection but does not reply within the connection timeout, when a read-only CLI command (`list`/`search`) runs, then it exits 2 with `✕ Notey did not respond in time.` and returns in well under the real 5 s when the seam shortens it (6.7-INT-004, AC5).
- Given the same hung server, when the mutating `add` command runs, then it exits 2 with the indeterminate message `✕ Notey did not respond in time; your note may or may not have been saved. Run 'notey list' to check.`, and the CLI neither claims the note failed nor auto-retries (the request may have already committed server-side; the protocol has no idempotency key) (6.7-INT-004, AC5).
- Given multiple users on one system, when each runs `notey`, then the CLI resolves a user-scoped socket path (under `$XDG_RUNTIME_DIR` on Linux) matching the server's per-user path, and the server's 0600 + per-user guarantees (already tested) prevent cross-user access (AC4, FR37).
- Given the full build, when `cargo test -p notey-cli`, `cargo build/test/clippy --manifest-path src-tauri/Cargo.toml`, and `cargo clippy -p notey-cli --all-targets` run, then all prior Epic 1–6 tests stay green, there are no warnings, and `exit_code_for` remains exhaustive over the `CommandOutcome` variants.

## Design Notes

**Why a thread + `recv_timeout`, not a socket read timeout.** `interprocess`'s `local_socket::Stream` does not expose a portable `set_read_timeout`, and the hang we must bound spans connect → write → read. Running the existing blocking round-trip on a worker thread and waiting with `std::sync::mpsc::recv_timeout` bounds the whole operation with zero new dependencies and is deterministic to test. The worker that is still blocked on the dead socket is harmless: the CLI prints and exits immediately, and the OS reaps the thread; a late `tx.send` after the receiver is gone returns `Err` and is ignored.

```rust
// client.rs sketch
pub fn send_request(request: &CliRequest) -> Result<CliResponse, ClientError> {
    let (tx, rx) = mpsc::sync_channel(1);
    let req = request.clone();
    thread::spawn(move || { let _ = tx.send(send_request_blocking(&req)); });
    match rx.recv_timeout(connect_timeout()) {
        Ok(result) => result,
        Err(mpsc::RecvTimeoutError::Timeout) => Err(ClientError::Timeout),
        Err(mpsc::RecvTimeoutError::Disconnected) =>
            Err(ClientError::Io(io::Error::new(io::ErrorKind::Other, "client worker exited"))),
    }
}
```

**Single classifier.** Today `dispatch_list`/`dispatch_search` hand-map `Err(NotRunning) => exit 2` and `Err(other) => exit 1`; once `Timeout` exists, that `other` arm would wrongly send timeouts to exit 1. Folding every transport error through `outcome_for_client_error` + `emit_outcome` removes the divergence and is the core of RISK-E6-005 (exit-code mapping).

## Verification

**Commands:**

- `cargo test -p notey-cli` -- expected: new `client`/`lib` units + `cli_errors` integration tests pass; all prior CLI tests green.
- `cargo build --manifest-path src-tauri/Cargo.toml` -- expected: compiles (regenerates `bindings.ts` unchanged for this story).
- `cargo test --manifest-path src-tauri/Cargo.toml` -- expected: full backend suite green, incl. `ipc_tests` isolation tests (unchanged).
- `cargo clippy -p notey-cli --all-targets` and `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets` -- expected: warning-clean.

**Manual checks:**

- With the app running, hang the server (or point `NOTEY_SOCKET_PATH` at a socket whose server never replies) → `notey list` prints the timeout line and exits 2 within ~5 s instead of hanging.
</content>
</invoke>
