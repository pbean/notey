---
title: "Settings View Panel"
type: "feature"
created: "2026-06-13"
status: "done"
baseline_commit: "546cc528ad0f180407c5fd177f6554781f91b5c0"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Notey has no central UI for personalization. Theme and layout density can only be toggled blindly via the command palette / hotkeys, font size and family cannot be changed at all, and the global capture shortcut is invisible to the user. Preferences already persist to `config.toml`, but nothing surfaces them.

**Approach:** Build a Settings overlay (the host surface for all of Epic 7) opened via Ctrl/Cmd+, or the palette "Open Settings" entry, rendering three sections — General (theme, layout mode), Editor (font size, font family), Hotkey (current shortcut display) — each control persisting through the existing `updateConfig` command. Theme and font apply live. The deep per-control behaviors owned by later stories (instant-swap theme nuance 7.2, proportional type-scale 7.3, hotkey capture + conflict detection 7.4, window-mode application 7.5) are out of scope here; this story delivers the panel and wires controls to persistence + basic live apply.

## Boundaries & Constraints

**Always:**
- Persist every change via the generated `commands.updateConfig` binding (never raw `invoke`, never a new persistence path). `updateConfig` merges partials server-side, so send only the changed field — no client-side read-modify-write.
- Theme and font changes apply immediately (live CSS swap) in addition to persisting.
- Reuse the existing theme/layout runtime in `command-palette/actions.ts` (`applyThemeClass`, `applyLayoutModeClass`, `userToggled`) as the single source of truth — do not duplicate the class-application rules.
- The overlay mirrors the established overlay pattern (SearchOverlay): dimmed backdrop, focus trap, Esc-to-dismiss, and registration with `overlays/manager.ts` for mutual exclusion.
- Font size is constrained to the 12–24px inclusive range at the point of change.
- Every interactive control has an accessible label; the dialog uses `role="dialog"` + `aria-modal` + `aria-label`.

**Ask First:**
- Reworking the existing `comfortable`/`compact` density semantics of `general.layoutMode`, or removing the palette "Toggle Layout Mode" cycle — that reconciliation is Story 7.5's, not this story's.

**Never:**
- Do NOT implement hotkey capture mode, conflict detection, or "reset to default" (Story 7.4) — the Hotkey section only DISPLAYS the current shortcut plus a deferred "Change" affordance.
- Do NOT implement window-layout-mode behavior (resize / always-on-top / chrome) for floating/half/full (Story 7.5). The selector persists the chosen value only.
- Do NOT implement proportional `--text-*` type-scale or CodeMirror reconfiguration for fonts (Story 7.3) — beyond the single base font-size + font-family CSS vars this story introduces.
- Do NOT add new Tauri commands (the config command surface already exists).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| -------- | ------------- | -------------------------- | -------------- |
| Open via hotkey | Ctrl/Cmd+, pressed | Settings overlay opens, loads current config, traps focus, closes other overlays | N/A |
| Open via palette | "Open Settings" selected | Same as above | N/A |
| Toggle theme | User picks light (was dark) | `data-theme` classes swap live via `applyThemeClass`; `updateConfig({general:{theme:'light'}})` persists | `updateConfig` error → `console.error`, leave applied UI; no crash |
| Change font size | Slider/input set to value | Clamped to 12–24; `--editor-font-size` updates live; persists `editor.fontSize` | Out-of-range input clamped, never persisted raw |
| Change font family | Select "sans-serif" | `--font-primary` swaps to `var(--font-sans)` live; persists `editor.fontFamily` | `updateConfig` error → `console.error`; no crash |
| Change layout mode | Select "half-screen" | Persists `general.layoutMode`; no window behavior yet (7.5) | `updateConfig` error → `console.error`; no crash |
| Dismiss | Esc pressed in overlay | Overlay closes, focus returns to editor | N/A |
| Change hotkey | "Change" clicked | `stubAction('Change global shortcut')` (deferred to 7.4) | N/A |

</frozen-after-approval>

## Code Map

