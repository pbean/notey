---
title: "Story 5.6: JSON Export"
type: "feature"
created: "2026-06-12"
status: "done"
baseline_commit: "4ddc1fbc0137a11a2993bb9dc9c8dbf5feb51957"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md"
  - "{project-root}/_bmad-output/implementation-artifacts/spec-5-5-markdown-export-with-native-file-picker.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Notey can export notes as individual Markdown files (Story 5.5), but offers no machine-readable bundle. Users who want to programmatically process, migrate, or back up their notes need a single structured file with full metadata — completing the epic's "your data is local, yours, and never locked in" promise.

**Approach:** Add an "Export to JSON" command-palette action that opens a native OS **file-save** dialog (via `@tauri-apps/plugin-dialog`'s `save`), then invokes a new `export_json` Tauri command. A backend export service reads every active (non-trashed) note (with its workspace name via `LEFT JOIN`) and writes them as a single 2-space-indented `.json` array to the chosen path. On success the frontend shows a "Exported N notes to /path" toast.

## Boundaries & Constraints

**Always:**
- The native save dialog is opened **from the frontend** via `@tauri-apps/plugin-dialog`'s `save({ title, defaultPath: "notey-export.json", filters: [{ name: "JSON", extensions: ["json"] }] })`. A `null` return (user cancelled) aborts silently — no command call, no toast.
- All file writing happens **in Rust** via `std::fs`/`std::io` inside the export service — the frontend never touches the filesystem (it only passes the chosen path string to the command). Do **not** introduce `tauri-plugin-fs`.
- **Path containment:** the chosen file may not exist yet, so canonicalize its **parent directory** (`dunce::canonicalize`) — which must already exist — then write to `canonical_parent.join(file_name)`. Reject (`NoteyError::Validation`) a path with no parent or no final filename component. This confines the write to a real directory and blocks traversal while still allowing a new file.
- **Note object shape:** each array element has exactly `id` (number), `title`, `content`, `format`, `workspaceName` (string or `null` when the note has no workspace), `createdAt`, `updatedAt` — `camelCase` keys via serde. Field values come straight from the DB row; JSON string escaping is handled by `serde_json`.
- **Formatting:** serialize with 2-space indentation (`serde_json::to_writer_pretty` into a `BufWriter<File>`), producing a top-level array. Zero active notes → an empty array `[]` and a returned count of `0`.
- **Query:** `SELECT n.id, n.title, n.content, n.format, n.created_at, n.updated_at, w.name FROM notes n LEFT JOIN workspaces w ON w.id = n.workspace_id WHERE n.is_trashed = 0 ORDER BY n.updated_at DESC` — same active-only, workspace-joined pattern as Markdown export; `w.name` is `NULL` → `workspaceName: null`.
- New command follows project conventions: thin `#[tauri::command] #[specta::specta]` handler that locks the managed `Mutex<Connection>` via `commands::recover_poisoned_db`, delegates to the testable export service, returns `Result<usize, NoteyError>` (the exported count). Register it in `specta_builder`'s `collect_commands!`. Create the permission TOML manually if the build doesn't, add `allow-export-json` to `capabilities/default.json` and `EXPECTED_COMMANDS` in `acl_tests.rs`, and add `dialog:allow-save` to the capability.

**Ask First:**
- Exporting trashed notes, adding format/workspace filters, including extra fields (e.g. `isTrashed`, `deletedAt`, `workspaceId`), or wrapping the array in an envelope object (`{ version, exportedAt, notes }`) — this story emits a bare array of the seven listed fields.
- Adding a progress toast/events for JSON (this story has none — single-file write is fast; the 10k-note/30s budget is met without per-note IPC).
- Persisting the last-used export path or auto-revealing the file after export.

**Never:**
- No `tauri-plugin-fs`; no broad filesystem capability; no frontend filesystem access.
- No Markdown export changes (Story 5.5 is done) — JSON only.
- No new config keys, no settings UI.
- No per-note Tauri command round-trips — one `export_json` call writes the whole file.
- No manual mutation of `notes_fts`; export is read-only against `notes`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| -------- | ------------- | -------------------------- | -------------- |
| Happy path | N active notes, valid file path | One `.json` file: 2-space-indented array of N note objects with all seven fields; returns `N`; "Exported N notes to /path" toast (5s) | N/A |
| User cancels dialog | `save()` returns `null` | No command call, no file, no toast | N/A |
| No active notes | 0 non-trashed notes | File contains `[]`; returns `0`; toast "Exported 0 notes to /path" | N/A |
| Note without workspace | `workspace_id` NULL | element has `"workspaceName": null` | N/A |
| Note with workspace | joined `workspaces.name` | element has `"workspaceName": "<name>"` | N/A |
| Special chars in content/title | quotes, newlines, unicode | Properly JSON-escaped by `serde_json`; file round-trips as valid JSON | N/A |
| Trashed notes present | mix of trashed + active | only active notes appear in the array | N/A |
| Parent dir missing / path has no filename | bad path string | command returns `NoteyError::Validation`; frontend failure toast | propagate `Validation` |
| Write fails | parent read-only / disk full | command returns `NoteyError::Io`; frontend failure toast | propagate `Io`, surface error toast |
| Concurrent invocation | action fired twice | second call is a no-op while one export is in flight | guarded |

</frozen-after-approval>

## Code Map

Backend (`src-tauri/`):
- `src/services/export.rs` -- EXTEND existing module. ADD `export_json_to_file(conn: &Connection, path: &Path) -> Result<usize, NoteyError>`: streams active notes (workspace name via `LEFT JOIN`) into a `Vec<ExportNote>`, then `serde_json::to_writer_pretty` into a `BufWriter<File>`; returns the count. ADD private `#[derive(Serialize)] #[serde(rename_all = "camelCase")] struct ExportNote { id: i64, title, content, format, workspace_name: Option<String>, created_at, updated_at }` (Serialize only — never crosses the IPC boundary). Tauri-free and unit-testable. Markdown export code is untouched.
- `src/commands/export.rs` -- EXTEND. ADD thin handler `export_json(state: State<'_, Mutex<rusqlite::Connection>>, file_path: String) -> Result<usize, NoteyError>`: derive+validate parent dir (canonicalize, must exist) and filename, lock conn via `recover_poisoned_db`, call `services::export::export_json_to_file(&conn, &target)`. No `AppHandle`/progress.
- `src/lib.rs` -- add `commands::export::export_json` to `specta_builder`'s `collect_commands!` (alongside `export_markdown`).
- `src-tauri/permissions/autogenerated/export_json.toml` -- create manually if the build skips it (known Tauri v2 issue), mirroring `export_markdown.toml`.
- `src-tauri/capabilities/default.json` -- ADD `"dialog:allow-save"` and `"allow-export-json"`.
- `src-tauri/tests/acl_tests.rs` -- ADD `"allow-export-json"` to `EXPECTED_COMMANDS`.

Frontend (`src/`):
- `src/features/export/exportJson.ts` -- NEW. `exportToJson()`: open save dialog; if non-null, invoke `commands.exportJson(path)`; on ok show "Exported N notes to {path}" (5s), on error show a failure toast. Module-level `isExporting` guard + `resetExportGuard()` for tests. Mirrors `exportMarkdown.ts` minus the progress-toast/event machinery.
- `src/features/command-palette/hooks/usePaletteCommands.ts` -- replace the `export-json` stub `action` with `exportToJson`.
- `src/generated/bindings.ts` -- AUTO-regenerated (`commands.exportJson`). Never hand-edit.

## Tasks & Acceptance

**Execution:**

- [x] `src-tauri/src/services/export.rs` -- add `ExportNote` struct + `export_json_to_file`: run the active-notes `LEFT JOIN` query, map each row into `ExportNote` (`w.name` → `Option<String>`), write the Vec with `serde_json::to_writer_pretty(BufWriter::new(File::create(path)?), &notes)`, return the count. rustdoc the public fn.
- [x] `src-tauri/src/services/export.rs` (tests) -- unit-test the I/O matrix using a temp file + in-memory DB: N notes → array of N objects with all seven fields and 2-space indentation (parse back with `serde_json::from_str` and assert structure); NULL workspace → `workspaceName: null`; populated workspace → name present; 0 notes → `[]` and returns 0; trashed notes excluded; special chars in title/content survive a JSON round-trip; ordering is `updated_at DESC`.
- [x] `src-tauri/src/commands/export.rs` -- add the `export_json` handler: validate/canonicalize the parent directory (return `NoteyError::Validation` if it doesn't exist or the path lacks a filename), lock conn, delegate to the service.
- [x] `src-tauri/src/lib.rs` -- register `commands::export::export_json` in `collect_commands!`.
- [x] `src-tauri/permissions/autogenerated/export_json.toml`, `capabilities/default.json`, `tests/acl_tests.rs` -- add the permission TOML (if not auto-generated), `dialog:allow-save` + `allow-export-json` to the capability, and `allow-export-json` to `EXPECTED_COMMANDS`.
- [x] `src/features/export/exportJson.ts` (+ test) -- implement the save-dialog→invoke→toast flow with the concurrency guard; test (mocking `@tauri-apps/plugin-dialog` and `commands`): cancel (`null`) → no toast; success → toast with count + path; error → failure toast; double-invoke is guarded.
- [x] `src/features/command-palette/hooks/usePaletteCommands.ts` -- wire `exportToJson` into the `export-json` command (drop the stub).

**Acceptance Criteria:**

- Given "Export to JSON" is chosen and a file path is picked, when `export_json` runs, then all active (non-trashed) notes are written as a single 2-space-indented JSON array where each element has `id`, `title`, `content`, `format`, `workspaceName`, `createdAt`, `updatedAt`, and the command returns the exported count.
- Given a note has no workspace, then its `workspaceName` is `null`; given it has one, then `workspaceName` is the workspace name.
- Given the save dialog is cancelled (`null`), then no command runs and no toast appears.
- Given the export completes, then a 5s toast reads "Exported N notes to /path".
- Given the write fails or the parent directory is invalid, then the command returns `NoteyError::Io`/`Validation`, and the frontend shows a failure toast.
- Given filesystem access, then writes are confined to the user-selected file's directory (no traversal) and no `tauri-plugin-fs` / broad FS capability is added.
- Given `cd src-tauri && cargo test`, `cargo clippy -- -D warnings`, `npm run test`, and `npm run build`, then all pass and `bindings.ts` regenerates with `exportJson`.

### Review Findings

- [x] [Review][Patch] Reject symlink export targets to preserve path containment [src-tauri/src/commands/export.rs:74]
- [x] [Review][Patch] Surface final buffered write failures from JSON export [src-tauri/src/services/export.rs:142]
- [x] [Review][Patch] Distinguish missing export directories from I/O failures during path resolution [src-tauri/src/commands/export.rs:86]

#### Review Ledger (2026-06-12T17:59:17-07:00)

patch: Reject symlink export targets to preserve path containment [src-tauri/src/commands/export.rs:74] — the command canonicalizes the parent directory but still follows an existing symlink at the chosen filename, so a save can escape the approved directory.
patch: Surface final buffered write failures from JSON export [src-tauri/src/services/export.rs:142] — `BufWriter` is dropped without an explicit flush check, so late write failures can return success with truncated JSON.
patch: Distinguish missing export directories from I/O failures during path resolution [src-tauri/src/commands/export.rs:86] — canonicalization currently maps every failure to `Validation`, which misclassifies permission and other filesystem errors promised as `Io`.
dismiss: Allow overwriting an existing regular file at the chosen path [src-tauri/src/services/export.rs:165] — the story does not forbid replacing a user-selected file, so this is not a review blocker.
dismiss: Hold the database mutex for the full JSON export [src-tauri/src/commands/export.rs:97] — the change follows the existing sync-command/export pattern and the spec does not require a lock-release refactor here.
dismiss: Add a deterministic secondary sort key for identical `updated_at` values [src-tauri/src/services/export.rs:148] — the frozen query specifies `ORDER BY n.updated_at DESC`, and no acceptance criterion requires a stable tie-breaker.
dismiss: Force a `.json` extension when the user edits the save filename [src/features/export/exportJson.ts:26] — the story requires a default filename and JSON filter, not automatic extension rewriting.
dismiss: Differentiate validation and I/O failures in the frontend toast copy [src/features/export/exportJson.ts:42] — the acceptance criteria require a failure toast, not per-error messaging.
dismiss: Track missing dedicated I/O-failure regression tests as a separate bug [src-tauri/src/services/export.rs:142] — regression coverage belongs in the patch for the concrete buffered-write defect, not as an extra product issue.
dismiss: Track missing command-level path-validation tests as a separate bug [src-tauri/src/commands/export.rs:74] — regression coverage belongs in the path-validation patches above, not as an extra product issue.
dismiss: Treat save-options and toast-duration assertions as a release blocker [src/features/export/exportJson.test.ts:1] — this is test-hygiene noise without evidence of incorrect story behavior.
dismiss: Reject `.` or `..` as explicit filenames [src-tauri/src/commands/export.rs:79] — `Path::file_name()` already returns `None` for those cases, so the existing validation path rejects them.
dismiss: Preserve the previous export via atomic temp-file rename [src-tauri/src/services/export.rs:165] — the story requires reporting write failures, not atomic replacement semantics.
dismiss: Stream JSON rows instead of collecting a `Vec<ExportNote>` first [src-tauri/src/services/export.rs:151] — the frozen design notes explicitly chose collect-then-write for this story.
dismiss: Missing frontend JSON export implementation [src/features/export/exportJson.ts:1] — contradicted by the diff and the file itself; the implementation and tests are present.
dismiss: Missing `export_json` permission TOML [src-tauri/permissions/autogenerated/export_json.toml:1] — contradicted by the diff and the file itself; the permission file was added.

## Spec Change Log

## Design Notes

**Why collect-then-`to_writer_pretty`, not row-by-row streaming.** Markdown export streamed because it writes N independent files. JSON export produces one array, so the natural unit is the whole structure. Building a `Vec<ExportNote>` for 10k small text rows is a few MB and serializes well under the 30s budget; `to_writer_pretty` into a `BufWriter<File>` streams the *bytes to disk* (no giant in-memory `String`) and yields canonical 2-space indentation — manual per-row framing would risk malformed indentation for marginal benefit.

**`workspaceName` is `null`, not `""`.** Markdown frontmatter used `workspace: ""` because YAML there is a flat string; JSON consumers expect a real `null` to distinguish "no workspace" from a workspace literally named empty. `Option<String>` from the nullable `LEFT JOIN` column serializes to `null` directly.

**Save vs. open dialog.** Markdown export used `open({ directory: true })` (pick a folder for N files). JSON writes one file, so it uses `save(...)` (pick a target filename) — hence the new `dialog:allow-save` capability and the parent-directory canonicalization (the file itself won't exist yet).

**Expected output shape:**
```json
[
  {
    "id": 1,
    "title": "My Note",
    "content": "Hello",
    "format": "markdown",
    "workspaceName": "notey",
    "createdAt": "2026-06-12T09:00:00+00:00",
    "updatedAt": "2026-06-12T09:30:00+00:00"
  }
]
```

## Verification

**Commands:**

- `cd src-tauri && cargo test` -- expected: all pass, including new `export_json` service tests; regenerates `src/generated/bindings.ts` with `exportJson`.
- `cd src-tauri && cargo clippy -- -D warnings` -- expected: clean.
- `npm run test` -- expected: new `exportJson` action tests pass alongside existing suites.
- `npm run build` -- expected: `tsc` typecheck + Vite build succeed (generated `exportJson` typed).

**Manual checks:**

- Create a few notes (one with a `"`/newline in its content, one with no workspace, one in a workspace). Run "Export to JSON", pick a path: confirm a single valid `.json` array with all seven fields per note, 2-space indentation, `workspaceName: null` for the loose note, and a "Exported N notes to /path" toast. Cancel the dialog: nothing happens. Point at a read-only directory: a failure toast appears and the app stays responsive.
</content>
</invoke>
