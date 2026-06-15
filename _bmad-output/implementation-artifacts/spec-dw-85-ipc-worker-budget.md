---
title: 'DW-85: bound IPC worker lifetime and connection budget (cross-platform watchdog)'
type: 'feature'
created: '2026-06-15'
status: 'done'
baseline_commit: '322e5703c1cf27969579fa8c2914a9d04551d807'
context: ['{project-root}/_bmad-output/project-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The IPC server spawns one unbounded worker thread per connection, each blocking forever in `read_frame` (`socket_server.rs:289-302`). A buggy or runaway same-user local process that opens many half-open connections (connect, never send a complete frame) parks unbounded threads, with no worker-count cap and no read deadline. DW-85 deferred this pending an explicit cross-platform design call, because `interprocess` named pipes on Windows have no I/O timeout.

**Approach:** Add two bounds enforced uniformly on every platform. (1) A **connection budget**: cap concurrent workers; reject an over-budget connection immediately with an error response and close it. (2) A **worker-lifetime watchdog**: a single reaper thread that, for any worker still waiting to read its request frame past a deadline, unblocks the stuck read by acting on the worker's own connection — `libc::shutdown(SHUT_RD)` on Unix (read half only, so a just-completed request's response write is never torn), `CancelIoEx` on Windows — so the worker errors out and frees its slot. The reaper acts only while holding the registry lock, and workers deregister under that same lock before their stream closes, so no fd/handle reuse race is possible.

## Boundaries & Constraints

**Always:**
- Both bounds active on all platforms; the watchdog is the uniform mechanism (no Unix-only / Windows-only split).
- The read deadline covers only the **request-read phase**. Once a full frame is read, clear the worker's deadline so handler execution and response write are never reaped mid-flight.
- The reaper calls shutdown/cancel only while holding the worker-registry lock; a worker removes its registry entry under that same lock **before** its `Stream` (and thus the fd/handle) is dropped.
- An over-budget connection receives a single framed error response (e.g. `IpcResponse::err("server busy")`) and is then closed — never silently dropped.
- Budget cap, read deadline, and reaper interval are constants with env overrides (`NOTEY_IPC_MAX_WORKERS`, `NOTEY_IPC_READ_DEADLINE_MS`) for fast deterministic tests — mirror the existing `NOTEY_SOCKET_PATH` seam.
- Preserve all existing behavior: length-prefix framing, 8 MiB `MAX_REQUEST_BYTES`, `0600`/stale-reclaim security, single-`Mutex<Connection>` delegation, graceful `shutdown()` on `RunEvent::Exit`.
- The reaper thread stops when the existing `shutdown` flag is set and is joined by `IpcServer::shutdown`.

**Ask First:**
- Changing the chosen policy away from budget + cross-platform watchdog (already decided — do not revisit).
- Reaping a worker during handler/response (deadline is read-phase-only, by decision).

**Never:**
- Do not add new Tauri commands or touch the service/persistence layer (delegation rule holds).
- Do not close/drop the fd or handle out from under the owning worker `Stream` — shutdown/cancel only (no double-close).
- Do not block the accept loop on the budget check or the reaper.
- Do not change the CLI client or the wire protocol shape.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Normal request | One client sends a complete frame promptly | Served as today; registered then deregistered; deadline cleared on full read | N/A |
| At capacity | `MAX_WORKERS` workers already in-flight, new client connects | New connection gets one `IpcResponse::err("server busy")` frame, then closed; accept loop keeps serving | error frame, no panic |
| Half-open stall | Client connects, sends partial/no length prefix, stalls past read deadline | Reaper shuts down that connection; worker's `read_frame` errors; slot freed; budget recovers | worker exits cleanly, entry removed |
| Slow-but-valid handler | Frame fully read, handler/DB slow | Never reaped (deadline cleared after read); response delivered | N/A |
| Shutdown with workers in-flight | `IpcServer::shutdown` called | Reaper observes shutdown flag and exits; accept loop stops; server drops | join reaper + accept |

</frozen-after-approval>

