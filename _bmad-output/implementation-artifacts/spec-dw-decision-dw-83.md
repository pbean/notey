---
title: 'Resolve theme: system against the OS prefers-color-scheme (live)'
type: 'feature'
created: '2026-06-12'
status: 'done'
context: ['{project-root}/_bmad-output/project-context.md']
baseline_commit: '2633ee723337218269081ba5f039de0bcddbb248'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A persisted `theme: 'system'` — a value the backend `String` field permits and the `buildConfig` test-factory default — is currently mapped to **light** visuals by `applyThemeClass` (anything non-`dark` becomes `.light`). It is never resolved against the OS `prefers-color-scheme`, and there is no `matchMedia` logic anywhere, so a user whose OS is in dark mode but whose config says `system` boots into light and never tracks OS appearance changes. (DW-83; deferred from the `spec-layout-theme-persistence-fix` review as the spec's Ask-First boundary.)

**Approach:** Resolve `theme: 'system'` to dark/light via `window.matchMedia('(prefers-color-scheme: dark)')` inside the existing single-source `applyThemeClass` helper, so startup and toggles share one resolution rule. On startup, subscribe once to the media query's `change` event so a live OS appearance change re-applies the class **only while the active theme is `system`** (an explicit dark/light toggle opts out until the user re-selects system).

## Boundaries & Constraints

**Always:** `applyThemeClass` stays the single source of truth shared by startup + toggles. Resolution: `dark` → dark; `system` → dark iff `matchMedia('(prefers-color-scheme: dark)').matches`; any other value (`light`, unknown) → light. Continue toggling `.dark`/`.light` as a mutually-exclusive pair (the existing invariant). Feature-detect `window.matchMedia` (it is absent in jsdom and could be absent in a degraded webview): when unavailable, `system` falls back to light and no listener is bound — never throw. Subscribe to OS changes exactly once, at startup, via `addEventListener('change', …)` on a single cached `MediaQueryList`. The OS-change handler re-applies the theme **only when the active theme is `system`**. Honor the existing per-session `userToggled.theme` race guard: an explicit toggle during the boot window still wins and opts the session out of system tracking.

**Ask First:** Adding a user-facing way to *select* `system` (a settings UI or a third toggle state). Out of scope — this only resolves a `system` value that already arrives from config; the existing `toggleTheme` keeps flipping dark↔light.

**Never:** Do not change the Rust config model, defaults, or `update_config` semantics. Do not add a settings store/feature. Do not change `toggleTheme`'s dark↔light flip behavior or `applyLayoutModeClass`. Do not add CSS `@media (prefers-color-scheme)` rules — resolution is JS-only so it composes with the existing `.dark`/`.light` token systems. Do not make `applyStartupConfig` register the listener more than once.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Startup, system + OS dark | config `{theme:'system'}`, `matchMedia(...).matches === true` | `.dark` present, `.light` absent | N/A |
| Startup, system + OS light | config `{theme:'system'}`, `matchMedia(...).matches === false` | `.light` present, `.dark` absent | N/A |
| Live OS change while system | active theme `system`, OS flips dark→light | `change` handler re-applies → `.light` present, `.dark` absent | N/A |
| Live OS change after explicit toggle | user toggled to `dark`, then OS flips | handler no-ops — `.dark` stays (system tracking opted out) | N/A |
| Startup, system + no matchMedia | `window.matchMedia` undefined (jsdom/degraded) | `system` falls back to `.light`; no listener bound; no throw | feature-detect, fall back |
| Explicit dark/light unchanged | config `{theme:'dark'}` or `{theme:'light'}` | same as today: `.dark` / `.light` respectively | N/A |

</frozen-after-approval>

## Code Map

- `src/features/command-palette/actions.ts` -- owns `applyThemeClass`, `applyStartupConfig`, the toggles, and `userToggled` race guard / `resetToggleTracking`. All changes land here: system resolution in `applyThemeClass`, listener subscription in `applyStartupConfig`, new module state, and extend `resetToggleTracking` to clear it.
- `src/features/command-palette/actions.test.ts` -- existing theme/startup/race tests; extend with system-resolution + live-change coverage.
- `src/test-utils/setup.ts` -- global `afterEach` calls `resetToggleTracking()`; the extended reset must clear the new system-theme state so it does not bleed between tests. Reference only — no change needed unless reset signature changes (it does not).
- `src/index.css` -- reference only: `.dark` (201) and `.light` (266). No `@media (prefers-color-scheme)` exists — confirms resolution must be JS. No change.
- `src/generated/bindings.ts` -- reference only: `GeneralConfig.theme` is `string` (so `'system'` is a valid persisted value). No change (generated).

## Tasks & Acceptance

**Execution:**

- [x] `src/features/command-palette/actions.ts` -- (1) Add a feature-detected, cached accessor for `window.matchMedia('(prefers-color-scheme: dark)')` returning the `MediaQueryList | null`. (2) In `applyThemeClass`, resolve `isDark` as `theme === 'dark' || (theme === 'system' && query?.matches === true)`, and track whether the active theme is `system` in module state (so the OS-change handler knows whether to act). Keep the `.dark`/`.light` mutually-exclusive pair. (3) In `applyStartupConfig`, after applying classes, bind the `change` listener exactly once (guarded) — the handler re-applies `applyThemeClass('system')` only while the active theme is `system`. (4) Extend `resetToggleTracking` to also clear the new system-theme module state (active flag, cached query, listener-bound flag). Update JSDoc on all touched functions.

- [x] `src/features/command-palette/actions.test.ts` -- Add tests: startup `system` + OS dark → `.dark`; startup `system` + OS light → `.light`; live `change` event while system flips the class; live `change` after an explicit toggle is ignored; `system` with `window.matchMedia` undefined falls back to `.light` without throwing. Mock `window.matchMedia` with a capturable `change` listener; restore it in `afterEach`.

**Acceptance Criteria:**

- Given a persisted `{theme:'system'}` and the OS reports dark (`matchMedia('(prefers-color-scheme: dark)').matches === true`), when the app boots, then `<html>` has `.dark` and not `.light`.
- Given a persisted `{theme:'system'}` and the OS reports light, when the app boots, then `<html>` has `.light` and not `.dark`.
- Given the active theme is `system`, when the OS appearance changes after startup, then the resolved `.dark`/`.light` class updates live without a restart.
- Given the user has explicitly toggled to dark or light, when the OS appearance later changes, then the class does not change (system tracking is opted out for the session).
- Given `window.matchMedia` is unavailable, when a `system` theme is applied, then it resolves to light and no error is thrown and no listener is bound.
- Given a persisted `{theme:'dark'}` or `{theme:'light'}`, when the app boots, then behavior is unchanged from today (the existing pair invariant holds).

## Design Notes

Resolution lives in the one shared helper so startup and the live listener agree:
```ts
function systemPrefersDark(): boolean {
  return getSystemThemeQuery()?.matches ?? false; // null when matchMedia absent
}
function applyThemeClass(theme: string): void {
  systemThemeActive = theme === 'system';
  const isDark = theme === 'dark' || (theme === 'system' && systemPrefersDark());
  const root = document.documentElement;
  root.classList.toggle('dark', isDark);
  root.classList.toggle('light', !isDark); // pair invariant preserved
}
```
The cached `MediaQueryList` is a live object — `.matches` updates on its own and one `change` listener suffices. The handler gates on `systemThemeActive`, which `applyThemeClass` sets false whenever a concrete `dark`/`light` is applied (including via `toggleTheme`, which flips `system`→`dark`). This reuses the existing opt-out mechanics rather than adding new state to the toggles. `toggleTheme` is untouched: reading a `system` config still yields `next = 'dark'` (since `'system' !== 'dark'`), which is the desired "leave system, pick a concrete theme" behavior.

## Verification

**Commands:**

- `npx vitest run src/features/command-palette/actions.test.ts` -- expected: all tests pass, including new system-resolution + live-change cases.
- `npx tsc --noEmit` -- expected: no type errors.
- `npx eslint src/features/command-palette/actions.ts src/features/command-palette/actions.test.ts` -- expected: clean.

### Review Findings

- [x] [Review][Patch] Harden degraded-webview system-theme fallback [src/features/command-palette/actions.ts:94]
- [x] [Review][Patch] Re-apply the current `system` theme after listener bind [src/features/command-palette/actions.ts:221]

#### Review Ledger (2026-06-12)

patch: Harden degraded-webview system-theme fallback [src/features/command-palette/actions.ts:94] — fixed by guarding `matchMedia` acquisition, supporting legacy `addListener`, detaching listeners during test resets, and adding regression coverage.
patch: Re-apply the current `system` theme after listener bind [src/features/command-palette/actions.ts:221] — fixed by re-checking the active OS theme immediately after subscription so the boot window cannot leave stale classes behind.
dismiss: Repeated-startup listener idempotency needs its own test [src/features/command-palette/actions.test.ts:447] — the existing `systemThemeListenerBound` guard is explicit in code and no contradictory path was found in verification.
dismiss: Explicit-toggle opt-out test hides stale-config bugs [src/features/command-palette/actions.test.ts:575] — verified against `toggleTheme()` control flow; the code does not re-read config after `updateConfig`.
dismiss: Session cannot recover if listener binding fails and theme later returns to `system` [src/features/command-palette/actions.ts:164] — unreachable in the shipped UX because no control can re-select `system` during the session.
