---
title: "Story 6.2: IPC Socket Server in Desktop App"
type: "feature"
created: "2026-06-13"
status: "done"
baseline_commit: "40e4032472a5a2025e3785f59d78cb3435258c82"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md"
  - "{project-root}/_bmad-output/test-artifacts/test-design-epic-6.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 6's CLI (`notey add/list/search`) needs a server endpoint inside the running desktop app to talk to. Story 6.1 shipped the standalone `notey-cli` crate; Story 6.2 owns the *other side* — a local IPC socket server in `src-tauri/` that listens on a per-user, owner-only socket, parses the `{action,payload}` → `{success,data,error}` protocol, and routes `create_note`/`list_notes`/`search_notes` to the **existing** service layer without forking persistence logic. It must be the secure, robust, shared contract that Stories 6.3–6.6 build on.

**Approach:** Add a new `src-tauri/src/ipc/` module: `protocol.rs` (duplicated JSON request/response types + a pure `handle_request(&Connection, &[u8]) -> IpcResponse` dispatcher) and `socket_server.rs` (an `interprocess` local-socket listener with a length-prefixed framing layer, a per-user socket-path resolver, 0600 permissions, stale-socket rebind, and a threaded accept loop). Wire it into `lib.rs` startup against the app's single managed `Mutex<Connection>` and tear it down on exit. The socket **path is injectable** (constructor argument / `NOTEY_SOCKET_PATH` env override) so integration tests bind a temp socket against a temp DB.

## Boundaries & Constraints

**Always:**
- Reuse the existing service functions verbatim — `services::notes::create_note` + `update_note`, `services::notes::list_notes`, `services::search_service::search_notes`, `services::workspace_service::resolve_workspace`. Do NOT fork or reimplement persistence/search/workspace logic.
- Honor the project's **single `Mutex<Connection>`** rule: the server locks the SAME connection Tauri manages (via the `AppHandle` in production wiring); it must NOT open a second SQLite connection. Lock recovery goes through `commands::recover_poisoned_db`.
- Protocol envelope is authoritative: request `{ "action": string, "payload": { … } }`; response `{ "success": bool, "data": <value|null>, "error": <string|null> }`. All boundary structs use `#[serde(rename_all = "camelCase")]`; dates stay ISO 8601 strings.
- Supported actions: `create_note`, `list_notes`, `search_notes`. Any other action → `success:false` error envelope (no panic).
- Malformed/garbage/truncated request bytes → `success:false` error envelope, never a panic and never a crash of the host GUI process.
- `create_note` content is capped at **1 MiB** (`MAX_CONTENT_BYTES = 1024*1024`); over-cap content → error envelope. All DB writes stay parameterized (existing queries) — an injection/path-traversal/control-char payload must be stored **literally**, with no SQL or filesystem effect.
- Socket security (Unix): bind under the **per-user runtime dir** (`$XDG_RUNTIME_DIR/notey.sock`, i.e. `dirs::runtime_dir()`), file mode **0600** set immediately after bind. Remove the socket file on graceful shutdown; on startup, a stale socket whose owner is gone must be reclaimed (probe-then-remove-then-rebind), not leaked.
- The accept loop runs off the UI thread; one slow/never-closing client must not block accepting or processing other clients. Concurrent clients each get their own correct, independent response.
- Crate hygiene: rustdoc on public items, clippy-clean, Conventional Commits, `#[serde(rename_all="camelCase")]` on IPC structs.

**Ask First:**
- Promoting the inline `#[cfg(target_os)]` socket-path resolver into a full trait-based `platform/` module (architecture lists `platform/` but it does not yet exist — this story introduces only the path resolver it needs).
- Any change that would require altering existing Tauri command signatures or the managed-state type.

