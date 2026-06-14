---
title: "Global Hotkey Reconfiguration & Conflict Detection"
type: "feature"
created: "2026-06-14"
status: "done"
baseline_commit: "2fd2443082b5fa2da7c034f2a0f11353cb60c302"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Settings → Hotkey section can display the global capture shortcut but cannot change it — the "Change" button is a stub (`stubAction('Change global shortcut')`). The plumbing exists (`HotkeyConfig.globalShortcut`, `update_config` validation + re-registration, the `[hotkey]` TOML section, generated bindings), but two things block a safe rebind feature. First, there is no UI to capture a new combination or reset to the default. Second — and more serious — `update_config` **persists the new shortcut to disk and to in-memory state *before* it attempts to register it** (`commands/config.rs:52-59` save/commit, then `:70` register), and on a registration conflict it rolls back only the OS registration, not the persisted config. So a conflicting binding leaves disk + memory claiming the new shortcut while the *old* one is still the one actually firing — and on the next launch `lib.rs:217` tries to register that saved-conflicting shortcut with `?`, which fails app startup. The epic requires the opposite: detect the conflict *before* committing, keep the old shortcut active, and only persist on a valid binding.

**Approach:** (1) Reorder `update_config` so a hotkey change registers the new shortcut FIRST; only on success unregister the old and then merge+save+commit; on failure leave the old shortcut registered, persist nothing, and return a `Config` conflict error. (2) Make startup hotkey registration non-fatal (log + continue) so a bad saved shortcut degrades gracefully instead of bricking launch. (3) Introduce a platform-aware default (`Cmd+Shift+N` on macOS, `Ctrl+Shift+N` elsewhere) as the single source of truth for both first-run and reset. (4) Replace the stub with a capture-mode UI in the Hotkey section: "Press new shortcut…", live captured combo, Save/Cancel, and a "Reset to default" action; a successful rebind updates the snapshot from the backend's returned config and shows a confirmation toast, a conflict keeps the displayed shortcut unchanged and shows a 5-second toast plus an inline warning.

## Boundaries & Constraints

**Always:**
- Conflict-before-commit ordering is the core invariant: on a hotkey change, `register(new)` must succeed before anything is written to disk or in-memory; on failure the previously-registered shortcut stays active and the persisted/in-memory config is untouched. Non-hotkey updates (theme/font/layout) keep their current merge-under-lock behavior unchanged.
- The new shortcut string is validated by `parse_shortcut` before any registration attempt (unchanged); the capture UI only emits strings in `parse_shortcut`'s grammar (`Ctrl`/`Cmd`/`Shift`/`Alt` + a main key), canonical order `[Ctrl|Cmd] + Shift + Alt + KEY`.
- A bindable capture requires at least one modifier plus one supported main key (A–Z or 0–9). Pure-modifier presses are ignored until a main key arrives.
- The hotkey setter is NOT optimistic: the displayed shortcut changes only after the backend confirms the new binding (it returns the merged `AppConfig`); on conflict the old value remains shown. This differs from the live-apply font/theme setters by design.
- Reset-to-default and first-run default resolve from one platform-aware source: `Cmd+Shift+N` on macOS, `Ctrl+Shift+N` on all other platforms.
- All config access stays on the existing `getConfig`/`updateConfig` tauri-specta bindings — no new Tauri command, no new persistence path. The global-shortcut ACL permissions already present in `capabilities/default.json` are sufficient (no ACL change).
- Esc while capturing cancels capture only (stop propagation) — it must not close the Settings overlay; Esc when not capturing keeps the existing overlay-close behavior. Capture controls keep the section's focus-ring + 24px min-target conventions.

**Ask First:**
- Validating the global hotkey against Notey's own in-app shortcut map (Ctrl+P, Ctrl+F, etc.) — that unified shortcut model belongs to Story 7.6; do not build it here.
- Changing the captured-key set beyond A–Z / 0–9 (e.g. function keys, punctuation) or the canonical modifier ordering.

