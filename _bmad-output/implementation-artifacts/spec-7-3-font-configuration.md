---
title: "Font Configuration"
type: "feature"
created: "2026-06-14"
status: "done"
baseline_commit: "414b26b19ef1323be8cbe5ea963c4ecd8d05cb44"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The font-configuration plumbing was built ahead during Stories 7.1/7.2: the `[editor]` config (`fontSize` default 14, `fontFamily` default `mono`), the `PartialEditorConfig` merge path, the settings store actions, the Settings → Editor controls (12–24px range + mono/sans select), the live apply helpers (`applyFontSize` sets `--editor-font-size`, `applyFontFamily` sets `--font-primary`), boot-window persistence, and their tests all already exist and pass. One acceptance criterion remains unmet: the epic requires that **the type scale scale proportionally from the chosen base rather than only changing one element**. Today `applyFontSize` changes only `--editor-font-size` (the editor body); the `--text-*` type-scale ramp (`--text-xs … --text-2xl`) is hard-coded to fixed px, so changing the font size does not move the rest of the app's typography. The code itself records the gap: `actions.ts` JSDoc states "Proportional `--text-*` scaling is deferred to Story 7.3."

**Approach:** Close the single remaining gap by anchoring the `--text-*` type-scale ramp to the user-chosen base. Redefine the six `--text-*` tokens in `src/index.css` as `calc()` proportions of `var(--editor-font-size)` (with `--text-base` equal to the base), so the existing single knob — `--editor-font-size`, already set live by `applyFontSize` and at startup by `applyStartupConfig` — drives the whole proportional ramp with no new JS path. This makes both consumption paths scale uniformly: the 63 inline-style `var(--text-*)` references (read from `:root`) and the Tailwind `text-*` utility classes (which inline the token value at build). Update the stale "deferred to Story 7.3" JSDoc to describe the now-implemented behavior, and add a drift-proof test that the ramp is anchored to the base and reproduces the current px at the default size.

## Boundaries & Constraints

**Always:**
- `--editor-font-size` stays the single base knob. `applyFontSize` remains the one place that sets it (class/attribute-free `style.setProperty` on `<html>`); the proportional `--text-*` ramp derives from it purely in CSS — never duplicate a per-step ramp in JS.
- The `--text-*` ramp must reproduce the current px values at the default base of 14px (`xs 11, sm 13, base 14, lg 16, xl 18, 2xl 22`) — no visual regression at the default; write each token as `calc(var(--editor-font-size) * N / 14)` (and `--text-base: var(--editor-font-size)`) so the original numerator stays self-documenting.
- Font size stays clamped to the 12–24px range (`clampFontSize`, `FONT_SIZE_MIN/MAX`); the editor body keeps reading `--editor-font-size` directly.
- The `--text-*` tokens must remain defined in the `@theme inline` block (lines 10–15 of `index.css`) so Tailwind keeps generating the `text-*` utilities and still emits the variables to `:root` for the inline-style references.

**Ask First:**
- Changing the proportion ratios away from the current 14px-anchored scale (e.g. adopting a modular-scale ratio), or scoping the proportional scale to a subtree instead of `:root` (which would decouple editor text from app chrome).

**Never:**
- Do NOT re-add or re-derive anything already built: the `EditorConfig`/`PartialEditorConfig` fields and defaults, the merge/save/load path, a new Tauri command or persistence channel, the store `setFontSize`/`setFontFamily` actions, or the Settings Editor controls. This story is the type-scale wiring only.
- Do NOT change the clamp range, the `mono`/`sans` family mapping, or the boot-window `userToggled` guards.
- Do NOT introduce CSS transitions/animations on font-size changes, and do NOT touch the theme/contrast tokens (Story 7.2) or attempt the per-component accessibility audit (Story 7.8).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| -------- | ------------- | -------------------------- | -------------- |
| Default size | `fontSize: 14` (default) | `--text-*` resolve to the current px (11/13/14/16/18/22); no visual change vs. today | N/A |
| Increase size | user sets `fontSize: 20` | `--editor-font-size: 20px`; every `--text-*` and `text-*` utility scales proportionally (e.g. `--text-sm` ≈ 18.6px, `--text-2xl` ≈ 31.4px); editor body is 20px | N/A |
| Decrease to min | user sets `fontSize: 12` | base clamps to 12px; ramp scales down proportionally | clamped by `clampFontSize` |
| Above max | input/stored `fontSize: 30` | clamped to 24px; ramp scales from 24 | clamped, never exceeds 24 |
| Family change | `fontFamily: sans` | `--font-primary → var(--font-sans)`; size ramp unaffected | invalid family resolves to mono |
| Restart with saved size | persisted `fontSize: 18` | `applyStartupConfig` sets `--editor-font-size: 18px`; ramp restored proportionally before paint settles | `getConfig` error → defaults left in place |

