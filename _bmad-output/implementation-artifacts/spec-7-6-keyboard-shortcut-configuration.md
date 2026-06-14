---
title: "Keyboard Shortcut Configuration"
type: "feature"
created: "2026-06-14"
status: "done"
baseline_commit: "bf70d2543420e983fb420481fa0d710757e8fbe8"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Notey's in-app keyboard shortcuts (command palette, search, new note, note list, toggle theme, close tab, etc.) are hard-coded across `CaptureWindow.tsx` and `useTabKeyboardNav.ts` (`e.key === 'p'`, `'f'`, …). There is no `[shortcuts]` config section, no Settings surface listing them, and no way for a user to rebind any of them — Story 7.6 (FR44, UX-DR27) requires that all application shortcuts be listed with their current bindings, rebindable via capture mode with conflict warnings, persisted to `config.toml`, and loaded on startup.

**Approach:** Add a `[shortcuts]` config section (`ShortcutConfig`) holding the six rebindable in-app actions; persist through the existing `update_config`/`config_service` path (no new command, no OS-level registration — these are webview shortcuts). On the frontend add a pure shortcut module (`matchesShortcut`, canonicalize/display, conflict detection), a live `bindings` map in `useSettingsStore` hydrated at startup, a Settings "Shortcuts" section that lists every shortcut (six editable via a capture row reusing the Story-7.4 capture pattern, the rest shown read-only as "Reserved"), and rewire the live handlers to match against the configured bindings instead of literals.

## Boundaries & Constraints

**Always:**
- **Six configurable actions**, each stored in `[shortcuts]` and rebindable: `commandPalette` (default `Ctrl+P`), `search` (`Ctrl+F`), `newNote` (`Ctrl+N`), `toggleNoteList` (`Ctrl+B`), `toggleTheme` (`Ctrl+Shift+T`), `closeTab` (`Ctrl+W`).
- In-app shortcut strings reuse the Story-7.4 capture grammar exactly: `[Ctrl|Cmd]+[Shift]+[Alt]+KEY` where `KEY ∈ A–Z, 0–9` (from `formatShortcutFromEvent`). The **primary modifier is mandatory**. Stored strings are **canonical** (`Ctrl` token cross-platform — `canonicalizeShortcut` rewrites a captured `Cmd` to `Ctrl`); the matcher treats the `Ctrl`/`Cmd` token interchangeably as the platform command modifier (`event.ctrlKey || event.metaKey`); `displayShortcut` localizes `Ctrl`→`⌘` on macOS for the UI only.
- `matchesShortcut(event, shortcut)` is the single matching primitive: primary modifier required; `Shift`/`Alt` must match **exactly** (present iff held — `Ctrl+P` must NOT fire on `Ctrl+Shift+P`); main key compared via `event.code` (`Key{A-Z}`/`Digit{0-9}`, layout-independent). All existing overlay guards and `e.repeat` guards in the handlers are preserved.
- **Reserved shortcuts** are listed read-only in Settings with their current binding but are NOT rebindable, because their keys fall outside the capture grammar or are a structural range: `openSettings` (`Ctrl+,`), `nextTab` (`Ctrl+Tab`), `prevTab` (`Ctrl+Shift+Tab`), tab-jump (`Ctrl+1`…`Ctrl+9`), back/hide (`Esc`). Their handlers stay hard-coded.
- Conflict detection runs in the frontend before persisting a rebind: a captured combo that equals another configurable action's current binding, OR is in the reserved-combo denylist (`Ctrl+1`…`Ctrl+9`, the only capturable reserved combos), is rejected with an inline warning naming the clash; the user recaptures or cancels (no double-binding is ever saved). Capturing `Esc`/`Tab`/punctuation yields `null` from the formatter → inline "use a modifier + letter/number" hint.
- Persistence flows only through `commands.updateConfig({ shortcuts: { … } })` → `merge_update`; missing `[shortcuts]` section or missing keys fall back to defaults (`#[serde(default)]`). The live `bindings` map is hydrated in `applyStartupConfig` so custom bindings take effect on startup, and updated optimistically after a successful save.

