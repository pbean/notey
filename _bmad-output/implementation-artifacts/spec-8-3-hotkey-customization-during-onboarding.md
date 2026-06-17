---
title: "Story 8.3 — Hotkey Customization During Onboarding"
type: "feature"
created: "2026-06-17"
status: "done"
baseline_commit: "89e39fc3282e7dfdcd238ba355d8660e2d9f444a"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-8-context.md"
  - "{project-root}/_bmad-output/project-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 8.1 shipped the onboarding overlay's "Customize" affordance as an inert shell: clicking it flips `customizing` and shows the static "Press your preferred shortcut…" prompt, but there is no key capture, no conflict handling, and `applyCustomHotkey` only mutates the displayed string locally — it never persists or re-registers the global shortcut. A new user cannot actually change the capture hotkey before leaving onboarding.

**Approach:** Implement the green phase of in-onboarding hotkey customization purely on the frontend by reusing Epic 7's existing register-before-commit path. In the overlay's `customizing` branch, capture a modifier+key combination with the existing `formatShortcutFromEvent` grammar, live-preview it as key caps, and on an explicit Save delegate to the shared `useSettingsStore.setGlobalShortcut()` (which calls `commands.updateConfig` — validate → register-new → unregister-old → persist). A conflict keeps the previous shortcut and surfaces an inline warning so the user can retry; success updates the displayed shortcut and continues onboarding. No backend, command, or dependency changes.

## Boundaries & Constraints

**Always:**
- Persist + register the new shortcut ONLY through `useSettingsStore.getState().setGlobalShortcut(combo)` — the single Epic 7 register-before-commit path (it already does conflict detection, unregister-old, atomic persist, and returns `true`/`false`). Never call `commands.updateConfig` directly from onboarding and never reimplement parsing/conflict logic.
- Derive captured combos with the existing `formatShortcutFromEvent` + supported-key set from `src/features/settings/shortcut.ts` (canonical `Ctrl|Cmd + Shift + Alt + KEY`). No new capture grammar.
- Capture uses a window keydown listener in the **capture phase** with `preventDefault` + `stopPropagation`, mirroring `HotkeyCaptureField`: ignore Tab and bare-modifier presses; an unsupported/modifier-less combo shows an inline warning rather than capturing.
- Register only on an explicit Save/confirm action — never auto-register on each keypress.
- On conflict/failure: keep the previously displayed-and-registered shortcut, show an inline warning (`role="alert"`), and stay in capture mode so the user can try again. On success: set the overlay `hotkey` to the captured combo, leave capture mode, and continue onboarding.
- While `customizing`, suppress the overlay's Esc-dismiss and `hotkey-pressed`-dismiss so capture is never interrupted; Esc cancels capture only. Outside capture, Story 8.1 Esc/hotkey dismissal is unchanged.
- All IPC stays via generated `commands.*` bindings (transitively through the settings store). Zero raw `invoke`, zero network, no broad FS.

**Ask First:**
- Changing the shared `setGlobalShortcut` contract or the `formatShortcutFromEvent` grammar (both shared with Settings / Epic 7).
- Introducing any backend code, new Tauri command, or new runtime dependency (none expected — this story is frontend-only reuse).

