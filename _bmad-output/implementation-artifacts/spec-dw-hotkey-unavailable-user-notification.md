---
title: "Hotkey-unavailable user notification (FR57 / DW-99)"
type: "feature"
created: "2026-06-17"
status: "done"
context: ["{project-root}/_bmad-output/project-context.md"]
baseline_commit: "c8fcb550dc81527ad8416a01aed037f4a11d560d"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When no global-shortcut backend is available on the user's compositor (pure Wayland with no XWayland, per Story 8.6 / FR57 / AC2), the app silently falls back to tray-only summoning. The only signal is an `eprintln!` in `src-tauri/src/lib.rs` (the `Err` arm of `register_hotkey`) that the user never sees, so they are left with an app that does not respond to its hotkey and no explanation.

**Approach:** Record the hotkey availability detected at startup in Tauri-managed state, expose it through a thin read-only command, and have the frontend query it on launch and raise a toast (via the existing `src/features/toast` surface) when the hotkey backend is unavailable. The toast is persistent and click-dismissable so it survives until the user actually opens the (startup-hidden) window and acknowledges it.

## Boundaries & Constraints

**Always:**

- Reuse the existing toast system (`useToastStore` / `Toaster`) — no new notification infrastructure.
- Hotkey detection stays exactly where Story 8.6 put it (the `register_hotkey` match in `lib.rs`); this work only records its outcome and surfaces it. Keep the existing `eprintln!` notice.
- All IPC via tauri-specta generated bindings (`commands.getHotkeyStatus`) — never raw `invoke`. Backend IPC struct uses `#[serde(rename_all = "camelCase")]`.
- Notification is best-effort and non-blocking: any failure querying status or showing the toast must be logged and must not affect startup or window summoning.
- The toast must remain visible long enough to be seen given the window is hidden at startup — use a persistent toast, not a short auto-dismiss.

**Never:**

- Do not emit the status as a `setup`-time Tauri event consumed by a frontend listener: the window is hidden and the webview listener is not yet attached when `setup` runs, so such an event is dropped (see Design Notes). Pull-on-startup is the reliable mechanism.
- Do not auto-show or focus the main window on hotkey-unavailability — surfacing the window proactively is a separate product decision, out of scope here.
- Do not change the hotkey detection logic, the registration fallback, or tray behavior.
- Do not surface the raw technical error string in the toast (log it to the console instead).

## I/O & Edge-Case Matrix

| Scenario                                    | Input / State                                         | Expected Output / Behavior                                                                                                        | Error Handling              |
| ------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Backend available                           | `register_hotkey` returns `Ok` (or non-desktop build) | Managed `HotkeyStatus { available: true, reason: null }`                                                                          | N/A                         |
| Backend unavailable                         | `register_hotkey` returns `Err(e)`                    | Managed `HotkeyStatus { available: false, reason: e.to_string() }`; existing `eprintln!` still logged                             | N/A                         |
| Frontend startup, available                 | `getHotkeyStatus()` → `{ available: true }`           | No toast shown                                                                                                                    | N/A                         |
| Frontend startup, unavailable               | `getHotkeyStatus()` → `{ available: false, reason }`  | Persistent toast: "Global hotkey unavailable on this system — open Notey from the tray icon."; `reason` logged via `console.warn` | N/A                         |
| Duplicate startup invoke (React StrictMode) | `startHotkeyUnavailableNotice()` called twice         | Status queried once, at most one toast                                                                                            | Idempotent via module guard |
| `getHotkeyStatus()` rejects                 | command throws                                        | No toast; error logged                                                                                                            | `console.error`, swallowed  |
| Toast clicked                               | user clicks any toast card                            | Toast dismissed immediately                                                                                                       | Idempotent (no-op if gone)  |

</frozen-after-approval>

## Code Map

