---
title: "Story 6.4: CLI `list` Command"
type: "feature"
created: "2026-06-13"
status: "done"
baseline_commit: "fc082d83571d89c3ab4da11792b91c79ad2df739"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md"
  - "{project-root}/_bmad-output/test-artifacts/test-design-epic-6.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `notey add` is live (Story 6.3), but `notey list` still dead-ends on the deferred `NotRunning` stub — there is no way to see captured notes from the terminal. Worse, the IPC `list_notes` action cannot serve the command's acceptance criteria as it stands: it returns bare `Note` rows (numeric `workspace_id`, no name) and filters by `workspaceId: i64`, while the CLI must *display* each note's workspace **name** and *filter* by workspace **name** (FR15).

**Approach:** Make `notey list` round-trip a `list_notes` request and print one note per line — title (≤50 chars), relative date, workspace name — in a pipe-friendly form. To supply name display + name filtering, teach the *server's* `list_notes` IPC action to return name-enriched rows and accept an optional `workspaceName` filter, implemented as one new service function (`notes::list_notes_with_workspace`) that LEFT JOINs `workspaces` — exactly parallel to how `search_notes` already returns `workspaceName`. The GUI's existing `list_notes` Tauri command and service stay untouched.

## Boundaries & Constraints

**Always:**
- Wire action verb is `"list_notes"`. No-filter request payload is exactly `{}`; with a filter it is `{ "workspaceName": "<name>" }` (camelCase). The server resolves the name → workspace ids and returns only matching notes; because `workspaces.name` is NOT unique (only `path` is), a name filter matches *all* workspaces sharing that name.
- Response `data` is an array of name-enriched note items; each item carries (at least) `id`, `title`, `workspaceName` (nullable), and `updatedAt`, all camelCase, dates ISO 8601. The CLI duplicates this item struct locally (AC6 — `notey-cli` shares NO code with `src-tauri/`).
- Server enrichment lives in the **service layer** (`services/notes.rs`), not forked into the IPC handler: add `list_notes_with_workspace(conn, workspace_name: Option<&str>)`; `handle_list` only parses the payload and delegates. Notes are ordered `updated_at DESC` and exclude trashed rows, matching `notes::list_notes`.
- CLI output (stdout): one line per note, `title \t relative-date \t workspace-name`, TAB-separated for robust piping (`cut -f`, `awk -F'\t'`). Title truncated to ≤50 chars (append `…` when longer). Workspace name absent → empty third field. No ANSI color on list rows. Empty result → no stdout lines, exit 0.
- Relative-date wording mirrors the frontend `formatRelativeDate` buckets verbatim: `just now` (<1m), `{n}m ago` (<60m), `{n}h ago` (<24h), `{n}d ago` (<7d), else `MonthAbbr Day` (e.g. `Jun 13`); future timestamps and unparseable dates degrade gracefully (future → month-day, unparseable → empty string). The relative-date helper takes "now" as a parameter so it is pure and unit-testable.
- Validate `--workspace` with the existing Story 6.1 `validate_workspace` **before** any socket attempt; reject path-traversal/separators/control chars (exit 2, no connect).
- Reuse `client::send_request`, `error_line`, and the exit-code mapping (success→0, app error→1, not running→2). rustdoc on public items, clippy-clean, Conventional Commits.

**Ask First:**
- Adding any CLI dependency beyond `chrono` (added here, pinned `chrono = "0.4"` to match `src-tauri`, for relative-date formatting).
- Any change to the public `notey-cli` API surface or to the GUI's `list_notes` Tauri command / `notes::list_notes` service.

