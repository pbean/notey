---
title: "Layout Mode Switching"
type: "feature"
created: "2026-06-14"
status: "done"
baseline_commit: "4072fec18784e01de2a784529444debb17bf81b5"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `general.layoutMode` was repurposed in Epic 4 as a *density* toggle (`compact`/`comfortable`, driving the `.compact` spacing class) to give `toggleLayoutMode` a visible effect (DW-75) — but Epic 7 reserves this field for a *window mode*: Floating → Half-screen → Full-screen. Story 7.1 already staged the Settings selector with the three window-mode options and `setLayoutMode`/`SettingsPanel` explicitly defer the actual window behavior to this story (`actions.ts:466`, DW-86, DW-84). Today, picking a window mode persists a string but does nothing — no window resizes, re-centers, or changes always-on-top/chrome, and the density class is the only live effect.

**Approach:** Make `layoutMode` mean window mode and apply it through Tauri window properties. Add one privileged backend command `apply_layout_mode(window, mode)` whose branching geometry lives in a pure, unit-tested `compute_layout` helper; the command applies size, position, always-on-top, decorations, and resizable to the `main` window. Rewire the frontend `setLayoutMode`/`toggleLayoutMode`/startup paths to invoke it (persistence stays on the existing `updateConfig` path), retire the density class entirely, and normalize legacy persisted values (`compact`/`comfortable`) to `floating` through one shared helper.

## Boundaries & Constraints

**Always:**
- The three canonical modes are `floating`, `half-screen`, `full-screen`. `floating` = always-on-top, drop-shadow, resizable, 600×400 (logical), centered on the active monitor, borderless overlay (no chrome), skip-taskbar. `half-screen` and `full-screen` = NOT always-on-top, standard chrome (decorations on), shown in the taskbar. `full-screen` maximizes (standard chrome, not exclusive/borderless fullscreen). `half-screen` = full work-area width × half work-area height, centered on the active monitor's work area.
- Geometry derives from the active monitor's usable work area (`current_monitor()?.work_area()`, falling back to `primary_monitor()`), so the taskbar/dock is respected. All branching/geometry math lives in a pure `compute_layout(mode, work_area, scale_factor)` function that returns a plan struct and is the unit-test target; the command only applies the plan to the window.
- Every window-property call is best-effort: a platform that rejects one property (e.g. runtime decoration toggling) logs and continues — it must not fail the whole mode switch or the command.
- Persistence stays on the existing `updateConfig`/`config_service` path (the `[general] layoutMode` TOML key). `apply_layout_mode` performs NO config read/write — it is pure window control. The frontend persists, then applies.
- The cycle order is Floating → Half-screen → Full-screen → Floating. An unknown/legacy current value is treated as `floating` (so the next cycle step is `half-screen`).
- Legacy persisted values (`compact`, `comfortable`, or any non-canonical string) normalize to `floating` for both display and application, via one shared pure helper reused by the store, actions/startup, and `SettingsPanel`.
- The new command follows the project's Tauri-command checklist: registered in `lib.rs`, manual permission TOML if the build skips it, `allow-apply-layout-mode` added to `capabilities/default.json` and `EXPECTED_COMMANDS` in `acl_tests.rs`, invoked only through generated bindings.

**Ask First:**
- Changing the half-screen rectangle definition (which half / orientation / docked vs centered) beyond the centered full-width × half-height choice recorded here.
- Re-centering or re-applying layout mode inside the Rust window-summon path (`toggle_main_window`) — out of scope; summon keeps its current `center()` behavior, which is compatible with the centered geometry.