**Never:**
- Do NOT build the CLI client side, `notey add/list/search` output formatting, exit-code mapping, `--workspace <name>`→id resolution, or the real-time `note-created` event emit — those are Stories 6.3–6.7. `list_notes`/`search_notes` payloads take an optional numeric `workspaceId` only.
- Do NOT add a `--json` flag, exit code `3`, or a CLI latency benchmark (out of scope per the epic ACs).
- Do NOT request broad FS capabilities, add network access, or register new Tauri commands (keep `acl_tests.rs::EXPECTED_COMMANDS` unchanged).
- Do NOT make `src-tauri` depend on `notey-cli` or vice-versa (duplicated protocol structs, AC6).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| route create | `{action:"create_note", payload:{content:"hi", format:"markdown"}}` | new note persisted (title="hi", content="hi"); `{success:true, data:<Note camelCase, id>}` | N/A |
| title derive | content `"# Heading\nbody"` | title = first line trimmed, ≤100 chars (`"# Heading"`) | empty/whitespace content → title `"Untitled"` |
| create with workspace | payload adds `workspacePath:"/abs/git/repo"` | `resolve_workspace` detects+upserts; note gets that `workspaceId` | invalid path → error envelope (Validation) |
| route list | `{action:"list_notes", payload:{}}` / `{workspaceId:7}` | `{success:true, data:[Note,…]}`, non-trashed, newest first | N/A |
| route search | `{action:"search_notes", payload:{query:"foo"}}` | `{success:true, data:[SearchResult,…]}` | empty query → `{success:true,data:[]}` (service behavior) |
| content over cap | content > 1 MiB | rejected before write | `{success:false, error:"…too large…"}` |
| injection payload | content `"'; DROP TABLE notes;--"`, `"../../etc"`, `"ab"` | stored literally as content; `notes` table intact | N/A — parameterized; no SQL/path effect |
| unknown action | `{action:"delete_everything", payload:{}}` | `{success:false, error:"unknown action: …"}` | handled, no panic |
| malformed frame | not JSON / truncated / `{}` missing `action` | `{success:false, error:"…"}` | parse error → error envelope, no panic |
| oversized frame | length prefix > `MAX_REQUEST_BYTES` | connection rejected/closed, accept loop unaffected | bounded read, no OOM |
| concurrent clients | N clients each sending a request | each receives its own correct envelope | per-connection worker threads |
| socket perms | server bound on Unix | socket file mode == `0600` | N/A |
| stale socket | socket file exists, no live server | reclaimed (removed) then rebound on start | bind succeeds |
| cleanup | server shutdown | socket file removed from disk | N/A |

</frozen-after-approval>

## Code Map

- `src-tauri/src/ipc/mod.rs` -- NEW. `pub mod protocol; pub mod socket_server;` + re-exports.
- `src-tauri/src/ipc/protocol.rs` -- NEW. `IpcRequest`, `IpcResponse` (camelCase) + `MAX_CONTENT_BYTES` + pure `handle_request(conn: &Connection, raw: &[u8]) -> IpcResponse` dispatcher and per-action payload structs + `derive_title`. Unit tests live here.
- `src-tauri/src/ipc/socket_server.rs` -- NEW. `socket_path()` resolver (`#[cfg]` per-OS + `NOTEY_SOCKET_PATH` override), length-prefixed frame read/write, `IpcServer` (bind → 0600 → spawn accept loop → shutdown/cleanup).
- `src-tauri/src/lib.rs` -- MODIFY. Add `pub mod ipc;`; in `setup()` start the server with a handler closure capturing `app.handle()`; switch `.run(generate_context!())` to `build()?` + run-event handler that shuts the server down on `RunEvent::Exit`.
- `src-tauri/Cargo.toml` -- MODIFY. Add `interprocess = "2"` to `[dependencies]` (server + tests). `dirs` already present.
- `src-tauri/src/commands/mod.rs` -- REFERENCE. Reuse `recover_poisoned_db` for lock recovery (already `pub(crate)`).
- `src-tauri/src/services/{notes,search_service,workspace_service}.rs` -- REFERENCE. Delegation targets; do not modify.
- `src-tauri/tests/ipc_tests.rs` -- NEW. Reusable temp-socket + temp-DB harness and the 6.2 integration scenarios.

## Tasks & Acceptance

**Execution:**