## Code Map

- `src-tauri/src/ipc/socket_server.rs` -- core change: `accept_loop` extracts the raw fd/handle and registers each connection against a shared budget before spawning; `handle_connection` clears its deadline after a successful read and deregisters on exit; add the `WorkerRegistry`, the reaper thread, and the platform `unblock_conn` helper. `IpcServer` gains the reaper join handle.
- `src-tauri/src/lib.rs:304-310` -- `IpcServer::start` call site; no signature change expected (registry is internal). Verify shutdown-on-`Exit` still joins cleanly.
- `src-tauri/tests/ipc_tests.rs` -- existing `TestServer`/`raw_connect`/`NOTEY_SOCKET_PATH` patterns and `int_007_slow_client_does_not_block_accept_loop`; add budget + watchdog-reclaim integration tests using the env overrides.
- `src-tauri/Cargo.toml` -- add `[target.'cfg(unix)'.dependencies] libc = "0.2"` and `[target.'cfg(windows)'.dependencies] windows = { version = "0.61", features = ["Win32_Foundation","Win32_System_IO"] }` (reuse versions already resolved in `Cargo.lock` — no new major).

## Tasks & Acceptance

**Execution:**
- [x] `src-tauri/Cargo.toml` -- add target-specific `libc` (unix) and `windows` (windows) deps at the versions already in `Cargo.lock`.
- [x] `src-tauri/src/ipc/socket_server.rs` -- add a `WorkerRegistry` (`Arc<Mutex<HashMap<u64, WorkerEntry>>>` + `AtomicU64` id), budget constant + env overrides, read-deadline tracking, the reaper thread, and `unblock_conn` (`libc::shutdown(SHUT_RDWR)` matching `Stream::UdSocket`; `CancelIoEx` matching `Stream::NamedPipe`). Wire registration/budget into `accept_loop`, deadline-clear + RAII deregister into `handle_connection`, reaper lifecycle into `IpcServer::start`/`shutdown`.
- [x] `src-tauri/tests/ipc_tests.rs` -- add: (a) budget test — saturate to `MAX_WORKERS` half-open conns, assert the next gets `server busy`; (b) watchdog-reclaim test — one half-open conn past the deadline frees its slot so a later full request succeeds; reuse `NOTEY_IPC_MAX_WORKERS`/`NOTEY_IPC_READ_DEADLINE_MS` for speed. Keep `int_007` green.

**Acceptance Criteria:**
- Given `MAX_WORKERS` in-flight workers, when another client connects, then it receives exactly one `server busy` error frame and is closed, and existing/subsequent clients are still served.
- Given a connection that connects but never completes its request frame, when the read deadline elapses, then the reaper unblocks it, the worker exits, and its budget slot is reclaimed (a later burst of valid requests all succeed).
- Given a connection whose frame is fully read, when its handler runs longer than the read deadline, then it is never reaped and its response is delivered intact.
- Given `IpcServer::shutdown`, when called with workers in-flight, then the reaper thread exits and is joined without hanging.
- Given the change, when `cargo test`, `cargo clippy`, and `cargo build` run on Linux, then all pass (including the unchanged `int_007` test).

## Spec Change Log

- 2026-06-15 (step-04 review, human-approved frozen-intent refinement): Blind/edge-case review found a narrow torn-write race — if a client completes its request frame exactly as the read deadline elapses, the reaper's `SHUT_RDWR` could also kill the response-write half (client sees EOF). Refined the Unix unblock mechanism from `SHUT_RDWR` to `SHUT_RD` (read half only) in the frozen Approach + Design Notes; `SHUT_RD` still unblocks a stalled `read_exact` but leaves the write half intact, so a just-completed request is never torn. Pinkyd approved the frozen-wording edit. Avoids: a successful request silently losing its response under reaper timing. KEEP: reaper acts only under the registry lock; deregister-under-lock-before-close drop ordering; read-phase-only deadline.

## Design Notes