**Never:**
- Do NOT name the specific conflicting application in the toast — the OS global-shortcut API does not expose which app holds a registered combination. The conflict toast states the shortcut is unavailable / in use and that the previous shortcut was kept; naming the exact app is not implementable (recorded as a known deviation from the epic wording).
- Do NOT re-derive existing plumbing: the `HotkeyConfig`/`PartialHotkeyConfig` fields, the `merge_update` hotkey branch, `parse_shortcut`, the bindings, or the Settings overlay host.
- Do NOT introduce a separate register/unregister frontend command, polling, or a second hotkey. Exactly one global shortcut is registered at a time.
- Do NOT touch theme/font/layout setters, contrast tokens, or the per-component accessibility audit (Story 7.8).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| -------- | ------------- | -------------------------- | -------------- |
| Valid rebind | capture `Ctrl+Alt+J`, Save; combo free | `register(new)` OK → unregister old → save+commit; `update_config` returns merged config; snapshot + `<kbd>` show new shortcut; confirmation toast | N/A |
| Conflict | capture `Ctrl+Shift+N` already held by another app | `register(new)` fails → old shortcut stays active, nothing persisted; `update_config` returns `Config` error; displayed shortcut unchanged; 5s conflict toast + inline warning | conflict surfaced, old binding intact |
| Reset to default | user clicks "Reset to default" | sets shortcut to platform default (`Cmd+Shift+N` macOS / `Ctrl+Shift+N` else) via the same rebind path | if even the default conflicts, same conflict handling |
| No-op rebind | capture equals current shortcut | parsed-equal short-circuit: no unregister/register churn; persist is a harmless no-op; new value shown | N/A |
| Pure modifier | user presses only `Ctrl`/`Shift` in capture | ignored; field still shows "Press new shortcut…"; no string emitted | not a bindable combo |
| Unsupported / missing modifier | bare `J`, or `Ctrl+Tab`/`Esc` as binding | not captured; inline hint to use a modifier + A–Z/0–9; no backend call | rejected client-side before persist |
| Cancel capture | Esc (or Cancel) while capturing | exits capture mode; shortcut unchanged; overlay stays open | N/A |
| Startup with bad saved shortcut | persisted shortcut fails registration at launch | app starts; warning logged; app summon still available via tray/window | non-fatal, no `?` propagation |

</frozen-after-approval>

## Code Map

- `src-tauri/src/commands/config.rs` -- `update_config`: reorder to register-before-commit (validate → register new → unregister old → merge/save/commit under lock); on register failure return `Config` error with nothing persisted; short-circuit when new parses equal to old
- `src-tauri/src/lib.rs` -- startup global-shortcut registration (`:217`): make `register` non-fatal (log warning, continue) instead of `?`; use the platform default for the parse fallback (`:200`); add/extend `#[cfg(test)] mod tests` for `parse_shortcut` and the default helper
- `src-tauri/src/models/config.rs` -- add `pub fn default_global_shortcut() -> String` (cfg-gated: `Cmd+Shift+N` on macOS, `Ctrl+Shift+N` else); use it in `HotkeyConfig::default()`
- `src-tauri/src/services/config.rs` -- default-shortcut assertions (`:148`, `:254`) reference `default_global_shortcut()` so they stay correct cross-platform; merge/hotkey branch unchanged
- `src/features/settings/shortcut.ts` -- NEW: pure helpers `platformDefaultShortcut()` and `formatShortcutFromEvent(e)` (canonical string or `null`), plus the supported main-key set — unit-testable without React
- `src/features/settings/store.ts` -- add async `setGlobalShortcut(shortcut): Promise<boolean>`: call `commands.updateConfig({hotkey:{globalShortcut}})`, await; on success set `config` from returned merged config + confirmation toast (return true); on error keep snapshot + 5s conflict toast (return false)
- `src/features/settings/components/HotkeyCaptureField.tsx` -- NEW: display mode (`<kbd>` + Change + Reset-to-default) and capture mode ("Press new shortcut…", live combo, Save/Cancel, inline warning); Esc cancels capture only
- `src/features/settings/components/SettingsPanel.tsx` -- replace the stubbed Hotkey row (`:276-302`) with `<HotkeyCaptureField/>`; drop the `stubAction` import if now unused
- `src/features/settings/shortcut.test.ts` -- NEW: unit-test `formatShortcutFromEvent` (modifier+key, pure-modifier→null, missing-modifier→null, unsupported-key→null, canonical order, Cmd via metaKey) and `platformDefaultShortcut`
- `src/features/settings/store.test.ts` -- add `setGlobalShortcut` cases: success updates snapshot from returned config + toast; error keeps snapshot + 5s toast
- `src/features/settings/components/SettingsPanel.test.tsx` -- replace the `:108` "routes to stub" test with capture-flow coverage: enter capture → emit combo → Save calls `updateConfig`; conflict path shows old value + toast; Reset sends platform default