**Ask First:**
- Making any reserved shortcut (`Esc`, `Ctrl+,`, `Ctrl+Tab`, tab-jump) rebindable — that requires widening the shared capture grammar (which the global-hotkey path in Story 7.4 also depends on) and is deferred.
- Adding a real "Switch Workspace" shortcut — the palette entry is a `stubAction`; no working feature exists to bind, so it is excluded.

**Never:**
- Do NOT register in-app shortcuts with `tauri-plugin-global-shortcut` or touch `update_config`'s hotkey branch, `parse_shortcut`, `resolve_active_shortcut`, or the global-capture-shortcut path (Story 7.4). In-app shortcuts are webview-only and need no OS registration or validation command.
- Do NOT widen or modify the shared `formatShortcutFromEvent`/`platformDefaultShortcut` in `shortcut.ts` (global-hotkey contract). Add a separate `shortcuts.ts` module.
- Do NOT add a new Tauri command or a second persistence path; reuse `get_config`/`update_config`.
- Do NOT allow two actions on the same combo, and do NOT change theme/font/layout/hotkey setters or the per-component accessibility audit (Story 7.8).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| -------- | ------------- | -------------------------- | -------------- |
| Match configured shortcut | binding `Ctrl+P`, event Ctrl+P (`code=KeyP`) | `matchesShortcut` → true; palette toggles | N/A |
| Reject extra modifier | binding `Ctrl+P`, event Ctrl+Shift+P | `matchesShortcut` → false | N/A |
| Cmd on macOS | binding `Ctrl+F`, event Cmd+F (`metaKey`) | true (primary modifier interchangeable) | N/A |
| Canonicalize captured Cmd | capture `Cmd+B` on macOS | stored as `Ctrl+B`; displayed `⌘B` | N/A |
| Conflict with other action | capture `Ctrl+F` while rebinding `newNote` | inline warning "already bound to Search"; save blocked | recapture/cancel; nothing persisted |
| Conflict with reserved combo | capture `Ctrl+5` (tab-jump range) | inline warning "reserved for Jump to tab"; save blocked | recapture/cancel |
| Unrepresentable capture | press `Esc`/`Tab`/`Ctrl+,` in capture | formatter returns `null`; inline hint shown, no combo captured | stay in capture |
| Rebind persists + applies | capture `Ctrl+G` for `search`, Save | `updateConfig({shortcuts:{search:"Ctrl+G"}})` ok → `bindings.search="Ctrl+G"`, toast; Ctrl+G now opens search, Ctrl+F no longer does | on save error: toast, keep old binding, return false |
| Reset one shortcut | "Reset" on `search` | binding restored to `Ctrl+F`, persisted | N/A |
| Missing `[shortcuts]` section | legacy `config.toml` with no `[shortcuts]` | all six default per `ShortcutConfig::default()`; app uses defaults | N/A |
| Startup hydration | persisted `search="Ctrl+G"` at launch | `applyStartupConfig` sets `bindings`; handler honors `Ctrl+G` from first keypress | on getConfig error: defaults retained |

</frozen-after-approval>

## Code Map

