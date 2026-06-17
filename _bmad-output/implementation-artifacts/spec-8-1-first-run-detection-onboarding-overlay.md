---
title: "Story 8.1 — First-Run Detection & Onboarding Overlay"
type: "feature"
created: "2026-06-17"
status: "done"
baseline_commit: "d5a65b67397e98daa4a90fc1e2d3ca6020eed796"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-8-context.md"
  - "{project-root}/_bmad-output/project-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A brand-new user launches Notey to a blank editor with no indication of how to summon the app. The capture global-shortcut — the single thing a new user must learn — is invisible, and the codebase has only RED-PHASE stubs for onboarding (backend service with `todo!`, frontend store/api/component shells, and `#[ignore]`/`describe.skip` acceptance tests).

**Approach:** Implement the green phase of the first-run onboarding slice. Persist onboarding state (`complete`, `sessions_seen`) to `onboarding.toml` in the platform config dir; on first run, show the main window with a centered accessible overlay that teaches the configured capture shortcut as key caps; dismiss-and-persist-completion on Esc or hotkey press; and show a transient "Ctrl+P for commands" status-bar hint for the user's first 5 sessions. The overlay is the **complete visual shell** for the whole epic — it renders the Customize (8.3) and macOS-accessibility (8.2) states so those stories only wire their backends — but this story implements no macOS-permission detection and no hotkey capture/conflict/re-registration logic.

## Boundaries & Constraints

**Always:**
- Persist onboarding state atomically to `onboarding.toml` (temp-file + rename), sibling to `config.toml`, mirroring `services::config::save`. Missing/corrupt file → default state, never an error.
- First-run detection keys solely off `onboarding.complete == false`. Onboarding is shown once and never again once `complete` is set.
- All IPC via tauri-specta generated `commands.*` bindings — never raw `invoke()`. New commands need `#[serde(rename_all = "camelCase")]` boundary types, a permission TOML, a `capabilities/default.json` entry, and an `EXPECTED_COMMANDS` entry in `acl_tests.rs`.
- Tauri command handlers stay thin & synchronous; all logic lives in `services::onboarding`.
- The overlay must expose `data-testid="onboarding-overlay"` and `data-testid="hotkey-display"`, with `role="dialog"`, `aria-modal="true"`, `aria-label="Welcome to Notey"`, focus-trapped via the existing `useFocusTrap` hook.
- The command-hint gate is exactly `sessions_seen < COMMAND_HINT_SESSION_LIMIT` (=5); `sessions_seen` is the count of *prior* sessions (incremented once per launch AFTER the overlay reads it), so the hint shows for the first 5 launches.
- Zero network access; reuse the existing global-shortcut machinery (no reimplementation).

**Ask First:**
- Changing the frozen `OnboardingState` field names/shape, the `onboarding.toml` filename/location, or the `COMMAND_HINT_SESSION_LIMIT` value.
- Introducing any new runtime dependency.

**Never:**
- Do NOT implement Story 8.2 backend (macOS accessibility permission detection / "open System Settings" command) or Story 8.3 backend (hotkey capture parsing, conflict detection, persistence, live re-registration). Render their overlay states as inert shell only; wire the "System Settings" button and the customize-capture to documented `TODO(Story 8.2/8.3)` handlers.
- Do NOT add a new E2E test (P1-E2E-002 is owned by a later cross-platform pass; component/store/integration layers cover this story).
- Do NOT mutate `AppConfig` / `config.toml` for onboarding state — onboarding has its own file.
- No raw `app.emit` with stringly names — the hotkey-press event must be a typed `tauri_specta::Event`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| First run | no `onboarding.toml` | `load` → `{complete:false, sessions_seen:0}`; window shown with overlay | missing/corrupt file → default state, no error |
| Mark complete + reload | `mark_complete` then fresh `is_complete` | `true`; `onboarding.toml` exists on disk | atomic temp+rename write |
| Idempotent completion | `increment_session` then `mark_complete` twice | `complete==true`, `sessions_seen==1` (not reset) | N/A |
| Session counting | `increment_session` ×2, reload | returns `1` then `2`; persists across reload | N/A |
| Command-hint gate | `sessions_seen` 0..4 vs ≥5 | `should_show_command_hint` true for `<5`, false for `≥5` (permanently) | N/A |
| Dismiss (Esc or hotkey) | overlay visible | `dismiss()` persists `complete=true`, hides overlay, never reshown on re-show | `completeOnboarding` failure logged; overlay still hides |
| Already onboarded | `complete==true` at launch | overlay stays hidden (`isVisible=false`) | N/A |

</frozen-after-approval>

## Code Map

