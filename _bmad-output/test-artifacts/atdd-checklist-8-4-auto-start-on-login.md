---
stepsCompleted:
  ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04c-aggregate']
lastStep: 'step-04c-aggregate'
lastSaved: '2026-06-14'
storyId: '8.4'
storyKey: '8-4-auto-start-on-login'
storyFile: '_bmad-output/planning-artifacts/epics.md (Epic 8 → Story 8.4)'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-8-4-auto-start-on-login.md'
generatedTestFiles:
  - 'src-tauri/tests/autostart_tests.rs'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/project-context.md'
---

# ATDD Checklist: Story 8.4 — Auto-Start on Login

> **Stack adaptation.** Backend/platform story. Red phase = cargo `#[ignore]`. The "does the OS actually launch the app at login?" guarantee is platform QA (manual); these tests pin the **persistence + idempotence + service contract**.

## Mode

AI generation (backend).

## TDD Red Phase (Current)

✅ `src-tauri/tests/autostart_tests.rs` — 5 tests, all `#[ignore = "red-phase: Story 8.4"]`

Stub surface:
- `src-tauri/src/services/autostart.rs` — `AutostartState`, `load`, `enable`, `disable`, `is_enabled`, `state_file_path`
- `src-tauri/src/platform/*` — `autostart_enable` / `autostart_disable` / `autostart_is_enabled` on the `Platform` trait

## Acceptance Criteria Coverage

| AC | Test | Level | Priority |
|---|---|---|---|
| Fresh install: auto-start disabled | `load_defaults_to_disabled` | unit/integration | P2 |
| Enable → preference saved `auto_start = true` | `enable_persists_true` | integration | P1 |
| Disable → preference saved `auto_start = false` | `disable_persists_false` | integration | P1 |
| Enabling is idempotent (no duplicate launch agent) | `enable_is_idempotent` | integration | P2 |
| Platform mechanism is source of truth for active state | `is_enabled_reports_platform_state` | unit | P1 |
| Plugin registered with `MacosLauncher::LaunchAgent`; capability ACL `autostart:allow-*`; reboot → starts as tray daemon | **platform QA + green-phase wiring** (not unit-automatable) | manual | P1 |

## Red-Phase Proof (verified)

`cargo test --test autostart_tests` → `0 passed; 0 failed; 5 ignored`. Activating any test fails on the `todo!` panic. Clippy clean.

## Green-Phase Wiring

1. **Add `tauri-plugin-autostart`** — verify the current 2.x version on crates.io (do NOT pin from memory; per global rule). Initialize with `MacosLauncher::LaunchAgent`.
2. Implement `Platform::autostart_*` per OS (macOS LaunchAgent plist; Linux XDG autostart `.desktop`; Windows HKCU Run key) and have `services::autostart` delegate to it + persist the preference.
3. **Config key:** AC specifies `[general] auto_start`. The scaffold persists a dedicated `[autostart] enabled` (separate `autostart.toml`) to avoid a ~50-site TypeScript ripple from changing `GeneralConfig` during red phase. At green phase, decide: keep the dedicated section, or move into `[general]` and update all `general: { … }` TS literals + `buildConfig` + regenerate bindings.
4. **Capability ACL:** add `autostart:allow-enable`, `autostart:allow-disable`, `autostart:allow-is-enabled` to `capabilities/default.json`; if you expose a `set_autostart` command, add its permission TOML + `EXPECTED_COMMANDS` entry (acl_tests).
5. Expose enable/disable via Settings + command palette.

## Activation Steps

Implement a method → remove its `#[ignore]` → confirm fail-then-pass → commit. Track the reboot/launch-at-login verification as a platform-QA item (RISK references in epics.md).
