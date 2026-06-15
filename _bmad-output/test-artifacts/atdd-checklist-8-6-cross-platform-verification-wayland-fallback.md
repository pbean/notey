---
stepsCompleted:
  ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04c-aggregate']
lastStep: 'step-04c-aggregate'
lastSaved: '2026-06-14'
storyId: '8.6'
storyKey: '8-6-cross-platform-verification-wayland-fallback'
storyFile: '_bmad-output/planning-artifacts/epics.md (Epic 8 → Story 8.6)'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-8-6-cross-platform-verification-wayland-fallback.md'
generatedTestFiles:
  - 'src-tauri/tests/platform_tests.rs'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/project-context.md'
---

# ATDD Checklist: Story 8.6 — Cross-Platform Verification & Wayland Fallback

> **Stack adaptation.** Platform-abstraction story. Red phase = cargo `#[ignore]` with `#[cfg(target_os = …)]`-gated assertions so each runs only on its platform (the CI matrix covers all 5 targets). RISK-001 (cross-platform rendering, score 6) → E2E + visual is platform QA; these tests pin the `Platform` trait contract + the Wayland fallback selection.

## Mode

AI generation (backend).

## TDD Red Phase (Current)

✅ `src-tauri/tests/platform_tests.rs` — `current_resolves_to_target_platform`, `linux_hotkey_uses_standard_backend_on_x11`, `linux_hotkey_falls_back_to_wayland_portal` (all `#[ignore]`); plus the data/socket/accessibility tests shared with 8.5/8.2

Stub surface:
- `src-tauri/src/platform/mod.rs` — `Platform` trait (data_dir, config_dir, log_dir, socket_path, register_hotkey, autostart_*, accessibility_*), `HotkeyBackend` enum, `current()`
- `src-tauri/src/platform/{linux,macos,windows}.rs` — per-OS `#[cfg(target_os)]` impls (`todo!`)

## Acceptance Criteria Coverage

| AC | Test | Level | Priority |
|---|---|---|---|
| `Platform` trait defines data_dir/config_dir/log_dir/socket_path/register_hotkey/autostart_* | trait exists + `current_resolves_to_target_platform` | unit | P1 |
| `#[cfg(target_os)]` impls in `platform/{linux,macos,windows}.rs` | the three module files (compile per-target) | unit | P1 |
| Wayland: standard plugin fails → portal fallback (ashpd) | `linux_hotkey_falls_back_to_wayland_portal` (needs Wayland harness) | unit (linux) | P1 |
| No fallback works → user notified | green-phase: `register_hotkey` returns `Err(Config)` → caller toasts | unit/integration | P1 |
| Standard backend on X11 | `linux_hotkey_uses_standard_backend_on_x11` | unit (linux) | P1 |
| FRs work on Win10/11, macOS 12+, Linux X11; platform-standard paths | **platform QA / CI matrix** (RISK-001) | manual + E2E | P0 |
| CI produces 5 target artifacts | **CI config** (already cross-platform matrix per project-context) | CI | P1 |

## Red-Phase Proof (verified)

`cargo test --test platform_tests` (Linux host) → 6 tests ignored; macOS-cfg tests excluded on Linux. Activating `current_resolves_to_target_platform` exercises the implemented `name()`; activating `linux_hotkey_uses_standard_backend_on_x11` fails on `todo!`. Clippy clean.

## Green-Phase Wiring

1. Implement each per-OS `Platform` method against real APIs.
2. **Linux `register_hotkey`:** try the standard Tauri global-shortcut plugin; on failure under Wayland, attempt the XDG GlobalShortcuts portal — verify the current `ashpd` version on crates.io (do NOT pin from memory). Return `HotkeyBackend::Standard` / `WaylandPortal` accordingly; `Err(NoteyError::Config)` when neither works so the caller can notify the user (FR57).
3. Stand up a Wayland test harness (or gate behind an `#[ignore]` + CI Wayland job) to exercise `linux_hotkey_falls_back_to_wayland_portal`.
4. Route `lib.rs` hotkey registration + path resolution through `Platform` (ties into Story 8.5).
5. Confirm the release matrix emits all 5 targets (Win x64, macOS x64 + ARM64, Linux x64 + ARM64).

## Activation Steps

Implement a method → remove its `#[ignore]` → confirm fail-then-pass on the relevant platform → commit. Run cfg-gated tests on each OS via the CI matrix; track rendering/visual verification as platform QA (RISK-001).
