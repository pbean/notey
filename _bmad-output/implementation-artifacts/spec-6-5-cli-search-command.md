---
title: "Story 6.5: CLI `search` Command"
type: "feature"
created: "2026-06-13"
status: "done"
baseline_commit: "ba53acc1adbcc71e42a68c848d906f7bb38fa865"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md"
  - "{project-root}/_bmad-output/test-artifacts/test-design-epic-6.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `notey add` and `notey list` are live, but `notey search` still dead-ends on the deferred `NotRunning` stub — there is no way to full-text search notes from the terminal (FR14). Worse, the IPC `search_notes` action filters by `workspaceId: i64`, while the CLI must filter by workspace **name** (`--workspace <name>`, AC2), exactly the mismatch Story 6.4 already resolved for `list`.

**Approach:** Wire `notey search "<query>"` to round-trip a `search_notes` request and print one result per line — title, snippet (match context), workspace name, relative date — pipe-friendly. To support name filtering, teach the *server's* `search_notes` IPC action to accept an optional `workspaceName` (parallel to the 6.4 `list_notes` change) via one new service function (`search_service::search_notes_by_workspace_name`) that LEFT JOINs `workspaces` and filters on `w.name`. The GUI's id-based `search_notes` Tauri command and `search_service::search_notes` stay untouched.

## Boundaries & Constraints

**Always:**
- Wire action verb is `"search_notes"`. No-filter payload is exactly `{ "query": "<query>" }`; with a filter it is `{ "query": "<query>", "workspaceName": "<name>" }` (camelCase). `query` is always present and required.
- Response `data` is an array of search items; each item carries (at least) `id`, `title`, `snippet`, `workspaceName` (nullable), and `updatedAt`, all camelCase, dates ISO 8601. The CLI duplicates this item struct locally (AC6 — `notey-cli` shares NO code with `src-tauri/`); extra fields (e.g. `format`) are ignored.
- Server filtering lives in the **service layer** (`services/search_service.rs`), not forked into the IPC handler: add `search_notes_by_workspace_name(conn, query, workspace_name: Option<&str>)`; `handle_search` only parses the payload and delegates. Because `workspaces.name` is NOT unique (only `path` is), a name filter matches notes in *all* workspaces sharing that name (same rule as 6.4 list). Reuse the existing FTS5 sanitization, empty-query short-circuit, BM25 `ORDER BY rank`, and `LIMIT 50`.
- CLI output (stdout): one line per result, `title \t snippet \t workspace-name \t relative-date`, TAB-separated for robust piping. Title truncated to ≤`MAX_TITLE_CHARS` (reuse 6.4 `truncate_title`). FTS5 `<mark>`/`</mark>` highlight tags are stripped to plain text in the snippet. Embedded TAB/newline/CR in any field are sanitized to spaces (reuse 6.4 `sanitize_list_field`) so each result stays a single 4-field record. Workspace name absent → empty third field. No ANSI color on result rows.
- Relative-date rendering reuses the 6.4 `relative_date(iso, now)` helper verbatim (same buckets, same future/unparseable degradation, same display-timezone month-day).
- No-match: when the server returns an empty array, print exactly `No notes matching '<query>'` to **stdout** (single-quoted original query) and exit 0 (AC3).
- Validate `--workspace` with the existing `validate_workspace` **before** any socket attempt; reject path-traversal/separators/control chars (exit 2, no connect).
- Reuse `client::send_request`, `error_line`, and the exit-code mapping (success → 0, app error → 1, not running → 2). rustdoc on public items, clippy-clean, Conventional Commits.

**Ask First:**
- Any change to the public `notey-cli` API surface, or to the GUI's `search_notes` Tauri command / `search_service::search_notes` (id-based) service.
- Adding any CLI dependency (none is required — `chrono` already present from 6.4).