**Never:**
- Do NOT keep the density feature: remove the `.compact` block from `index.css` and the density behavior of `applyLayoutModeClass`. No spacing-scale toggle survives this story.
- Do NOT invent a new persistence path, a second config command, or move persistence into the window command.
- Do NOT use exclusive `set_fullscreen(true)` for `full-screen` (the epic requires standard chrome) — use `maximize()`.
- Do NOT modify theme/font setters, the hotkey command, `toggle_main_window`'s summon logic, or the per-component accessibility audit (Story 7.8).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| -------- | ------------- | -------------------------- | -------------- |
| Apply floating | `mode="floating"` | size 600×400 (logical→physical via scale), centered, always-on-top on, decorations off, shadow on, resizable on, skip-taskbar on | N/A |
| Apply half-screen | `mode="half-screen"`, work area W×H | size = W × round(H/2), positioned centered in work area, always-on-top off, decorations on, taskbar shown | N/A |
| Apply full-screen | `mode="full-screen"` | `maximize()`; always-on-top off, decorations on, taskbar shown | N/A |
| Switch from maximized | window currently maximized → floating/half | `unmaximize()` before `set_size`/`set_position` so sizing takes effect | N/A |
| Invalid mode | `mode="bogus"` | command returns `NoteyError::Validation`; window untouched; `compute_layout` returns `None`/`Err` | rejected before any window call |
| No monitor available | `current_monitor()` and `primary_monitor()` both `None` | floating/full-screen still apply (center/maximize need no math); half-screen falls back to `center()` keeping current size; warning logged | degrade, do not error |
| Legacy persisted value | config `layoutMode="comfortable"` at startup | normalized to `floating`; floating geometry applied; Settings shows `floating` | N/A |
| Cycle from legacy | toggle while stored value is `compact` | treated as `floating` → next is `half-screen`; persisted + applied | N/A |
| Rapid toggle | two `toggleLayoutMode` calls in flight | existing `isTogglingLayoutMode` guard drops the second; no lost-update | guard early-returns |

</frozen-after-approval>

## Code Map

- `src-tauri/src/commands/window.rs` -- add `apply_layout_mode(window, mode)` command: call `compute_layout`, then apply the plan to the window (unmaximize→set props→set_size/position or maximize), best-effort per call; invalid mode → `NoteyError::Validation`
- `src-tauri/src/services/window_layout.rs` -- NEW: `LayoutPlan` struct + pure `compute_layout(mode: &str, work_area: WorkArea, scale_factor: f64) -> Result<LayoutPlan, NoteyError>`; `#[cfg(test)] mod tests` covering all 3 modes + invalid + half-screen rounding. Plain `WorkArea { x, y, width, height }` input so tests need no Tauri runtime
- `src-tauri/src/services/mod.rs` -- register `pub mod window_layout;`
- `src-tauri/src/lib.rs` -- add `commands::window::apply_layout_mode` to `collect_commands!`
- `src-tauri/src/models/config.rs` -- `GeneralConfig::default().layout_mode`: `"comfortable"` → `"floating"` (reverses DW-84 now that `floating` is a real value); update the default-assertion test
- `src-tauri/src/services/config.rs` -- update the two default/read tests asserting `layout_mode == "comfortable"` to `"floating"`; merge test unchanged
- `src-tauri/capabilities/default.json` -- add `"allow-apply-layout-mode"`
- `src-tauri/permissions/autogenerated/apply_layout_mode.toml` -- create manually if `cargo build` does not generate it (per project-context Tauri gotcha)
- `src-tauri/tests/acl_tests.rs` -- add `"allow-apply-layout-mode"` to `EXPECTED_COMMANDS`
- `src/features/settings/layoutMode.ts` -- NEW pure helpers: `WINDOW_LAYOUT_MODES`, `normalizeLayoutMode(raw): string` (unknown→`floating`), `nextLayoutMode(current): string` (3-mode cycle)
- `src/features/command-palette/actions.ts` -- replace `applyLayoutModeClass` (delete density class) with `applyLayoutMode(mode)` calling `commands.applyLayoutMode(normalized)`; `toggleLayoutMode` cycles via `nextLayoutMode`; `setLayoutMode` persists + invokes apply (drop the "deferred to 7.5" comment); `applyStartupConfig` applies normalized persisted mode via the command (keep `userToggled.layoutMode` guard)
- `src/features/settings/store.ts` -- `setLayoutMode` snapshot uses `normalizeLayoutMode`; drop the `'comfortable'` fallback literals for layout
- `src/features/settings/components/SettingsPanel.tsx` -- import `WINDOW_LAYOUT_MODES`/`normalizeLayoutMode` from the new helper (remove the inline `LAYOUT_MODES` + reconciliation comment)
- `src/index.css` -- remove the `.compact { ... }` block
- `src/test-utils/factories.ts` -- `buildConfig` default `layoutMode: 'compact'` → `'floating'`
- `src/features/command-palette/actions.test.ts`, `src/features/settings/components/SettingsPanel.test.tsx`, `src/features/settings/layoutMode.test.ts` (NEW) -- rewrite density/`.compact` assertions to window-mode behavior (mock `commands.applyLayoutMode`); cover normalize + cycle helpers