- `src-tauri/src/models/config.rs` -- add `font_family: String` to `EditorConfig` (+ default `"mono"`)
- `src-tauri/src/services/config.rs` -- add `font_family` to `PartialEditorConfig` + `merge_update`; add merge/load test
- `src/generated/bindings.ts` -- regenerated (NOT hand-edited) — gains `fontFamily` on `EditorConfig`/`PartialEditorConfig`
- `src/features/command-palette/actions.ts` -- add `setTheme`, `setLayoutMode`, `setFontSize`, `setFontFamily`; add `applyFontSize`/`applyFontFamily`; extend `applyStartupConfig` to apply persisted font
- `src/features/settings/store.ts` -- new `useSettingsStore` (open/close, config snapshot, overlay registration)
- `src/features/settings/components/SettingsPanel.tsx` -- new overlay component with General/Editor/Hotkey sections
- `src/features/overlays/manager.ts` -- add `'settings'` to `OverlayId`
- `src/features/command-palette/hooks/usePaletteCommands.ts` -- wire "Open Settings" stub → `useSettingsStore.getState().open()`
- `src/features/editor/components/CaptureWindow.tsx` -- add Ctrl/Cmd+, keydown handler + render `<SettingsPanel />`
- `src/features/editor/extensions.ts` -- route editor font through `var(--font-primary)` + `var(--editor-font-size)`
- `src/index.css` -- declare `--font-primary: var(--font-mono)` and `--editor-font-size: 14px` on `:root`

## Tasks & Acceptance

**Execution:**

- [x] `src-tauri/src/models/config.rs` -- add `font_family: String` to `EditorConfig`, default `"mono"` -- enables family persistence
- [x] `src-tauri/src/services/config.rs` -- extend `PartialEditorConfig` + `merge_update` with `font_family`; add a test covering font_family merge and TOML round-trip
- [x] `src/index.css` -- add `--font-primary: var(--font-mono)` and `--editor-font-size: 14px` to `:root`
- [x] `src/features/editor/extensions.ts` -- change editor `&` theme to `fontFamily: 'var(--font-primary)'` and `fontSize: 'var(--editor-font-size)'`
- [x] `src/features/command-palette/actions.ts` -- add `setTheme`/`setLayoutMode` (persist + apply via existing helpers, set `userToggled`), `setFontSize` (clamp 12–24, persist, `applyFontSize`), `setFontFamily` (persist, `applyFontFamily`); `applyFontSize`/`applyFontFamily` set the CSS vars; extend `applyStartupConfig` to apply persisted font
- [x] `src/features/overlays/manager.ts` -- add `'settings'` to `OverlayId`
- [x] `src/features/settings/store.ts` -- create `useSettingsStore`: `isOpen`, `config` snapshot, `open()` (getConfig → snapshot, `closeOtherOverlays('settings')`), `close()`, thin per-setting actions that update the snapshot and delegate to the actions.ts setters; register close fn with overlay manager
- [x] `src/features/settings/components/SettingsPanel.tsx` -- overlay with backdrop, focus trap, Esc-close, `role="dialog"`/`aria-modal`/`aria-label`; General (theme dark/light, layout floating/half-screen/full-screen), Editor (font size 12–24, font family monospace/sans-serif), Hotkey (current `globalShortcut` display + deferred "Change" button), and a footer note that advanced users can edit `config.toml` directly
- [x] `src/features/command-palette/hooks/usePaletteCommands.ts` -- replace the "Open Settings" `stubAction` with `useSettingsStore.getState().open()`
- [x] `src/features/editor/components/CaptureWindow.tsx` -- add Ctrl/Cmd+, handler opening settings; render `<SettingsPanel />`
- [x] tests -- `settings/store.test.ts` (open loads config + mutual exclusion, close), `SettingsPanel.test.tsx` (renders three sections, Esc closes, font clamp, a change calls `updateConfig`), and setter tests in `actions.test.ts` (font clamp, persisted partial shape)

**Acceptance Criteria:**

- Given the app is focused, when the user presses Ctrl/Cmd+, or selects "Open Settings" from the palette, then a modal overlay opens showing General, Editor, and Hotkey sections with focus trapped inside it.
- Given the General section, when viewed, then it shows a Theme control (dark/light) and a Layout mode selector (floating/half-screen/full-screen).
- Given the Editor section, when viewed, then it shows a Font size control constrained to 12–24px and a Font family selector (monospace/sans-serif).
- Given the Hotkey section, when viewed, then it shows the current `globalShortcut` from config plus a "Change" affordance (capture flow deferred to 7.4).
- Given the user changes any setting, when the change is applied, then `commands.updateConfig` is invoked with only that field; theme and font changes also take visible effect immediately; and the overlay can be dismissed with Esc.
- Given a persisted font preference, when the app restarts, then `applyStartupConfig` applies the saved font size and family.
- Given the panel, when displayed, then a note informs the user that advanced users can edit `config.toml` directly.

