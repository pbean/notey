---
title: "Story 5.4: Trash Auto-Purge (30-Day Retention)"
type: "feature"
created: "2026-06-12"
status: "done"
baseline_commit: "7ba7446788ede6974a1a50a11835e0276ec84216"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Soft-deleted notes accumulate in the trash forever. Stories 5.1–5.3 made deletion reversible (trash) and gave an explicit manual escape hatch (permanent delete), but nothing ever clears aged-out trash automatically, so the database grows unbounded with notes the user clearly abandoned. The product promises deleted notes stay recoverable for *at least* 30 days — after that they should silently go away.

**Approach:** Add a configurable `[trash] retentionDays` setting (default 30) to `AppConfig`, and a backend `purge_expired_trash(conn, retention_days)` service that runs a single date-comparison `DELETE` against trashed notes older than the window. Wire it into the Tauri startup hook (`lib.rs` setup) as a silent, non-fatal background maintenance step — no toast, no command, no UI. The existing `notes_fts_ad` DELETE trigger keeps FTS in sync automatically.

## Boundaries & Constraints

**Always:**
- Auto-purge is a **single bulk `DELETE`** scoped by `is_trashed = 1 AND deleted_at IS NOT NULL AND deleted_at < ?cutoff`. The cutoff is computed in Rust as `(Utc::now() - chrono::Duration::days(retention_days)).to_rfc3339()` so it is byte-for-byte comparable with stored `deleted_at` values (which are also `Utc::now().to_rfc3339()`). NEVER use SQLite's `datetime('now', …)` — its `YYYY-MM-DD HH:MM:SS` format is not lexicographically comparable to the stored RFC3339 strings.
- The comparison is strict `<`, so a note deleted *exactly* `retention_days` ago is **kept** — this upholds the "recoverable for at least 30 days" guarantee.
- Retention is read from `AppConfig.trash.retention_days`, a new `TrashConfig` section with `#[serde(default)]` and a manual `Default` of `30`. A missing `[trash]` section in `config.toml` must deserialize to the default. TOML/JSON key is **camelCase** (`retentionDays`), matching the existing `fontSize`/`layoutMode`/`globalShortcut` convention and serde `rename_all = "camelCase"`.
- Startup purge is **silent and non-fatal**: run it in the `.setup()` closure after config load; on `Err`, log to stderr (`eprintln!`) and continue — a purge failure must NEVER panic or block app start. Lock the managed `Mutex<Connection>` via the existing `commands::recover_poisoned_db` helper.
- Permanent removal flows through the same `notes` `DELETE` path as Story 5.3, so the `notes_fts_ad` trigger removes FTS rows — never touch `notes_fts` directly.
- Follow project conventions: thin startup wiring delegates to the testable service; rustdoc on the new public service fn and config struct; parameterized SQL only.

**Ask First:**
- Surfacing `retentionDays` in any UI / settings panel, or making it editable through `update_config` (this story is config.toml-only; settings editing is Epic 7).
- Running purge on any cadence other than startup (e.g. a timer/interval), or notifying the user when notes are purged.
- Adding a "disable auto-purge" sentinel (e.g. `retentionDays = 0` meaning "never"). Current behavior: `0` purges all currently-trashed notes immediately.

**Never:**
- No new Tauri command, permission TOML, ACL entry, or frontend code — auto-purge is internal startup logic, not invoked from the UI.
- No per-row delete loop, no `delete_note_permanently` call per note — one set-based `DELETE`.
- No touching of active (non-trashed) notes; the `is_trashed = 1` guard is mandatory.
- No manual mutation of `notes_fts`; no changes to `trash_note`/`restore_note`/`delete_note_permanently`/`list_trashed_notes` SQL.
- No export work (Stories 5.5–5.6).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| -------- | ------------- | -------------------------- | -------------- |
| Purge aged-out trash | trashed note with `deleted_at` older than `retention_days` | Row `DELETE`d from `notes`; FTS row removed by trigger (not returned by search or `list_trashed_notes`); included in returned count | N/A |
| Keep recent trash | trashed note `deleted_at` within the window | Kept; not counted | N/A |
| Keep boundary note | `deleted_at` == cutoff (exactly `retention_days` old) | Kept (strict `<`) — guarantees ≥ `retention_days` recoverability | N/A |
| Ignore active notes | `is_trashed = 0` (`deleted_at` NULL) | Untouched regardless of age | N/A |
| Nothing to purge | no trashed rows, or all within window | Returns `0`; no rows changed | N/A |
| `retentionDays = 0` | config sets `0` | cutoff == now → all currently-trashed notes purged | N/A (explicit config) |
| Missing `[trash]` section | `config.toml` without the section | `serde(default)` → `retention_days = 30` | N/A |
| Purge fails at startup | DB error during the `DELETE` | Logged via `eprintln!`; app start continues | swallow error, no panic |

</frozen-after-approval>

## Code Map

