---
stepsCompleted:
  ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04c-aggregate']
lastStep: 'step-04c-aggregate'
lastSaved: '2026-06-14'
storyId: '8.2'
storyKey: '8-2-macos-accessibility-permission-guidance'
storyFile: '_bmad-output/planning-artifacts/epics.md (Epic 8 → Story 8.2)'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-8-2-macos-accessibility-permission-guidance.md'
generatedTestFiles:
  - 'src-tauri/tests/platform_tests.rs'
  - 'src/features/onboarding/components/OnboardingOverlay.test.tsx'
  - 'src/features/onboarding/store.test.ts'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/project-context.md'
---

# ATDD Checklist: Story 8.2 — macOS Accessibility Permission Guidance

> **Stack adaptation.** Red phase = compiling stubs + inert tests (cargo `#[ignore]`, Vitest `describe.skip`). macOS-only assertions are `#[cfg(target_os = "macos")]`-gated, so they compile/run only on the macOS CI leg; on this Linux dev host they are excluded from the test binary by design.

## Mode

AI generation (backend platform + frontend overlay slice).

## TDD Red Phase (Current)

✅ Red-phase scaffolds generated — all inert

- Backend: `src-tauri/tests/platform_tests.rs` — `macos_reports_accessibility_permission`, `macos_can_open_accessibility_settings` (cfg macOS), `non_macos_skips_accessibility_gate` (cfg non-macOS)
- Frontend: `OnboardingOverlay.test.tsx::shows macOS accessibility guidance…`; `store.test.ts::flags macOS accessibility guidance when required`

Stub surface:
- `src-tauri/src/platform/{mod,macos,linux,windows}.rs` — `accessibility_permission_granted()`, `open_accessibility_settings()` on the `Platform` trait (macOS = `todo!`; Linux/Windows = `Ok(true)` / no-op, satisfying the "skip on non-macOS" AC)
- `src/features/onboarding/store.ts` — `accessibilityNeeded` + `setAccessibilityNeeded`

## Acceptance Criteria Coverage

| AC | Test | Level | Priority |
|---|---|---|---|
| On macOS, onboarding checks accessibility permission | `platform_tests::macos_reports_accessibility_permission` | unit (macOS) | P1 |
| Permission NOT granted → overlay shows guidance text + "Open System Settings" + skip-with-warning | overlay `shows macOS accessibility guidance with a settings link when required` | component | P1 |
| User grants permission → guidance dismissed, onboarding continues | covered by overlay guidance test (negative branch) + `setAccessibilityNeeded(false)` | store/component | P2 |
| Not macOS → accessibility step skipped entirely | `platform_tests::non_macos_skips_accessibility_gate` | unit (non-macOS) | P1 |
| Open accessibility settings pane | `platform_tests::macos_can_open_accessibility_settings` | unit (macOS) | P2 |

## Red-Phase Proof (verified)

- `cargo test --test platform_tests` (Linux host) → relevant tests `ignored`; `non_macos_skips_accessibility_gate` compiled in and ignored. macOS-cfg tests excluded on Linux (compile on the macOS CI leg).
- Frontend guidance/flag tests skipped within the 13 skipped onboarding tests.

## Green-Phase Wiring

1. Implement `MacosPlatform::accessibility_permission_granted` via `AXIsProcessTrusted()` and `open_accessibility_settings` via the `x-apple.systempreferences:…Privacy_Accessibility` URL.
2. Expose a `check_accessibility_permission` command (additive binding) if the overlay needs a live check; otherwise call it from the startup/onboarding init path and push the result into `setAccessibilityNeeded`.
3. Render the guidance block in `OnboardingOverlay` (text, "Open System Settings" button → command, skip-with-warning affordance) gated by `accessibilityNeeded`.
4. Re-check on window focus so granting the permission dismisses the guidance live.

## Activation Steps

Implement → remove `#[ignore]` / unskip the matching test → confirm it fails-then-passes → commit. Run macOS-cfg tests on a macOS machine or the macOS CI leg.