- [x] `src-tauri/Cargo.toml` -- add `interprocess = "2"` dependency.
- [x] `src-tauri/src/ipc/protocol.rs` -- define `IpcRequest{action,payload}`, `IpcResponse{success,data:Option<Value>,error:Option<String>}` with `ok(data)`/`err(msg)` constructors; `MAX_CONTENT_BYTES`; `derive_title`; per-action payload structs (`CreateNotePayload{content, format(default markdown), workspacePath:Option}`, `ListNotesPayload{workspaceId:Option<i64>}`, `SearchNotesPayload{query, workspaceId:Option<i64>}`); `handle_request` that parses, validates, routes to the three services (create = `create_note` + `update_note` with derived title; optional `resolve_workspace`), and maps `NoteyError` → error envelope.
- [x] `src-tauri/src/ipc/socket_server.rs` -- `socket_path()` (`NOTEY_SOCKET_PATH` override → `dirs::runtime_dir()/notey.sock` on Linux → temp-dir fallback → namespaced name on Windows); length-prefixed `read_frame`/`write_frame` bounded by `MAX_REQUEST_BYTES`; `IpcServer::bind(path)` (stale-reclaim + 0600 on Unix), `IpcServer::serve(handler)` (threaded accept loop, per-connection worker), `IpcServer::shutdown()` (+ `Drop`) removing the socket file.
- [x] `src-tauri/src/ipc/mod.rs` -- module wiring + re-exports.
- [x] `src-tauri/src/lib.rs` -- `pub mod ipc;`; start the server in `setup()` with a handler closure that locks the managed `Mutex<Connection>` via the `AppHandle` (`recover_poisoned_db`) and calls `handle_request`; tear it down on `RunEvent::Exit`. Server-start failure is logged, non-fatal to boot.
- [x] `src-tauri/src/ipc/protocol.rs` -- `#[cfg(test)]` unit tests for the I/O matrix dispatch rows (routing, title derive, over-cap reject, injection-stored-literally, unknown action, malformed bytes).
- [x] `src-tauri/tests/ipc_tests.rs` -- temp-socket+temp-DB harness + integration tests covering 6.2-INT-001..008 (bind/route/envelope, 0600 + runtime-dir path, protocol malformed/unknown, injection literal, cleanup + stale rebind, N concurrent clients, oversized/slow client, user-scoped path).

**Acceptance Criteria:**

- Given a server bound to a temp socket over a seeded temp DB, when a client sends `create_note`/`list_notes`/`search_notes`, then each routes to the matching service and returns a well-formed `{success,data,error}` envelope (6.2-INT-001 / P0-INT-007).
- Given a server bound on Unix, when the socket file is stat-ed, then its mode is `0600`, and `socket_path()` resolves under the per-user runtime dir (6.2-INT-002 / RISK-E6-002).
- Given malformed JSON, a truncated frame, or an unknown action, when received, then the server replies with a `success:false` error envelope and the host process does not panic or crash (6.2-INT-003 / P0-INT-008).
- Given a `create_note` whose content is a SQL/path-traversal/control-char string, when stored, then it is persisted literally with no SQL or filesystem effect and the schema is intact (6.2-INT-004 / RISK-E6-001).
- Given a graceful shutdown then a restart over a stale socket file, when the server starts, then the stale file is reclaimed and bind succeeds; the file is removed on shutdown (6.2-INT-005).
- Given N concurrent clients, when each sends a request, then each receives its own correct response and no slow client blocks the accept loop (6.2-INT-006/007).
- Given the existing suite, when `cargo test` and `cargo clippy --all-targets` run in `src-tauri/`, then all prior Epic 1–5 tests still pass and there are no warnings; `acl_tests.rs::EXPECTED_COMMANDS` is unchanged.

## Design Notes

**Pure dispatch, framing-agnostic.** `handle_request` takes an already-de-framed JSON body and a `&Connection`, so it is unit-testable without a socket and reused by both the socket layer and tests:

```rust
pub fn handle_request(conn: &Connection, raw: &[u8]) -> IpcResponse {
    let req: IpcRequest = match serde_json::from_slice(raw) {
        Ok(r) => r, Err(e) => return IpcResponse::err(format!("malformed request: {e}")),
    };
    match req.action.as_str() {
        "create_note" => /* parse payload, cap content, optional resolve_workspace,
                            create_note + update_note(title=derive_title(content)) */,
        "list_notes"  => /* list_notes(conn, workspaceId) */,
        "search_notes"=> /* search_notes(conn, query, workspaceId) */,
        other => IpcResponse::err(format!("unknown action: {other}")),
    }
}
```

`derive_title` mirrors the GUI (`useAutoSave.ts`): first line, `trim()`, first 100 chars, else `"Untitled"`. `IpcResponse::ok` serializes the service result (`Note`/`Vec<Note>`/`Vec<SearchResult>`) with `serde_json::to_value`.

**Single connection via AppHandle (production).** The accept-loop handler closure captures `app.handle().clone()`; per request it does `let st = handle.state::<Mutex<Connection>>(); let conn = st.lock().unwrap_or_else(recover_poisoned_db); handle_request(&conn, raw)`. Tests instead pass a handler over their own `Arc<Mutex<Connection>>` — same `handle_request`, different connection source. This keeps the single-Mutex rule and avoids touching command signatures.