- `src-tauri/src/models/config.rs` -- add `ShortcutConfig` struct (6 `String` fields, `#[serde(default = "…")]` per field), `Default` impl, and `pub shortcuts: ShortcutConfig` (`#[serde(default)]`) on `AppConfig`. Default values are canonical `Ctrl+…` strings. Add a default-assertion test.
- `src-tauri/src/services/config.rs` -- add `PartialShortcutConfig` (6 `Option<String>`), `shortcuts: Option<PartialShortcutConfig>` on `PartialAppConfig`, and merge it in `merge_update`; add round-trip + missing-section + merge tests. Update the existing `merge_update_*` test literals that construct `PartialAppConfig` to include `shortcuts: None`.
- `src/generated/bindings.ts` -- regenerated by the Rust build to include `ShortcutConfig`/`PartialShortcutConfig` and the new `shortcuts` fields. If the build does not regenerate it, hand-add the types and fields (per project-context bindings gotcha).
- `src/features/settings/shortcuts.ts` -- NEW pure module: `CONFIGURABLE_ACTIONS` (`{id,label,default}[]`), `RESERVED_ACTIONS` (`{id,label,binding}[]`), `DEFAULT_SHORTCUTS`, `RESERVED_COMBOS` (`Ctrl+1`…`Ctrl+9`), `canonicalizeShortcut`, `displayShortcut`, `matchesShortcut(event, shortcut)`, `findShortcutConflict(combo, bindings, excludeId)`.
- `src/features/settings/store.ts` -- add `bindings: Record<string,string>` (init `DEFAULT_SHORTCUTS`), `hydrateShortcuts(config)`, `setShortcut(actionId, combo): Promise<boolean>` (canonicalize → conflict check → `updateConfig({shortcuts:{…}})` → on ok update `bindings`+`config`+toast, on error toast+false), `resetShortcut(actionId)`.
- `src/features/command-palette/actions.ts` -- in `applyStartupConfig`, call `useSettingsStore.getState().hydrateShortcuts(configResult.data)` so persisted bindings load at startup.
- `src/features/editor/components/CaptureWindow.tsx` -- replace literal `e.key` checks for search/palette/newNote/noteList/theme with `matchesShortcut(e, useSettingsStore.getState().bindings[id])`; keep `Ctrl+,` settings handler hard-coded (reserved) and all overlay/`e.repeat` guards.
- `src/features/tabs/hooks/useTabKeyboardNav.ts` -- replace the `Ctrl+W` literal with `matchesShortcut(e, bindings.closeTab)`; keep Tab-cycle and `Ctrl+1-9` literals (reserved).
- `src/features/settings/components/ShortcutCaptureRow.tsx` -- NEW per-action capture row mirroring `HotkeyCaptureField`'s capture-phase listener; uses `formatShortcutFromEvent` + `canonicalizeShortcut`, runs `findShortcutConflict` before `setShortcut`, shows inline warning, Change/Save/Cancel/Reset.
- `src/features/settings/components/SettingsPanel.tsx` -- add a "Shortcuts" section: a `ShortcutCaptureRow` per configurable action, plus reserved rows (read-only `<kbd>` + "Reserved" label).
- `src/features/command-palette/hooks/usePaletteCommands.ts` -- derive the shortcut hint labels for the configurable commands (`new-note`, `search-notes`, `open-note-list`, `toggle-theme`) from live `bindings` via `displayShortcut`; reserved/literal hints unchanged.
- Tests (co-located): `src/features/settings/shortcuts.test.ts` (NEW), `src/features/settings/components/ShortcutCaptureRow.test.tsx` (NEW), and updates to `store.test.ts`, `SettingsPanel.test.tsx`, `CaptureWindow.test.tsx`, `useTabKeyboardNav.test.ts`, `usePaletteCommands.test.ts`.

## Tasks & Acceptance

**Execution:**