- `src-tauri/src/services/onboarding.rs` -- service: replace 5 `todo!` stubs (`load`, `is_complete`, `mark_complete`, `increment_session`, `should_show_command_hint`) with atomic TOML persistence; update the RED-PHASE module doc.
- `src-tauri/tests/onboarding_tests.rs` -- 5 `#[ignore]` integration tests encoding the service contract; remove the `#[ignore]` attributes to activate.
- `src-tauri/src/commands/onboarding.rs` -- NEW thin commands: `get_onboarding_state`, `complete_onboarding`, `increment_onboarding_session`, all over `State<ConfigDir>`.
- `src-tauri/src/commands/mod.rs` -- add `pub mod onboarding;`.
- `src-tauri/src/ipc/events.rs` -- add typed `HotkeyPressed` event (kebab `hotkey-pressed`), mirroring `NoteCreated`.
- `src-tauri/src/lib.rs` -- register the 3 commands + `HotkeyPressed` event in `specta_builder`; on first run (onboarding not complete) show+center+focus the main window; emit `HotkeyPressed` in the global-shortcut `Pressed` handler.
- `src-tauri/permissions/autogenerated/*.toml` + `src-tauri/capabilities/default.json` + `src-tauri/tests/acl_tests.rs` -- ACL wiring for the 3 new commands.
- `src/features/onboarding/api.ts` -- wire the 3 functions to generated bindings (replace `not implemented` throws).
- `src/features/onboarding/store.ts` -- already orchestrates correctly; no change expected beyond verification.
- `src/features/onboarding/components/OnboardingOverlay.tsx` -- implement the full overlay shell markup + Esc/hotkey-event dismissal + focus trap.
- `src/features/onboarding/bootstrap.ts` -- NEW: `initOnboarding()` — read config hotkey, `store.init(hotkey)`, then record the session once (StrictMode-guarded).
- `src/App.tsx` -- call `initOnboarding()` in the startup effect.
- `src/features/editor/components/CaptureWindow.tsx` -- render `<OnboardingOverlay />` in the relative container.
- `src/features/editor/components/StatusBar.tsx` -- render the "Ctrl+P for commands" hint in `var(--text-muted)` when `shouldShowCommandHint()`.
- `src/features/onboarding/store.test.ts` & `OnboardingOverlay.test.tsx` -- flip `describe.skip` → `describe` to activate.

## Tasks & Acceptance

**Execution:**

- [x] `src-tauri/src/services/onboarding.rs` -- Implement `load` (read+parse TOML, default on missing/corrupt), `is_complete`, `mark_complete` (set flag, atomic write, idempotent — preserve `sessions_seen`), `increment_session` (load, bump, persist, return new count), `should_show_command_hint` (`state.sessions_seen < COMMAND_HINT_SESSION_LIMIT`); refresh the module doc to drop the stub language. -- Backend persistence core.
- [x] `src-tauri/tests/onboarding_tests.rs` -- Remove all 5 `#[ignore]` attributes. -- Activate the red-phase contract.
- [x] `src-tauri/src/commands/onboarding.rs` + `commands/mod.rs` -- Add thin sync commands delegating to the service via `State<ConfigDir>`; return `OnboardingState` / `()` / `u32`. -- IPC surface.
- [x] `src-tauri/src/ipc/events.rs` -- Add `HotkeyPressed` typed event (empty/marker payload) + a name unit test (`hotkey-pressed`). -- Reliable hotkey-press signal to the webview.
- [x] `src-tauri/src/lib.rs` -- Register the 3 commands + `HotkeyPressed` in `specta_builder`; after managing `ConfigDir`, show the main window when `!onboarding::is_complete(...)`; emit `HotkeyPressed` from the shortcut `Pressed` handler. -- Wiring + first-run window show.
- [x] `src-tauri/permissions/autogenerated/{get_onboarding_state,complete_onboarding,increment_onboarding_session}.toml`, `capabilities/default.json`, `tests/acl_tests.rs` -- Add allow-permissions + `EXPECTED_COMMANDS` entries. -- Default-deny ACL.
- [x] `src/features/onboarding/api.ts` -- Replace throws with `commands.getOnboardingState()`, `commands.completeOnboarding()`, `commands.incrementOnboardingSession()` (unwrap `Result`). -- Frontend bridge.
- [x] `src/features/onboarding/components/OnboardingOverlay.tsx` -- Render centered `role="dialog"` overlay: "Your capture shortcut is" + key caps split from the hotkey string (`data-testid="hotkey-display"`) + "Press it now to try"; muted Customize control → `startCustomize()` showing "Press your preferred shortcut…"; macOS guidance block (shell) shown when `accessibilityNeeded`, with the permission text, a "System Settings" button (`TODO(8.2)`), and the skip-with-warning text; Esc keydown and `events.hotkeyPressed` listener → `dismiss()`; focus-trap via `useFocusTrap`. -- The overlay UI.
- [x] `src/features/onboarding/bootstrap.ts` + `src/App.tsx` -- `initOnboarding()`: `getConfig()` → hotkey → `store.init(hotkey)` → record session once (module-flag guarded). Call from the App startup effect. -- First-run wiring + session counting.
- [x] `src/features/editor/components/CaptureWindow.tsx` -- Mount `<OnboardingOverlay />`. -- Show the overlay.
- [x] `src/features/editor/components/StatusBar.tsx` -- Add the `var(--text-muted)` "Ctrl+P for commands" hint gated on `useOnboardingStore(s => s.shouldShowCommandHint())`. -- Progressive disclosure.
- [x] `src/features/onboarding/store.test.ts` & `OnboardingOverlay.test.tsx` -- Activate (`describe.skip` → `describe`). -- Lock the contract.

