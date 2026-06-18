---
title: "Story 8.6 — Cross-Platform Verification & Wayland Fallback (Platform trait completion)"
type: "feature"
created: "2026-06-17"
status: "done"
baseline_commit: "1b1716644ceecd58095b0990fb15e09ec3fd6664"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-8-context.md"
  - "{project-root}/_bmad-output/project-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The `Platform` trait is meant to be the single source of truth for all OS-divergent behavior (epic-8 capstone, FR56/FR57/FR58), but three contracts are still red-phase `todo!()` for every OS: `config_dir()`, `log_dir()`, and `register_hotkey()`. Config paths today resolve through a separate `services::config::config_dir()` (a second implementation), there is no platform log-dir resolver at all, and nothing routes the global-hotkey backend through the trait — so the Wayland gap (FR57) has no single place to detect and degrade gracefully. Three platform acceptance tests are `#[ignore]`.

**Approach:** Implement `config_dir()`, `log_dir()`, and `register_hotkey()` for all three OS targets via the trait. Make `services::config::config_dir()` delegate to `platform::current().config_dir()` so config-path resolution has one implementation. Implement `register_hotkey()` as a Wayland-aware backend selector (X11/XWayland/macOS/Windows → `Standard`; pure-Wayland-without-XWayland → `Err`, since native portal support is the post-v1 fast-follow per the PRD), and have `lib.rs` consult it so a compositor with no working backend is detected and logged (graceful degradation; window stays summonable via tray). Un-ignore the two now-satisfiable platform tests.

## Boundaries & Constraints

**Always:**
- Path namespaces match the existing convention (`services::config::config_dir`): `notey` on Linux/Windows, `com.notey.app` on macOS.
- `config_dir()` = `dirs::config_dir()/<namespace>` (`$XDG_CONFIG_HOME` / `%APPDATA%` / `~/Library/Application Support`). `log_dir()` per-OS standard: Linux `dirs::state_dir()/notey/logs` (`$XDG_STATE_HOME`), macOS `~/Library/Logs/com.notey.app`, Windows `dirs::data_local_dir()/notey/logs` (`%LOCALAPPDATA%`). Both are pure resolvers — they do NOT create the directory — and return `Err(NoteyError::Config(..))` when the base dir cannot be determined.
- `services::config::config_dir()` keeps its signature and returns the same path it returns today; it now obtains that path from `platform::current().config_dir()`. The byte-for-byte result must be unchanged.
- `register_hotkey(accelerator)` returns `Ok(HotkeyBackend::Standard)` on macOS, Windows, and any Linux session where the X11 path is usable (X11 native, or Wayland with XWayland — i.e. `DISPLAY` is set). It returns `Err(NoteyError::Config(..))` only on a pure-Wayland session with no XWayland (`XDG_SESSION_TYPE=wayland`/`WAYLAND_DISPLAY` set AND `DISPLAY` unset). It never panics and never requires a Tauri `AppHandle`.
- `lib.rs` consults `platform::current().register_hotkey(&shortcut_str)` in the desktop global-shortcut setup: on `Ok(_)` it performs the existing plugin registration exactly as today; on `Err(e)` it logs a clear FR57 degradation warning (global shortcut unavailable on this compositor; summon via tray) and skips the initial `register()` call. The plugin builder/handler install stays unconditional so re-registration via `update_config` still works.
- All path/dir resolution uses the already-present `dirs` crate (v5) — no new dependency.

**Ask First:**
- Adding a real `ashpd` D-Bus GlobalShortcuts portal registration (the native Wayland path) — that is the post-v1 fast-follow tracked in DW-96, gated on Tauri global-hotkey PR #162.
- Implementing the `autostart_*` trait methods or any user-facing (toast/dialog) notification UI — tracked in DW-97 / DW-99.
- Introducing a logging plugin or any consumer of `log_dir()` — this story only adds the resolver to satisfy the trait contract.

