---
title: "Story 8.5 — Per-User Data Isolation"
type: "feature"
created: "2026-06-17"
status: "done"
baseline_commit: "9572e56f7387003c4bae20e4b2d1143cf27e31a2"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-8-context.md"
  - "{project-root}/_bmad-output/project-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Per-user isolation is partly real but not yet routed through the `Platform` abstraction the epic mandates as the single source of truth (FR51/FR58). The SQLite database path is resolved by Tauri's opaque `app.path().app_data_dir()` (bundle id `com.pinkyd.tauri-app`) rather than a per-user platform-standard dir, and the `Platform` trait's `data_dir()` and `socket_path()` are red-phase `todo!()` stubs labeled "Story 8.5". The socket path/0600 logic already works but lives inline in `ipc/socket_server.rs`, so there is no single owner of path resolution. The Story 8.5 acceptance tests in `tests/platform_tests.rs` are `#[ignore]`.

**Approach:** Implement `Platform::data_dir()` and `Platform::socket_path()` for all three OS targets so data and socket paths resolve from the current user's platform-standard directories (`dirs` crate: `data_dir()` + namespace; `runtime_dir()`/temp for the socket). Route the database location through `platform::current().data_dir()` and make `socket_server::socket_path()` delegate its default-case resolution to `platform::current().socket_path()` (keeping its existing `--socket-path` / `NOTEY_SOCKET_PATH` override seams). Add a `NOTEY_DATA_DIR` test/override seam to `data_dir()` mirroring the existing socket seam. Un-ignore the two Story 8.5 platform tests.

## Boundaries & Constraints

**Always:**
- Path resolution is namespaced per existing convention: `notey` on Linux/Windows, `com.notey.app` on macOS (mirrors `services::config::config_dir`). Data dir = `dirs::data_dir()` + namespace (XDG_DATA_HOME / %APPDATA% / `~/Library/Application Support`).
- `data_dir()` honors a `NOTEY_DATA_DIR` env override first (test/hermetic seam, mirrors `NOTEY_SOCKET_PATH`), then falls back to the platform-standard path; it returns `Err(NoteyError::Config(...))` when no directory can be determined. It is a pure resolver — it does NOT create the directory (the caller `db::init_db` already `create_dir_all`s).
- `Platform::socket_path()` returns the pure default user-scoped path (Unix: `dirs::runtime_dir()/notey.sock`, else user-scoped temp fallback; Windows: user-scoped namespaced pipe). The default-resolution body + the `user_scope_token()` helper move OUT of `socket_server.rs` and INTO `platform` so there is one implementation.
- `socket_server::socket_path()` keeps its override precedence — `--socket-path` arg, then `NOTEY_SOCKET_PATH` env — then delegates the default to `platform::current().socket_path()`. Behavior for both seams and the default must be byte-identical to today.
- The socket file is still created owner-only (0600 on Unix) by the existing `set_owner_only()` in `socket_server.rs` — do not change that mechanism.
- Only `data_dir()` and `socket_path()` are implemented this story. `config_dir()`, `log_dir()`, `register_hotkey()`, and the `autostart_*` trait methods remain Story 8.6 `todo!()` stubs.
- All dirs come from the already-present `dirs` crate (v5) — no new dependency.

**Ask First:**
- Changing the live config-resolution path (`services::config::config_dir`) or implementing the trait `config_dir()` — that is Story 8.6's mechanism; config is already user-scoped.
- Adding a `--data-dir` CLI argument (full E2E-hermetic data isolation, DW-91/DW-95) — the `NOTEY_DATA_DIR` env seam is the agreed scope here.
- Migrating an existing `com.pinkyd.tauri-app` database to the new `notey` data dir (greenfield pre-v1; no migration intended).

**Never:**
- Do NOT change the `notey-cli` crate's `client.rs` socket-path logic — its duplication of the resolution is intentional (standalone crate, no workspace) and already tested to mirror the server. Verify it still matches after relocation; do not unify it.
- Do NOT add an auth token or any isolation mechanism beyond the user-scoped path + 0600 file mode (v1 contract).
- Do NOT touch hotkey, autostart, accessibility, FTS, or any unrelated subsystem.
- Do NOT change the socket override seams' precedence or the 0600 logic.
- No new IPC commands, no frontend changes, no new E2E journey.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Linux data dir | `NOTEY_DATA_DIR` unset | `data_dir()` = `dirs::data_dir()/notey` (`$XDG_DATA_HOME` or `~/.local/share`) | dirs None → `NoteyError::Config` |
| macOS data dir | `NOTEY_DATA_DIR` unset | `data_dir()` = `~/Library/Application Support/com.notey.app` | dirs None → `NoteyError::Config` |
| Windows data dir | `NOTEY_DATA_DIR` unset | `data_dir()` = `%APPDATA%\notey` | dirs None → `NoteyError::Config` |
| Data dir override | `NOTEY_DATA_DIR=/tmp/x` | `data_dir()` = `/tmp/x` (verbatim) | N/A |
| Unix socket default | no override, `XDG_RUNTIME_DIR` set | `socket_path()` = `$XDG_RUNTIME_DIR/notey.sock` | N/A |
| Unix socket fallback | no `XDG_RUNTIME_DIR` | `socket_path()` = `tempdir/notey-<user>.sock` (token from HOME/USER) | empty token → `notey.sock` |
| Windows socket | any | `socket_path()` = namespaced pipe `notey-<user>` | empty token → `notey` |
| Socket override (server) | `NOTEY_SOCKET_PATH` / `--socket-path` set | `socket_server::socket_path()` returns the override (unchanged) | N/A |
| Server default == platform | no override | `socket_server::socket_path()` == `platform::current().socket_path()` | N/A |
| DB init | app startup | DB opened at `platform::current().data_dir()/notey.db`; dir created if missing | resolve error → startup fails fast (expect) |