- `src-tauri/src/models/hotkey.rs` -- NEW: `HotkeyStatus { available: bool, reason: Option<String> }` (serde camelCase + specta `Type`) with `available()` / `unavailable(reason)` constructors.
- `src-tauri/src/models/mod.rs` -- add `pub mod hotkey;`.
- `src-tauri/src/commands/hotkey.rs` -- NEW: thin sync command `get_hotkey_status(state) -> HotkeyStatus` reading managed state; recovers a poisoned lock by cloning the inner value.
- `src-tauri/src/commands/mod.rs` -- add `pub mod hotkey;`.
- `src-tauri/src/lib.rs` -- register `commands::hotkey::get_hotkey_status` in `collect_commands!`; manage `Mutex<HotkeyStatus>` (default available) before the `#[cfg(desktop)]` global-shortcut block; in the `register_hotkey` match, set it to `available()` on `Ok` and `unavailable(e.to_string())` on `Err` (alongside the existing `eprintln!`).
- `src-tauri/permissions/autogenerated/get_hotkey_status.toml` -- NEW if `cargo build` does not generate it (per project-context Tauri-v2 known issue).
- `src-tauri/capabilities/default.json` -- add `"allow-get-hotkey-status"`.
- `src-tauri/tests/acl_tests.rs` -- add `"allow-get-hotkey-status"` to `EXPECTED_COMMANDS`.
- `src/generated/bindings.ts` -- regenerated by the build/`export_bindings` test (NOT hand-edited); will expose `commands.getHotkeyStatus` + `HotkeyStatus` type.
- `src/features/hotkey/unavailableNotice.ts` -- NEW: `startHotkeyUnavailableNotice()` — queries `getHotkeyStatus()`, raises the persistent toast when unavailable; module-guarded for idempotency.
- `src/features/hotkey/unavailableNotice.test.ts` -- NEW: unit tests for the matrix.
- `src/features/toast/components/Toaster.tsx` -- add click-to-dismiss on each toast card so the persistent notice can be cleared.
- `src/features/toast/components/Toaster.test.tsx` -- NEW: cover click-to-dismiss.
- `src/App.tsx` -- call `void startHotkeyUnavailableNotice()` in the startup effect (best-effort, errors logged, non-blocking).

## Tasks & Acceptance

**Execution:**

- [x] `src-tauri/src/models/hotkey.rs` -- define `HotkeyStatus` (camelCase serde, specta `Type`, rustdoc) with `available()`/`unavailable(String)` constructors -- typed status carried across the IPC boundary.
- [x] `src-tauri/src/models/mod.rs` -- add `pub mod hotkey;` -- expose the new model.
- [x] `src-tauri/src/commands/hotkey.rs` -- thin sync `#[tauri::command] #[specta::specta] get_hotkey_status(State<Mutex<HotkeyStatus>>) -> HotkeyStatus`; clone inner value, recovering a poisoned lock -- read-only IPC accessor.
- [x] `src-tauri/src/commands/mod.rs` -- add `pub mod hotkey;` -- register the command module.
- [x] `src-tauri/src/lib.rs` -- add `commands::hotkey::get_hotkey_status` to `collect_commands!`; `app.manage(Mutex::new(HotkeyStatus::available()))` before the desktop shortcut block; in the `register_hotkey` match update the managed status (`available()` on `Ok`, `unavailable(e.to_string())` on `Err`) while keeping the existing `eprintln!` -- records detection outcome for the frontend to pull.
- [x] `src-tauri/capabilities/default.json` + `src-tauri/permissions/autogenerated/get_hotkey_status.toml` -- add `"allow-get-hotkey-status"` and the perm TOML (create manually if the build skips it) -- ACL grant for the new command.
- [x] `src-tauri/tests/acl_tests.rs` -- add `"allow-get-hotkey-status"` to `EXPECTED_COMMANDS` -- keep the ACL coverage test green.
- [x] `src/features/hotkey/unavailableNotice.ts` -- `startHotkeyUnavailableNotice()`: query `commands.getHotkeyStatus()`; if `!available`, `useToastStore.getState().addToast(message, 0)` (persistent) and `console.warn` the reason; idempotent via module guard; swallow+log errors -- frontend surface wiring.
- [x] `src/features/toast/components/Toaster.tsx` -- add `onClick={() => dismissToast(toast.id)}` (cursor pointer, `title="Dismiss"`) to each toast card -- lets the user clear the persistent notice.
- [x] `src/App.tsx` -- invoke `void startHotkeyUnavailableNotice()` in the startup effect, non-blocking -- triggers the pull on launch.
- [x] `src/features/hotkey/unavailableNotice.test.ts` + `src/features/toast/components/Toaster.test.tsx` -- unit-test the I/O & Edge-Case Matrix (unavailable→persistent toast + warn, available→none, idempotency, command rejection, click-dismiss) -- and a Rust `#[cfg(test)]` in `models/hotkey.rs` asserting camelCase serialization (`available`, `reason`).

### Review Findings

- [x] [Review][Patch] `Ok` arm should record `HotkeyStatus::available()` [src-tauri/src/lib.rs:300] -- fixed in review: the successful backend-probe arm now explicitly writes `HotkeyStatus::available()` to managed state, matching the frozen Code Map requirement instead of relying only on the default.
- [x] [Review][Patch] Toast click-dismiss control needs keyboard accessibility [src/features/toast/components/Toaster.tsx:37] -- fixed in review: toast cards are now semantic buttons with an accessible dismiss label, preserving click dismissal while allowing keyboard and assistive-technology dismissal.

#### Review Ledger (2026-06-17)