**Never:**
- Do NOT change `services::config::config_dir`'s public signature, the `notey`/`com.notey.app` namespaces, or any persisted path. No data/config migration.
- Do NOT implement the `autostart_*` methods (leave them as `todo!()` relabeled to DW-97) or the `accessibility_*`/`data_dir`/`socket_path` methods (already done in Stories 8.2/8.5).
- Do NOT change the existing fail-soft behavior of hotkey registration for the `Standard` backend, or touch the conflict-detection / `update_config` re-registration path.
- Do NOT add new IPC commands, frontend changes, new E2E journeys, or new env-override seams.
- Do NOT modify the CI workflow / release pipeline (AC4 release artifacts → DW-98).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Linux config dir | unset env | `config_dir()` = `dirs::config_dir()/notey` | dirs None → `NoteyError::Config` |
| macOS config dir | unset env | `config_dir()` = `~/Library/Application Support/com.notey.app` | dirs None → `NoteyError::Config` |
| Windows config dir | unset env | `config_dir()` = `%APPDATA%\notey` | dirs None → `NoteyError::Config` |
| Linux log dir | unset env | `log_dir()` = `dirs::state_dir()/notey/logs` | dirs None → `NoteyError::Config` |
| macOS log dir | unset env | `log_dir()` = `~/Library/Logs/com.notey.app` | home None → `NoteyError::Config` |
| Windows log dir | unset env | `log_dir()` = `%LOCALAPPDATA%\notey\logs` | dirs None → `NoteyError::Config` |
| Hotkey on macOS/Windows | any | `register_hotkey()` = `Ok(Standard)` | N/A |
| Hotkey on X11 / XWayland | `DISPLAY` set | `register_hotkey()` = `Ok(Standard)` | N/A |
| Hotkey headless (cargo test) | no `DISPLAY`, no wayland vars | `register_hotkey()` = `Ok(Standard)` | N/A |
| Hotkey pure Wayland | wayland session, `DISPLAY` unset | `register_hotkey()` = `Err(Config)` | caller logs FR57 warning, skips register |
| config single-source | any | `platform::current().config_dir()` == `services::config::config_dir()` | both propagate the same `Err` |

</frozen-after-approval>

## Code Map

- `src-tauri/src/platform/mod.rs` -- add `pub(crate) fn resolve_config_dir(namespace: &str) -> Result<PathBuf, NoteyError>` (mirrors `resolve_data_dir`, no env seam). Update the module-doc green-phase note: 8.6 implements `config_dir`/`log_dir`/`register_hotkey`; `autostart_*` deferred to DW-97; native Wayland portal deferred to DW-96.
- `src-tauri/src/platform/linux.rs` -- `config_dir()` → `super::resolve_config_dir("notey")`; `log_dir()` → `dirs::state_dir()/notey/logs` (Err if None); `register_hotkey()` → Wayland-aware backend selection (see Design Notes). Drop the three `todo!()`; relabel the `autostart_*` `todo!()` to DW-97.
- `src-tauri/src/platform/macos.rs` -- `config_dir()` → `super::resolve_config_dir("com.notey.app")`; `log_dir()` → `dirs::home_dir()/Library/Logs/com.notey.app` (Err if None); `register_hotkey()` → `Ok(Standard)`. Drop the three `todo!()`; relabel `autostart_*` to DW-97.
- `src-tauri/src/platform/windows.rs` -- `config_dir()` → `super::resolve_config_dir("notey")`; `log_dir()` → `dirs::data_local_dir()/notey/logs` (Err if None); `register_hotkey()` → `Ok(Standard)`. Drop the three `todo!()`; relabel `autostart_*` to DW-97.
- `src-tauri/src/services/config.rs` -- `config_dir()` body becomes `crate::platform::current().config_dir()`; keep the doc comment and signature. Remove the now-dead `dirs`/`cfg` namespace logic and any import left unused.
- `src-tauri/src/lib.rs` -- in the `#[cfg(desktop)]` global-shortcut block, call `platform::current().register_hotkey(&shortcut_str)`; on `Ok(_)` keep the existing register flow, on `Err(e)` log the FR57 warning and skip the initial `register()`. Plugin builder install stays unconditional.
- `src-tauri/tests/platform_tests.rs` -- un-ignore `current_resolves_to_target_platform` and `linux_hotkey_uses_standard_backend_on_x11`; keep `linux_hotkey_falls_back_to_wayland_portal` ignored. Add `config_dir_is_user_scoped_and_standard`, `log_dir_is_user_scoped_and_standard`, a non-Linux `hotkey_uses_standard_backend`, and `config_dir_matches_services_config` (single-source invariant).