**Never:**
- Do NOT add Rust, a new Tauri command, ACL/permission entries, or a new `onboarding/api.ts` function — the registration + conflict + persistence path already exists in Epic 7's `update_config`.
- Do NOT auto-apply the shortcut on every captured keystroke (no register spam).
- Do NOT add a new E2E test (P1-E2E-002 is owned by the later cross-platform pass).
- Do NOT gate Story 8.1's Esc/hotkey onboarding dismissal outside capture mode.
- Do NOT mutate `onboarding.toml` or `AppConfig`/`config.toml` directly for the shortcut.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Enter capture | click "Customize" | `customizing=true`; "Press your preferred shortcut…" shown; capture listener active; Save disabled | N/A |
| Valid combo pressed | `Ctrl+Shift+J` in capture | live-preview key caps update to the combo; Save enabled; warning cleared | N/A |
| Invalid press | bare `J`, pure modifier, or unsupported key | nothing captured; inline warning to use a modifier + letter/number; Save stays disabled | swallow, warn inline |
| Save, no conflict | Save with captured combo | `setGlobalShortcut`→`true`; overlay `hotkey` = new combo; capture exits; onboarding continues with new caps | N/A |
| Save, conflict/failure | `setGlobalShortcut`→`false` | inline warning shown; remains in capture; displayed + registered shortcut unchanged | keep old, allow retry |
| Cancel capture | "Cancel" button | capture exits; original hotkey still displayed; onboarding NOT dismissed | N/A |
| Esc during capture | Esc keydown while `customizing` | cancels capture only; onboarding stays open | stopPropagation blocks dismiss |
| Global hotkey press during capture | backend `hotkey-pressed` while `customizing` | ignored — no dismiss until capture exits | listener gated off |

</frozen-after-approval>

## Code Map

- `src/features/onboarding/store.ts` -- Make `applyCustomHotkey` async returning `Promise<boolean>`: delegate to `useSettingsStore.getState().setGlobalShortcut(combo)`; on `true` `set({ hotkey: combo, customizing: false })` and return `true`; on `false` leave `customizing` true (retry) and return `false`. Add `cancelCustomize: () => set({ customizing: false })`. Update the `OnboardingActions` interface + JSDoc and drop the RED-PHASE note now that the slice is green.
- `src/features/onboarding/components/OnboardingOverlay.tsx` -- Implement the real `customizing` branch: local `captured`/`warning` state; a capture-phase window `keydown` handler using `formatShortcutFromEvent` (ignore Tab + bare modifiers, Esc→`cancelCustomize`, invalid→warning, valid→live preview); render the live key-cap preview + Save (disabled until captured) + Cancel + inline warning; Save → `await applyCustomHotkey(captured)` then warn-and-stay on `false`. Gate the existing Esc-dismiss and `hotkey-pressed` effects on `!customizing`.
- `src/features/settings/shortcut.ts` -- REUSE `formatShortcutFromEvent` (no change).
- `src/features/settings/store.ts` -- REUSE `setGlobalShortcut` (no change).
- `src/features/onboarding/store.test.ts` -- Replace the stub `applyCustomHotkey` test with async cases mocking `useSettingsStore.getState().setGlobalShortcut` (success updates hotkey + exits capture; conflict keeps hotkey + stays in capture + returns `false`); add a `cancelCustomize` test.
- `src/features/onboarding/components/OnboardingOverlay.test.tsx` -- Add capture-flow tests: valid press shows live preview + enables Save; invalid press shows the warning; Save (success) calls `setGlobalShortcut`, shows the new key caps, and exits capture; Save (conflict) shows the warning and stays in capture; Cancel and Esc cancel capture without dismissing onboarding.

## Tasks & Acceptance

**Execution:**

- [x] `src/features/onboarding/store.ts` -- Convert `applyCustomHotkey` to the async delegating action and add `cancelCustomize` (interface + impl + JSDoc); refresh the store doc comment. -- Onboarding-side orchestration over the shared registration path.
- [x] `src/features/onboarding/components/OnboardingOverlay.tsx` -- Implement capture-mode keydown + live preview + Save/Cancel + inline warning in the `customizing` branch and gate the Esc/`hotkey-pressed` dismiss effects on `!customizing`. -- The customization UI.
- [x] `src/features/onboarding/store.test.ts` -- Update/add store tests for async `applyCustomHotkey` (success + conflict) and `cancelCustomize`, mocking the settings store's `setGlobalShortcut`. -- Lock the store contract.
- [x] `src/features/onboarding/components/OnboardingOverlay.test.tsx` -- Add the capture-flow component tests (live preview, invalid warning, Save success/conflict, Cancel/Esc). -- Lock the overlay contract.

**Acceptance Criteria:**