</frozen-after-approval>

## Code Map

- `src-tauri/src/platform/mod.rs` -- add `pub(crate)` helpers: `resolve_data_dir(namespace: &str) -> Result<PathBuf, NoteyError>` (honors `NOTEY_DATA_DIR`, else `dirs::data_dir().join(namespace)`, else `Err(Config)`); `#[cfg(unix)] resolve_unix_socket() -> PathBuf` and `#[cfg(windows)] resolve_windows_socket() -> PathBuf` (relocated default resolution); `user_scope_token() -> Option<String>` (moved verbatim from `socket_server.rs`). Update the module-doc green-phase note to reflect that 8.5 implements `data_dir`+`socket_path` and routes the DB + socket through the trait (config_dir/log_dir stay 8.6).
- `src-tauri/src/platform/linux.rs` -- `data_dir()` → `super::resolve_data_dir("notey")`; `socket_path()` → `super::resolve_unix_socket()`. Drop the two `todo!()`.
- `src-tauri/src/platform/macos.rs` -- `data_dir()` → `super::resolve_data_dir("com.notey.app")`; `socket_path()` → `super::resolve_unix_socket()`. Drop the two `todo!()`.
- `src-tauri/src/platform/windows.rs` -- `data_dir()` → `super::resolve_data_dir("notey")`; `socket_path()` → `super::resolve_windows_socket()`. Drop the two `todo!()`.
- `src-tauri/src/ipc/socket_server.rs` -- `socket_path()`: keep arg + env override checks, then `return crate::platform::current().socket_path();`. Remove the relocated inline unix/windows blocks and the local `user_scope_token()`. Clean up now-unused imports (`dirs`, possibly `Path`) to satisfy `clippy -D warnings`.
- `src-tauri/src/lib.rs` -- in `setup`, replace `app.path().app_data_dir()` (lines ~176-179) with `crate::platform::current().data_dir().expect("Failed to resolve data dir")`; drop the now-unused `app.path()` call there. Confirm `tauri::Manager`/`app.path()` is still needed elsewhere before removing any import.
- `src-tauri/tests/platform_tests.rs` -- remove `#[ignore]` from `data_dir_is_user_scoped_and_standard` and `socket_path_is_user_scoped` (the two Story 8.5 tests). Add `data_dir_honors_override_seam` (set/restore `NOTEY_DATA_DIR` under a mutex, assert verbatim passthrough) and, where cheap, a macOS-gated assertion that the data dir contains `com.notey.app`. Leave the 8.6-labeled tests `#[ignore]`.
- `src-tauri/tests/ipc_tests.rs` -- add `socket_server_default_matches_platform` asserting `socket_server::socket_path() == platform::current().socket_path()` with no overrides set (under the existing `SOCKET_PATH_ENV_LOCK`). Existing `int_002_*` socket tests must still pass unchanged.

## Tasks & Acceptance

**Execution:**

- [x] `src-tauri/src/platform/mod.rs` -- add `resolve_data_dir`, `resolve_unix_socket`/`resolve_windows_socket`, and the moved `user_scope_token`; update the module-doc note.
- [x] `src-tauri/src/platform/{linux,macos,windows}.rs` -- implement `data_dir()` and `socket_path()` via the mod helpers; remove the two Story-8.5 `todo!()` per file.
- [x] `src-tauri/src/ipc/socket_server.rs` -- make `socket_path()` delegate the default to `platform::current().socket_path()`; remove relocated logic + dead imports.
- [x] `src-tauri/src/lib.rs` -- resolve the DB dir via `platform::current().data_dir()`; remove the dead `app_data_dir()` path.
- [x] `src-tauri/tests/platform_tests.rs` -- un-ignore the two Story 8.5 tests; add the override-seam test (+ macOS naming assertion).
- [x] `src-tauri/tests/ipc_tests.rs` -- add the server-default-matches-platform invariant test.
- [x] Grep for other readers of `app_data_dir`/the old data path and the relocated socket helpers; fix any stragglers so the single-source-of-truth holds (only `db::init_db` param + `lib.rs` startup; both rewired).

### Review Findings

