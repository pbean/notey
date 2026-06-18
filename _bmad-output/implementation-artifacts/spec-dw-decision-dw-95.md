---
title: "App --socket-path CLI arg for per-run E2E IPC isolation (DW-95)"
type: "feature"
created: "2026-06-16"
status: "done"
context: []
baseline_commit: "e03877932bcab1d48b470adfd41c8df4b7b2784e"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Local E2E cannot isolate its IPC socket per run. A modern WebKitWebDriver (`webkit2gtk-4.1 2.52.4`) resets the launched app's environment — stripping `NOTEY_SOCKET_PATH` and forcing `XDG_RUNTIME_DIR` back to the real session value — and `tauri-driver 2.0.6` has no env passthrough. So the test app always binds the default `$XDG_RUNTIME_DIR/notey.sock`, colliding with any real notey instance; the live-sync suite currently can only *skip* when a real instance is present rather than isolate from it.

**Approach:** Give the desktop app a `--socket-path <PATH>` CLI argument that overrides the resolved IPC socket path, taking precedence over the `NOTEY_SOCKET_PATH` env var and the default. Route a per-run unique path through `tauri:options.args` in `e2e/run.mjs` (the tauri-driver `args` field is forwarded to the spawned binary as process args, surviving the env reset). Each E2E session then binds its own isolated endpoint regardless of env propagation, so the live-sync suite no longer needs the "real instance present → skip" guard.

## Boundaries & Constraints

**Always:**
- CLI-arg precedence: `--socket-path` > `NOTEY_SOCKET_PATH` env > platform default. The arg is the most explicit channel and must win.
- Parse the arg permissively from `std::env::args()` — accept both `--socket-path <PATH>` and `--socket-path=<PATH>`; ignore unknown/extra args (the launcher may inject others) and never abort/exit the process on a parse miss.
- The CLI (`notey`, spawned directly by the E2E node process) keeps reading `NOTEY_SOCKET_PATH`; the app reads `--socket-path`. Both must resolve to the *same* per-run path so app and CLI rendezvous.
- Behavior must stay identical on CI (older driver where env survives) and locally — both now bind the per-run path via the arg.

**Ask First:**
- Adding a heavyweight CLI-parsing dependency (e.g. `clap`) to the desktop crate — the single arg should be hand-parsed; do not pull in a new dep without approval.

**Never:**
- Do not change the default/`NOTEY_SOCKET_PATH` resolution behavior for normal (no-arg) app launches.
- Do not isolate the E2E *database* — only the socket is in scope (DB sharing with a real instance is pre-existing and out of scope).
- Do not touch the IPC framing, worker, or security (`0600`) logic.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| -------- | ------------- | -------------------------- | -------------- |
| Arg with space form | argv contains `--socket-path /tmp/x.sock` | `socket_path()` returns `/tmp/x.sock` | N/A |
| Arg with equals form | argv contains `--socket-path=/tmp/x.sock` | `socket_path()` returns `/tmp/x.sock` | N/A |
| Arg precedence over env | argv has `--socket-path /tmp/a.sock` AND `NOTEY_SOCKET_PATH=/tmp/b.sock` | returns `/tmp/a.sock` | N/A |
| Arg absent | argv has no `--socket-path`, env set | falls back to `NOTEY_SOCKET_PATH`, then default | N/A |
| Flag present, value missing | argv ends with `--socket-path` (no following token) | treated as absent → env/default | no panic |
| Empty value | `--socket-path=` or `--socket-path ""` | treated as absent → env/default | no panic |
| Unknown extra args | argv has other flags around `--socket-path` | extra flags ignored; arg still found | no abort |

</frozen-after-approval>

## Code Map

- `src-tauri/src/ipc/socket_server.rs` -- `socket_path()` resolves the IPC path. Add a permissive `--socket-path` argv parser, give it top precedence, and add a unit-test module (none exists today).
- `src-tauri/src/lib.rs` -- calls `ipc::socket_server::socket_path()` at server start (line ~304). No change needed — it consumes whatever `socket_path()` returns.
- `e2e/driver.mjs` -- `createSession(application)` builds the `tauri:options` capability. Extend to forward an optional `args` array.
- `e2e/run.mjs` -- top-of-file per-run socket setup, the 5 `createSession(APP_PATH)` calls, `appSocketCandidates()`/`waitForAppSocket()` discovery, and the `realInstancePresent` skip guard in `cliLiveSyncTests()`/`main()`.

## Tasks & Acceptance

**Execution:**

- [x] `src-tauri/src/ipc/socket_server.rs` -- Add a pure helper `socket_path_arg_from<I: Iterator<Item = String>>(args: I) -> Option<PathBuf>` that scans for `--socket-path <PATH>` / `--socket-path=<PATH>`, returning the first non-empty value (else `None`); add `socket_path_arg()` wrapping `std::env::args()`. In `socket_path()`, check `socket_path_arg()` first, before the `NOTEY_SOCKET_PATH` env branch. Update the rustdoc on `socket_path()` to document the new precedence.
- [x] `src-tauri/src/ipc/socket_server.rs` -- Add a `#[cfg(test)] mod tests` covering every I/O & Edge-Case Matrix row for `socket_path_arg_from` (space form, equals form, missing value, empty value, unknown extra args, absent).
- [x] `e2e/driver.mjs` -- `createSession(application, args = [])`: include `args` in `tauri:options` only when non-empty. Update the JSDoc.
- [x] `e2e/run.mjs` -- Keep the per-run `NOTEY_SOCKET_PATH` assignment (for the CLI) and capture it as a constant; pass `['--socket-path', <perRunPath>]` to every `createSession` call (a small wrapper is fine). Simplify `appSocketCandidates()`/`waitForAppSocket()` to the now-deterministic per-run path. Remove the `realInstancePresent` detection and the live-sync skip block now that isolation is guaranteed via the arg; update the surrounding comments to reflect the arg-based isolation.

