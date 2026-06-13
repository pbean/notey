---
title: "Story 5.5: Markdown Export with Native File Picker"
type: "feature"
created: "2026-06-12"
status: "done"
baseline_commit: "b088b52171bdd308f29e7ff646698b9bb8e6674d"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Notey's "your data is local, yours, and never locked in" promise has no escape hatch yet — there is no way to get notes *out* of the app. Users need to back up or migrate their notes to plain Markdown files that any other tool can read.

**Approach:** Add an "Export to Markdown" command-palette action that opens a native OS directory picker (via `tauri-plugin-dialog`), then invokes a new `export_markdown` Tauri command. A backend export service streams every active (non-trashed) note to an individual `.md` file — YAML frontmatter (`title`, `created_at`, `updated_at`, `workspace`, `format`) followed by the note body — with filesystem-safe, de-duplicated filenames. The command emits throttled progress events so the frontend can show a live "Exporting… N/total" toast for slow exports, then a final "Exported N notes to /path" toast.

## Boundaries & Constraints

**Always:**
- The native picker is opened **from the frontend** via `@tauri-apps/plugin-dialog`'s `open({ directory: true, multiple: false })`. A `null` return (user cancelled) aborts silently — no command call, no toast.
- All file writing happens **in Rust** via `std::fs` inside the export service — the frontend never touches the filesystem (it only passes the chosen directory string to the command). This is the project's "frontend never touches the filesystem directly" rule; the OS picker grants the directory and Rust path-canonicalization confines writes to it. Do **not** introduce `tauri-plugin-fs`.
- **Path containment:** canonicalize the user-selected directory once; every file is written as `dir.join(sanitized_filename)` where the sanitized filename contains **no** path separators or `..`. Sanitization is the primary traversal guard; canonicalization is the documented backstop.
- **Filename sanitization (derive from title):** strip/replace filesystem-reserved characters (`/ \ : * ? " < > |`), control chars, and leading/trailing dots/spaces; collapse internal whitespace; cap length (≤ 200 chars, leaving room for a dedup suffix and `.md`); empty/blank titles fall back to `untitled`; Windows reserved device names (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9`, case-insensitive) are prefixed with `_`.
- **De-duplication:** track already-used filenames case-insensitively; on collision append ` (2)`, ` (3)`, … before the `.md` extension so no note silently overwrites another.
- **YAML frontmatter** is emitted with all five keys always present, each value double-quoted with `\` and `"` escaped (safe for titles/workspaces containing `:`, quotes, etc.). A note with no workspace emits `workspace: ""`. Body follows a blank line after the closing `---`, with a trailing newline.
- **Streaming:** iterate DB rows and write each file as you go (do not collect all note bodies into a Vec first) so peak memory stays bounded for 10k notes. Pull the workspace name in the same query via `LEFT JOIN workspaces`.
- **Progress events** are emitted on the `export-markdown-progress` event (kebab-case) with payload `{ current, total }`, **throttled** (emit at most ~every 50 notes, plus one final event at completion) to avoid flooding IPC for large exports.
- New command follows project conventions: thin `#[tauri::command] #[specta::specta]` handler locks the managed `Mutex<Connection>` via `commands::recover_poisoned_db`, delegates to the testable export service, returns `Result<usize, NoteyError>` (the exported count). Register it in `specta_builder`'s `collect_commands!`. Create the permission TOML manually if the build doesn't, add `allow-export-markdown` to `capabilities/default.json` and `EXPECTED_COMMANDS` in `acl_tests.rs`, and add `dialog:allow-open` to the capability.

**Ask First:**
- Exporting trashed notes, adding format/workspace filters, or a "flatten vs. per-workspace subfolders" layout (this story exports all active notes flat into the chosen directory).
- Persisting the last-used export directory, or auto-opening the directory after export.
- Surfacing export errors with per-file detail or a partial-failure report beyond the single failure toast.

**Never:**
- No `tauri-plugin-fs`; no broad filesystem capability; no frontend filesystem access.
- No JSON export (Story 5.6) — Markdown only.
- No new config keys, no settings UI.
- No per-note Tauri command round-trips — one `export_markdown` call writes all files.
- No manual mutation of `notes_fts`; export is read-only against `notes`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| -------- | ------------- | -------------------------- | -------------- |
| Happy path | N active notes, valid dir | N `.md` files written, each with frontmatter + body; returns `N`; "Exported N notes to /path" toast (5s) | N/A |
| User cancels picker | `open()` returns `null` | No command call, no files, no toast | N/A |
| No active notes | 0 non-trashed notes | Returns `0`; toast "Exported 0 notes to /path"; no files written | N/A |
| Duplicate titles | two notes titled "Notes" | `Notes.md` and `Notes (2).md` — neither overwrites the other | N/A |
| Title with reserved chars | title `a/b:c?` | sanitized to a safe single-segment filename (no separators) inside dir | N/A |
| Empty/blank title | title `""` or whitespace | filename `untitled.md` (deduped if repeated) | N/A |
| Note without workspace | `workspace_id` NULL | frontmatter `workspace: ""` | N/A |
| Title with YAML-special chars | title `He said: "hi"` | `title: "He said: \"hi\""` — valid quoted YAML | N/A |
| Slow export (>2s) | many notes | progress toast "Exporting… N/total" appears after 2s and updates; dismissed at completion | N/A |
| Write fails mid-export | dir read-only / disk full | command returns `NoteyError::Io`; frontend shows failure toast; progress toast dismissed | propagate `Io`, surface error toast |
| Concurrent invocation | action fired twice | second call is a no-op while one export is in flight | guarded |

</frozen-after-approval>

## Code Map

Backend (`src-tauri/`):
- `Cargo.toml` -- ADD `tauri-plugin-dialog = "2"` (matches sibling `"2"` plugin convention).
- `src/services/export.rs` -- NEW module. `export_markdown_to_dir(conn: &Connection, dir: &Path, progress: impl FnMut(usize, usize)) -> Result<usize, NoteyError>` streams active notes (with workspace name via `LEFT JOIN`) and writes one `.md` per note; plus private helpers `sanitize_filename(title: &str) -> String`, `dedup_filename(base, &mut HashSet)`, `build_frontmatter(title, created_at, updated_at, workspace, format) -> String`. Service is Tauri-free and unit-testable.
- `src/services/mod.rs` -- ADD `pub mod export;`.
- `src/commands/export.rs` -- NEW thin handler `export_markdown(app: tauri::AppHandle, state: State<'_, Mutex<Connection>>, directory: String) -> Result<usize, NoteyError>`: canonicalize+validate `directory`, lock conn via `recover_poisoned_db`, call the service passing a throttled closure that `app.emit("export-markdown-progress", ExportProgress { current, total })` (needs `tauri::Emitter`). Define `#[derive(Serialize, Clone, Type)] #[serde(rename_all = "camelCase")] struct ExportProgress`.
- `src/commands/mod.rs` -- ADD `pub mod export;`.
- `src/lib.rs` -- `.plugin(tauri_plugin_dialog::init())` on the Builder; add `commands::export::export_markdown` to `specta_builder`'s `collect_commands!`.
- `src-tauri/permissions/autogenerated/export_markdown.toml` -- create manually if the build skips it (known Tauri v2 issue), mirroring `trash_note.toml`.
- `src-tauri/capabilities/default.json` -- ADD `"dialog:allow-open"` and `"allow-export-markdown"`.
- `src-tauri/tests/acl_tests.rs` -- ADD `"allow-export-markdown"` to `EXPECTED_COMMANDS`.

Frontend (`src/`):
- `package.json` -- ADD `@tauri-apps/plugin-dialog` (`^2`, matches `@tauri-apps/plugin-opener`).
- `src/features/export/exportMarkdown.ts` -- NEW. `exportToMarkdown()`: open directory picker; if non-null, set a 2s timer + `listen('export-markdown-progress', …)`; invoke `commands.exportMarkdown(dir)`; show/update a persistent progress toast only once >2s; on resolve dismiss it and show "Exported N notes to {dir}" (5s) or a failure toast. Module-level `isExporting` guard + `resetExportGuard()` for tests.
- `src/features/toast/store.ts` -- EXTEND: `addToast` keeps a persistent toast when `durationMs <= 0` (skip the auto-dismiss timer); ADD `updateToast(id, message)` (in-place, no-op if gone). Backward compatible (default stays 3000).
- `src/features/command-palette/hooks/usePaletteCommands.ts` -- replace the `export-markdown` stub `action` with `exportToMarkdown`.
- `src/generated/bindings.ts` -- AUTO-regenerated (`commands.exportMarkdown`, `NoteyError`). Never hand-edit.

## Tasks & Acceptance

**Execution:**

- [x] `src-tauri/Cargo.toml` + `src/lib.rs` -- add the `tauri-plugin-dialog` dependency and `.plugin(tauri_plugin_dialog::init())`; register `commands::export::export_markdown` in `specta_builder`.
- [x] `src-tauri/src/services/export.rs` (+ `services/mod.rs`) -- implement `export_markdown_to_dir`, `sanitize_filename`, `dedup_filename`, `build_frontmatter`. Stream rows via `SELECT n.title, n.content, n.format, n.created_at, n.updated_at, COALESCE(w.name,'') FROM notes n LEFT JOIN workspaces w ON w.id = n.workspace_id WHERE n.is_trashed = 0 ORDER BY n.updated_at DESC`; write each file with `std::fs::write`; call `progress(i+1, total)`; return count. rustdoc each public item.
- [x] `src-tauri/src/services/export.rs` (tests) -- unit-test the I/O matrix: writes one file per note with exact frontmatter + body; reserved-char and empty titles sanitize safely; duplicate titles get ` (2)` suffixes (no overwrite); NULL workspace → `workspace: ""`; YAML-special chars escaped; 0 notes → returns 0, no files; progress callback invoked with increasing `current` up to `total`. Use a temp dir + `setup_test_db()`-style in-memory DB.
- [x] `src-tauri/src/commands/export.rs` (+ `commands/mod.rs`) -- thin handler: canonicalize/validate `directory` (return `NoteyError::Validation` if it isn't an existing directory), lock conn, delegate to service with a throttled (~every 50 + final) emit closure; define `ExportProgress`.
- [x] `src-tauri/permissions/autogenerated/export_markdown.toml`, `capabilities/default.json`, `tests/acl_tests.rs` -- add the permission TOML (if not auto-generated), `dialog:allow-open` + `allow-export-markdown` to the capability, and `allow-export-markdown` to `EXPECTED_COMMANDS`.
- [x] `package.json` -- add `@tauri-apps/plugin-dialog`.
- [x] `src/features/toast/store.ts` (+ test) -- add persistent-toast support (`durationMs <= 0`) and `updateToast`; test that a persistent toast is not auto-dismissed and that `updateToast` changes the message / no-ops when absent.
- [x] `src/features/export/exportMarkdown.ts` (+ test) -- implement the picker→invoke→toast flow with the 2s progress-toast threshold and concurrency guard; test (mocking `@tauri-apps/plugin-dialog`, `@tauri-apps/api/event`, and `commands`): cancel → no toast; success → success toast with count + path; error → failure toast; double-invoke is guarded.
- [x] `src/features/command-palette/hooks/usePaletteCommands.ts` -- wire `exportToMarkdown` into the `export-markdown` command.

### Review Findings

- [x] [Review][Patch] Prevent export from overwriting existing files in the chosen directory [src-tauri/src/services/export.rs:67]
- [x] [Review][Patch] Complete filename sanitization for device-name, `..`, and filesystem-length edge cases [src-tauri/src/services/export.rs:108]
- [x] [Review][Patch] Escape control characters in YAML frontmatter values [src-tauri/src/services/export.rs:165]
- [x] [Review][Patch] Avoid `0/0` progress toasts on slow exports [src/features/export/exportMarkdown.ts:50]

#### Review Ledger (2026-06-12T17:18:36-07:00)

patch: Prevent export from overwriting existing files in the chosen directory [src-tauri/src/services/export.rs:67] — current deduplication only covers titles within one export run, so `std::fs::write` can clobber pre-existing files in the selected folder.
patch: Complete filename sanitization for device-name, `..`, and filesystem-length edge cases [src-tauri/src/services/export.rs:108] — the sanitizer still permits Windows-reserved dotted names, internal `..`, and multibyte filenames that exceed common OS byte limits.
patch: Escape control characters in YAML frontmatter values [src-tauri/src/services/export.rs:165] — quoted YAML fields only escape `\\` and `\"`, so workspace names containing CR/LF/TAB can serialize ambiguously.
patch: Avoid `0/0` progress toasts on slow exports [src/features/export/exportMarkdown.ts:50] — the frontend starts from `{ current: 0, total: 0 }` and the backend does not emit an initial total before the 2s toast timer fires.
dismiss: Custom command permission is not path-scoped by Tauri design [src-tauri/src/commands/export.rs:38] — custom command ACLs gate invocation, while the approved story design explicitly relies on frontend picker selection plus backend canonicalization instead of plugin-fs scoping.
dismiss: Final filename can exceed 200 characters after suffixing [src-tauri/src/services/export.rs:154] — the spec caps the title-derived stem at 200 characters and explicitly leaves room for the dedup suffix and `.md`.
dismiss: Partial export can remain on disk after a mid-run write failure [src-tauri/src/services/export.rs:91] — streaming writes plus a single failure toast are part of the approved story behavior, so rollback is not required here.
dismiss: Export holds the database mutex for the whole run [src-tauri/src/commands/export.rs:51] — the approved design notes explicitly accept holding the lock during export on Tauri’s blocking thread pool.
dismiss: Duplicate-title assignment is unstable on identical timestamps [src-tauri/src/services/export.rs:64] — the approved query intentionally orders exported notes by `updated_at DESC` only.
dismiss: Separate missing-test complaint [src/features/export/exportMarkdown.test.ts:15] — this is redundant with the concrete code defects above; the fixes themselves need the targeted regression tests.
dismiss: Repeated `console.error` spy setup in the new tests [src/features/export/exportMarkdown.test.ts:23] — this is test-hygiene noise without evidence of incorrect story behavior or suite breakage.

**Acceptance Criteria:**

- Given "Export to Markdown" is chosen and a directory is picked, when `export_markdown` runs, then each active note is written as an individual `.md` file with YAML frontmatter (`title`, `created_at`, `updated_at`, `workspace`, `format`) and the note body, filenames are filesystem-safe and unique, and the command returns the exported count.
- Given the picker is cancelled (`null`), then no command runs and no toast appears.
- Given the export completes, then a 5s toast reads "Exported N notes to /path"; given it runs longer than 2s, then a "Exporting… N/total" progress toast appears and updates from `export-markdown-progress` events and is dismissed at completion.
- Given a write fails, then the command returns `NoteyError::Io`, the frontend shows a failure toast, and any progress toast is dismissed.
- Given filesystem access, then writes are confined to the user-selected directory (no path traversal) and no `tauri-plugin-fs` / broad FS capability is added.
- Given `cd src-tauri && cargo test`, `cargo clippy -- -D warnings`, `npm run test`, and `npm run build`, then all pass and `bindings.ts` regenerates with `exportMarkdown`.

## Design Notes

**Why writes live in Rust, not the fs plugin.** The epic calls for "scoped filesystem" access. Two readings exist: (a) expose `tauri-plugin-fs` scope to the frontend, or (b) keep writes in Rust and confine them by path-canonicalization. We choose (b): it honors the hard project rule "frontend never touches the filesystem directly," avoids a broad/awkward fs scope for writing thousands of files, and is simpler to make testable. The only new capability is `dialog:allow-open` for the picker.

**Frontmatter example** (always-quoted, escaped):
```markdown
---
title: "Meeting: \"Q3\" plan"
created_at: "2026-06-12T09:00:00+00:00"
updated_at: "2026-06-12T09:30:00+00:00"
workspace: "notey"
format: "markdown"
---

<note body here>
```

**Progress + 2s threshold (frontend sketch).** Don't show a toast immediately — most exports finish fast. Start a 2s timer; if it fires before the command resolves, create a persistent progress toast and keep it updated from events:
```ts
let progressId: number | null = null;
let latest = { current: 0, total: 0 };
const un = await listen<{ current: number; total: number }>(
  'export-markdown-progress', (e) => {
    latest = e.payload;
    if (progressId !== null)
      useToastStore.getState().updateToast(progressId, `Exporting… ${latest.current}/${latest.total}`);
  });
const t = setTimeout(() => {
  progressId = useToastStore.getState().addToast(`Exporting… ${latest.current}/${latest.total}`, 0); // 0 => persistent
}, 2000);
// … await commands.exportMarkdown(dir); then clearTimeout(t); un(); if (progressId!==null) dismissToast(progressId);
```

**Lock held during export is acceptable.** The sync command holds the `Mutex<Connection>` for the whole export; on Tauri's blocking thread pool this doesn't block the tokio runtime, and progress events still reach the webview live. A single-user desktop export briefly serializing DB access is fine.

## Verification

**Commands:**

- `cd src-tauri && cargo test` -- expected: all pass, including new `export` service tests; regenerates `src/generated/bindings.ts` with `exportMarkdown`.
- `cd src-tauri && cargo clippy -- -D warnings` -- expected: clean.
- `npm run test` -- expected: toast-store and export-action tests pass alongside existing suites.
- `npm run build` -- expected: `tsc` typecheck + Vite build succeed (new `@tauri-apps/plugin-dialog` import resolves, generated `exportMarkdown` typed).

**Manual checks:**

- Create a few notes (one with a `:`/`/` in its title, two with identical titles, one with no workspace). Run "Export to Markdown", pick a folder: confirm one `.md` per note, safe + unique filenames, correct frontmatter, and a "Exported N notes to /path" toast. Cancel the picker: nothing happens. Point the export at a read-only folder: a failure toast appears and the app stays responsive.
</content>
</invoke>