- [x] `src-tauri/src/models/config.rs` -- add `ShortcutConfig` (6 String fields with per-field serde defaults of canonical `Ctrl+…` strings) + `Default`; add `pub shortcuts: ShortcutConfig` to `AppConfig` with `#[serde(default)]`; add a `default_shortcuts_*`/assertion unit test.
- [x] `src-tauri/src/services/config.rs` -- add `PartialShortcutConfig` + `shortcuts` on `PartialAppConfig`; merge per-field in `merge_update`; fix existing `PartialAppConfig{…}` test constructors (add `shortcuts: None`); add tests: round-trip a `[shortcuts]` section, missing-section falls back to defaults, `merge_update` applies a partial shortcut.
- [x] `src/generated/bindings.ts` -- ensure regenerated (run the Rust build); if not regenerated, hand-add `ShortcutConfig`, `PartialShortcutConfig`, `AppConfig.shortcuts?`, `PartialAppConfig.shortcuts`.
- [x] `src/features/settings/shortcuts.ts` (NEW) -- implement registry constants, `canonicalizeShortcut`, `displayShortcut`, `matchesShortcut`, `findShortcutConflict`.
- [x] `src/features/settings/store.ts` -- add `bindings` state, `hydrateShortcuts`, `setShortcut`, `resetShortcut`; reset `bindings` in `resetSettings`.
- [x] `src/features/command-palette/actions.ts` -- hydrate shortcut bindings inside `applyStartupConfig`.
- [x] `src/features/editor/components/CaptureWindow.tsx` + `src/features/tabs/hooks/useTabKeyboardNav.ts` -- rewire configurable handlers to `matchesShortcut(e, bindings[id])`, preserving guards; leave reserved handlers literal.
- [x] `src/features/settings/components/ShortcutCaptureRow.tsx` (NEW) -- per-action capture/rebind row with conflict warning + reset.
- [x] `src/features/settings/components/SettingsPanel.tsx` -- render the Shortcuts section (configurable rows + reserved read-only rows).
- [x] `src/features/command-palette/hooks/usePaletteCommands.ts` -- source configurable command hint labels from live bindings via `displayShortcut`.
- [x] Tests -- add `shortcuts.test.ts` + `ShortcutCaptureRow.test.tsx`; extend `store.test.ts`, `SettingsPanel.test.tsx`, `CaptureWindow.test.tsx`, `useTabKeyboardNav.test.ts`, `usePaletteCommands.test.ts` to cover binding-driven dispatch, rebind persistence, conflict/reserved rejection, and startup hydration.

**Acceptance Criteria:**

- Given the Settings → Shortcuts section, when it renders, then all application shortcuts are listed with their current bindings — the six configurable actions with a "Change" control and the reserved shortcuts (`Esc`, `Ctrl+,`, `Ctrl+Tab`, `Ctrl+Shift+Tab`, `Ctrl+1-9`) shown read-only as "Reserved".
- Given a user rebinds `search` to a new combo in capture mode, when they Save, then the binding persists to `config.toml` `[shortcuts]` via `updateConfig`, the new combo opens search, and the previous combo no longer does.
- Given a captured combo that already belongs to another action or a reserved combo, when capturing, then an inline warning naming the clash is shown and Save is blocked until the user picks a different combo or cancels — no duplicate binding is ever saved.
- Given persisted custom bindings (or a legacy config with no `[shortcuts]` section), when the app starts, then `applyStartupConfig` hydrates the live binding map (defaults filling any missing key) so handlers honor the configured shortcuts from the first keypress.
- Given a configurable shortcut is rebound, when the command palette is opened, then its hint label reflects the current binding (localized to `⌘` on macOS).
- Given the global capture-hotkey path (Story 7.4), when in-app shortcuts change, then `update_config`'s hotkey registration is never invoked and the global shortcut is unaffected.

## Design Notes

- **Why webview-only (no registration):** in-app shortcuts are matched against `keydown` in the renderer, never handed to the OS, so they need no `parse_shortcut`/global-shortcut registration. `update_config` only registers when `partial.hotkey` is `Some`, so a `shortcuts`-only partial is inert on the hotkey path — keeping Story 7.4 untouched.
- **Canonical `Ctrl` storage + display localization:** storing one canonical token keeps `config.toml` stable across platforms and makes conflict comparison trivial; `event.ctrlKey || event.metaKey` already matches both, mirroring the existing handlers. Only the UI localizes to `⌘`.
- **Reserved set rationale:** `Ctrl+,` (comma), `Ctrl+Tab` (Tab), and `Esc` are not expressible in the Story-7.4 capture grammar, and tab-jump is a numeric range, not a single binding. Listing them read-only satisfies "all shortcuts listed with current bindings" without widening the shared grammar (Ask-First, deferred). This narrowing is a documented judgment call surfaced as a PREFERENCE.
- **`matchesShortcut` exact-modifier rule** (golden): for `Ctrl+Shift+T` → require `(ctrlKey||metaKey) && shiftKey && !altKey && code==='KeyT'`. Absent modifiers must be absent, so `Ctrl+P` never fires under `Ctrl+Shift+P`.
- **Capture-phase listener:** `SettingsPanel` stops propagation of all Ctrl/Cmd combos in the capture phase; `ShortcutCaptureRow` must attach its `keydown` listener with `capture: true` (as `HotkeyCaptureField` does) so it still receives the combo while capturing.

