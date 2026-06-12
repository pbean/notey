---
title: 'Apply persisted theme + layoutMode at startup; guard toggle concurrency'
type: 'bugfix'
created: '2026-06-12'
status: 'done'
context: ['{project-root}/_bmad-output/project-context.md']
baseline_commit: '4d4e9fd76310b25b34f851dbbd2e844882123b70'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Two latent bugs from the Epic 4 cleanup pass (retro Action Items 1 & 2). (1) `main.tsx` unconditionally calls `classList.add('dark')` at boot — it never reads config, so the persisted `layoutMode` is never applied and the persisted `theme` is silently overwritten to dark on every restart. (2) `toggleTheme` / `toggleLayoutMode` do an unguarded `getConfig` → `updateConfig` read-modify-write; rapid double-fire (e.g. key repeat) reads stale config before either write lands, so a toggle is lost and DOM/config can diverge.

**Approach:** Add a single startup-config step that reads persisted config once and applies the `.dark` / `.compact` classes from it. Mirror the proven `isCreatingNote` in-flight boolean guard on both toggles so concurrent invocations are dropped, not raced. Reuse one set of class-apply helpers across startup and toggles so the rules live in one place.

## Boundaries & Constraints

**Always:** Theme rule toggles `.dark`/`.light` as a mutually-exclusive pair — `.dark` iff `theme === 'dark'`, `.light` for any other value (light/system). Both classes are required because shadcn tokens are light-first in `:root` (overridden by `.dark`) while Notey custom tokens are dark-first in `:root` (overridden by `.light`); applying only one leaves a mixed palette. Layout rule is `classList.toggle('compact', layoutMode === 'compact')` (CSS only defines `.compact`; comfortable/floating/any other value = no class). Keep the synchronous `classList.add('dark')` in `main.tsx` as the pre-paint default so dark users see no flash, then reconcile asynchronously. On `getConfig` failure at startup, log and leave the synchronous defaults in place. Use tauri-specta `commands.getConfig()` bindings — never raw `invoke`.

**Ask First:** Introducing OS/`system` theme resolution (media query) — there is no existing support; out of scope unless requested.

**Never:** Do not change the Rust config model, defaults, or `update_config` semantics. Do not add a settings store/feature. Do not change the toggle UX beyond serializing concurrent calls. Do not touch unrelated Action Items 3 (test audit) or 4 (Epic 5 process).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Startup, saved dark+compact | config `{theme:'dark', layoutMode:'compact'}` | `.dark` + `.compact` present, `.light` absent | N/A |
| Startup, saved light+comfortable | config `{theme:'light', layoutMode:'comfortable'}` | `.light` present, `.dark` + `.compact` absent | N/A |
| Startup, default layoutMode | config `{layoutMode:'floating'}` (backend default) | `.compact` absent (treated as non-compact) | N/A |
| Startup, getConfig fails | IPC returns error | DOM untouched (keeps synchronous dark default) | `console.error`, return |
| Rapid double toggle | `toggleTheme()` called twice while first IPC in-flight | second call returns immediately; exactly one `update_config` | guard cleared in `finally` |

</frozen-after-approval>

## Code Map

- `src/main.tsx` -- boot entry; currently force-adds `.dark`. Add `void applyStartupConfig()` after the synchronous default.
- `src/features/command-palette/actions.ts` -- owns theme/layout DOM-class logic and the `isCreatingNote` guard pattern. Add `applyStartupConfig`, class-apply helpers, and the two toggle guards here.
- `src/features/command-palette/actions.test.ts` -- existing toggle tests; extend with startup + concurrency coverage.
- `src/index.css` -- reference only: `.compact` (190), `.dark` (201), and `.light` (266) class definitions; Notey custom tokens are dark-first in `:root` (164) and overridden by `.light`. No change.
- `src/test-utils/factories.ts` -- `buildConfig` helper for test configs.

## Tasks & Acceptance

**Execution:**
- [x] `src/features/command-palette/actions.ts` -- Add private `applyThemeClass(theme)` and `applyLayoutModeClass(layoutMode)` helpers encoding the two class rules. Add exported `async applyStartupConfig()` that calls `commands.getConfig()`, applies both classes from `general.theme ?? 'dark'` / `general.layoutMode ?? 'comfortable'`, and on error logs + returns leaving DOM untouched. Refactor `toggleTheme` / `toggleLayoutMode` to apply DOM via the helpers, and wrap each in an in-flight boolean guard (`isTogglingTheme`, `isTogglingLayoutMode`) mirroring `isCreatingNote` (early-return if set; set before first await; clear in `finally`). JSDoc all new exports.
- [x] `src/main.tsx` -- Import `applyStartupConfig`; keep the synchronous `classList.add('dark')`; add `void applyStartupConfig();` before `createRoot(...).render(...)`.
- [x] `src/features/command-palette/actions.test.ts` -- Add `applyStartupConfig` tests (dark+compact, light+comfortable, floating→no compact, getConfig-failure leaves DOM untouched) and concurrency tests for both toggles (deferred `get_config` promise → second call dropped → one `update_config`). Clean up `.dark`/`.compact` on `<html>` in `afterEach` to prevent bleed.