- patch: `Ok` arm should record `HotkeyStatus::available()` [src-tauri/src/lib.rs:300] -- fixed; Acceptance Auditor correctly found the frozen spec required an explicit available write in the `Ok` arm.
- patch: Toast click-dismiss control needs keyboard accessibility [src/features/toast/components/Toaster.tsx:37] -- fixed; Edge Case Hunter correctly found the persistent dismiss affordance was mouse-only.
- dismiss: Non-desktop builds default to hotkey available [src-tauri/src/lib.rs:257] -- specified behavior; the frozen I/O matrix says non-desktop builds produce `available: true`.
- dismiss: Registration failure after backend probe should mark status unavailable [src-tauri/src/lib.rs:305] -- out of scope; this status tracks backend availability per FR57, while shortcut conflicts remain existing logged/rebind behavior.
- dismiss: One-shot guard suppresses retry after `getHotkeyStatus()` rejection [src/features/hotkey/unavailableNotice.ts:33] -- specified behavior; the matrix requires rejection to log, swallow, and show no toast.
- dismiss: All toasts are now click-dismissable [src/features/toast/components/Toaster.tsx:40] -- specified behavior; the Code Map calls for click-to-dismiss on each toast card.
- dismiss: Missing visible close-button text [src/features/toast/components/Toaster.tsx:41] -- no product requirement for a separate close button; fixed accessibility through semantic button labeling.
- dismiss: Tray guidance may be wrong if tray is unavailable [src/features/hotkey/unavailableNotice.ts:10] -- out of scope; the approved message explicitly directs users to the tray icon.
- dismiss: Technical reason is only logged, not displayed [src/features/hotkey/unavailableNotice.ts:38] -- specified behavior; frozen constraints forbid surfacing the raw technical error in the toast.
- dismiss: Generated `getHotkeyStatus` binding is not wrapped with `typedError` [src/generated/bindings.ts:114] -- expected codegen for a command returning plain `HotkeyStatus` rather than `Result<T, NoteyError>`.
- dismiss: `HotkeyStatus` derives `Deserialize` unnecessarily [src-tauri/src/models/hotkey.rs:18] -- harmless consistency with other IPC models, not a behavioral risk.
- dismiss: Click-dismiss test relies on event bubbling [src/features/toast/components/Toaster.test.tsx:24] -- superseded by added semantic-button coverage.

**Acceptance Criteria:**

- Given a session where `register_hotkey` returns `Err`, when the app starts and the frontend queries `getHotkeyStatus`, then a persistent toast tells the user the hotkey is unavailable and to use the tray, and the technical reason is logged to the console.
- Given a session where the hotkey registers successfully, when the app starts, then no hotkey toast is shown.
- Given the startup effect runs twice (React StrictMode), when `startHotkeyUnavailableNotice` is invoked again, then at most one toast is shown.
- Given the persistent toast is visible, when the user clicks it, then it is dismissed.
- Given `getHotkeyStatus` is unavailable or rejects, when the notice runs, then startup and window summoning are unaffected and the error is logged.

## Design Notes

**Why pull, not a `setup`-time event.** The intent (DW-99) suggested emitting a typed Tauri event from the `Err` arm and adding a frontend listener. That is unreliable here: the `main` window is configured `visible: false` (`tauri.conf.json`), the webview loads asynchronously, and the `register_hotkey` match runs early in the synchronous `setup` hook — well before the React `useEffect` listener attaches. Tauri does not buffer events for not-yet-registered listeners, so the event would be dropped. Recording the outcome in managed state and letting the frontend pull it on startup is race-free and matches the codebase's existing startup-state pattern (e.g. `get_onboarding_state`). This is a deliberate deviation from the suggested mechanism, logged as a PREFERENCE.

**Persistent toast.** Because the window is hidden at startup, a normal 3s auto-dismiss toast would expire before the user ever opens the window. The notice is added persistently (`addToast(msg, 0)` — non-positive duration skips the auto-dismiss timer, per the existing store contract) and click-to-dismiss is added to the `Toaster` so the user can clear it after reading. The export-progress toast already relies on the persistent path, so this reuses an established store capability.

**Managing the status.** `app.manage(Mutex::new(HotkeyStatus::available()))` is done unconditionally so the command always has state (including non-desktop builds where the `#[cfg(desktop)]` shortcut block is compiled out). The desktop block updates the managed value through the lock, mirroring the existing `Mutex<Config>` pattern.

## Verification

**Commands:**

- `cd src-tauri && cargo test` -- expected: all pass, including `acl_tests` (new `allow-get-hotkey-status`) and the `HotkeyStatus` serde test.
- `cd src-tauri && cargo test export_bindings` -- expected: regenerates `src/generated/bindings.ts` with `commands.getHotkeyStatus` and the `HotkeyStatus` type.
- `cd src-tauri && cargo clippy --all-targets -- -D warnings` -- expected: clean.
- `npm run test` -- expected: new `unavailableNotice` and `Toaster` tests pass; existing toast/store tests unaffected.
- `npx tsc --noEmit && npx eslint src/features/hotkey src/features/toast src/App.tsx` -- expected: no type or lint errors.