## Verification

**Commands:**

- `cd src-tauri && cargo test` -- expected: new `ShortcutConfig` default + `[shortcuts]` round-trip/merge/missing-section tests pass; updated `merge_update_*` constructors compile.
- `cd src-tauri && cargo clippy --all-targets -- -D warnings` -- expected: clean.
- `npx tsc --noEmit` -- expected: no type errors; `shortcuts`/`ShortcutConfig` resolve through regenerated `src/generated/bindings.ts`.
- `npx vitest run` -- expected: `shortcuts.test.ts` (match/canonicalize/display/conflict), `ShortcutCaptureRow.test.tsx`, and the extended store/panel/handler/palette tests pass — binding-driven dispatch, rebind persistence, conflict+reserved rejection, and startup hydration all covered.

### Review Findings

- [x] [Review][Patch] Enforce the mandatory Ctrl/Cmd modifier for configurable shortcuts [src/features/settings/components/ShortcutCaptureRow.tsx:138]
- [x] [Review][Patch] Await startup shortcut hydration before mounting keyboard handlers [src/main.tsx:13]
- [x] [Review][Patch] Keep `Esc`/`Tab` in capture mode and show the invalid-shortcut hint [src/features/settings/components/ShortcutCaptureRow.tsx:125]
- [x] [Review][Defer] Define recovery for duplicate hand-edited shortcut bindings [src/features/settings/shortcuts.ts:205] — deferred, pre-existing

#### Review Ledger (2026-06-14T03:10:21-07:00)

patch: Enforce the mandatory Ctrl/Cmd modifier for configurable shortcuts [src/features/settings/components/ShortcutCaptureRow.tsx:138] — fixed by validating capture/store inputs and falling back invalid loaded values to defaults.
patch: Await startup shortcut hydration before mounting keyboard handlers [src/main.tsx:13] — fixed by awaiting `applyStartupConfig()` before React mounts the keyboard listeners.
patch: Keep `Esc`/`Tab` in capture mode and show the invalid-shortcut hint [src/features/settings/components/ShortcutCaptureRow.tsx:125] — fixed by routing both keys through the invalid-capture warning path instead of exiting capture.
defer: Define recovery for duplicate hand-edited shortcut bindings [src/features/settings/shortcuts.ts:205] — auto-mode: needs human decision.
dismiss: Malformed TOML shortcut field resets config defaults [src-tauri/src/models/config.rs:81] — shared corrupt-TOML fallback behavior; not specific enough for this story review.
dismiss: Multiple rows can capture at once [src/features/settings/components/ShortcutCaptureRow.tsx:123] — low-probability multi-click UX edge outside the approved story scope.
dismiss: Shortcut text normalization is incomplete [src/features/settings/shortcuts.ts:104] — invalid persisted shortcuts now fall back to defaults; remaining normalization is cosmetic.
dismiss: Palette hint staleness without rerender [src/features/command-palette/hooks/usePaletteCommands.ts:28] — not reproducible in the current command-palette open/close render flow.
dismiss: AltGr can collide with Ctrl+Alt bindings [src/features/settings/shortcuts.ts:158] — locale-specific behavior not specified by the approved story scope.
dismiss: Additional handler-specific shortcut tests [src/features/editor/components/CaptureWindow.test.tsx:7] — no concrete behavioral gap remained after the fixes and full-suite pass.