- Given the onboarding overlay shows the default capture shortcut, when the user clicks "Customize", presses a valid modifier+key combination, and clicks Save with no conflict, then the new shortcut is registered and persisted via the shared Epic 7 path and the overlay continues showing the new shortcut as key caps.
- Given the user is in capture mode and saves a combination that fails to register (conflict), when the backend rejects it, then an inline warning is shown, the previously registered shortcut is retained, and the user can capture another combination without leaving onboarding.
- Given the user is in capture mode, when they press Esc or click Cancel, then capture is abandoned, the original shortcut is still displayed, and onboarding is not dismissed.
- Given the build, when the suites run, then `vitest` (updated onboarding store + overlay tests), `tsc`, and `npm run build` all pass; no backend, clippy, or binding changes are introduced.

## Design Notes

**Why frontend-only:** Conflict detection, register-before-commit, unregister-old, and atomic persistence already live in Epic 7's `commands::config::update_config`, surfaced to the UI by `useSettingsStore.setGlobalShortcut` (returns `true`/`false`, raises its own conflict toast). Story 8.3 is simply the onboarding-time entry point into that path — reusing it satisfies the epic's "share the validation/registration path" directive and adds no Rust.

**Esc precedence during capture:** The capture keydown listener is registered in the capture phase and calls `stopPropagation`, so the overlay's bubble-phase Esc-dismiss never fires while customizing; the dismiss effects are additionally gated on `!customizing` so a backend `hotkey-pressed` event can't complete onboarding mid-capture. This mirrors `HotkeyCaptureField` exactly.

**Capture core (golden, mirrors HotkeyCaptureField):**
```ts
if (isModifierCode(e.code)) return;            // wait for a main key
const combo = formatShortcutFromEvent(e);
if (combo === null) { setCaptured(null); setWarning(USE_MODIFIER_MSG); return; }
setCaptured(combo); setWarning(null);          // live preview; Save → applyCustomHotkey
```

## Verification

**Commands:**

- `npm test -- src/features/onboarding` -- expected: updated onboarding store + overlay tests pass (capture, save, conflict, cancel).
- `npm run build` -- expected: `tsc` + vite build succeed (no binding changes).
- `cd src-tauri && cargo test` -- expected: backend suite stays green and unchanged (no backend edits in this story).

### Review Findings

- [x] [Review][Patch] Capture-mode Save/Cancel keyboard activation was swallowed by shortcut capture [src/features/onboarding/components/OnboardingOverlay.tsx:123] — fixed by allowing focused button Enter/Space keydown events to pass through instead of treating them as shortcut input.
- [x] [Review][Patch] Save could be submitted repeatedly or followed by Cancel while registration was still pending [src/features/onboarding/components/OnboardingOverlay.tsx:191] — fixed with a ref-backed in-flight guard plus disabled Save/Cancel controls during registration.
- [x] [Review][Patch] A stale `hotkey-pressed` listener could still dismiss onboarding after capture started [src/features/onboarding/components/OnboardingOverlay.tsx:91] — fixed by checking listener activity and current onboarding state inside the callback before dismissing.

#### Review Ledger (2026-06-17)

- patch: Capture-mode Save/Cancel keyboard activation was swallowed by shortcut capture [src/features/onboarding/components/OnboardingOverlay.tsx:123] — focused capture controls now receive Enter/Space normally.
- patch: Save could be submitted repeatedly or followed by Cancel while registration was still pending [src/features/onboarding/components/OnboardingOverlay.tsx:191] — in-flight Save is guarded and controls are disabled until registration settles.
- patch: A stale `hotkey-pressed` listener could still dismiss onboarding after capture started [src/features/onboarding/components/OnboardingOverlay.tsx:91] — stale callbacks now check listener activity and current store state before dismissing.
- dismiss: Save failure can reject without showing the retry warning [src/features/onboarding/store.ts:98] — false positive; `useSettingsStore.setGlobalShortcut` catches thrown `updateConfig` errors and resolves `false`.