## Tasks & Acceptance

**Execution:**

- [x] `src-tauri/src/services/window_layout.rs` -- NEW `LayoutPlan` + pure `compute_layout`; floating=600×400 logical scaled to physical + centered + always-on-top/borderless/shadow/skip-taskbar; half-screen=full-width×half-height centered in work area + chrome; full-screen=maximize + chrome; invalid→`NoteyError::Validation`. Add `#[cfg(test)] mod tests` for all branches incl. half-height rounding and the no-work-area path shape.
- [x] `src-tauri/src/services/mod.rs` -- declare `pub mod window_layout;`.
- [x] `src-tauri/src/commands/window.rs` -- add thin `apply_layout_mode(window, mode)`: fetch monitor work area (current→primary→None), call `compute_layout`, apply best-effort (`unmaximize` first when needed; `set_decorations`/`set_always_on_top`/`set_resizable`/`set_shadow`/`set_skip_taskbar`; then `maximize()` or `set_size`+`set_position`/`center()`), log per-call failures, return `Ok(())`; propagate `Validation` for bad mode.
- [x] `src-tauri/src/lib.rs` -- register `commands::window::apply_layout_mode` in `collect_commands!`.
- [x] `src-tauri/src/models/config.rs` + `src-tauri/src/services/config.rs` -- flip default `layout_mode` to `"floating"`; update the default/read assertions.
- [x] `src-tauri/capabilities/default.json`, `src-tauri/permissions/autogenerated/apply_layout_mode.toml`, `src-tauri/tests/acl_tests.rs` -- wire the ACL permission (create TOML manually if not auto-generated).
- [x] `src/features/settings/layoutMode.ts` -- implement `WINDOW_LAYOUT_MODES`, `normalizeLayoutMode`, `nextLayoutMode`.
- [x] `src/features/command-palette/actions.ts` -- replace density apply with `applyLayoutMode` calling `commands.applyLayoutMode`; cycle via `nextLayoutMode`; startup applies normalized persisted mode (guard preserved); remove `applyLayoutModeClass` density behavior.
- [x] `src/features/settings/store.ts` + `SettingsPanel.tsx` -- use the shared helper; remove inline `LAYOUT_MODES`/legacy literals.
- [x] `src/index.css` -- delete the `.compact` block.
- [x] `src/test-utils/factories.ts` -- default `layoutMode: 'floating'`.
- [x] `src/features/settings/layoutMode.test.ts` (NEW) + `actions.test.ts` + `SettingsPanel.test.tsx` -- cover normalize/cycle helpers and rewrite all `.compact`/density assertions to assert `commands.applyLayoutMode` is invoked with the expected mode and that persistence still fires.

**Acceptance Criteria:**

- Given the Settings → General "Layout mode" selector, when the user picks `half-screen`, then the value persists via `updateConfig` and `apply_layout_mode` resizes the `main` window to half the active monitor's work area, centered, with standard chrome and not always-on-top.
- Given any layout mode, when the user runs the "Toggle Layout Mode" palette command repeatedly, then the mode cycles Floating → Half-screen → Full-screen → Floating, each step persisted and applied to the window, with a legacy/unknown stored value treated as Floating.
- Given a persisted `layoutMode` (including a legacy `compact`/`comfortable` value) at app launch, when `applyStartupConfig` runs, then the normalized window mode is applied so the window restores its size/chrome/always-on-top across restarts.
- Given `mode="floating"`, when applied, then the window is always-on-top, borderless with a drop shadow, resizable, sized 600×400, and centered on the active monitor.
- Given an invalid mode string, when `apply_layout_mode` is invoked, then it returns a Validation error and the window is left unchanged.
- Given the density feature is removed, when the app runs, then no `.compact` class is applied anywhere and spacing tokens are constant regardless of layout mode.

## Design Notes