</frozen-after-approval>

## Code Map

- `src/index.css` -- `@theme inline` block, lines 10–15: redefine `--text-xs … --text-2xl` as `calc()` proportions of `var(--editor-font-size)`; `--editor-font-size` base lives at line 185 in the Notey `:root` (referenced, unchanged)
- `src/features/command-palette/actions.ts` -- `applyFontSize` (lines ~278–286): functional code unchanged (still sets `--editor-font-size`); replace the "Proportional `--text-*` scaling is deferred to Story 7.3" JSDoc with the implemented behavior
- `src/features/theme/typescale.test.ts` -- NEW: parse `index.css`, assert the `--text-*` ramp is anchored to `--editor-font-size` and reproduces the current px at base 14 (mirrors `contrast.test.ts`'s index.css loading)
- `src/features/editor/extensions.ts` -- (reference only) editor theme already reads `var(--editor-font-size)`/`var(--font-primary)`; no change
- `src/features/settings/components/SettingsPanel.tsx` -- (reference only) Editor controls already render and bind to persisted config; no change

## Tasks & Acceptance

**Execution:**

- [x] `src/index.css` -- in the `@theme inline` block, replace the six fixed-px `--text-*` declarations with base-anchored `calc()`: `--text-base: var(--editor-font-size)`, and `--text-xs/sm/lg/xl/2xl: calc(var(--editor-font-size) * {11,13,16,18,22} / 14)`. Add a short comment that the ramp is proportional to the editor base font size (Story 7.3) and that 14 is the default anchor.
- [x] `src/features/command-palette/actions.ts` -- update the `applyFontSize` JSDoc: drop the "deferred to Story 7.3" line; state that setting `--editor-font-size` drives the proportional `--text-*` ramp defined in `index.css`, so the base is the single knob. No behavior change.
- [x] `src/features/theme/typescale.test.ts` -- NEW: read `src/index.css` (same `file:`/Vite-server loader as `contrast.test.ts`), extract each `--text-*` declaration, assert it references `var(--editor-font-size)` (base references it directly; the others via `calc(... * N / 14)`), and assert that evaluating the ratio at a 14px base reproduces 11/13/14/16/18/22 and at a 20px base yields the proportional values — so the scale is wired and the default has no regression.

**Acceptance Criteria:**

- Given the default config (`fontSize: 14`), when the app renders, then `--text-xs … --text-2xl` resolve to 11/13/14/16/18/22 px exactly — identical to the pre-change appearance.
- Given the user changes the editor font size in Settings, when the size applies, then `--editor-font-size` updates live AND the entire `--text-*` type scale (and the `text-*` Tailwind utilities) scales proportionally from the new base in the same paint — not just the editor body — with the value persisted via `updateConfig` and the size clamped to 12–24px.
- Given a saved font size, when the app restarts, then `applyStartupConfig` restores `--editor-font-size` and the proportional ramp follows, with no opposite-state flash for the common case.
- Given the type-scale test, when it runs, then it confirms the ramp is anchored to `--editor-font-size` and reproduces the default px values, failing loudly if any token drifts off the base.

## Design Notes

- **Why CSS `calc`, not JS:** the build output shows `--text-*` is emitted to `:root` (inline-style `var(--text-*)` refs, 63 of them) *and* inlined into utilities (`.text-sm{font-size:13px}`) because of `@theme inline`. A JS ramp on `documentElement` would only reach the `:root`/inline-style path, leaving utility classes unscaled and inconsistent. Defining the tokens as `calc(var(--editor-font-size) * N / 14)` covers both paths from the one base the runtime already sets, and stays drift-proof. `calc(14px * 11 / 14)` computes to exactly 11px, so the default is pixel-identical.
- **Scope of "the type scale":** anchoring at `:root` means a larger editor font also enlarges app chrome (status bar, tabs, search, settings) that consume `--text-*`. That is the intended accessibility behavior for this epic ("scale proportionally from the chosen base rather than only changing one element"), and the editor body (which reads `--editor-font-size` directly) stays consistent because `--text-base` equals the base.
- **Test shape:** jsdom does not resolve `calc()` or the CSS cascade, so the test parses the `index.css` source (like `contrast.test.ts`) and checks the algebra — that each token is anchored to `--editor-font-size` with the right ratio — rather than a computed layout. This catches a token being reverted to a fixed px or given the wrong ratio.

## Verification

**Commands:**

- `npx vite build` -- expected: Tailwind compiles the `calc()` theme values; the emitted CSS contains `--text-*: calc(var(--editor-font-size) * …)` and `text-*` utilities inline the same calc (confirms `@theme inline` accepts the expressions)
- `npx vitest run` -- expected: the new `typescale.test.ts` passes, and the existing `setFontSize`/`setFontFamily`/`applyStartupConfig` and `SettingsPanel` font tests stay green
- `npx tsc --noEmit` -- expected: no type errors
- `cd src-tauri && cargo test` -- expected: config/editor-default tests still green (no backend change; smoke-check only)

### Review Findings

- [x] [Review][Patch] Type-scale audit does not enforce the exact `@theme inline` `/14` contract [src/features/theme/typescale.test.ts:29]

#### Review Ledger (2026-06-14T00:58:23-07:00)

patch: Type-scale audit does not enforce the exact `@theme inline` `/14` contract [src/features/theme/typescale.test.ts:29] — the audit matched the first stylesheet hit and only checked numeric equivalence, so it could pass without ensuring the six audited tokens remain uniquely authored in `@theme inline` with the spec-required `/14` anchor.
dismiss: Missing `--editor-font-size` fallback in the proportional ramp [src/index.css:10] — contradicted by `:root` already defining `--editor-font-size: 14px`.
dismiss: Proportional type scaling lacks chrome-layout regression coverage [src/index.css:10] — speculative; the story intentionally widens `text-*` consumers and the generated CSS confirms both token and utility paths scale from the same base.
dismiss: The proportional ramp omits matching line-height scaling [src/index.css:10] — contradicted by generated unitless `--text-*-line-height` tokens that continue to scale with font size.
dismiss: The audit should mount UI and assert computed styles instead of parsing CSS [src/features/theme/typescale.test.ts:1] — the frozen spec explicitly requires a source-parse algebraic test because jsdom does not resolve this `calc()`-driven cascade reliably.
dismiss: The audit should accept fallback `var()` or algebraically equivalent formulas [src/features/theme/typescale.test.ts:58] — the spec intentionally requires the exact self-documenting `var(--editor-font-size)` and `calc(... * N / 14)` authoring shape.
dismiss: The audit should cover more than the six named `--text-*` tokens [src/features/theme/typescale.test.ts:34] — the story scope is exactly `xs/sm/base/lg/xl/2xl`, the only ramp entries it changes.
dismiss: Runtime clamp/setter behavior is untested by this patch [src/features/theme/typescale.test.ts:66] — contradicted by existing `actions.test.ts` coverage for clamping, live application, and startup restore.
dismiss: `epic-6` cannot be `done` while retro items remain open [_bmad-output/implementation-artifacts/sprint-status.yaml:109] — intentional tracking model: epic completion and retro action items are recorded independently in this file.
dismiss: Epic 5 and Epic 6 retro items duplicate ownership for carried work [_bmad-output/implementation-artifacts/sprint-status.yaml:185] — intentional carry-forward cross-references, not contradictory state transitions.
dismiss: `last_updated` understates the broader sprint-status edits [_bmad-output/implementation-artifacts/sprint-status.yaml:40] — comment-only metadata; no automation or state transition depends on the prose after the date.