## Tasks & Acceptance

**Execution:**

- [x] `src-tauri/src/platform/mod.rs` -- add `resolve_config_dir`; update module-doc note.
- [x] `src-tauri/src/platform/{linux,macos,windows}.rs` -- implement `config_dir()`, `log_dir()`, `register_hotkey()`; remove their `todo!()`; relabel `autostart_*` stubs to DW-97.
- [x] `src-tauri/src/services/config.rs` -- delegate `config_dir()` to `platform::current().config_dir()`; drop dead code/imports.
- [x] `src-tauri/src/lib.rs` -- consult `register_hotkey()` in the desktop shortcut setup; log FR57 warning + skip `register()` on `Err`.
- [x] `src-tauri/tests/platform_tests.rs` -- un-ignore the two satisfiable tests; add the config/log/hotkey/single-source tests (hermetic, `#[cfg(target_os)]`-gated where the expected path differs).
- [x] Grep for other readers of the trait stubs / `services::config::config_dir` to confirm the single-source-of-truth holds and nothing still depends on the removed code.

**Acceptance Criteria:**

- Given the `Platform` trait, when the app runs on each target OS, then `config_dir()`, `log_dir()`, `register_hotkey()`, `data_dir()`, and `socket_path()` all resolve without any `todo!()`/panic, and `#[cfg(target_os)]` implementations exist in `platform/{linux,macos,windows}.rs`. (AC1)
- Given config-path resolution, when `services::config::config_dir()` and `platform::current().config_dir()` are compared, then they return the identical path (single source of truth), under the per-user platform-standard config dir with no system-wide shared directory. (FR58)
- Given a Linux session where the X11 path is usable (X11 native or XWayland present, including headless `cargo test`), when `register_hotkey()` is called, then it returns `Ok(HotkeyBackend::Standard)`; given a pure-Wayland session with no XWayland, then it returns `Err` and `lib.rs` logs that the global shortcut is unavailable on the compositor while leaving the window summonable via the tray. (FR56/FR57)
- Given the existing `Standard` backend path, when the app registers the global shortcut at startup, then behavior is unchanged from before this story (fail-soft on conflict; re-registration via `update_config` still works).
- Given the build, when the suites run, then `cargo test` (incl. the un-ignored `platform_tests` cases and the new config/log/hotkey/single-source tests), `cargo clippy --all-targets -- -D warnings`, `vitest`, `tsc`, and `npm run build` all pass.

## Design Notes

**Single source of truth.** `services::config::config_dir()` and the trait `config_dir()` currently duplicate `dirs::config_dir() + namespace`. Collapsing the live function onto the trait (rather than vice-versa) keeps the trait authoritative — the epic's stated design — without changing any caller's signature. The 8.5 spec explicitly flagged this as "Story 8.6's mechanism."

**Linux hotkey backend selection (no AppHandle needed).** The trait method only *selects/validates* the backend; the actual Tauri plugin registration stays in `lib.rs` where the `AppHandle` lives. Selection rule:
```rust
// linux.rs register_hotkey
let wayland = std::env::var_os("WAYLAND_DISPLAY").is_some()
    || std::env::var("XDG_SESSION_TYPE").map(|t| t == "wayland").unwrap_or(false);
let xwayland = std::env::var_os("DISPLAY").is_some();
if wayland && !xwayland {
    return Err(NoteyError::Config(
        "global shortcut unavailable: Wayland compositor without XWayland \
         (native portal support is a fast-follow — DW-96)".into(),
    ));
}
Ok(HotkeyBackend::Standard)
```
This makes the headless CI `cargo test` (no env vars set) return `Standard`, satisfying `linux_hotkey_uses_standard_backend_on_x11`, while honoring the v1 contract that XWayland is the baseline fallback. The `linux_hotkey_falls_back_to_wayland_portal` test stays `#[ignore]` (it expects `Ok(WaylandPortal)`, which only the DW-96 portal work will deliver).

