---
title: "Theme Switching (Dark/Light)"
type: "feature"
created: "2026-06-13"
status: "done"
baseline_commit: "100f338866a4becf77037b6036bfb0434d091386"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 7.1 built the theme runtime (instant `.dark`/`.light` class swap, OS `prefers-color-scheme` resolution + live tracking, Ctrl/Cmd+Shift+T toggle, palette entry, settings dark/light buttons, persistence). But Story 7.2's acceptance criteria are not fully met: (1) the spec/PRD mandate a `data-theme` attribute on `html` as the switch contract — currently only classes toggle; (2) first launch defaults to `theme: "dark"` regardless of the OS, so a brand-new user is never given the `prefers-color-scheme` default the AC requires; (3) the fully-supported `system` value is not selectable in the settings UI; (4) WCAG 2.1 AA contrast has not been verified for both themes.

**Approach:** Close the four gaps without rebuilding the working runtime: mirror the resolved theme onto a `data-theme` attribute in the single-source apply path; change the config default to `system` and make the synchronous boot apply the OS-resolved theme so first launch honors `prefers-color-scheme`; add a `system` choice to the settings theme control; and add a drift-proof contrast audit test over both themes' design tokens, fixing any pair that fails the AA threshold.

## Boundaries & Constraints

**Always:**
- `applyThemeClass` stays the single source of truth for theme application. It must, in one place, toggle the `.dark`/`.light` classes (the token-cascade driver, per 7.1's frozen decision) AND set `data-theme="dark"|"light"` on `<html>` to the **resolved** theme (so `system` resolves to `dark`/`light`, never the literal string `system`).
- First launch with no saved preference resolves to the OS `prefers-color-scheme`; a saved manual `dark`/`light` preference always overrides it on restart (the existing `userToggled`/startup-skip machinery already guarantees this — do not regress it).
- The synchronous boot in `main.tsx` must apply the OS-resolved theme (class + `data-theme`) through a helper exported from `actions.ts` — never duplicate the class/attribute rule inline.
- Persist theme changes only via the generated `commands.updateConfig` binding (the existing `setTheme`/`toggleTheme` paths already do this); send only the changed field.
- Contrast audit reads token values from `src/index.css` (the source of truth) at test time so it cannot drift from the stylesheet.

**Ask First:**
- Changing any shadcn oklch token values, or altering the `.dark`/`.light` cascade architecture (dark-first Notey `:root` + class overrides) established in 7.1.

**Never:**
- Do NOT rip out or replace the `.dark`/`.light` class mechanism with attribute-only selectors — the attribute is the AC contract/test hook; classes remain the styling driver. Do not duplicate the class rules anywhere.
- Do NOT change the `Ctrl/Cmd+Shift+T` toggle to cycle through `system` — it stays a binary dark↔light toggle per the AC ("toggle between dark and light"). `system` is reachable only via the settings UI.
- Do NOT add new Tauri commands or a new persistence path; the config surface already supports `theme`.
- Do NOT perform the comprehensive app-wide / per-component accessibility audit (Story 7.8). This story's contrast scope is the theme **design tokens** in both themes only.
- Do NOT add CSS transitions/animations to color or theme changes (the swap must stay instantaneous).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| -------- | ------------- | -------------------------- | -------------- |
| Toggle/select dark | theme set to `dark` | `<html>` gets `.dark` (no `.light`) and `data-theme="dark"`; persisted | N/A |
| Toggle/select light | theme set to `light` | `<html>` gets `.light` (no `.dark`) and `data-theme="light"`; persisted | N/A |
| Select system, OS dark | `theme: system`, `prefers-color-scheme: dark` | resolves dark: `.dark` + `data-theme="dark"`; live OS flip re-resolves | N/A |
| Select system, OS light | `theme: system`, `prefers-color-scheme: light` | resolves light: `.light` + `data-theme="light"` | N/A |
| First launch, no saved pref | fresh config → default `theme: system` | boot applies OS-resolved theme (class + `data-theme`); no dark flash for a light-OS user | `matchMedia` absent → fall back to light |
| Restart with manual pref | saved `theme: dark` on a light OS | startup applies `dark`, overriding OS; not reverted by boot default | `getConfig` error → boot default left in place |
| `matchMedia` unavailable | jsdom / degraded webview, `theme: system` | resolves to light; `data-theme="light"`; no throw | feature-detected, never throws |
| Contrast audit | token pairs in both themes | all required text/bg ≥4.5:1, UI/focus ≥3:1 | test fails listing the offending pair |

</frozen-after-approval>

## Code Map

- `src/features/command-palette/actions.ts` -- `applyThemeClass` (add `data-theme` attribute alongside the class toggle); add exported synchronous `applyBootTheme()` that applies the OS-resolved theme for the boot path
- `src/main.tsx` -- replace the hardcoded `document.documentElement.classList.add('dark')` with `applyBootTheme()`
- `src-tauri/src/models/config.rs` -- change `GeneralConfig::default().theme` from `"dark"` to `"system"`; update the rustdoc
- `src-tauri/src/services/config.rs` -- update any default-config test asserting `theme == "dark"` to `"system"`
- `src/features/settings/components/SettingsPanel.tsx` -- extend the theme control from `['dark','light']` to include `'system'`
- `src/index.css` -- source of the Notey design tokens (`:root` dark, `.light`); adjust only token values that fail the contrast audit
- `src/features/command-palette/actions.test.ts` -- add `data-theme` attribute assertions + `applyBootTheme` tests
- `src/features/settings/components/SettingsPanel.test.tsx` -- add `system` option render + select test
- `src/features/theme/contrast.test.ts` -- NEW: parse `index.css` token blocks, compute WCAG contrast ratios, assert AA thresholds for both themes

## Tasks & Acceptance

**Execution:**

- [x] `src/features/command-palette/actions.ts` -- in `applyThemeClass`, after toggling `.dark`/`.light`, also `root.setAttribute('data-theme', isDark ? 'dark' : 'light')`; update its rustdoc-style JSDoc to note the attribute is the AC contract mirroring the resolved theme while classes drive the token cascade
- [x] `src/features/command-palette/actions.ts` -- add exported `applyBootTheme()`: synchronously resolve the OS theme via the existing `systemPrefersDark()` helper and apply class + `data-theme` (delegating to `applyThemeClass('system')` so the rule stays single-source), used only as the pre-config boot default
- [x] `src/main.tsx` -- import and call `applyBootTheme()` instead of hardcoding `.dark`; update the comment to explain the boot default now honors `prefers-color-scheme`
- [x] `src-tauri/src/models/config.rs` -- set default `theme` to `"system"`; update the struct/field doc to state first-launch follows the OS until the user picks a theme
- [x] `src-tauri/src/services/config.rs` -- update the default-config test (and any TOML round-trip default assertion) to expect `theme == "system"`
- [x] `src/features/settings/components/SettingsPanel.tsx` -- render `system`/`dark`/`light` in the theme `role="group"`; `system` calls `setTheme('system')`; keep `aria-pressed`, focus-ring, and `data-testid={theme-${t}}` conventions; ensure `firstControlRef` still targets the first button
- [x] `src/features/theme/contrast.test.ts` -- NEW: read `src/index.css`, extract hex tokens from the `:root` (dark) and `.light` blocks, compute WCAG 2.1 relative-luminance contrast ratios, and assert: `text-primary`/`text-secondary` on each surface (`bg-primary`/`bg-elevated`/`bg-surface`) ≥ 4.5:1; `text-muted` (incidental), `accent`, `border-default`, `focus-ring`, `success`/`warning`/`error` against `bg-primary` ≥ 3:1 — for BOTH themes; failures must name the offending token pair and theme
- [x] `src/index.css` -- adjust only the specific token value(s) the contrast test flags (minimal change to reach the threshold); leave shadcn oklch tokens untouched
- [x] `src/features/command-palette/actions.test.ts` -- assert `data-theme` is set to the resolved value for dark/light/system(dark)/system(light)/matchMedia-absent; add `applyBootTheme` tests (OS dark → dark+attribute, OS light → light+attribute, matchMedia absent → light)
- [x] `src/features/settings/components/SettingsPanel.test.tsx` -- assert a `system` button renders and clicking it calls the store `setTheme('system')`

**Acceptance Criteria:**

- Given the user toggles or selects a theme (settings, palette "Toggle Theme", or Ctrl/Cmd+Shift+T), when the theme changes, then `<html>` exposes `data-theme="dark"` or `data-theme="light"` matching the resolved theme, all CSS custom properties swap instantly with no re-render, and the preference persists via `updateConfig`.
- Given a first launch with no saved preference, when the app starts, then the default config theme is `system`, the boot path applies the theme matching `prefers-color-scheme`, and no opposite-theme flash occurs for the common case.
- Given a saved manual `dark`/`light` preference, when the app restarts, then that preference is applied and overrides the OS setting.
- Given the settings theme control, when viewed, then it offers `system`, `dark`, and `light`, and selecting `system` makes the app follow and live-track the OS appearance.
- Given both themes, when the contrast audit test runs, then every required text/background pair meets ≥4.5:1 and every UI-component/focus pair meets ≥3:1 (WCAG 2.1 AA), with no token regression.

## Design Notes

- **Attribute vs. class (judgment call):** The PRD/epic say theme is driven by a `data-theme` attribute; 7.1 (frozen) implemented `.dark`/`.light` classes because shadcn tokens are light-first in `:root` and Notey tokens are dark-first, so both need class overrides. Rather than re-architect the cascade (Story-7.8-sized risk), `applyThemeClass` now sets BOTH: classes remain the styling driver, and `data-theme` becomes the resolved-theme contract the AC and tests assert on. `system` always resolves to `dark`/`light` in the attribute — the attribute reflects what is shown, never the mode name.
- **First-launch default:** the runtime already resolves and live-tracks `system`; the only reason first launch didn't honor the OS was the `"dark"` default. Flipping the default to `"system"` activates the existing path. `applyBootTheme()` exists so the synchronous pre-config paint also matches the OS (avoiding a dark flash for light-OS users) without duplicating the apply rule.
- **Contrast test shape (drift-proof):** the test parses `index.css` hex tokens at runtime instead of hardcoding a palette, so editing a token re-checks automatically. Scope is the Notey hex design tokens (the app's actual chrome) for both themes; shadcn oklch tokens and per-component audits are Story 7.8. Use the standard sRGB relative-luminance formula (linearize channels, `L = 0.2126R+0.7152G+0.0722B`, ratio `(L1+0.05)/(L2+0.05)`).

## Verification

**Commands:**

- `cd src-tauri && cargo test` -- expected: config default test passes with `theme == "system"`; all config tests green
- `cd src-tauri && cargo clippy --all-targets -- -D warnings` -- expected: clean
- `npx tsc --noEmit` -- expected: no type errors
- `npx vitest run` -- expected: `data-theme`/`applyBootTheme` assertions in `actions.test.ts`, the `system` option test in `SettingsPanel.test.tsx`, and `contrast.test.ts` all pass

### Review Findings

- [x] [Review][Patch] Toggle Theme no-ops for `theme: system` on a dark OS [src/features/command-palette/actions.ts:357]
- [x] [Review][Patch] Contrast audit omits required `text-muted`/`border-default` checks and hides failing token values [src/features/theme/contrast.test.ts:18]
- [x] [Review][Patch] Contrast audit depends on repo-root `process.cwd()` [src/features/theme/contrast.test.ts:29]
- [x] [Review][Defer] Theme contract is documented but not schema-enforced [src/generated/bindings.ts:114] — deferred, pre-existing

#### Review Ledger (2026-06-14)

patch: Toggle Theme no-ops for `theme: system` on a dark OS [src/features/command-palette/actions.ts:357] — `toggleTheme()` maps any non-`dark` preference to `dark`, so a dark-resolved `system` user sees no visual change on the first toggle.
patch: Contrast audit omits required `text-muted`/`border-default` checks and hides failing token values [src/features/theme/contrast.test.ts:18] — the new test explicitly excludes spec-required pairs, and current `text-muted`/`border-default` values still fall below the required 3:1 ratios.
patch: Contrast audit depends on repo-root `process.cwd()` [src/features/theme/contrast.test.ts:29] — the file reader is coupled to the current working directory instead of the test file location.
defer: Theme contract is documented but not schema-enforced [src/generated/bindings.ts:114] — the UI currently emits only valid values; hardening the config/schema surface is broader than Story 7.2.
dismiss: Absolute-path additions reported by blind diff review [n/a] — false positive caused by `git diff --no-index` absolute-path headers for untracked files, not misplaced repo files.