## Design Notes

- `command-palette/actions.ts` is the app's runtime-apply module (it already owns `applyStartupConfig`, `applyThemeClass`, `applyLayoutModeClass`, and the sticky `userToggled` session markers). New setters live there to preserve single-source-of-truth; `useSettingsStore` delegates to them. Setters take explicit values, so unlike the toggles they need no `getConfig` pre-read — send the partial and let the backend merge.
- Live font apply is intentionally shallow: one base size var (`--editor-font-size`) and one family var (`--font-primary`). Proportional `--text-*` scaling and CodeMirror specifics are Story 7.3. CSS custom properties update rendering live, so no editor reconfiguration is needed for the family/size swap.
- **Layout-mode seam (judgment call):** `general.layoutMode` currently stores density (`comfortable`/`compact`) and the palette toggle cycles those. Story 7.1's AC asks for window modes (floating/half-screen/full-screen) whose behavior belongs to Story 7.5. This story renders the floating/half/full selector and persists the chosen value; `applyLayoutModeClass` treats any non-`compact` value as non-compact (harmless), and the existing density toggle is left untouched for 7.5 to reconcile.

## Verification

**Commands:**

- `cd src-tauri && cargo test export_bindings` -- regenerates `src/generated/bindings.ts`; expected: `fontFamily` present on `EditorConfig`/`PartialEditorConfig`
- `cd src-tauri && cargo test` -- expected: all config tests pass incl. new font_family merge/load
- `cd src-tauri && cargo clippy --all-targets -- -D warnings` -- expected: clean
- `npx tsc --noEmit` -- expected: no type errors (new bindings consumed)
- `npx vitest run` -- expected: settings store, panel, and setter tests pass

### Review Findings

- [x] [Review][Patch] Settings modal now fully traps interaction across keyboard shortcuts and shell chrome [src/features/editor/components/CaptureWindow.tsx:29]
- [x] [Review][Patch] Settings open preserves the current overlay until config loading succeeds [src/features/settings/store.ts:46]
- [x] [Review][Patch] Startup font application no longer clobbers boot-window edits [src/features/command-palette/actions.ts:295]
- [x] [Review][Patch] Concurrent partial config writes now serialize against the latest committed snapshot [src-tauri/src/commands/config.rs:45]
- [x] [Review][Patch] Settings font-size control clamps malformed persisted values before rendering [src/features/settings/components/SettingsPanel.tsx:123]
- [x] [Review][Defer] Legacy `layoutMode` values are misrepresented in the new selector [src/features/settings/components/SettingsPanel.tsx:119] — deferred, pre-existing
- [x] [Review][Patch] Settings modal does not trap Ctrl/Cmd shortcuts while open [src/features/settings/components/SettingsPanel.tsx:83]
- [x] [Review][Patch] Settings backdrop is an unlabeled mouse-only dismiss target [src/features/settings/components/SettingsPanel.tsx:141]
- [x] [Review][Patch] Selecting "Open Settings" closes the palette before config loading succeeds [src/features/command-palette/components/CommandPalette.tsx:40]
- [x] [Review][Patch] Settings open/save paths do not recover when generated bindings reject with `Error` [src/features/settings/store.ts:46]
- [x] [Review][Patch] Rapid successive setting changes can persist out of order [src/features/command-palette/actions.ts:403]
- [x] [Review][Defer] Hotkey runtime can drift from saved config when OS re-registration fails [src-tauri/src/commands/config.rs:52] — deferred, pre-existing

#### Review Ledger (2026-06-13)