**Never:**
- Do NOT modify or fork `notes::list_notes` (the GUI path) or change the GUI's behavior; add the new function alongside it.
- Do NOT implement a 5-second connect timeout or the full error taxonomy (Story 6.7), wire `search` output (Story 6.5), or emit the `note-created` event (Story 6.6).
- Do NOT add a `--json` flag, colorize list rows, or add exit code `3`.
- Do NOT reimplement git-workspace detection CLI-side, depend on `src-tauri`, or add network access.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| list, app up | `notey list`, server returns 2 notes | request `{action:"list_notes", payload:{}}`; stdout 2 lines, each `title⇥reldate⇥workspace`; exit 0 | N/A |
| filter by workspace | `notey list --workspace my-proj` | request payload `{workspaceName:"my-proj"}`; only that workspace's notes printed; exit 0 | N/A |
| long title | note title 80 chars | first 49 chars + `…` (50 display chars) in column 1 | N/A |
| no workspace on note | note with `workspaceName:null` | third TAB field is empty; line still has 2 tabs | N/A |
| relative dates | notes updated 30s / 5m / 3h / 2d / 40d ago | columns show `just now` / `5m ago` / `3h ago` / `2d ago` / `MonthAbbr Day` | N/A |
| unparseable date | item `updatedAt` not RFC3339 | relative-date field is empty; line still printed | degrade, not fail |
| empty result | server returns `[]` | no stdout lines; exit 0 | N/A |
| invalid `--workspace` | `notey list --workspace ../x` | stderr `✕ invalid workspace name: ../x`; exit 2; no socket attempt | local reject |
| app returns error | server `{success:false,error:"db locked"}` | stderr `✕ db locked`; exit 1 | mapped to AppError |
| app not running | connect refused / socket absent | stderr `✕ Notey is not running. Start the application first.`; exit 2 | mapped to NotRunning |
| piped stdout | stdout not a TTY | list rows contain no ANSI escape bytes (rows are always plain) | N/A |

</frozen-after-approval>

## Code Map

- `src-tauri/src/services/notes.rs` -- MODIFY. Add `list_notes_with_workspace(conn, workspace_name: Option<&str>) -> Result<Vec<NoteListItem>, NoteyError>`: one SQL `SELECT n.id, n.title, w.name AS workspace_name, n.updated_at FROM notes n LEFT JOIN workspaces w ON w.id = n.workspace_id WHERE n.is_trashed = 0 AND (?1 IS NULL OR w.name = ?1) ORDER BY n.updated_at DESC`, parameterized. Leave `list_notes` (GUI path) unchanged. Add `#[cfg(test)]` coverage for enrichment + name filter (incl. duplicate-name match).
- `src-tauri/src/models/mod.rs` -- MODIFY. Add `NoteListItem { id, title, workspace_name: Option<String>, updated_at: String }` with `#[serde(rename_all = "camelCase")]` + `Type` derive (mirrors `SearchResult`).
- `src-tauri/src/ipc/protocol.rs` -- MODIFY. Change `ListNotesPayload` to `{ workspace_name: Option<String> }` (camelCase, `#[serde(default)]`); `handle_list` delegates to `list_notes_with_workspace`. Update the existing `list_notes_routes_with_and_without_filter` test to drive the `workspaceName` filter and assert enriched output.
- `notey-cli/Cargo.toml` -- MODIFY. Add `chrono = "0.4"`.
- `notey-cli/src/lib.rs` -- MODIFY. Add a local `NoteListItem` mirror struct. Rework the `Command::List` arm in `run()`: validate workspace → build `list_notes` request → dispatch → on success parse `data` to `Vec<NoteListItem>` + print formatted lines (exit 0); on app-error/not-running map to `error_line` + exit code. Add pure helpers `build_list_request`, `truncate_title`, `relative_date(iso, now)`, `format_list_line(item, now)`, `format_list(items, now)`. `add` path unchanged; `search` stays deferred.
- `notey-cli/tests/cli_list.rs` -- NEW. Stub-socket harness (same pattern as `cli_add.rs`): assert the captured request shape (`list_notes`, `{}` vs `{workspaceName}`), printed lines/truncation/empty-list, and the app-error (exit 1) / not-running (exit 2) mappings.
- `src-tauri/tests/ipc_tests.rs` -- MODIFY (consequence of the contract change). `int_001_routes_workspace_resolution_and_positive_filters` drove the old `workspaceId` list filter; switch its `list_notes` call to `workspaceName` (the search filter there still uses `workspaceId` and is untouched).
- `src-tauri/src/services/search_service.rs` -- REFERENCE ONLY. The `LEFT JOIN workspaces` + `workspace_name` pattern to mirror; do not modify.

## Tasks & Acceptance

**Execution:**