### Review Findings

- [x] [Review][Patch] Completion can be lost by a startup/dismiss race [src-tauri/src/services/onboarding.rs:76]
- [x] [Review][Patch] Dismiss failure leaves overlay visible [src/features/onboarding/store.ts:72]
- [x] [Review][Patch] Onboarding can show an empty shortcut instruction [src/features/onboarding/bootstrap.ts:28]
- [x] [Review][Patch] Retired command hint can flash before onboarding init resolves [src/features/editor/components/StatusBar.tsx:18]
- [x] [Review][Patch] Persisted onboarding TOML uses `sessionsSeen` instead of frozen `sessions_seen` [src-tauri/src/services/onboarding.rs:30]
- [x] [Review][Patch] Dialog focus is not moved into the instruction/focus trap on open [src/features/onboarding/components/OnboardingOverlay.tsx:23]

#### Review Ledger (2026-06-17)

- patch: Completion can be lost by a startup/dismiss race [src-tauri/src/services/onboarding.rs:76] -- concurrent session increment and completion both read-modify-write `onboarding.toml`, so a stale increment can clear completion.
- patch: Dismiss failure leaves overlay visible [src/features/onboarding/store.ts:72] -- `dismiss()` hides only after `completeOnboarding()` succeeds, contrary to the required failure behavior.
- patch: Onboarding can show an empty shortcut instruction [src/features/onboarding/bootstrap.ts:28] -- config load failure leaves `hotkey` empty while the overlay still renders the try prompt.
- patch: Retired command hint can flash before onboarding init resolves [src/features/editor/components/StatusBar.tsx:18] -- the store defaults `sessionsSeen` to 0, so already-retired users can briefly see the hint before persisted state loads.
- patch: Persisted onboarding TOML uses `sessionsSeen` instead of frozen `sessions_seen` [src-tauri/src/services/onboarding.rs:30] -- the IPC struct's camelCase serde naming is reused for TOML persistence.
- patch: Dialog focus is not moved into the instruction/focus trap on open [src/features/onboarding/components/OnboardingOverlay.tsx:23] -- the current hook traps tabbing only and the component explicitly leaves focus on the editor.

**Acceptance Criteria:**

- Given a fresh config dir, when the app starts, then the main window is shown with the onboarding overlay rendered (dialog markup + key caps + try prompt) and `onboarding.toml` reports not-complete.
- Given the overlay is visible, when the user presses Esc or the configured hotkey, then `onboarding_complete` is persisted, the overlay hides, and it never reappears (including after a window hide/show cycle).
- Given onboarding is already complete, when the app starts, then no overlay is shown.
- Given the user is within their first 5 sessions, when the StatusBar renders, then the "Ctrl+P for commands" hint appears in `var(--text-muted)`; from the 6th session it is gone permanently.
- Given the build, when bindings regenerate and the suites run, then `cargo test`, `vitest`, clippy, and tsc all pass with the previously-ignored/skipped onboarding tests now active.

## Design Notes

**Session-count off-by-one:** `store.init` reads the *prior* `sessions_seen` and seeds the hint; `bootstrap` then increments for the next launch. So launch 1 reads 0 (shows), … launch 5 reads 4 (shows), launch 6 reads 5 (hidden) — exactly "first 5 sessions." Guard the increment with a module-level boolean so React StrictMode's double-mount doesn't double-count.

**Hotkey-press dismissal:** the OS global shortcut hides the window via the existing `toggle_main_window`, but the React tree is *not* reloaded, so the frontend must learn of the press to flip `isVisible` and persist completion. The shortcut handler emits the typed `HotkeyPressed` event; the visible overlay's `events.hotkeyPressed.listen(...)` calls `dismiss()`. Relying on a webview keydown for a registered global shortcut is unreliable cross-platform — the event is the source of truth.

**Key-cap split (golden):**
```tsx
{hotkey.split('+').map((k) => <kbd key={k}>{k.trim()}</kbd>)}
```

## Verification

**Commands:**

- `cd src-tauri && cargo test --test onboarding_tests` -- expected: all 5 (de-ignored) pass.
- `cd src-tauri && cargo test` -- expected: full backend suite green (incl. `acl_tests`, `export_bindings` regen of `bindings.ts`).
- `cd src-tauri && cargo clippy --all-targets -- -D warnings` -- expected: no warnings.
- `npm test -- src/features/onboarding src/features/editor/components/StatusBar.test` -- expected: activated onboarding store/overlay tests + StatusBar pass.
- `npm run build` -- expected: `tsc` + vite build succeed (bindings include the 3 new commands + `hotkeyPressed`).