## Tasks & Acceptance

**Execution:**

- [x] `src-tauri/src/commands/config.rs` -- reorder `update_config`: after parse-validation, if the parsed new shortcut differs from the current one, `register(new)` first; on `Ok` unregister old then merge/save/commit under the config lock; on `Err` return `NoteyError::Config(...)` with nothing written; skip registration when new == old. (Old binding retired only after both registration AND save succeed; save-failure rolls back the registration.)
- [x] `src-tauri/src/lib.rs` -- replace `app.global_shortcut().register(shortcut)?` with a non-fatal log-and-continue; use `default_global_shortcut()` for the invalid-parse fallback; add `#[cfg(test)] mod tests` covering `parse_shortcut` (valid combos, modifier aliases, invalid key/modifier → `None`).
- [x] `src-tauri/src/models/config.rs` -- add cfg-gated `default_global_shortcut()` and call it from `HotkeyConfig::default()`.
- [x] `src-tauri/src/services/config.rs` -- point the two default-shortcut assertions at `default_global_shortcut()`.
- [x] `src/features/settings/shortcut.ts` -- implement `platformDefaultShortcut()` (macOS→`Cmd+Shift+N`, else `Ctrl+Shift+N`, via userAgent/platform detection) and `formatShortcutFromEvent(e)` returning the canonical `[Ctrl|Cmd]+Shift+Alt+KEY` string or `null`.
- [x] `src/features/settings/store.ts` -- add `setGlobalShortcut` per Code Map (await result, branch on status, toast, return boolean; snapshot set only from the backend-returned merged config).
- [x] `src/features/settings/components/HotkeyCaptureField.tsx` -- implement the capture-mode field with Change / Reset-to-default / Save / Cancel, live combo, inline warning, and Esc-cancels-capture (stop propagation).
- [x] `src/features/settings/components/SettingsPanel.tsx` -- render `HotkeyCaptureField` in the Hotkey section; remove now-unused `stubAction` import.
- [x] `src/features/settings/shortcut.test.ts` -- unit tests per Code Map.
- [x] `src/features/settings/store.test.ts` -- `setGlobalShortcut` success/conflict tests per Code Map.
- [x] `src/features/settings/components/SettingsPanel.test.tsx` -- replace stub test with capture/conflict/reset coverage.

**Acceptance Criteria:**

- Given the Settings → Hotkey section, when the user clicks Change, captures a free modifier+key combination, and confirms, then the new shortcut registers, the old one is unregistered, the value persists via `updateConfig`, and the displayed shortcut updates to the new binding with a confirmation toast.
- Given the user captures a combination already held by another application, when they confirm, then the previous shortcut remains active, nothing is persisted, the displayed shortcut is unchanged, and a 5-second conflict toast (plus inline warning) is shown.
- Given any saved or just-entered shortcut, when the app commits a hotkey change, then disk and in-memory config reflect the new shortcut only on a successful registration — never on a conflict.
- Given the Hotkey section, when the user clicks "Reset to default", then the shortcut is set to the platform default (`Cmd+Shift+N` on macOS, `Ctrl+Shift+N` otherwise) through the same conflict-checked rebind path.
- Given a persisted shortcut that fails to register at launch, when the app starts, then startup completes (warning logged) rather than failing, and the window remains summonable via the tray/window.
- Given capture mode, when the user presses only modifiers, an unsupported key, or a combination without a modifier, then no binding is emitted and an inline hint guides a valid combination; pressing Esc cancels capture without closing the overlay.

