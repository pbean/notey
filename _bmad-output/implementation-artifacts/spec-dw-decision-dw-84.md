---
title: "Align backend layout_mode default to 'comfortable'"
type: "chore"
created: "2026-06-12"
status: "done"
context: []
baseline_commit: "43ec5622c5aaa7ccf2685c45091e925eb144ed7a"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The backend `GeneralConfig` default `layout_mode` is `"floating"`, a value with no distinct styling and no place in the frontend's `comfortable`↔`compact` toggle vocabulary. `index.css` defines only `.compact`; `floating` renders identically to `comfortable`. Worse, it produces a double-toggle wart: from the `"floating"` default, `toggleLayoutMode` computes `next = current === 'comfortable' ? 'compact' : 'comfortable'`, so the first toggle goes `floating → comfortable` (no visible change) and a second toggle is needed to reach `compact`.

**Approach:** Change the backend default `layout_mode` from `"floating"` to `"comfortable"` so the persisted vocabulary matches the frontend toggle and the first toggle immediately reaches `compact`. Purge the dead `"floating"` literal from the codebase, keeping backward-compatible handling so any already-persisted `"floating"` config still renders as non-compact.

## Boundaries & Constraints

**Always:** Keep `layout_mode` typed as `String` at the IPC boundary (no enum). Preserve the frontend invariant that compact is applied iff `layoutMode === 'compact'`, so legacy persisted `"floating"` values continue to render as comfortable. Keep `#[serde(rename_all = "camelCase")]` on config structs.

**Ask First:** Introducing a real distinct `floating` layout style, or migrating/rewriting users' persisted config files on disk.

**Never:** Add a `.floating` CSS class or any third layout variant. Change the `theme`, `font_size`, or `global_shortcut` defaults. Touch generated bindings (`src/generated/bindings.ts`) by hand. Add a startup migration that rewrites existing `config.toml` files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| -------- | ------------- | -------------------------- | -------------- |
| Fresh install, no config | `config.toml` missing | Default created with `layoutMode = "comfortable"` | N/A |
| First layout toggle on fresh default | persisted `comfortable` | One toggle → `compact` applied immediately | N/A |
| Legacy persisted value | `config.toml` has `layoutMode = "floating"` | Loads without error; renders as non-compact (comfortable) | N/A |

</frozen-after-approval>

## Code Map

- `src-tauri/src/models/config.rs` -- `GeneralConfig::default()` holds the `layout_mode` default literal to change.
- `src-tauri/src/services/config.rs` -- contains the `#[cfg(test)]` fixture using `layoutMode = "floating"` and the default-config test; the production load/merge logic is unaffected.
- `src/features/command-palette/actions.ts` -- `applyLayoutModeClass` doc comment references the dead `floating` value; toggle/apply logic already correct (`=== 'compact'`).
- `src/features/command-palette/actions.test.ts` -- test asserting a `floating` layout value renders non-compact; reframe as a legacy-value backward-compat test.
- `src/index.css` -- defines only `.compact`; no change, confirms `floating`/`comfortable` are visually identical.

## Tasks & Acceptance

**Execution:**

- [x] `src-tauri/src/models/config.rs` -- change `layout_mode: "floating".to_string()` to `"comfortable".to_string()` in `GeneralConfig::default()` -- aligns the persisted default with the frontend vocabulary and removes the double-toggle wart.
- [x] `src-tauri/src/services/config.rs` -- in `load_creates_default_when_missing`, add `assert_eq!(config.general.layout_mode, "comfortable");` to lock the new default; change the `layoutMode = "floating"` fixture in `load_reads_existing_config` to `"comfortable"` to purge the dead literal.
- [x] `src/features/command-palette/actions.ts` -- update the `applyLayoutModeClass` doc comment so it no longer cites `floating` as an example non-compact value (e.g. "any other value (such as comfortable) clears it").
- [x] `src/features/command-palette/actions.test.ts` -- reframe the `floating` test as an explicit legacy/backward-compat case: rename it to convey that a legacy persisted `"floating"` value still renders non-compact, and keep it exercising the literal `"floating"` string (the real value old configs hold) so the backward-compat guarantee stays covered. This is the one intentional, clearly-labeled `floating` reference that remains.

**Acceptance Criteria:**

- Given a fresh install with no `config.toml`, when the app creates the default config, then `general.layout_mode` equals `"comfortable"`.
- Given the fresh `comfortable` default, when the user invokes the layout toggle once, then `compact` is applied (no double-toggle).
- Given a `config.toml` that still contains `layoutMode = "floating"`, when it is loaded and applied at startup, then it loads without error and does not apply the compact class.
- Given production source after the change (excluding `target/`, generated files, and `*.test.ts` test files), when searching for the literal `floating` (case-insensitive), then no occurrences remain; the only surviving reference is the single intentional backward-compat case in `actions.test.ts`.

## Verification

**Commands:**

- `cargo test --manifest-path src-tauri/Cargo.toml config` -- expected: config tests pass, including the new default assertion.
- `npx vitest run src/features/command-palette/actions.test.ts` -- expected: all command-palette layout tests pass.
- `grep -rni "floating" src src-tauri --include='*.rs' --include='*.ts' --include='*.tsx' --include='*.css' | grep -v '\.test\.ts'` -- expected: no matches (the only remaining reference is the labeled legacy test in `actions.test.ts`).

### Review Findings

- [x] [Review][Patch] Legacy persisted `floating` values still require two toggles to reach compact [src/features/command-palette/actions.ts:288]

#### Review Ledger (2026-06-12)

patch: Legacy persisted `floating` values still require two toggles to reach compact [src/features/command-palette/actions.ts:288] — Verified: `toggleLayoutMode()` treats only `comfortable` as the non-compact case, so a legacy `floating` value first persists `comfortable` and leaves the DOM non-compact.