**Acceptance Criteria:**
- Given a saved config of `{theme:'light', layoutMode:'compact'}`, when the app boots, then `<html>` has `.light` + `.compact` and does not have `.dark` (saved theme honored as a complete, non-mixed palette, not overwritten to dark).
- Given any theme change or startup, when the theme resolves to dark, then `<html>` has `.dark` and not `.light`; when it resolves to non-dark, then `<html>` has `.light` and not `.dark` (classes are always a mutually-exclusive pair).
- Given a saved `layoutMode` of `'compact'`, when the app boots, then the compact spacing is applied without a manual toggle.
- Given `toggleTheme` (or `toggleLayoutMode`) is invoked twice in rapid succession before the first completes, when both run, then exactly one `update_config` is issued and the final DOM/config state is consistent (one net toggle).
- Given `getConfig` fails at startup, when `applyStartupConfig` runs, then the app keeps the dark default and logs the error without throwing.

## Spec Change Log

### 2026-06-12 — Theme class rule corrected to a `.dark`/`.light` pair (human-authorized)

- **Trigger:** Adversarial review (edge-case hunter) found that honoring a saved *light* theme at boot exposes a pre-existing rendering bug — the theme system only toggled `.dark`, never `.light`. Notey custom tokens (`--bg-primary`, …) are dark-first in `:root` and overridden only by `.light`, so "light" left a mixed/broken palette. This change surfaced and persisted that state for light users.
- **Amended:** Frozen **Always** theme rule, I/O matrix rows, Code Map (`index.css` `.light`), and a new AC for the mutually-exclusive pair. Implementation: `applyThemeClass` now sets `.dark` iff dark and `.light` otherwise — fixing startup *and* both toggles via the single shared helper.
- **Known-bad state avoided:** Saved-light users booting into (or toggling to) a half-themed UI where shadcn surfaces go light while Notey custom tokens stay dark.
- **KEEP:** Single-source-of-truth `applyThemeClass`/`applyLayoutModeClass` helpers shared by startup + toggles; in-flight boolean guards mirroring `isCreatingNote`; synchronous `.dark` pre-paint default in `main.tsx`; per-field `PartialGeneralConfig` writes (theme and layout never clobber each other).

## Design Notes

Class rules must stay identical between startup and toggles — hence shared helpers:
```ts
function applyThemeClass(theme: string) {
  const isDark = theme === 'dark';
  const root = document.documentElement;
  root.classList.toggle('dark', isDark);
  root.classList.toggle('light', !isDark); // .dark/.light are a mutually-exclusive pair
}
function applyLayoutModeClass(mode: string) {
  document.documentElement.classList.toggle('compact', mode === 'compact');
}
```
`main.tsx` keeps the synchronous dark default to avoid a flash for the common case; `applyStartupConfig` (async IPC) then corrects to the persisted theme and applies layout. Cross-toggle interference is already safe — each toggle writes only its own field via `PartialGeneralConfig` (the other field is `null`) — so two independent per-function guards suffice; no shared lock needed.

## Verification

**Commands:**
- `npx vitest run src/features/command-palette/actions.test.ts` -- expected: all tests pass, including new startup + concurrency cases.
- `npx tsc --noEmit` -- expected: no type errors.
- `npx eslint src/main.tsx src/features/command-palette/actions.ts` -- expected: clean (no floating-promise / misused-promise violations on the new `void applyStartupConfig()`).

## Suggested Review Order

**Shared class rules (the heart of the fix)**

- Start here — the single source of truth: `.dark`/`.light` toggled as a mutually-exclusive pair (fixes the broken-light-theme bug).
  [`actions.ts:66`](../../src/features/command-palette/actions.ts#L66)
- Layout class rule — `.compact` iff compact; non-compact values stay comfortable.
  [`actions.ts:79`](../../src/features/command-palette/actions.ts#L79)

**Startup application (Action Item 1)**

- Reads config once at boot, applies persisted theme + layout via the shared helpers; on failure keeps defaults.
  [`actions.ts:89`](../../src/features/command-palette/actions.ts#L89)
- Boot wiring: synchronous `.dark` pre-paint default, then `void applyStartupConfig()` reconciles.
  [`main.tsx:9`](../../src/main.tsx#L9)

**Concurrency guards (Action Item 2)**

- Theme toggle in-flight guard mirroring `isCreatingNote` (early-return + `finally` reset).
  [`actions.ts:108`](../../src/features/command-palette/actions.ts#L108)
- Layout toggle in-flight guard, same shape.
  [`actions.ts:150`](../../src/features/command-palette/actions.ts#L150)

**Tests**

- Startup cases: dark+compact, light+comfortable (asserts `.light`), floating→non-compact, getConfig-failure leaves DOM untouched.
  [`actions.test.ts:244`](../../src/features/command-palette/actions.test.ts#L244)
- Concurrency: deferred `get_config` promise → second call dropped → exactly one `update_config`.
  [`actions.test.ts:107`](../../src/features/command-palette/actions.test.ts#L107)
