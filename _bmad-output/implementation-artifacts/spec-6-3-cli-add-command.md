---
title: "Story 6.3: CLI `add` Command (Text + Stdin)"
type: "feature"
created: "2026-06-13"
status: "done"
baseline_commit: "5884497caacb056c4fc7d6740e54ae748186e471"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md"
  - "{project-root}/_bmad-output/test-artifacts/test-design-epic-6.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Stories 6.1 (CLI scaffold/parse/validate) and 6.2 (desktop IPC socket server) are done, but the two halves have never been connected: `notey add` parses and validates, then dead-ends on a "not running" stub — no socket client exists. Story 6.3 owns the first real CLI↔app round-trip: `notey add "text"` and `cmd | notey add --stdin` must reach the running app over the IPC socket, persist a note via the existing `create_note` action, and print `✓ Note created`.

**Approach:** Add a duplicated, standalone socket client (`notey-cli/src/client.rs`) that resolves the same per-user socket path the server binds, frames a request with the same 4-byte length prefix, and round-trips one `{action,payload}`→`{success,data,error}` exchange. Wire `Command::Add` in `run()` to: collect content (argv or stdin) once, validate it, attach the auto-detected workspace by sending the canonicalized CWD as `workspacePath` (the server's `resolve_workspace` does git detection + upsert — no CLI reimplementation), dispatch, and map the response to output + exit code. Output is TTY-aware: ANSI green/red only when the stream is a terminal, plain text when piped.

## Boundaries & Constraints

**Always:**
- Keep AC6: `notey-cli` shares NO code with `src-tauri/`. The client duplicates the wire contract (4-byte big-endian length prefix + UTF-8 JSON body; `{action,payload}`/`{success,data,error}` envelopes) as local code. Match the server framing in `src-tauri/src/ipc/socket_server.rs` and the `create_note` payload shape in `src-tauri/src/ipc/protocol.rs` exactly.
- The wire action for `add` is `"create_note"` (server dispatcher verb), NOT `"add"`. Payload is `{ content, format, workspacePath? }`, all camelCase; `format` is `"markdown"`/`"plaintext"`.
- Resolve the socket path with the same precedence the server uses: `NOTEY_SOCKET_PATH` env override first, then `dirs::runtime_dir()/notey.sock` on Unix (temp-dir fallback), then a namespaced pipe on Windows. `NOTEY_SOCKET_PATH` is the test seam.
- Collect `add` content exactly once (stdin is not re-readable): read source → `validate_content` → convert to a UTF-8 `String` for the JSON payload. Preserve the Story 6.1 validation order (local validation failures exit before any socket attempt).
- Workspace: send the canonicalized current working directory as `workspacePath` so the server resolves/dedups it with the SAME Epic-2 logic the GUI uses (RISK-E6-006 mitigated by delegation, not duplication). If the CWD cannot be determined/canonicalized, omit `workspacePath` (note is created workspace-less) — never fail `add` over workspace detection.
- Response mapping: `success:true`→`✓ Note created` to stdout, exit 0; `success:false`→`✕ <error>` to stderr, exit 1; connection refused / socket missing→`✕ Notey is not running. Start the application first.` to stderr, exit 2. Reuse `CommandOutcome` + `exit_code_for`.
- Output coloring is a pure, testable function of an `is_terminal` flag (use `std::io::IsTerminal` — no new color crate). TTY → green `✓` / red `✕`; non-TTY → no ANSI escapes.
- rustdoc on public items, clippy-clean, Conventional Commits.

**Ask First:**
- Adding any dependency beyond `dirs` (needed to mirror the server's runtime-dir resolution; pin `dirs = "5"` to match `src-tauri` exactly).
- Changing the public `notey-cli` API signatures or the frozen Story 6.1 validation/exit-code contract.

**Never:**
- Do NOT implement a 5-second connect timeout, the full error-message taxonomy, or cross-user isolation polish — those are Story 6.7. Provide only the minimal connection-failure→`NotRunning` mapping that `add` needs to fail gracefully.
- Do NOT wire `list`/`search` output or dispatch — they stay on their deferred path until Stories 6.4/6.5. Only `Command::Add` becomes live.
- Do NOT reimplement git-workspace detection CLI-side (would re-introduce RISK-E6-006 divergence). Send the CWD path; let the server detect.
- Do NOT emit the `note-created` desktop event (Story 6.6), add a `--json` flag, or add exit code `3`.
- Do NOT make `notey-cli` depend on `src-tauri` or add network access.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| add text, app up | `notey add "hello"`, server returns `{success:true,data:{id,…}}` | request `{action:"create_note", payload:{content:"hello", format:"markdown", workspacePath:<cwd>}}` sent; stdout `✓ Note created`; exit 0 | N/A |
| add stdin, app up | `echo hi \| notey add --stdin` | stdin read to EOF → `content:"hi\n"` in payload; `✓ Note created`; exit 0 | N/A |
| format flag | `notey add note --format plaintext` | payload `format:"plaintext"` | N/A |
| at-cap content | 1 MiB exactly via `--stdin`, app up | accepted, sent, `✓ Note created`, exit 0 | N/A |
| over-cap content | 1 MiB + 1 via `--stdin` | rejected locally before connect; stderr `✕ note content exceeds the 1 MiB limit`; exit 2 | no socket attempt |
| non-UTF-8 stdin | bytes invalid as UTF-8 | rejected; stderr `✕ note content must be valid UTF-8`; exit 2 | no socket attempt |
| app returns error | server `{success:false,error:"db locked"}` | stderr `✕ db locked`; exit 1 | mapped to `AppError` |
| app not running | connect refused / socket file absent | stderr `✕ Notey is not running. Start the application first.`; exit 2 | mapped to `NotRunning` |
| workspace from git CWD | CWD inside a git repo | `workspacePath` = canonical CWD in payload; server resolves repo workspace (no dup on repeat) | N/A |
| CWD unresolvable | `current_dir()` errors | `workspacePath` omitted; note still created | degrade, not fail |
| piped stdout | stdout not a TTY | success line is plain `✓ Note created`, no ANSI escape bytes | N/A |
| tty stdout | stdout is a TTY | success line wraps `✓` in green ANSI, error wraps `✕` in red | N/A |

</frozen-after-approval>

## Code Map

- `notey-cli/src/client.rs` -- NEW. Socket-path resolver (`NOTEY_SOCKET_PATH`→`dirs::runtime_dir()/notey.sock`→temp fallback→Windows namespaced), `to_name` transport helper, duplicated 4-byte BE `read_frame`/`write_frame`, and `send_request(req: &CliRequest) -> Result<CliResponse, ClientError>` that connects, frames, and parses. `ClientError` distinguishes connection-refused (→`NotRunning`) from other I/O.
- `notey-cli/src/lib.rs` -- MODIFY. Add `mod client;`. Restructure `run()`'s `Command::Add` arm: collect content once (argv/stdin), validate, build the `create_note` `CliRequest` (content + format + optional `workspacePath` from canonical CWD), dispatch via `client::send_request`, map `CliResponse`/`ClientError` → `CommandOutcome` → TTY-aware output + exit code. Add a pure `format_outcome(outcome, is_terminal) -> (stream, line, code)` style helper (or `success_line`/`error_line` fns) so coloring is unit-testable. `list`/`search` arms unchanged (still deferred).
- `notey-cli/Cargo.toml` -- MODIFY. Add `dirs = "5"` (match `src-tauri`). `interprocess` already present.
- `notey-cli/tests/cli_add.rs` -- NEW. In-test stub socket server (binds a temp socket via `interprocess`, captures the framed request, returns a canned framed response) + the `notey` binary driven via `NOTEY_SOCKET_PATH`. Covers 6.3-INT-001/002/003 and the error/not-running mappings.
- `src-tauri/src/ipc/socket_server.rs` / `protocol.rs` -- REFERENCE ONLY. The framing + payload contract to mirror; do not modify.

## Tasks & Acceptance

**Execution:**

- [x] `notey-cli/Cargo.toml` -- add `dirs = "5"`.
- [x] `notey-cli/src/client.rs` -- implement `socket_path()`, `to_name()`, framed `read_frame`/`write_frame`, `ClientError` (variant for connection-refused vs other I/O vs decode), and `send_request(&CliRequest) -> Result<CliResponse, ClientError>`. rustdoc each public item; note the duplication-of-`src-tauri` rationale (AC6).
- [x] `notey-cli/src/lib.rs` -- `mod client;`; rework the `Add` path in `run()` to collect-once → validate → build `create_note` request (with CWD `workspacePath`) → dispatch → map outcome; add the pure TTY-aware output helper. Keep `list`/`search` deferred and the Story 6.1 validation/exit ordering intact.
- [x] `notey-cli/src/lib.rs` -- `#[cfg(test)]` unit tests for the output helper (TTY green/red vs piped plain) covering 6.3-UNIT-001, and for the request-builder (action `create_note`, payload fields/casing, format mapping, `workspacePath` present/omitted).
- [x] `notey-cli/tests/cli_add.rs` -- stub-server harness + integration scenarios: add-text round-trip + `✓ Note created` + exit 0 (6.3-INT-001); `--stdin` EOF read + 1 MiB end-to-end accept and over-cap reject (6.3-INT-002); CWD `workspacePath` included and stable across repeated invocations (6.3-INT-003); `success:false`→exit 1; not-running→exit 2.

**Acceptance Criteria:**

- Given a stub IPC server over a temp socket, when `notey add "X"` runs against it, then the server receives `{action:"create_note", payload:{content:"X", format:"markdown", workspacePath:<canonical cwd>}}`, the CLI prints `✓ Note created` to stdout, and exits 0 (6.3-INT-001 / P1-INT-001).
- Given `printf 'X' | notey add --stdin`, when content is at or below 1 MiB, then it is read to EOF, sent, and the note is created; when content exceeds 1 MiB, then the CLI exits 2 with the limit message and never opens the socket (6.3-INT-002 / RISK-E6-001).
- Given a CWD inside a git repository, when `notey add` runs, then the request carries the canonicalized CWD as `workspacePath` and repeating the command from the same directory sends the same path (server-side dedup is proven by Story 6.2); the CLI never fails `add` because of workspace detection (6.3-INT-003 / RISK-E6-006).
- Given the app responds `{success:false,error}`, when `add` runs, then stderr shows `✕ <error>` and exit is 1; given the socket is absent/refused, then stderr shows the "Notey is not running" message and exit is 2.
- Given stdout is not a TTY, when `add` succeeds, then the output contains no ANSI escape bytes; given a TTY, the success/error glyphs are colored (6.3-UNIT-001 / UX-DR61).
- Given the full crate, when `cargo test --manifest-path notey-cli/Cargo.toml` and `cargo clippy --manifest-path notey-cli/Cargo.toml --all-targets` run, then all Story 6.1 tests plus the new 6.3 tests pass with no warnings, and `cargo tree` shows no `src-tauri` dependency (AC6).

### Review Findings

- [x] [Review][Patch] Cap stdin reads before over-limit rejection [notey-cli/src/lib.rs:351]
- [x] [Review][Patch] Omit `workspacePath` when CWD canonicalization fails [notey-cli/src/lib.rs:400]
- [x] [Review][Patch] Exercise the git-repository workspace scenario in `6.3-INT-003` [notey-cli/tests/cli_add.rs:223]

#### Review Ledger (2026-06-13)

patch: Cap stdin reads before over-limit rejection [notey-cli/src/lib.rs:351-356] -- `read_to_end` buffers the entire pipe before the 1 MiB guard, so `cat hugefile | notey add --stdin` can still consume unbounded memory.
patch: Omit `workspacePath` when CWD canonicalization fails [notey-cli/src/lib.rs:400-403] -- the spec requires canonicalize-or-omit, but the implementation falls back to a raw non-canonical path.
patch: Exercise the git-repository workspace scenario in `6.3-INT-003` [notey-cli/tests/cli_add.rs:223-252] -- the current tests use plain temp directories and do not cover the required repo-shaped CWD case.
dismiss: Invalid UTF-8 CWD silently drops workspace [notey-cli/src/lib.rs:400-403] -- JSON payloads cannot carry non-UTF-8 paths; omitting the field is the correct fallback.
dismiss: CWD lookup failure should hard-fail `add` [notey-cli/src/lib.rs:400-403] -- the spec explicitly says workspace detection must degrade rather than fail note creation.
dismiss: Timeout handling is missing in Story 6.3 [notey-cli/src/lib.rs:408-415] -- 5-second timeout behavior is explicitly deferred to Story 6.7.
dismiss: Shared-temp fallback socket path is insecure [notey-cli/src/client.rs:58-79] -- this mirrors the approved server contract, and broader isolation hardening is outside Story 6.3.
dismiss: `NOTEY_SOCKET_PATH` should be validated [notey-cli/src/client.rs:58-60] -- the environment override is an explicit test seam required by the spec.
dismiss: More connect errors should map to `NotRunning` [notey-cli/src/client.rs:173-177] -- the story only requires the minimal missing/refused mapping; a fuller taxonomy is deferred.
dismiss: Recomputing TTY state at emit time can skew formatting [notey-cli/src/lib.rs:420-444] -- the pure formatting helpers already satisfy the story's testability requirement.
dismiss: Non-TTY output should avoid Unicode glyphs [notey-cli/src/lib.rs:447-460] -- the spec requires plain text without ANSI, not ASCII-only output.
dismiss: Windows transport path lacks direct coverage [notey-cli/tests/cli_add.rs] -- named-pipe coverage is not part of Story 6.3's required verification set.
dismiss: Missing malformed or oversized response-frame tests [notey-cli/src/client.rs:124-170] -- useful future hardening, but not required by this story's acceptance set.
dismiss: Broken-pipe output can panic [notey-cli/src/lib.rs:420-444] -- real CLI hardening opportunity, but outside this story's specified behavior and unchanged in existing error-print paths.

## Design Notes

**Collect content once.** `run()` currently reads stdin inside `validate_command_for_run` and discards it; stdin cannot be re-read for the payload. Restructure so the `Add` arm resolves the content bytes a single time, validates, converts to `String` (rejecting non-UTF-8 with a usage error → exit 2), then dispatches. Keep the existing argv/stdin/conflict rules from Story 6.1 untouched.

**Workspace by delegation.** The server's `resolve_workspace(conn, path)` already walks up from `path` to find `.git`, derives the name, and upserts (dedup on canonical path). So the CLI sends the canonical CWD and adds nothing else — this is the RISK-E6-006 mitigation: identical resolution to the GUI because it IS the same code path.

**Framing mirror (keep tiny):**
```rust
fn write_frame(w: &mut impl Write, body: &[u8]) -> io::Result<()> {
    w.write_all(&(body.len() as u32).to_be_bytes())?;
    w.write_all(body)?; w.flush()
}
// connect: let name = path.as_os_str().to_fs_name::<GenericFilePath>()?;
//          let mut s = Stream::connect(name)?;  // ConnectionRefused/NotFound → NotRunning
```

**Test harness.** The CLI is standalone, so 6.3 integration tests bind their own stub server with `interprocess` (read one frame, return a canned `{success,...}` frame), export `NOTEY_SOCKET_PATH`, spawn the `notey` binary via `CARGO_BIN_EXE_notey`, and assert on the captured request bytes + child stdout/exit — no `src-tauri` dependency.

## Verification

**Commands:**

- `cargo test --manifest-path notey-cli/Cargo.toml` -- expected: Story 6.1 tests + new 6.3 unit/integration tests pass.
- `cargo test --manifest-path notey-cli/Cargo.toml --test cli_add` -- expected: the 6.3 round-trip/stdin/workspace/error scenarios pass.
- `cargo clippy --manifest-path notey-cli/Cargo.toml --all-targets` -- expected: warning-clean.
- `cargo tree --manifest-path notey-cli/Cargo.toml | grep -i src-tauri` -- expected: no match (AC6).