**Never:**
- Do NOT modify or fork `search_service::search_notes` (the GUI id-based path) or change GUI behavior; add the new name-based function alongside it.
- Do NOT implement a 5-second connect timeout or the full error taxonomy (Story 6.7), emit the `note-created` event (Story 6.6), or add real-time sync.
- Do NOT add a `--json` flag, colorize/ANSI-highlight result rows or matched terms, re-truncate the server-built snippet, or add exit code `3`.
- Do NOT reimplement git-workspace detection CLI-side, depend on `src-tauri`, or add network access.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| search, app up | `notey search "deploy"`, server returns 2 results | request `{action:"search_notes", payload:{query:"deploy"}}`; stdout 2 lines, each `title⇥snippet⇥workspace⇥reldate`; exit 0 | N/A |
| filter by workspace | `notey search "deploy" --workspace my-proj` | request payload `{query:"deploy", workspaceName:"my-proj"}`; only that workspace's results; exit 0 | N/A |
| snippet has marks | item snippet `"the <mark>deploy</mark> step..."` | second field is `the deploy step...` (tags stripped, plain) | N/A |
| long title | result title 80 chars | first 49 chars + `…` (50 display chars) in column 1 | N/A |
| no workspace on result | result with `workspaceName:null` | third TAB field empty; line still has 3 tabs (4 fields) | N/A |
| embedded delimiter | snippet/title contains `\t`/`\n` | delimiter replaced with space; record stays one 4-field line | sanitize, not fail |
| relative dates | results updated 5m / 3h / 40d ago | column 4 shows `5m ago` / `3h ago` / `MonthAbbr Day` | N/A |
| no match | server returns `[]` | stdout `No notes matching 'deploy'`; exit 0 | N/A |
| invalid `--workspace` | `notey search "x" --workspace ../e` | stderr `✕ invalid workspace name: ../e`; exit 2; no socket attempt | local reject |
| app returns error | server `{success:false,error:"db locked"}` | stderr `✕ db locked`; exit 1 | mapped to AppError |
| app not running | connect refused / socket absent | stderr `✕ Notey is not running. Start the application first.`; exit 2 | mapped to NotRunning |
| piped stdout | stdout not a TTY | result rows + no-match message carry no ANSI escape bytes | N/A |

</frozen-after-approval>

## Code Map

- `src-tauri/src/services/search_service.rs` -- MODIFY. Add `search_notes_by_workspace_name(conn, query: &str, workspace_name: Option<&str>) -> Result<Vec<SearchResult>, NoteyError>`: same FTS5 query as `search_notes` (snippet CASE, LEFT JOIN workspaces, `is_trashed=0`, `ORDER BY rank`, `LIMIT 50`) but with a single `AND (?2 IS NULL OR w.name = ?2)` filter (params `[sanitized, workspace_name]`). Reuse `sanitize_fts_query` + the empty-query short-circuit. Leave `search_notes` (GUI id-based path) unchanged. Add `#[cfg(test)]` coverage: name filter, no-filter parity, duplicate-name match.
- `src-tauri/src/ipc/protocol.rs` -- MODIFY. Change `SearchNotesPayload` field `workspace_id: Option<i64>` → `workspace_name: Option<String>` (`#[serde(default)]`, camelCase); `handle_search` delegates to `search_notes_by_workspace_name`. The existing `search_notes_routes` / `search_notes_missing_query_is_error` tests still pass (no workspace field).
- `src-tauri/tests/ipc_tests.rs` -- MODIFY (consequence of the contract change). `int_001_routes_workspace_resolution_and_positive_filters` (line ~141) drives the search filter with `workspaceId`; switch it to `workspaceName: workspace_name` (the same name already used for the list filter above it).
- `notey-cli/src/lib.rs` -- MODIFY. Add a local `SearchResultItem` mirror struct (`id`, `title`, `snippet`, `workspace_name`, `updated_at`; camelCase deserialize). Rework the `Command::Search` arm in `run()`: validate workspace → `dispatch_search(query, workspace)` returning the exit code directly (mirrors `dispatch_list`). Add pure helpers `build_search_request(query, workspace)`, `parse_search_data(data)`, `strip_marks(snippet)`, `format_search_line(item, now)`, `format_search(items, now)`. Reuse `truncate_title`, `relative_date`, `sanitize_list_field`, `error_line`, `client::send_request`. Update the module rustdoc (`search` no longer deferred).
- `notey-cli/tests/cli_search.rs` -- NEW. Stub-socket harness (copy `cli_list.rs` pattern): assert request shape (`search_notes`, `{query}` vs `{query,workspaceName}`), the 4-field result line with marks stripped, the no-match stdout message (exit 0), and the app-error (exit 1) / not-running (exit 2) / invalid-workspace (exit 2, no connect) mappings.
- `src-tauri/src/services/notes.rs` -- REFERENCE ONLY. `list_notes_with_workspace`'s `(?1 IS NULL OR w.name = ?1)` name-filter pattern to mirror; do not modify.
- `notey-cli/src/lib.rs` (`dispatch_list` / `format_list*`) -- REFERENCE ONLY. The 6.4 list path is the structural template for the search path.

