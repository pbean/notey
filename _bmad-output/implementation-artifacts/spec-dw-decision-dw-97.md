---
title: "Route auto-start through the Platform trait (DW-97)"
type: "refactor"
created: "2026-06-17"
status: "done"
context: ["{project-root}/_bmad-output/project-context.md"]
baseline_commit: "135168ccd75f702e45cd68b0b37779d712854282"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The `Platform` trait declares `autostart_enable/disable/is_enabled` but every implementation is `todo!()` (DW-97), so auto-start is NOT actually routed through the trait. The real mechanism — `tauri-plugin-autostart` via `app.autolaunch()` — is reached directly from `commands/autostart.rs` and the `lib.rs` startup reconcile, because the `&self`-only trait signature cannot reach the Tauri `AppHandle` the plugin needs. The trait therefore advertises a contract it does not honor.

**Approach:** The human chose to redesign the trait and route through it. Add `app: &tauri::AppHandle` to the three `autostart_*` trait methods, implement them on each platform by delegating to a single shared `app.autolaunch()` resolver (mirroring the existing `resolve_data_dir`/`resolve_config_dir` pattern so the plugin logic is centralized, never reimplemented per-OS), then switch `commands/autostart.rs` and the `lib.rs` reconcile block to call through `crate::platform::current()` instead of touching `autolaunch()` directly. No behavioral change to the user-facing auto-start feature (FR41–FR43 stay satisfied).

## Boundaries & Constraints

**Always:**
- Keep the `Platform` trait object-safe — it is returned as `Box<dyn Platform>` from `current()`. A `app: &tauri::AppHandle` parameter is object-safe; preserve that.
- Centralize the `autolaunch()` delegation in ONE place (shared `pub(crate)` helpers in `platform/mod.rs`) so all three per-OS impls are thin delegates — do NOT triplicate plugin calls.
- Preserve `set_autostart`'s existing lock discipline exactly: hold the `Mutex<AppConfig>` across the OS change + persist, and keep the rollback-on-save-failure path. Only the calls that today hit `app.autolaunch()` change to trait calls.
- Preserve the `#[cfg(desktop)]` / `#[cfg(not(desktop))]` structure in `commands/autostart.rs` (the `not(desktop)` arms still return `Ok(false)` / persist-only) — route only the existing desktop arms through the trait.
- Keep error messages and `NoteyError` variants identical to today's wording (`Failed to enable auto-start: {e}`, `Failed to disable auto-start: {e}`, `Failed to query auto-start state: {e}`).
- The persisted `[general] auto_start` preference remains the single source of truth; OS registration is reconciled to it. Unchanged.
- Update rustdoc that currently says `autostart_*` is "deferred (DW-97)" / `todo!` across `platform/mod.rs`, `linux.rs`, `macos.rs`, `windows.rs` to describe the implemented delegation.

**Ask First:**
- Any change to the `set_autostart`/`get_autostart` command signatures or the generated TS bindings (`src/generated/bindings.ts`) — these must NOT change; the redesign is internal to the Rust trait layer.

**Never:**
- Do NOT hand-reimplement plist / `.desktop` / registry launch-agent logic — delegate entirely to `tauri-plugin-autostart`.
- Do NOT change the user-facing behavior, the config schema, the command names, or the IPC surface.
- Do NOT introduce a new error variant or a new dependency.
- Do NOT remove the `tauri-plugin-autostart` plugin registration in `lib.rs`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| -------- | ------------- | -------------------------- | -------------- |
| Enable via trait | `autostart_enable(&app)`, plugin succeeds | OS launch agent registered; `Ok(())` | N/A |
| Disable via trait | `autostart_disable(&app)`, plugin succeeds | OS launch agent removed; `Ok(())` | N/A |
| Query via trait | `autostart_is_enabled(&app)` | `Ok(true/false)` matching live OS registration | N/A |
| Plugin error on enable/disable | `autolaunch()` op returns `Err(e)` | propagate as `NoteyError::Config("Failed to {enable/disable} auto-start: {e}")` | mapped error |
| Plugin error on query | `is_enabled()` returns `Err(e)` | `NoteyError::Config("Failed to query auto-start state: {e}")` | mapped error |
| `set_autostart` save fails after OS change | config `save` returns `Err` | roll OS registration back to prior state via trait, then return the save error | rollback + propagate |