Backend (`src-tauri/`):
- `src/models/config.rs` -- ADD `TrashConfig { retention_days: u32 }` (`Debug, Clone, Serialize, Deserialize, Type`, `rename_all = "camelCase"`) with `impl Default` returning `30`; ADD `#[serde(default)] pub trash: TrashConfig` to `AppConfig`. Mirror the existing `GeneralConfig`/`EditorConfig`/`HotkeyConfig` pattern.
- `src/services/notes.rs` -- ADD `purge_expired_trash(conn: &Connection, retention_days: u32) -> Result<usize, NoteyError>`. `chrono::Utc` already imported; use `chrono::Duration::days`. rustdoc the retention guarantee, the silent/maintenance role, and automatic FTS sync. `setup_test_db()` (test mod) is the test harness to reuse; existing tests UPDATE `deleted_at` to literal ISO8601 strings to age rows.
- `src/lib.rs` -- in the `.setup(|app| { … })` closure, after `config` is loaded (~line 132) and before/after `app.manage(Mutex::new(config))`, call `purge_expired_trash` against the managed connection: `app.state::<Mutex<Connection>>()`, lock via `commands::recover_poisoned_db`, pass `config.trash.retention_days`; on `Err` `eprintln!` and continue. Read `config.trash.retention_days` before `config` is moved into `app.manage`.
- `src/services/config.rs` -- (tests only) ADD coverage that the default config has `retention_days == 30` and that a `config.toml` containing `[trash]\nretentionDays = 7` loads as `7`; `merge_update` needs NO change (it clones `existing`, preserving `trash`).
- `src/generated/bindings.ts` -- AUTO-regenerated by the `export_bindings`/build step: `AppConfig` gains optional `trash`, plus a new `TrashConfig` type. Never hand-edit; frontend needs no change (config is consumed read-only via `getConfig`).

## Tasks & Acceptance

**Execution:**

- [x] `src-tauri/src/models/config.rs` -- add `TrashConfig` struct (`retention_days: u32`, `rename_all = "camelCase"`, derives matching siblings) with `impl Default { retention_days: 30 }`; add `#[serde(default)] pub trash: TrashConfig` field to `AppConfig`. rustdoc the new struct.
- [x] `src-tauri/src/services/notes.rs` -- add `purge_expired_trash(conn: &Connection, retention_days: u32) -> Result<usize, NoteyError>` running `DELETE FROM notes WHERE is_trashed = 1 AND deleted_at IS NOT NULL AND deleted_at < ?1` with cutoff = `(Utc::now() - chrono::Duration::days(retention_days as i64)).to_rfc3339()`; return the rows-changed count. rustdoc it.
- [x] `src-tauri/src/services/notes.rs` -- add unit tests covering the I/O matrix: purges a note aged past the window (gone from `notes`, gone from `list_trashed_notes`, and FTS no longer returns it); keeps a note within the window; keeps a boundary note; never touches active (`is_trashed = 0`) notes; returns `0` when nothing qualifies; `retention_days = 0` purges all trashed notes. Age rows by UPDATEing `deleted_at` to old/near ISO8601 strings (mirror existing tests).
- [x] `src-tauri/src/lib.rs` -- wire the silent startup purge in `.setup()`: read `config.trash.retention_days`, lock the managed `Mutex<Connection>` via `commands::recover_poisoned_db`, call `purge_expired_trash`; on `Err` `eprintln!` a warning and continue (non-fatal). Ensure ordering doesn't use `config` after it is moved into `app.manage`.
- [x] `src-tauri/src/services/config.rs` -- add tests: `AppConfig::default().trash.retention_days == 30`; a `config.toml` with `[trash]\nretentionDays = 7` round-trips to `7`; a config file with no `[trash]` section yields the default `30`.

**Acceptance Criteria:**

- Given a `config.toml` with no `[trash]` section, when the app loads config, then `trash.retention_days` is `30`; given `[trash] retentionDays = N`, then it is `N`.
- Given a trashed note whose `deleted_at` is older than `retention_days`, when `purge_expired_trash` runs, then the row is deleted from `notes`, is absent from `list_trashed_notes`, and is no longer returned by full-text search; given a trashed note within the window (or exactly at the boundary), then it remains; given an active note, then it is never affected.
- Given the app starts, when the startup hook runs, then `purge_expired_trash` executes once against the live DB using the configured retention, and if it errors the failure is logged and startup still completes (no panic).
- Given `cargo test`, then the new service and config tests pass and `src/generated/bindings.ts` regenerates with `trash` on `AppConfig` and a `TrashConfig` type; given `cargo clippy -- -D warnings` and `npm run build`, then both are clean.

## Design Notes

The whole story is one set-based `DELETE` plus a config field and a six-line startup wire-up. The hard infrastructure (FTS DELETE trigger, RFC3339 timestamps, config load, managed connection) already exists — reuse it.