## Tasks & Acceptance

**Execution:**

- [x] `src-tauri/src/services/search_service.rs` -- add `search_notes_by_workspace_name` (FTS5 + optional `w.name` filter, parameterized, `ORDER BY rank`, `LIMIT 50`, non-trashed); unit-test name filter, no-filter parity, duplicate-name match. Do not touch `search_notes`.
- [x] `src-tauri/src/ipc/protocol.rs` -- switch `SearchNotesPayload` to `workspaceName`; delegate `handle_search` to the new fn. Keep `query` required.
- [x] `src-tauri/tests/ipc_tests.rs` -- switch the `search_notes` filter call from `workspaceId` to `workspaceName`.
- [x] `notey-cli/src/lib.rs` -- local `SearchResultItem`; wire `Command::Search` (validate → build → dispatch → format/print/exit); add pure helpers (`build_search_request`, `parse_search_data`, `strip_marks`, `format_search_line`, `format_search`). Keep `add` / `list` and exit-code ordering intact.
- [x] `notey-cli/src/lib.rs` -- `#[cfg(test)]` units: `build_search_request` (action + `{query}` vs `{query,workspaceName}`), `strip_marks` (removes `<mark>`/`</mark>`, leaves plain text), `format_search_line` (4-field TAB layout, empty workspace, marks stripped, delimiter sanitized).
- [x] `notey-cli/tests/cli_search.rs` -- stub-server scenarios: search round-trip + per-line columns (6.5-INT-001); `--workspace` filter passthrough (6.5-INT-002); no-match → `No notes matching '<query>'`, exit 0 (6.5-INT-003); invalid `--workspace` → exit 2 before connect; `success:false` → exit 1; not-running → exit 2.

**Acceptance Criteria:**

- Given a stub IPC server returning two search items, when `notey search "deploy"` runs, then it sends `{action:"search_notes", payload:{query:"deploy"}}`, prints exactly two TAB-separated lines each carrying title (≤50 chars), a snippet with `<mark>` tags stripped, the workspace name, and a relative date, and exits 0 (6.5-INT-001 / FR14).
- Given `notey search "q" --workspace my-proj`, when it runs, then the request payload is `{query:"q", workspaceName:"my-proj"}` and only that workspace's results return; an invalid workspace name is rejected locally (exit 2) before any socket attempt (6.5-INT-002).
- Given the server returns an empty result array, when `notey search "deploy"` runs, then stdout is exactly `No notes matching 'deploy'` and exit is 0 (6.5-INT-003).
- Given the desktop app, when the `search_notes` IPC action is invoked with and without a `workspaceName`, then it returns BM25-ranked `SearchResult` rows (each with `snippet` + `workspaceName`), the name filter matches every workspace sharing that name, and the GUI's id-based `search_notes` Tauri command/service behavior is unchanged.
- Given the app responds `{success:false,error}`, then stderr shows `✕ <error>` and exit is 1; given the socket is absent/refused, then stderr shows the "Notey is not running" message and exit is 2.
- Given the full crate, when `cargo test --manifest-path notey-cli/Cargo.toml` and `cargo clippy --manifest-path notey-cli/Cargo.toml --all-targets` run, then all prior CLI tests plus the new 6.5 tests pass warning-clean, and `cargo tree` shows no `src-tauri` dependency (AC6); and `cargo test` in `src-tauri` passes with the updated IPC search contract.

### Review Findings

- [x] [Review][Patch] Search no-filter test does not verify parity with the existing service path [src-tauri/src/services/search_service.rs:421]
- [x] [Review][Patch] Search IPC accepts legacy `workspaceId` payloads as unfiltered queries [src-tauri/src/ipc/protocol.rs:82]
- [x] [Review][Patch] Search CLI stdout does not sanitize all control bytes [notey-cli/src/lib.rs:714]
- [x] [Review][Patch] Public `run()` rustdoc still says search is deferred [notey-cli/src/lib.rs:301]

#### Review Ledger (2026-06-13)