</frozen-after-approval>

## Code Map

- `src-tauri/src/platform/mod.rs` -- `Platform` trait def (3 `autostart_*` signatures gain `&tauri::AppHandle`); add shared `pub(crate)` delegation helpers next to `resolve_data_dir`; update module-header rustdoc.
- `src-tauri/src/platform/linux.rs` -- replace 3 `todo!()` bodies with delegates to the shared helpers; update header.
- `src-tauri/src/platform/macos.rs` -- same.
- `src-tauri/src/platform/windows.rs` -- same.
- `src-tauri/src/commands/autostart.rs` -- `set_autostart`/`get_autostart` desktop arms call `crate::platform::current()` instead of `app.autolaunch()` directly.
- `src-tauri/src/lib.rs` -- startup reconcile block (~L228–250) calls the trait via `app.handle()` instead of `app.autolaunch()` directly.
- `src-tauri/tests/autostart_tests.rs` -- persistence-contract tests; unchanged (plugin delegation is QA-verified, not unit-testable without a Tauri runtime). Confirm still green.

## Tasks & Acceptance

**Execution:**

- [x] `src-tauri/src/platform/mod.rs` -- Change the three trait methods to `fn autostart_enable(&self, app: &tauri::AppHandle) -> Result<(), NoteyError>`, `autostart_disable(&self, app: &tauri::AppHandle) -> Result<(), NoteyError>`, `autostart_is_enabled(&self, app: &tauri::AppHandle) -> Result<bool, NoteyError>`. Add `pub(crate)` free fns (e.g. `autostart_enable`, `autostart_disable`, `autostart_is_enabled`) that `use tauri_plugin_autostart::ManagerExt;` and call `app.autolaunch().enable()/.disable()/.is_enabled()`, mapping `Err` to `NoteyError::Config` with the exact wording above. Rewrite the module-header rustdoc so DW-97/`todo!` language is replaced by "implemented; routes through the trait." -- single delegation point + honest trait contract.
- [x] `src-tauri/src/platform/{linux,macos,windows}.rs` -- Replace each `todo!("DW-97: …")` body with a thin delegate (`super::autostart_enable(app)` etc.) and the new signature; rewrite each file-header comment to drop "deferred (DW-97)". -- per-OS impls honor the trait without duplicating plugin logic.
- [x] `src-tauri/src/commands/autostart.rs` -- In `set_autostart`, inside the existing `#[cfg(desktop)]` block, obtain `let platform = crate::platform::current();` and replace the `manager.is_enabled()` / `manager.enable()` / `manager.disable()` calls (including the rollback path) with `platform.autostart_is_enabled(&app)?` / `platform.autostart_enable(&app)` / `platform.autostart_disable(&app)`; drop the now-unused `use tauri_plugin_autostart::ManagerExt;`. In `get_autostart`, replace the `#[cfg(desktop)]` arm body with `crate::platform::current().autostart_is_enabled(&app)`. Keep all `#[cfg(not(desktop))]` arms, the lock discipline, and the error mapping unchanged. -- route commands through the trait.
- [x] `src-tauri/src/lib.rs` -- In the `#[cfg(desktop)]` auto-start reconcile block, replace `app.autolaunch()` usage with `let platform = crate::platform::current();` and `platform.autostart_is_enabled(app.handle())` / `.autostart_enable(app.handle())` / `.autostart_disable(app.handle())`; drop the local `use tauri_plugin_autostart::ManagerExt;`. Preserve the best-effort, non-fatal `eprintln!` warnings and the `desired`-vs-`active` comparison logic. -- the trait becomes the single source of truth for auto-start side effects.