**Acceptance Criteria:**

- Given the app binary is launched with `--socket-path /tmp/notey-e2e.sock`, when the IPC server starts, then it binds `/tmp/notey-e2e.sock` even if `NOTEY_SOCKET_PATH` is unset/stripped and `XDG_RUNTIME_DIR` points elsewhere.
- Given the app is launched with both `--socket-path` and `NOTEY_SOCKET_PATH` set to different paths, when `socket_path()` resolves, then the `--socket-path` value wins.
- Given the app is launched with no `--socket-path`, when `socket_path()` resolves, then behavior is unchanged (env → default), so normal app launch and existing tests are unaffected.
- Given an E2E run, when each WebDriver session is created, then `tauri:options.args` carries the per-run `--socket-path`, the app and the `notey` CLI rendezvous on that path, and the live-sync suite runs (no longer skipped) even with a real notey instance on the default socket.
- Given `cargo test -p tauri-app` (or the crate's test command), when the new `socket_path_arg_from` tests run, then all matrix rows pass.

## Design Notes

Permissive hand-parse (no `clap` in the desktop crate) — robust to launcher-injected args and never exits the process:

```rust
fn socket_path_arg_from<I: Iterator<Item = String>>(args: I) -> Option<PathBuf> {
    let mut args = args;
    while let Some(arg) = args.next() {
        if let Some(v) = arg.strip_prefix("--socket-path=") {
            return (!v.is_empty()).then(|| PathBuf::from(v));
        }
        if arg == "--socket-path" {
            return args.next().filter(|v| !v.is_empty()).map(PathBuf::from);
        }
    }
    None
}
```

`socket_path()` gains one branch ahead of the env check:

```rust
pub fn socket_path() -> PathBuf {
    if let Some(custom) = socket_path_arg() { return custom; }
    if let Ok(custom) = std::env::var("NOTEY_SOCKET_PATH") { return PathBuf::from(custom); }
    // …existing default…
}
```

E2E side — both channels carry the same path; the CLI is not env-stripped (spawned directly by node), the app gets the arg:

```js
if (!process.env.NOTEY_SOCKET_PATH) {
  process.env.NOTEY_SOCKET_PATH = path.join(os.tmpdir(), `notey-e2e-${process.pid}.sock`);
}
const E2E_SOCKET_PATH = process.env.NOTEY_SOCKET_PATH;
// every session:
sessionId = await createSession(APP_PATH, ['--socket-path', E2E_SOCKET_PATH]);
```

## Verification

**Commands:**

- `cargo test -p tauri-app socket_path` -- expected: the new arg-parser unit tests pass (run from `src-tauri/`; adjust package name to the crate's actual name if different).
- `cargo build` (in `src-tauri/`) -- expected: app compiles with the new parser.
- `cargo clippy --all-targets -- -D warnings` (in `src-tauri/`) -- expected: no new warnings.
- `node --check e2e/run.mjs && node --check e2e/driver.mjs` -- expected: both parse clean.

**Manual checks (if no CLI):**

- Full E2E (`node e2e/run.mjs`) requires `tauri-driver` + built debug binary + xvfb; if unavailable in this environment, confirm by inspection that `tauri:options.args` carries `--socket-path` for every session and that the app's `socket_path()` returns the arg value. Note in the result if the live E2E run could not be executed here.

### Review Findings

- [x] [Review][Patch] Guard `--socket-path` parser against empty/malformed values while continuing to scan [src-tauri/src/ipc/socket_server.rs:116]
- [x] [Review][Patch] Normalize empty `NOTEY_SOCKET_PATH` before sharing the E2E socket path with app and CLI [e2e/run.mjs:51]
- [x] [Review][Patch] Reject a pre-existing live E2E socket before launching the test app [e2e/run.mjs:785]

#### Review Ledger (2026-06-16)

- patch: Guard `--socket-path` parser against empty/malformed values while continuing to scan [src-tauri/src/ipc/socket_server.rs:116] - merged blind/edge/auditor finding; malformed `--socket-path --flag` and earlier empty values must fall through instead of becoming a path or stopping the scan.
- patch: Normalize empty `NOTEY_SOCKET_PATH` before sharing the E2E socket path with app and CLI [e2e/run.mjs:51] - empty caller env split app fallback from CLI env resolution; generate a per-run path when the env var is unset or empty.
- patch: Reject a pre-existing live E2E socket before launching the test app [e2e/run.mjs:785] - prevents `waitForAppSocket()` and `notey add` from accepting an already-running listener at the chosen test path.
- dismiss: Windows custom paths are not unique by full path [src-tauri/src/ipc/socket_server.rs:201] - Windows local-socket transport already maps namespaced pipes from the final component; DW-95 uses unique per-run basenames and changing arbitrary path identity would require a coordinated CLI transport change outside this spec.
</content>
</invoke>