- [x] `src-tauri/src/models/mod.rs` -- add `NoteListItem` (camelCase, `Type`).
- [x] `src-tauri/src/services/notes.rs` -- add `list_notes_with_workspace` (LEFT JOIN + optional name filter, parameterized, `updated_at DESC`, non-trashed); unit-test enrichment, name filter, and duplicate-name match. Do not touch `list_notes`.
- [x] `src-tauri/src/ipc/protocol.rs` -- switch `ListNotesPayload` to `workspaceName`, delegate `handle_list` to the new fn; update the existing list routing test to the name filter + enriched assertions.
- [x] `notey-cli/Cargo.toml` -- add `chrono = "0.4"`.
- [x] `notey-cli/src/lib.rs` -- local `NoteListItem`; wire `Command::List` (validate → build → dispatch → format/print/exit); add pure formatter helpers. Keep `add` and exit-code ordering intact.
- [x] `notey-cli/src/lib.rs` -- `#[cfg(test)]` units: `relative_date` buckets (just now/m/h/d/month-day, future, unparseable), `truncate_title` (≤50 + ellipsis), `build_list_request` (action + `{}` vs `{workspaceName}`), `format_list_line` (TAB-separated, empty workspace).
- [x] `notey-cli/tests/cli_list.rs` -- stub-server scenarios: list round-trip + per-line columns (6.4-INT-001); `--workspace` filter passthrough (6.4-INT-002); empty list → no output, exit 0; `success:false` → exit 1; not-running → exit 2.

### Review Findings

- [x] [Review][Patch] Preserve the three-field TAB output contract by sanitizing embedded record delimiters before rendering list rows [notey-cli/src/lib.rs:607]
- [x] [Review][Patch] Render month-day fallback using the frontend-style local calendar day instead of UTC [notey-cli/src/lib.rs:642]
- [x] [Review][Patch] Enforce the CLI-side `list_notes` item contract by mirroring `id` and rejecting missing success payloads [notey-cli/src/lib.rs:123]

#### Review Ledger (2026-06-13T18:07:47-07:00)

patch: Preserve the three-field TAB output contract by sanitizing embedded record delimiters before rendering list rows [notey-cli/src/lib.rs:607] — fixed by normalizing `\t`, `\n`, and `\r` before TAB-delimited output.
patch: Render month-day fallback using the frontend-style local calendar day instead of UTC [notey-cli/src/lib.rs:642] — fixed by formatting older/future dates in the display timezone instead of UTC.
patch: Enforce the CLI-side `list_notes` item contract by mirroring `id` and rejecting missing success payloads [notey-cli/src/lib.rs:123] — fixed by adding `id` to the mirrored struct and treating missing `data` as a protocol error.
dismiss: Ignore legacy `workspaceId` IPC compatibility concern [src-tauri/src/ipc/protocol.rs:73] — Story 6.4 intentionally changes the CLI-side IPC filter to `workspaceName`; no backward-compat requirement is in scope.
dismiss: Duplicate workspace-name filters returning multiple workspaces [src-tauri/src/services/notes.rs:277] — explicitly required by the story because `workspaces.name` is not unique.
dismiss: Blank date on unparseable timestamps [notey-cli/src/lib.rs:651] — explicitly required by the story (`updatedAt` parse failure degrades to an empty date field).
dismiss: Future timestamps falling back to month-day [notey-cli/src/lib.rs:656] — explicitly required by the story (`future -> month-day`).
dismiss: Missing SQL tiebreaker after `updated_at DESC` [src-tauri/src/services/notes.rs:285] — the story only requires `updated_at DESC`; no secondary ordering rule is specified.
dismiss: Character-count truncation is not terminal-display-width aware [notey-cli/src/lib.rs:614] — the story constrains title length by characters, not by grapheme width or terminal columns.
dismiss: Month abbreviations are not locale-sensitive [notey-cli/src/lib.rs:675] — the story requires `MonthAbbr Day` buckets but does not define a localized CLI-output contract.

**Acceptance Criteria:**