**Acceptance Criteria:**

- Given the redesigned trait, when `cargo build` and `cargo clippy` run, then they succeed with no warnings and no remaining `todo!("DW-97…")` in the platform module.
- Given `crate::platform::current()`, when any caller needs to enable/disable/query auto-start, then it goes through `autostart_{enable,disable,is_enabled}(&app)` and NOT a direct `app.autolaunch()` call (grep for `.autolaunch()` call sites — excluding doc comments — returns nothing in `src/commands` and `src/lib.rs`; the only `.autolaunch()` calls live in `platform/mod.rs`).
- Given the `set_autostart` command, when a config save fails after the OS registration changed, then the OS registration is rolled back to its prior state through the trait before the error is returned (existing rollback contract preserved).
- Given the generated bindings, when the trait redesign is complete, then `src/generated/bindings.ts` and the `set_autostart`/`get_autostart` command signatures are byte-for-byte unchanged.
- Given `cargo test --test autostart_tests` and `cargo test --test platform_tests`, when run, then all pass.

## Design Notes

The shared-helper pattern already exists in `platform/mod.rs` (`resolve_data_dir`, `resolve_config_dir`, `resolve_unix_socket`). Auto-start delegation is platform-agnostic — the plugin handles plist/.desktop/registry internally — so a single shared helper per operation keeps all three OS impls one-liners and eliminates the cross-platform-divergence risk the ledger flagged:

```rust
// platform/mod.rs
pub(crate) fn autostart_enable(app: &tauri::AppHandle) -> Result<(), NoteyError> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch()
        .enable()
        .map_err(|e| NoteyError::Config(format!("Failed to enable auto-start: {e}")))
}
```

```rust
// platform/linux.rs (macos.rs, windows.rs identical)
fn autostart_enable(&self, app: &tauri::AppHandle) -> Result<(), NoteyError> {
    super::autostart_enable(app)
}
```

In `lib.rs` the reconcile runs in `setup` where `app` is `&mut tauri::App`; pass `app.handle()` (an `&AppHandle`) to the trait methods.

The autolaunch delegation cannot be unit-tested without a live Tauri runtime, so test coverage stays at the persistence contract in `autostart_tests.rs` (the established boundary — that file documents that launch-agent behavior is QA-verified).

## Verification

**Commands:**

- `cd src-tauri && cargo build` -- expected: compiles clean.
- `cd src-tauri && cargo clippy --all-targets -- -D warnings` -- expected: no warnings; no `todo!` in platform module.
- `cd src-tauri && cargo test --test autostart_tests --test platform_tests` -- expected: all pass.
- `cd src-tauri && grep -rn '\.autolaunch()' src/commands src/lib.rs | grep -vE ':[0-9]+:\s*//'` -- expected: no matches (no call sites; only doc comments may mention it).
- `git diff --stat src/generated/bindings.ts` -- expected: no change.

## Review Findings

#### Review Ledger (2026-06-17)

- dismiss: Unconditional autostart helper may break non-desktop builds [src-tauri/src/platform/mod.rs] — false positive: `tauri-plugin-autostart::ManagerExt` is available in the installed crate, this desktop Tauri app already registers the autostart plugin unconditionally in `lib.rs`, and the required desktop cfg command/reconcile arms still guard runtime use.
- dismiss: Public trait signature change can break undisclosed implementors/callers [src-tauri/src/platform/mod.rs] — expected spec-driven API redesign: the frozen intent explicitly requires adding `app: &tauri::AppHandle`; repository search found only the three target platform implementors and updated call sites, and clippy/tests compile cleanly.
- dismiss: Platform abstraction now depends directly on Tauri runtime state [src-tauri/src/platform/mod.rs] — intentional accepted design tradeoff: the frozen spec chose the `AppHandle` parameter specifically because `tauri-plugin-autostart` owns the launch-agent mechanism; Acceptance Auditor found no violation.