**Framing.** Each message = 4-byte big-endian length prefix + UTF-8 JSON body. Reader rejects `len > MAX_REQUEST_BYTES` (set generously above the 1 MiB content cap, e.g. 8 MiB) before allocating, using a bounded read — guards memory DoS and is newline-safe (note content may contain `\n`).

**interprocess 2.x.** `use interprocess::local_socket::{prelude::*, GenericFilePath, ListenerOptions, Stream};` → `let name = path.as_os_str().to_fs_name::<GenericFilePath>()?; let listener = ListenerOptions::new().name(name).create_sync()?;` then `for conn in listener.incoming() { spawn worker }`. Client: `Stream::connect(name)?`. After `create_sync`, on Unix set perms: `std::fs::set_permissions(path, Permissions::from_mode(0o600))` under `#[cfg(unix)]`. Stale reclaim: if bind fails with `AddrInUse`/exists, probe with `Stream::connect`; on connection-refused remove the file and retry once.

**Shutdown.** `IpcServer` holds an `Arc<AtomicBool>` flag + the socket `PathBuf`. `shutdown()` flips the flag, makes a throwaway self-connect to unblock `incoming()`, joins/detaches the thread, and `remove_file`s the socket; `Drop` also best-effort removes it. Workers check the flag.

**Cross-user isolation (testable slice).** True multi-uid access is manual/platform QA (RISK-E6-007); the automatable guarantee is mode `0600` + a `socket_path()` under `$XDG_RUNTIME_DIR` (itself `0700`). Assert both; document the cross-user portion as manual.

## Verification

**Commands:**

- `cargo test --manifest-path src-tauri/Cargo.toml` -- expected: new `ipc_tests` + protocol unit tests pass; all prior tests still green.
- `cargo test --manifest-path src-tauri/Cargo.toml --test ipc_tests` -- expected: the 6.2 integration scenarios (INT-001..008 plus supporting guardrail cases) pass.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets` -- expected: warning-clean.
- `cargo build --manifest-path src-tauri/Cargo.toml` -- expected: compiles; `bindings.ts` export test unaffected.

### Review Findings

- [x] [Review][Patch] Make `create_note` atomic across workspace resolution and note update [src-tauri/src/ipc/protocol.rs:129]
- [x] [Review][Patch] Use user-scoped socket names for the temp-dir fallback and Windows pipe path [src-tauri/src/ipc/socket_server.rs:43]
- [x] [Review][Patch] Reclaim only real stale sockets and preserve non-socket paths [src-tauri/src/ipc/socket_server.rs:224]
- [x] [Review][Patch] Abort IPC startup if owner-only socket permissions cannot be applied [src-tauri/src/ipc/socket_server.rs:178]
- [x] [Review][Patch] Backfill IPC integration coverage for workspace routing, real stale sockets, env override isolation, and per-client response pairing [src-tauri/tests/ipc_tests.rs:102]
- [x] [Review][Defer] Bound worker lifetime and connection budget for many half-open IPC clients [src-tauri/src/ipc/socket_server.rs:284] — deferred, auto-mode: needs human decision on the cross-platform timeout / worker-limit policy

#### Review Ledger (2026-06-13)

patch: Make `create_note` atomic across workspace resolution and note update [src-tauri/src/ipc/protocol.rs:129] — fixed by wrapping the create/update flow in one transaction and adding rollback coverage.
patch: Use user-scoped socket names for the temp-dir fallback and Windows pipe path [src-tauri/src/ipc/socket_server.rs:43] — fixed by deriving a stable per-user token for fallback socket naming.
patch: Reclaim only real stale sockets and preserve non-socket paths [src-tauri/src/ipc/socket_server.rs:224] — fixed by validating the existing path is a socket and only unlinking stale sockets on connection-refused/not-found.
patch: Abort IPC startup if owner-only socket permissions cannot be applied [src-tauri/src/ipc/socket_server.rs:178] — fixed by failing startup instead of serving an endpoint without the required `0600` protection.
patch: Backfill IPC integration coverage for workspace routing, real stale sockets, env override isolation, and per-client response pairing [src-tauri/tests/ipc_tests.rs:102] — fixed with new integration scenarios and safer test helpers.
defer: Bound worker lifetime and connection budget for many half-open IPC clients [src-tauri/src/ipc/socket_server.rs:284] — deferred in auto-mode because Windows named pipes do not support I/O timeouts and the worker-budget policy needs an explicit cross-platform decision.
dismiss: Cap IPC response size for large list/search results [src-tauri/src/ipc/protocol.rs:181] — dismissed because the existing Tauri command paths already serialize the same note/result collections and this story did not widen that response surface.