- Given a stub IPC server returning two name-enriched notes, when `notey list` runs, then it sends `{action:"list_notes", payload:{}}`, prints exactly two TAB-separated lines each carrying title (≤50 chars), a relative date, and the workspace name, and exits 0 (6.4-INT-001 / FR15).
- Given `notey list --workspace my-proj`, when it runs, then the request payload is `{workspaceName:"my-proj"}` and only that workspace's notes are returned; an invalid workspace name is rejected locally (exit 2) before any socket attempt (6.4-INT-002).
- Given the desktop app, when the `list_notes` IPC action is invoked with and without a `workspaceName`, then it returns name-enriched rows (each with `workspaceName`) ordered `updatedAt DESC`, the name filter matches every workspace sharing that name, and the GUI's `list_notes` Tauri command/service behavior is unchanged.
- Given the app responds `{success:false,error}`, then stderr shows `✕ <error>` and exit is 1; given the socket is absent/refused, then stderr shows the "Notey is not running" message and exit is 2; given an empty result, then stdout is empty and exit is 0.
- Given the full crate, when `cargo test --manifest-path notey-cli/Cargo.toml` and `cargo clippy --manifest-path notey-cli/Cargo.toml --all-targets` run, then all prior CLI tests plus the new 6.4 tests pass warning-clean, and `cargo tree` shows no `src-tauri` dependency (AC6); and `cargo test` in `src-tauri` passes with the updated IPC contract.

## Spec Change Log

## Design Notes

**Why a server change for a "CLI" story.** The story's ACs require name *display* and name *filtering*, neither of which the current `list_notes` IPC action can supply (it returns `workspace_id` only and filters by id). Rather than add a second IPC round-trip to resolve names, the server returns enriched rows and accepts a name filter — one query, mirroring `search_notes`. Keeping it in `services/notes.rs` honors the epic's "delegate to the same DB logic, don't fork persistence" rule; the GUI's id-based `list_notes` is left exactly as-is.

**Name non-uniqueness.** `workspaces.name` has no UNIQUE constraint (only `path` does), so a name filter is `w.name = ?1` and may legitimately return notes from several workspaces — this is acceptable and the simplest faithful reading of "notes in the specified workspace."

**Relative date (mirror, in Rust):**
```rust
// now passed in for testability; iso is RFC3339 (chrono::Utc::now().to_rfc3339())
let dt = match DateTime::parse_from_rfc3339(iso) { Ok(d) => d.with_timezone(&Utc), Err(_) => return String::new() };
let mins = (now - dt).num_minutes();
if mins < 0 { return format!("{} {}", dt.format("%b"), dt.day()); }      // future → month-day
if mins < 1 { "just now".into() } else if mins < 60 { format!("{mins}m ago") }
else if mins < 1440 { format!("{}h ago", mins/60) } else if mins < 10080 { format!("{}d ago", mins/1440) }
else { format!("{} {}", dt.format("%b"), dt.day()) }
```

**Pipe-friendliness.** TAB separation (not aligned columns) is the deliberate choice: titles contain spaces, so whitespace-aligned columns break field splitting; TAB lets `cut -f1`/`awk -F'\t'` parse cleanly while staying human-readable.

**Test harness.** `cli_list.rs` reuses `cli_add.rs`'s stub-server approach: bind a temp socket via `interprocess`, read one framed request, return a canned framed `{success,data:[…]}`, drive the `notey` binary through `NOTEY_SOCKET_PATH` + `CARGO_BIN_EXE_notey`, and assert on captured request bytes + child stdout/exit — no `src-tauri` dependency.

## Verification

**Commands:**

- `cargo test --manifest-path notey-cli/Cargo.toml` -- expected: prior CLI tests + new 6.4 unit/integration tests pass.
- `cargo test --manifest-path notey-cli/Cargo.toml --test cli_list` -- expected: list round-trip / filter / empty / error scenarios pass.
- `cargo clippy --manifest-path notey-cli/Cargo.toml --all-targets` -- expected: warning-clean.
- `cargo tree --manifest-path notey-cli/Cargo.toml | grep -i src-tauri` -- expected: no match (AC6).
- `cargo test --manifest-path src-tauri/Cargo.toml -- ipc:: notes::` -- expected: updated IPC list contract + new service tests pass; GUI `list_notes` tests unchanged.