- patch: Search no-filter test does not verify parity with the existing service path [src-tauri/src/services/search_service.rs:421] — spec requires true no-filter parity coverage, not just a result-count check.
- patch: Search IPC accepts legacy `workspaceId` payloads as unfiltered queries [src-tauri/src/ipc/protocol.rs:82] — unknown legacy fields are ignored today, silently widening a filtered search.
- patch: Search CLI stdout does not sanitize all control bytes [notey-cli/src/lib.rs:714, notey-cli/src/lib.rs:786] — raw query and snippet control bytes can inject terminal control sequences.
- patch: Public `run()` rustdoc still says search is deferred [notey-cli/src/lib.rs:301] — documentation contradicts the live search dispatch path.
- dismiss: `cli_search.rs` appears under an absolute path in the diff [notey-cli/tests/cli_search.rs] — combined `git diff --no-index` output rendered the untracked file with an absolute path; Cargo still discovered and ran the test.
- dismiss: The story spec appears under an absolute path in the diff [_bmad-output/implementation-artifacts/spec-6-5-cli-search-command.md] — the same untracked-file diff artifact does not reflect the file's real repo-relative location.
- dismiss: Name-based filtering can fan out across duplicate workspace names [src-tauri/src/services/search_service.rs:449] — the frozen spec explicitly requires matching every workspace sharing that name.
- dismiss: Search rows cannot distinguish duplicate workspace names [notey-cli/src/lib.rs:786] — the output format is spec-owned and intentionally prints workspace name only.
- dismiss: `strip_marks()` removes literal `<mark>` content [notey-cli/src/lib.rs:797] — the implementation matches the frozen design note that requires literal tag stripping.
- dismiss: Search IPC does not reject arbitrary workspace-name strings [src-tauri/src/ipc/protocol.rs:84] — the current contract only requires CLI-side validation and the server path remains parameterized.
- dismiss: `SearchResultItem` requires `id` even though the CLI does not print it [notey-cli/src/lib.rs:143] — the spec says every search item carries `id`, so strict deserialization is consistent with the contract.

## Spec Change Log

## Design Notes

**Why a server change for a "CLI" story.** Identical rationale to 6.4: the AC requires name *filtering*, but the IPC `search_notes` action only filters by `workspace_id`. Rather than a second round-trip to resolve names, the server accepts a name filter and resolves it in one query, mirroring `list_notes_with_workspace`. The GUI's id-based path is the live consumer of `search_service::search_notes` and is left exactly as-is; the IPC action is the CLI's sole consumer, so switching its payload to `workspaceName` has no GUI blast radius.

**Single-query name filter.** Unlike the existing `search_notes` (two near-identical Some/None blocks), the new function uses one statement with `AND (?2 IS NULL OR w.name = ?2)` — both filtered and unfiltered cases share one SQL string. Snippet/rank/limit logic is copied verbatim from `search_notes`.

**Snippet rendering.** FTS5 returns the snippet wrapped in `<mark>…</mark>` (the GUI parses these into styled spans via `HighlightedSnippet.tsx`). The CLI has no styled spans, so `strip_marks` removes only the literal `<mark>` and `</mark>` substrings, leaving the surrounding `...` ellipsis and text intact. No ANSI highlighting (kept out of scope — pipe-friendly, mirrors 6.4 plain rows).

**Field order & count.** Search prints 4 fields `title⇥snippet⇥workspace⇥reldate` (the story's stated order), versus list's 3 fields `title⇥reldate⇥workspace`. Both are TAB-separated and sanitized so each record is exactly one line.

**No-match contract.** AC3 says stdout prints `No notes matching 'query'` — this differs from list (which prints nothing on empty). It is a success outcome → exit 0 (the no-match exit code is an explicit ASSUMPTION per test-design-epic-6.md; AC3's stdout placement implies success).

## Verification

**Commands:**

- `cargo test --manifest-path notey-cli/Cargo.toml` -- expected: prior CLI tests + new 6.5 unit/integration tests pass.
- `cargo test --manifest-path notey-cli/Cargo.toml --test cli_search` -- expected: round-trip / filter / no-match / error scenarios pass.
- `cargo clippy --manifest-path notey-cli/Cargo.toml --all-targets` -- expected: warning-clean.
- `cargo tree --manifest-path notey-cli/Cargo.toml | grep -i src-tauri` -- expected: no match (AC6).
- `cargo test --manifest-path src-tauri/Cargo.toml -- ipc:: search_service::` -- expected: updated IPC search contract + new service tests pass; GUI id-based `search_notes` tests unchanged.