patch: Settings modal now fully traps interaction across keyboard shortcuts and shell chrome [src/features/editor/components/CaptureWindow.tsx:29] — blocked overlay-opening shortcuts while Settings is open and made the modal cover the full shell.
patch: Settings open preserves the current overlay until config loading succeeds [src/features/settings/store.ts:46] — delayed `closeOtherOverlays('settings')` until `getConfig()` returned `ok`.
patch: Startup font application no longer clobbers boot-window edits [src/features/command-palette/actions.ts:295] — added sticky `fontSize` / `fontFamily` startup guards mirroring the existing theme/layout race protection.
patch: Concurrent partial config writes now serialize against the latest committed snapshot [src-tauri/src/commands/config.rs:45] — held the config mutex through merge + save so overlapping partial updates cannot save from stale clones.
patch: Settings font-size control clamps malformed persisted values before rendering [src/features/settings/components/SettingsPanel.tsx:123] — normalized the slider/value display through `clampFontSize()` to match the live-applied CSS variable.
defer: Legacy `layoutMode` values are misrepresented in the new selector [src/features/settings/components/SettingsPanel.tsx:119] — Story 7.1 is reusing `general.layoutMode` for future window modes, and fixing the legacy display needs a Story 7.5 product/schema decision.
dismiss: Optimistic Settings snapshot remains changed when persistence fails [src/features/settings/store.ts:56] — the spec explicitly says theme/font changes should stay applied and only log on `updateConfig` failure.
dismiss: Theme control lacks a `system` option [src/features/settings/components/SettingsPanel.tsx:118] — the accepted Story 7.1 control surface is dark/light only, so adding `system` is a separate product choice.
dismiss: Unsupported `fontFamily` strings still survive in config.toml [src-tauri/src/models/config.rs:33] — runtime already normalizes unknown values to mono; stricter config-schema validation is broader hardening outside this story.

#### Review Ledger (2026-06-13T23:45:42-0700)

patch: Settings modal does not trap Ctrl/Cmd shortcuts while open [src/features/settings/components/SettingsPanel.tsx:83] — browser/webview shortcuts can still escape the modal because the current handlers only early-return.
patch: Settings backdrop is an unlabeled mouse-only dismiss target [src/features/settings/components/SettingsPanel.tsx:141] — the clickable backdrop is interactive but unreachable and unnamed for keyboard/screen-reader users.
patch: Selecting "Open Settings" closes the palette before config loading succeeds [src/features/command-palette/components/CommandPalette.tsx:40] — the palette closes before `getConfig()` resolves, so a load failure drops the current overlay.
patch: Settings open/save paths do not recover when generated bindings reject with `Error` [src/features/settings/store.ts:46, src/features/command-palette/actions.ts:403] — `typedError()` rethrows `Error` instances, so transport-level failures can surface as unhandled rejections instead of logging cleanly.
patch: Rapid successive setting changes can persist out of order [src/features/command-palette/actions.ts:403] — explicit settings writes are ungated, so older async saves can land after newer visible choices.
defer: Hotkey runtime can drift from saved config when OS re-registration fails [src-tauri/src/commands/config.rs:52] — the shortcut is persisted before OS re-registration and this rollback gap predates Story 7.1.
dismiss: Blind-layer generated-bindings corruption claims do not match the current file or passing typecheck [src/generated/bindings.ts] — contradicted by the live workspace and `npx tsc --noEmit`.
dismiss: Blind-layer test-file corruption claims do not match the current files or passing focused Vitest runs [src/features/editor/components/CaptureWindow.test.tsx, src/test-utils/setup.ts] — contradicted by the live workspace and the targeted test pass.
dismiss: Settings open would consume all keydown events inside the modal [src/features/editor/components/CaptureWindow.tsx] — contradicted by the current code; no blanket `preventDefault()` branch exists.
dismiss: `useTabKeyboardNav` captures stale settings-open state [src/features/tabs/hooks/useTabKeyboardNav.ts:12] — the listener reads overlay state through store `getState()` at event time rather than closing over stale booleans.
dismiss: Layout-mode startup suppression on explicit settings change [src/features/command-palette/actions.ts:422] — current non-compact live apply is the accepted 7.1 seam; Story 7.5 owns the semantics reconciliation.
dismiss: Optimistic Settings snapshot remains changed when persistence fails [src/features/settings/store.ts:56] — previously dismissed — see ledger.
dismiss: Theme/system-mode representation in the settings buttons [src/features/settings/components/SettingsPanel.tsx:118] — previously dismissed — see ledger.
dismiss: Unsupported `fontFamily` strings still survive in config.toml [src-tauri/src/models/config.rs:33] — previously dismissed — see ledger.