### Review Findings

- [x] [Review][Patch] Serialize hotkey rebinds against the actual active registration [src-tauri/src/commands/config.rs:16]
- [x] [Review][Patch] Preserve visible shortcut state, inline warnings, and keyboard access during capture transitions [src/features/settings/components/HotkeyCaptureField.tsx:74]
- [x] [Review][Patch] Distinguish shortcut conflicts from generic config-update failures [src/features/settings/store.ts:134]
- [x] [Review][Patch] Canonicalize the primary modifier and make reset/conflict tests platform-aware [src/features/settings/shortcut.ts:15]

#### Review Ledger (2026-06-14)

patch: Serialize hotkey rebinds against the actual active registration [src-tauri/src/commands/config.rs:16] — fixed by comparing against the registered shortcut under the config mutex and restoring registrations on failure.
patch: Preserve visible shortcut state, inline warnings, and keyboard access during capture transitions [src/features/settings/components/HotkeyCaptureField.tsx:74] — fixed by returning to display mode on conflicts, allowing Tab/button activation, and restoring focus on exit.
patch: Distinguish shortcut conflicts from generic config-update failures [src/features/settings/store.ts:134] — fixed by checking the backend error shape before choosing the toast copy.
patch: Canonicalize the primary modifier and make reset/conflict tests platform-aware [src/features/settings/shortcut.ts:15] — fixed by collapsing dual Ctrl/Cmd chords to one canonical primary modifier and updating the tests.
dismiss: Suspend the currently-active global shortcut while capture mode is open [src/features/settings/components/HotkeyCaptureField.tsx:86] — not statically verified and would need extra runtime coordination outside this story’s current command surface.
dismiss: Frontend reset should call into the Rust default-shortcut helper [src/features/settings/shortcut.ts:9] — dismissed because the approved spec explicitly calls for frontend UA/platform detection.

## Spec Change Log

## Design Notes

- **Why register-before-commit:** the OS registration attempt IS the conflict check. Doing it before persistence means a rejected binding can never corrupt the stored config or strand the app without a working hotkey, and it makes "keep the old shortcut active on conflict" fall out naturally (the old registration is only torn down once the new one is proven to bind).
- **Why not optimistic in the store:** the live-apply font/theme setters update the snapshot first because they cannot fail meaningfully. A hotkey rebind can be rejected by the OS, so the snapshot must follow the backend's returned merged config, not lead it — otherwise the UI would show a shortcut that isn't actually bound.
- **Conflict messaging limitation:** `tauri-plugin-global-shortcut::register` returns a generic error; no platform exposes the owning app of a conflicting global hotkey. The toast therefore reports the conflict and that the prior shortcut was kept, without naming the app — a deliberate, documented deviation from the epic's "naming the conflicting app" wording.
- **Capture string contract:** `formatShortcutFromEvent` must emit exactly what `parse_shortcut` accepts (`Cmd`→SUPER on macOS, `Ctrl`→CONTROL, etc.) so a captured combo round-trips through the backend without a Validation error; conflicts are then the only expected failure mode.

## Verification

**Commands:**

- `npx vitest run` -- expected: new `shortcut.test.ts` passes; `store.test.ts` setGlobalShortcut cases (success snapshot-from-result + toast, conflict keeps snapshot + 5s toast) pass; updated `SettingsPanel.test.tsx` capture/conflict/reset cases pass; existing settings/actions tests stay green.
- `npx tsc --noEmit` -- expected: no type errors (the `updateConfig` partial and returned `AppConfig` are used through generated bindings).
- `cd src-tauri && cargo test` -- expected: new `parse_shortcut` tests and the platform-default assertions pass; `merge_update` and config-default tests stay green.
- `cd src-tauri && cargo clippy --all-targets -- -D warnings` -- expected: clean (the reordered command introduces no new lints).