- [x] [Review][Patch] Make env-sensitive path tests hermetic and XDG-compliant [src-tauri/tests/platform_tests.rs:65] — applied: `data_dir_is_user_scoped_and_standard` now asserts `platform::current().data_dir()` equals `dirs::data_dir().join(namespace)` instead of assuming Unix data dirs are under `$HOME`; `NOTEY_DATA_DIR` and `NOTEY_SOCKET_PATH` tests now restore prior env values with an `OsString` guard.

#### Review Ledger (2026-06-17)

- patch: Make env-sensitive path tests hermetic and XDG-compliant [src-tauri/tests/platform_tests.rs:65; src-tauri/tests/ipc_tests.rs:38] — fixed valid XDG_DATA_HOME-outside-HOME failures and non-Unicode prior-env restoration leaks in tests.
- dismiss: Change production `NOTEY_DATA_DIR` to `var_os` / ignore empty values [src-tauri/src/platform/mod.rs:118] — dismissed because the story explicitly mirrors the existing `NOTEY_SOCKET_PATH` string env seam and preserves override behavior; empty string remains a verbatim override.

**Acceptance Criteria:**

- Given the app resolves data paths, when the database path is determined, then it is `platform::current().data_dir()/notey.db` under the current user's platform-standard data directory (XDG_DATA_HOME / %APPDATA% / `~/Library/Application Support`), with no system-wide shared directory used. (FR51/FR58)
- Given the IPC socket path is resolved with no override set, when `socket_server::socket_path()` and `platform::current().socket_path()` are compared, then they are equal and (on Linux with `XDG_RUNTIME_DIR` set) live under that per-user runtime dir as `notey.sock`, and the created socket file is mode 0600. (FR51)
- Given the `NOTEY_DATA_DIR` / `NOTEY_SOCKET_PATH` override seams, when each is set, then `data_dir()` / `socket_server::socket_path()` return the override verbatim (the existing socket-arg/env precedence is preserved).
- Given two users on one machine, when both run Notey, then each resolves an independent database, config, and IPC socket from their own per-user directories and neither can reach the other's 0600 socket (automatable slice: paths derive from per-user `dirs`/runtime dirs; true multi-uid access stays manual QA per RISK-E6-007).
- Given the build, when the suites run, then `cargo test` (incl. the un-ignored `platform_tests` Story 8.5 cases and the existing `ipc_tests` socket cases), `cargo clippy --all-targets -- -D warnings`, `vitest`, `tsc`, and `npm run build` all pass.

## Design Notes

**Single source of truth.** The epic mandates that data/config/log/socket resolution funnel through the `Platform` trait. This story does the two methods labeled 8.5 (`data_dir`, `socket_path`) and rewires their two callers (`lib.rs` DB init, `socket_server::socket_path`). `config_dir()`/`log_dir()` and hotkey/autostart routing stay Story 8.6 stubs — the live config path (`services::config::config_dir`) is already user-scoped, so config isolation (AC3) holds today without touching 8.6.

**Why relocate the socket logic instead of duplicating.** Putting the default resolution in `platform` and having `socket_server` delegate keeps one implementation inside the app crate. The override seams (`--socket-path`, `NOTEY_SOCKET_PATH`) are process-level concerns and stay in `socket_server`; the E2E harness depends on them (it routes `--socket-path` via `tauri:options.args` because a modern WebKitWebDriver resets the app env — see DW-95). The `notey-cli` crate keeps its own mirror copy (standalone, no workspace); it must continue to match the relocated default.

**Shared resolver shape (platform/mod.rs):**
```rust
pub(crate) fn resolve_data_dir(namespace: &str) -> Result<PathBuf, NoteyError> {
    if let Ok(custom) = std::env::var("NOTEY_DATA_DIR") {
        return Ok(PathBuf::from(custom));
    }
    dirs::data_dir()
        .map(|base| base.join(namespace))
        .ok_or_else(|| NoteyError::Config("Could not determine platform data directory".into()))
}
```

## Verification

**Commands:**

- `cd src-tauri && cargo test` -- expected: all suites green, including the un-ignored `platform_tests` Story 8.5 cases, the new override/invariant tests, and the existing `ipc_tests` socket cases.
- `cd src-tauri && cargo test --test platform_tests` -- expected: the two Story 8.5 tests (`data_dir_is_user_scoped_and_standard`, `socket_path_is_user_scoped`) now run and pass; the remaining Story 8.6 `todo!()` tests stay `#[ignore]`d (4 passed, 3 ignored).
- `cd src-tauri && cargo clippy --all-targets -- -D warnings` -- expected: clean (no dead-import warnings after the socket_server/lib.rs edits).
- `npm run build` -- expected: bindings regenerate unchanged (no IPC surface change); `tsc` + vite build succeed.

**Manual checks (if no CLI):**

- True multi-uid cross-user socket/data inaccessibility is platform QA (RISK-E6-007); the automated tests pin only the per-user path derivation + 0600 file mode.
</content>
</invoke>