**Why autostart stays a stub.** The `autostart_*` trait methods take `&self` with no `AppHandle`, but `tauri-plugin-autostart` (the mechanism that already satisfies FR41–43 in Story 8.4) needs the handle. Routing through the trait would mean hand-rolling plist/.desktop/registry logic — a no-gain, high-risk refactor. Tracked in DW-97; the `todo!()` bodies are relabeled, not removed (AC1 requires the trait to *define* them, and nothing calls them).

## Verification

**Commands:**

- `cd src-tauri && cargo test` -- expected: all suites green, including the un-ignored `platform_tests` cases (`current_resolves_to_target_platform`, `linux_hotkey_uses_standard_backend_on_x11`) and the new config/log/hotkey/single-source tests; `linux_hotkey_falls_back_to_wayland_portal` stays ignored.
- `cd src-tauri && cargo clippy --all-targets -- -D warnings` -- expected: clean (no dead-import/dead-code warnings after the `services::config` and `lib.rs` edits).
- `npm run build` -- expected: bindings regenerate unchanged (no IPC surface change); `tsc` + vite build succeed.

**Manual checks (if no CLI):**

- Real pure-Wayland-without-XWayland degradation and native portal behavior are platform QA (RISK-001 / DW-96); the automated tests pin only the per-OS path derivation and the X11/headless `Standard` backend selection.

### Review Findings

- [x] [Review][Patch] Platform docs still contradicted the frozen Wayland contract [src-tauri/src/platform/mod.rs:1] — patched: removed stale red-phase and native-portal-now guidance, and updated the trait docs to describe Standard vs pure-Wayland-unavailable behavior with DW-96 deferred.
- [x] [Review][Patch] Linux hotkey test was not hermetic for X11/XWayland [src-tauri/tests/platform_tests.rs:203] — patched: serialized hotkey env mutation and made the X11 test set `DISPLAY`, clear `WAYLAND_DISPLAY`, and set `XDG_SESSION_TYPE=x11`.
- [x] [Review][Patch] Empty `DISPLAY` counted as XWayland support [src-tauri/src/platform/linux.rs:66] — patched: display env vars are now treated as present only when non-empty.
- [x] [Review][Patch] Pure-Wayland unavailable path lacked an active regression test [src-tauri/tests/platform_tests.rs:210] — patched: added an active pure-Wayland-with-empty-`DISPLAY` test that expects a graceful `Config` error.

#### Review Ledger (2026-06-17)

- patch: Platform docs still contradicted the frozen Wayland contract [src-tauri/src/platform/mod.rs:1] — stale red-phase/portal-now docs contradicted the approved DW-96 deferral; patched.
- dismiss: Startup-only backend gate leaves rebind path inconsistent [src-tauri/src/commands/config.rs:109] — approved spec explicitly preserves `update_config` re-registration behavior and forbids touching that path in this story; registration failure remains fail-soft before persistence.
- dismiss: User notification is only stderr logging [src-tauri/src/lib.rs:309] — approved story scope requires a clear FR57 warning log and defers user-facing UI to DW-99.
- patch: Empty `DISPLAY` incorrectly counted as XWayland support [src-tauri/src/platform/linux.rs:66] — empty env vars are a real edge case; patched.
- dismiss: Autostart trait methods still panic in production paths [src-tauri/src/platform/linux.rs:82] — frozen scope explicitly leaves `autostart_*` as relabeled DW-97 stubs and current app autostart is handled by `tauri-plugin-autostart`.
- patch: Linux hotkey test was not hermetic for the X11/XWayland scenario [src-tauri/tests/platform_tests.rs:203] — ambient Wayland/X11 env could flip the result; patched.
- patch: Pure-Wayland unavailable behavior lacked an active regression test [src-tauri/tests/platform_tests.rs:210] — degradation behavior is now covered by an active Linux test.