Registry entry: `{ conn: RawConn, read_deadline: Option<Instant> }`, where `RawConn` is the platform raw fd (`i32`) / handle captured from the `&Stream` at accept time via the enum match. Budget = registry length under its lock; the RAII deregister guard must be declared *after* the `stream` binding so it removes the entry (under the lock) before the stream/fd closes.

**Safety invariant:** the reaper unblocks expired entries *while holding the registry lock*. Because a worker can only remove its entry — and thus close its fd/handle — under that same lock, an entry observed under the lock is guaranteed still-open, so shutdown/cancel never races a reused fd/handle.

`unblock_conn` matches the unified enum (inner UDS impls `AsFd`, named-pipe inner impls `AsHandle`):
```rust
#[cfg(unix)]    Stream::UdSocket(s)  => unsafe { libc::shutdown(s.as_fd().as_raw_fd(), libc::SHUT_RD); }
#[cfg(windows)] Stream::NamedPipe(s) => unsafe { let _ = CancelIoEx(/* s.as_handle() */, None); }
```
`shutdown(SHUT_RD)` leaves the fd open (no close) and shuts only the read half, so the worker's `read_exact` returns and it drops the stream normally — and a frame that finished reading right at the deadline can still write its response. `CancelIoEx` is cross-thread (unlike `CancelIo`), so it cancels the worker's synchronous `ReadFile`.

## Verification

**Commands:**
- `cargo test --manifest-path src-tauri/Cargo.toml ipc` -- expected: budget + watchdog tests pass, `int_007` still green
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` -- expected: clean
- `cargo build --manifest-path src-tauri/Cargo.toml` -- expected: builds (Linux; Windows path compiles under cfg)

## Suggested Review Order

**Design intent (start here)**

- The budget gate: brief lock, admit-or-reject, spawn outside the lock — the whole policy in one place.
  [`socket_server.rs:472`](../../src-tauri/src/ipc/socket_server.rs#L472)

**Connection budget**

- Registry whose length under its lock *is* the budget.
  [`socket_server.rs:100`](../../src-tauri/src/ipc/socket_server.rs#L100)

- Over-budget: one framed `server busy`, then close — never silently dropped.
  [`socket_server.rs:488`](../../src-tauri/src/ipc/socket_server.rs#L488)

**Worker-lifetime watchdog (highest-risk)**

- The reaper + its safety invariant: unblock only under the registry lock.
  [`socket_server.rs:572`](../../src-tauri/src/ipc/socket_server.rs#L572)

- `unblock_conn`: `SHUT_RD` (read-half only) on Unix, `CancelIoEx` on Windows.
  [`socket_server.rs:423`](../../src-tauri/src/ipc/socket_server.rs#L423)

- The lock-ordering linchpin: guard removes the entry *before* the stream/fd closes.
  [`socket_server.rs:515`](../../src-tauri/src/ipc/socket_server.rs#L515)

- Deadline is read-phase-only: cleared after a full frame so handlers are never reaped.
  [`socket_server.rs:544`](../../src-tauri/src/ipc/socket_server.rs#L544)

**Unsafe boundary**

- Why `RawConn: Send` is sound (raw value, never closed, acted on only under the lock).
  [`socket_server.rs:87`](../../src-tauri/src/ipc/socket_server.rs#L87)

**Config seam & lifecycle**

- Env-override parsing, mirroring `NOTEY_SOCKET_PATH`.
  [`socket_server.rs:47`](../../src-tauri/src/ipc/socket_server.rs#L47)

**Tests & deps (peripherals)**

- Test harness serializes every server start so env overrides can't leak across tests.
  [`ipc_tests.rs:72`](../../src-tauri/tests/ipc_tests.rs#L72)

- Budget rejection test.
  [`ipc_tests.rs:447`](../../src-tauri/tests/ipc_tests.rs#L447)

- Watchdog slot-reclaim test.
  [`ipc_tests.rs:488`](../../src-tauri/tests/ipc_tests.rs#L488)

- Target-specific `libc` / `windows` deps.
  [`Cargo.toml:46`](../../src-tauri/Cargo.toml#L46)