- **Why a pure `compute_layout`:** window manipulation needs a real `WebviewWindow`, untestable without a runtime. Pushing all mode→geometry branching into a pure function (input: a plain `WorkArea` + `scale_factor`) makes every mode, the half-height rounding, and the invalid case unit-testable; the command is then a thin, best-effort applier (the project's "thin command, testable service" rule).
- **Half-screen = centered, full-width × half-height.** Chosen because the epic says layout changes "center on the active monitor consistent with window-summon," and summon already calls `window.center()`; a centered geometry stays compatible with that re-center on the next summon (no fighting). This specific rectangle is a documented judgment call — flagged Ask-First and surfaced as a PREFERENCE for a human to revisit.
- **`floating` default reverses DW-84.** DW-84 had retired `floating` as a dead literal and defaulted to `comfortable`; this story makes `floating` the real, meaningful default window mode, so reintroducing it is correct, not a regression.
- **Best-effort property application:** runtime `set_decorations`/`set_shadow` can be flaky on some Linux/X11 setups. Each call is logged-and-ignored on error so a partial platform capability still yields the right size/always-on-top rather than a failed switch.
- **Closes:** DW-86 (legacy values misrepresented — now normalized + real modes) and the window-mode follow-up behind DW-75 (toggle now has a real window effect).

## Verification

**Commands:**

- `cd src-tauri && cargo test` -- expected: new `window_layout::tests` (all 3 modes, invalid, half rounding) pass; updated config default/read assertions (`floating`) pass; `acl_tests` sees `allow-apply-layout-mode`.
- `cd src-tauri && cargo clippy --all-targets -- -D warnings` -- expected: clean.
- `npx vitest run` -- expected: new `layoutMode.test.ts` (normalize/cycle) passes; rewritten `actions.test.ts` + `SettingsPanel.test.tsx` assert `commands.applyLayoutMode` invocation and persistence; no remaining `.compact` assertions.
- `npx tsc --noEmit` -- expected: no type errors; `applyLayoutMode` resolves through regenerated `src/generated/bindings.ts`.

### Review Findings

- [x] [Review][Patch] Persist settings-panel layout selections before applying them, and only mark the session override after the save succeeds [src/features/command-palette/actions.ts:491]
- [x] [Review][Patch] Serialize rapid settings-panel layout changes so IPC/save ordering cannot flip the final mode [src/features/command-palette/actions.ts:491]
- [x] [Review][Patch] Unmaximize before changing chrome/taskbar/layout properties when leaving full-screen [src-tauri/src/commands/window.rs:63]
- [x] [Review][Patch] Log the documented warning when no monitor is available for layout application [src-tauri/src/commands/window.rs:25]

#### Review Ledger (2026-06-14)

- patch: Persist settings-panel layout selections before applying them, and only mark the session override after the save succeeds [src/features/command-palette/actions.ts:491] — fixed by persisting first and gating `userToggled.layoutMode` on a successful save.
- patch: Serialize rapid settings-panel layout changes so IPC/save ordering cannot flip the final mode [src/features/command-palette/actions.ts:491] — fixed with a dedicated layout-mode promise chain and regression coverage for rapid successive selections.
- patch: Unmaximize before changing chrome/taskbar/layout properties when leaving full-screen [src-tauri/src/commands/window.rs:63] — fixed by moving the maximized-state escape hatch ahead of property and geometry updates, with warning logs for `is_maximized` failures.
- patch: Log the documented warning when no monitor is available for layout application [src-tauri/src/commands/window.rs:25] — fixed by emitting a fallback warning before the plan is applied.
- dismiss: Keep floating centering math inside `compute_layout` [src-tauri/src/services/window_layout.rs:80] — dismissed; `window.center()` still provides centered behavior and no concrete misbehavior was proven in the current implementation.
- dismiss: Treat `apply_layout_mode` helper error swallowing as a separate defect [src/features/command-palette/actions.ts:271] — dismissed; the concrete persist/apply contract break was already fixed and best-effort apply remains allowed by the story.
- dismiss: Treat the startup layout-apply race as a confirmed regression [src/features/command-palette/actions.ts:342] — dismissed; plausible but not reproduced or proven from the current control flow.
- dismiss: Add a special half-screen fallback for zero-sized work areas [src-tauri/src/services/window_layout.rs:94] — dismissed; speculative platform anomaly with no evidence in the story contract or current runtime.
