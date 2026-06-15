---
stepsCompleted:
  ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04c-aggregate']
lastStep: 'step-04c-aggregate'
lastSaved: '2026-06-14'
storyId: '8.3'
storyKey: '8-3-hotkey-customization-during-onboarding'
storyFile: '_bmad-output/planning-artifacts/epics.md (Epic 8 → Story 8.3)'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-8-3-hotkey-customization-during-onboarding.md'
generatedTestFiles:
  - 'src/features/onboarding/store.test.ts'
  - 'src/features/onboarding/components/OnboardingOverlay.test.tsx'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/project-context.md'
---

# ATDD Checklist: Story 8.3 — Hotkey Customization During Onboarding

> **Stack adaptation.** Frontend-only story (orchestration over existing backend). Red phase = Vitest `describe.skip`. Backend shortcut validation/registration/persistence is **already implemented and tested** (`update_config` / `merge_update` / `parse_shortcut` + conflict detection from Story 7.4) — green phase reuses it, so no new backend stub/test is needed here.

## Mode

AI generation (frontend).

## TDD Red Phase (Current)

✅ Red-phase scaffolds generated — all inert

- `src/features/onboarding/store.test.ts` — `startCustomize enters capture mode`, `applyCustomHotkey updates the displayed shortcut and exits capture mode`
- `src/features/onboarding/components/OnboardingOverlay.test.tsx` — `offers a Customize control that enters capture mode`

Stub surface:
- `src/features/onboarding/store.ts` — `customizing`, `startCustomize`, `applyCustomHotkey`
- `OnboardingOverlay.tsx` — empty shell (Customize control + capture UI not yet rendered)

## Acceptance Criteria Coverage

| AC | Test | Level | Priority |
|---|---|---|---|
| Default hotkey shown with a "Customize" link/button | overlay `offers a Customize control…` | component | P1 |
| Clicking Customize → "Press your preferred shortcut…" capture mode | overlay `offers a Customize control…` + store `startCustomize` | component/store | P1 |
| New combo captured → key caps update | store `applyCustomHotkey updates the displayed shortcut…` | store | P1 |
| Conflict → warning, retry; valid → saved + registered immediately; onboarding continues | **green-phase** via existing `useSettingsStore.setGlobalShortcut` (conflict-checked, registers before commit) | store/integration | P1 |

## Red-Phase Proof (verified)

`npx vitest run src/features/onboarding` → skipped (part of the 13 skipped). Full suite 556 passed | 13 skipped.

## Green-Phase Wiring

1. Render the "Customize" control + capture prompt in `OnboardingOverlay`; bind capture to the Story 7.4 shortcut-capture grammar/util already in `src/features/settings/`.
2. On a valid capture, call the existing `useSettingsStore.getState().setGlobalShortcut(combo)` — it performs conflict detection, registers the new binding before committing, persists to `config.toml`, and toasts on conflict. On success, mirror the new shortcut into `useOnboardingStore.applyCustomHotkey(combo)`; on conflict, stay in capture mode for retry.
3. Continue onboarding with the (possibly customized) shortcut displayed.

> **Reuse note:** do NOT reimplement shortcut validation/registration — `setGlobalShortcut` + `commands.updateConfig` already own it. The onboarding store only tracks display/capture UI state.

## Activation Steps

Implement the overlay's customize UI → unskip the matching tests → confirm fail-then-pass → commit. Add an integration test for the `setGlobalShortcut` conflict path during onboarding when wiring green.