- **Timestamp comparability is the one real trap.** Stored `deleted_at` is `Utc::now().to_rfc3339()` → `2026-06-12T14:30:45.123456+00:00`. SQLite's `datetime('now','-30 days')` yields `2026-05-13 14:30:45` (space separator, no offset, no fraction), which sorts *differently* from RFC3339 strings and silently mis-purges near the boundary. Computing the cutoff in Rust with the same `to_rfc3339()` formatter makes the lexicographic `<` exact. Example:
  ```rust
  let cutoff = (Utc::now() - chrono::Duration::days(retention_days as i64)).to_rfc3339();
  let purged = conn.execute(
      "DELETE FROM notes WHERE is_trashed = 1 AND deleted_at IS NOT NULL AND deleted_at < ?1",
      params![cutoff],
  )?;
  ```
- **Strict `<` is deliberate:** "recoverable for at least 30 days" means a note at exactly 30 days must survive. `< cutoff` keeps it; only strictly-older rows go.
- **camelCase TOML key:** the epic prose wrote `retention_days` illustratively, but the codebase serializes config in camelCase (`fontSize`, `layoutMode`) via `rename_all`. The actual key is `retentionDays`; following the convention keeps `config.toml` consistent and the generated TS type correct.
- **No merge_update change:** `merge_update` clones `existing` and overwrites only present partial fields, so `trash` is preserved automatically. We deliberately do NOT add `PartialTrashConfig` — retention is config.toml-only this story (UI editing is Epic 7), and omitting it keeps the IPC surface unchanged apart from the read-only `getConfig` return type.

## Verification

**Commands:**

- `cd src-tauri && cargo test` -- expected: all pass, including the new `purge_expired_trash` service tests and the trash-config tests; regenerates `src/generated/bindings.ts` with `trash`/`TrashConfig`.
- `cd src-tauri && cargo clippy -- -D warnings` -- expected: clean (CI gate).
- `npm run build` -- expected: `tsc` typecheck clean (the new optional `trash` field and `TrashConfig` type compile) and Vite build succeeds.
- `npm run test` -- expected: existing frontend tests still pass (no frontend changes).

**Manual checks:**

- Trash a note, then simulate age by setting its `deleted_at` to an old date in the DB (e.g. `UPDATE notes SET deleted_at='2020-01-01T00:00:00+00:00' WHERE id=…`), restart the app: the note is gone from the Trash view and unrecoverable via search. Trash a fresh note, restart: it is still in trash. Set `[trash] retentionDays = 0` in `config.toml`, restart with notes in trash: trash is emptied silently with no toast.

### Review Findings

- [x] [Review][Patch] Keep startup auto-purge silent on success [src-tauri/src/lib.rs:144]
- [x] [Review][Patch] Guard oversized retention values before computing purge cutoff [src-tauri/src/services/notes.rs:169]
- [x] [Review][Patch] Default `[trash]` sections missing `retentionDays` instead of resetting config [src-tauri/src/models/config.rs:46]

#### Review Ledger (2026-06-12T16:34:47-07:00)

patch: Keep startup auto-purge silent on success [src-tauri/src/lib.rs:144] — successful purge paths currently emit `eprintln!`, which violates the story's silent-startup constraint.
patch: Guard oversized retention values before computing purge cutoff [src-tauri/src/services/notes.rs:169] — `Utc::now() - Duration::days(retention_days as i64)` can overflow and panic on extreme config values.
patch: Default `[trash]` sections missing `retentionDays` instead of resetting config [src-tauri/src/models/config.rs:46] — `[trash]` without `retentionDays` currently fails deserialization and rewrites the whole config to defaults.
dismiss: Treat generated `bindings.ts` as forbidden frontend code [src/generated/bindings.ts:49] — the frozen spec explicitly requires regenerated bindings for the new config type.
dismiss: Reject `retentionDays = 0` as unsafe [src-tauri/src/services/notes.rs:169] — the frozen spec explicitly defines `0` as immediate purge for currently trashed notes.
dismiss: Re-litigate RFC3339 lexicographic comparison [src-tauri/src/services/notes.rs:159] — the frozen spec requires this exact storage and comparison strategy, and current writers use that format consistently.
dismiss: Purge corrupted trashed rows with null `deleted_at` [src-tauri/src/services/notes.rs:173] — current invariants set `deleted_at` on every trashed note; repairing corrupted data is outside this story.
dismiss: Move startup purge off the synchronous setup path [src-tauri/src/lib.rs:135] — the frozen spec explicitly requires a startup maintenance pass in `setup()`.
dismiss: Replace stderr error logging with a different channel [src-tauri/src/lib.rs:145] — the frozen spec explicitly says purge failures should be logged via `eprintln!`.
dismiss: Reuse `delete_note_permanently` inside bulk purge [src-tauri/src/services/notes.rs:166] — the story forbids per-row delete flows and requires a single bulk `DELETE`.
dismiss: Guard against system clock skew in retention decisions [src-tauri/src/services/notes.rs:169] — the frozen spec explicitly defines the cutoff from `Utc::now()`.
dismiss: Require a startup integration test in this story [src-tauri/src/lib.rs:131] — worthwhile coverage, but not a concrete defect in the implemented behavior and not required by the approved task list.
dismiss: Review-package spec diff path [/_bmad-output/implementation-artifacts/spec-5-4-trash-auto-purge.md] — artifact of how the review diff was packaged, not an actual repository path issue.
