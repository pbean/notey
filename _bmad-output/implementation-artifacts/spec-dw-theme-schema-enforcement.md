---
title: "Theme contract schema enforcement (DW-88)"
type: "refactor"
created: "2026-06-14"
status: "done"
context: ["{project-root}/_bmad-output/project-context.md"]
baseline_commit: "81d93e48431f80f35c5405ebd03d65d6cbe3c0d5"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 7.2 documents `theme` as exactly `system|dark|light`, but the backend models it as a free-form `String` and specta emits `theme: string`. The contract is documented, not enforced: arbitrary theme values slip through the IPC boundary and the partial-config merge unchallenged.

**Approach:** Replace the `String` theme field with a typed Rust enum `Theme { System, Dark, Light }` (serde lowercase, derives `specta::Type`) used by both `GeneralConfig` and `PartialGeneralConfig`. specta then regenerates `src/generated/bindings.ts` as the string-literal union `"system" | "dark" | "light"`, and serde rejects any unknown value at the deserialization boundary that feeds the merge — tightening the contract end-to-end with no consumer breakage (the UI already emits only valid values).

## Boundaries & Constraints

**Always:** Keep theme serialized lowercase (`"system"`, `"dark"`, `"light"`) in both JSON and TOML, identical to today's wire/disk values. `Theme::System` remains the default. Regenerate `src/generated/bindings.ts` via the existing tauri-specta export — never hand-edit it. Frontend `setTheme` signatures must narrow from `string` to the generated `Theme` union so the contract holds end-to-end and the TS build type-checks.

**Ask First:** Converting any field *other than* `theme` (e.g. `layoutMode`, `fontFamily`) to an enum — out of scope for this bundle.

**Never:** Do not change the serialized string values, the camelCase IPC field name, or the default. Do not make `merge_update` fallible or add a separate validation branch in `update_config` — the type system + serde enforcement is the rejection mechanism. Do not touch the global-shortcut validation logic.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| -------- | ------------- | -------------------------- | -------------- |
| Valid partial update | `{"general":{"theme":"light","layoutMode":null},...}` deserialized as `PartialAppConfig` | Deserializes; `merge_update` sets `theme = Theme::Light` | N/A |
| Unknown theme via IPC | `{"general":{"theme":"neon",...},...}` | serde rejects unknown variant — `PartialAppConfig` deserialization fails before merge | Deserialization `Err` (surfaces as command invocation error) |
| Invalid theme in config.toml | `[general]\ntheme = "neon"` on disk | `load_or_create` hits the existing corrupt-config path → falls back to `AppConfig::default()` (`theme = System`) | Warn-and-default (existing behavior) |
| Valid theme round-trip | `theme = Theme::Light` saved then loaded | Loads back as `Theme::Light` | N/A |

</frozen-after-approval>

## Code Map

- `src-tauri/src/models/config.rs` -- defines `GeneralConfig`; add `Theme` enum, change `theme: String` → `theme: Theme`, update `Default`.
- `src-tauri/src/services/config.rs` -- `PartialGeneralConfig.theme: Option<String>` → `Option<Theme>`; `merge_update` assigns the enum; tests assert enum values; add rejection test.
- `src-tauri/src/lib.rs` -- `export_bindings` test + startup `.export()` regenerate bindings (no edit; just the trigger).
- `src/generated/bindings.ts` -- regenerated output: gains `export type Theme`, `GeneralConfig.theme: Theme`, `PartialGeneralConfig.theme: Theme | null`.
- `src/features/command-palette/actions.ts` -- narrow `setTheme(theme: string)` → `setTheme(theme: Theme)`; import `Theme`. `applyThemeClass` stays `string` (intentional defensive DOM resolver).
- `src/features/settings/store.ts` -- narrow `setTheme: (theme: string)` → `(theme: Theme)`; import `Theme`.

## Tasks & Acceptance

**Execution:**

- [x] `src-tauri/src/models/config.rs` -- Add `pub enum Theme { System, Dark, Light }` with `#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]` + `#[serde(rename_all = "lowercase")]` and `#[default]` on `System`; rustdoc the enum. Change `GeneralConfig.theme` to `Theme`; set `Default` to `Theme::System`. -- Make the schema the source of truth.
- [x] `src-tauri/src/services/config.rs` -- Import `Theme`; change `PartialGeneralConfig.theme` to `Option<Theme>`; in `merge_update` assign the `Copy` enum (`if let Some(theme) = general.theme { merged.general.theme = theme; }`); update the four `assert_eq!(…theme, "system"/"light")` tests to `Theme::System`/`Theme::Light`. -- Carry the enum through the merge path.
- [x] `src-tauri/src/services/config.rs` -- Add tests covering the I/O matrix: `partial_config_rejects_unknown_theme` (serde_json deserialize of an unknown theme is `Err`), `partial_config_accepts_valid_theme`, and `load_falls_back_on_invalid_theme` (config.toml with `theme = "neon"` → default). -- Satisfies the required "invalid theme is rejected" test.
- [x] `src/generated/bindings.ts` -- Regenerate via `cargo test export_bindings` (do not hand-edit); confirm `Theme` union + updated `GeneralConfig`/`PartialGeneralConfig`. -- Propagate the typed contract to TS.
- [x] `src/features/command-palette/actions.ts` -- Import `type Theme`; change `setTheme` parameter to `Theme`. -- End-to-end type tightening.
- [x] `src/features/settings/store.ts` -- Import `type Theme`; change the `setTheme` action signature to `Theme`. -- End-to-end type tightening.

**Acceptance Criteria:**

- Given the regenerated bindings, when inspecting `src/generated/bindings.ts`, then `GeneralConfig.theme` and `PartialGeneralConfig.theme` reference the `"system" | "dark" | "light"` union (no bare `string`).
- Given an existing config.toml whose `theme` is a previously-valid value (`system`/`dark`/`light`), when the app loads, then it deserializes unchanged — no migration or reset for already-valid configs.
- Given the full backend and frontend test suites, when they run, then all pass with no `theme: string` references remaining and no new clippy/tsc errors.

## Design Notes

`#[derive(Default)]` with `#[default]` on the `System` variant (stable since Rust 1.62) replaces a manual `impl Default`, keeping `AppConfig::default().general.theme == Theme::System`.

Rejection is intentionally a property of the type system, not imperative validation: a unit-variant enum with `#[serde(rename_all = "lowercase")]` makes serde refuse unknown variants on deserialize, so the IPC path (`PartialAppConfig`) and the disk path (`AppConfig`) both reject `"neon"` automatically — the disk path routing into the existing warn-and-default corrupt-config branch. specta maps the same enum to a TS string-literal union; there is no i64/BigInt concern (see [[project_specta_bigint]]).

`applyThemeClass` keeps its `string` parameter on purpose — it is a defensive DOM resolver (documented to map any non-`dark`/`system` value to light) and is not a contract boundary.

## Verification

**Commands:**

- `cargo test --manifest-path src-tauri/Cargo.toml` -- expected: all tests pass, including `partial_config_rejects_unknown_theme` and `load_falls_back_on_invalid_theme`; `export_bindings` regenerates `src/generated/bindings.ts`.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` -- expected: no warnings.
- `npx tsc --noEmit` -- expected: no type errors (confirms the `Theme` union flows through `setTheme` and config consumers).
- `npx vitest run` -- expected: frontend suite passes.
- `rg -n "theme: string" src/generated/bindings.ts` -- expected: no matches.
