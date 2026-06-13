---
title: "Story 6.1: CLI Crate Scaffold & Argument Parsing"
type: "feature"
created: "2026-06-13"
status: "done"
baseline_commit: "7d040640788b5f511c43611a15a30a3f62eb2849"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md"
  - "{project-root}/_bmad-output/test-artifacts/atdd-checklist-6-1-cli-crate-scaffold-argument-parsing.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 6 needs a standalone `notey` CLI binary so terminal users can capture, list, and search notes. A red-phase ATDD scaffold (`notey-cli/` crate) already exists with the full public API declared as `todo!()` stubs and 22 `#[ignore]` cargo tests asserting the expected behaviour. Story 6.1 owns the crate scaffold, argument parsing, input validation, and exit-code mapping — not yet the IPC round-trip (that is Story 6.2).

**Approach:** Implement the stubbed functions in `notey-cli/src/lib.rs` — `cli_command`, `parse_args`, `validate_content`, `validate_workspace`, `exit_code_for`, and the `run` plumbing — using `clap` (derive) for parsing, then activate the matching ATDD tests RED→GREEN. The IPC dispatch inside `run` is explicitly deferred to Story 6.2; `run` parses + validates and stops short of the socket call.

## Boundaries & Constraints

**Always:**
- Keep the existing public API signatures and types in `notey-cli/src/lib.rs` exactly as the ATDD tests import them (`Format`, `Command`, `CliError`, `CommandOutcome`, `CliRequest`, `CliResponse`, `MAX_CONTENT_BYTES`, and the six functions). Fill `todo!()` bodies; do not rename or re-shape.
- `validate_content`: accept content `<= MAX_CONTENT_BYTES` (1 MiB), reject `> MAX_CONTENT_BYTES` with `ContentTooLarge`; allow tab/newline/CR, reject NUL and other C0 control chars (and DEL) with `InvalidContent`. Check size before control chars.
- `validate_workspace`: accept ordinary names (`notey`); reject empty, path separators (`/` `\`), `.`/`..`/any `..` substring, absolute paths, NUL, and control chars with `InvalidWorkspace`.
- `exit_code_for`: `Success`→0, `AppError`→1, `NotRunning`→2, `Timeout`→2.
- `cli_command()` exposes exactly the `add`, `list`, `search` subcommands; `--help` and per-subcommand `--help` surface the AC-specified positionals and flags.
- Crate stays standalone (AC6): NO dependency on or shared code with `src-tauri/`; protocol structs remain duplicated JSON structs.
- Conventional Commits, rustdoc on public items, clippy-clean.

**Ask First:**
- Any change that would make `notey-cli` depend on `src-tauri` or a shared crate (violates AC6).
- Any change to a `<frozen-after-approval>` validation rule the ATDD tests encode.

**Never:**
- Do NOT implement the IPC socket client / `interprocess` usage — that is Story 6.2. `run` must not attempt a real socket connection.
- Do NOT add a `--json` flag or exit code `3` ("no results") — explicitly out of scope for 6.1.
- Do NOT introduce a Cargo workspace; `notey-cli` is built via its own manifest.
- Do NOT use string interpolation for any future query path; validation only here.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| add positional | `notey add "hello"` | `Command::Add { text: Some("hello"), stdin: false, format: Markdown }` | N/A |
| add stdin | `notey add --stdin` | `Command::Add { stdin: true, .. }` | N/A |
| format default | `notey add note` | `format == Markdown` | N/A |
| format plaintext | `notey add note --format plaintext` | `format == Plaintext` | N/A |
| invalid format | `notey add note --format rtf` | parse fails | `Err(CliError::Parse)` |
| add missing input | `notey add` | parse fails (needs TEXT or `--stdin`) | `Err(CliError::Parse)` |
| list no/with ws | `notey list` / `notey list --workspace notey` | `Command::List { workspace: None / Some }` | N/A |
| search query+ws | `notey search "q" [--workspace notey]` | `Command::Search { query, workspace }` | N/A |
| search no query | `notey search` | parse fails | `Err(CliError::Parse)` |
| content at cap | 1 MiB bytes | `Ok(())` | N/A |
| content over cap | 1 MiB + 1 byte | rejected | `Err(ContentTooLarge)` |
| content control char | `b"valid\0byte"`, `b"bell\x07here"` | rejected | `Err(InvalidContent)` |
| content tab/nl/cr | `"...\n...\t...\r\n"` | accepted | N/A |
| workspace traversal | `../../etc/passwd`, `..`, `foo/bar`, `/abs/path`, `a\0b` | rejected | `Err(InvalidWorkspace)` |
| workspace ok | `notey` | accepted | N/A |
| exit codes | each `CommandOutcome` | `0/1/2/2` | N/A |

</frozen-after-approval>

## Code Map

- `notey-cli/src/lib.rs` -- the public API with `todo!()` stubs to implement; data/protocol types already defined.
- `notey-cli/src/main.rs` -- thin binary entrypoint calling `notey_cli::run`; clamps exit code to u8 (no change expected).
- `notey-cli/Cargo.toml` -- standalone crate manifest (clap derive, serde, serde_json, interprocess); already correct for AC1.
- `notey-cli/tests/cli_atdd.rs` -- 22 `#[ignore]` ATDD tests; remove `#[ignore]` per scenario as it goes green.
- `_bmad-output/test-artifacts/atdd-checklist-6-1-*.md` -- executable contract / scenario map.

## Tasks & Acceptance

**Execution:**

- [x] `notey-cli/src/lib.rs` -- add private `clap` derive structs (`Cli` + subcommand enum + format value-enum) and a `From` into the public `Format`; implement `cli_command()` via `CommandFactory::command()` so subcommand introspection works.
- [x] `notey-cli/src/lib.rs` -- implement `parse_args` (clap parse → public `Command`), including the AC rule that `add` requires `<TEXT>` or `--stdin`; map all clap failures to `CliError::Parse`.
- [x] `notey-cli/src/lib.rs` -- implement `validate_content` (size cap then control-char scan) and `validate_workspace` (separator/dot-dot/absolute/NUL/control rejection).
- [x] `notey-cli/src/lib.rs` -- implement `exit_code_for` (0/1/2/2 mapping).
- [x] `notey-cli/src/lib.rs` -- implement `run`: clap parse with `--help`/`--version` → stdout + exit 0, usage error → stderr + exit 2; on a valid command run the matching validation; the IPC dispatch is deferred to Story 6.2 (emit a clear stderr message and return `NotRunning`'s code). Document the deferral in rustdoc.
- [x] `notey-cli/tests/cli_atdd.rs` -- remove `#[ignore]` from the 22 tests once their scenarios pass so CI runs them by default.

### Review Findings

- [x] [Review][Patch] `add --stdin` bypasses runtime content validation and stdin draining [notey-cli/src/lib.rs:344]
- [x] [Review][Patch] `add` accepts both `<TEXT>` and `--stdin` without resolving the conflict [notey-cli/src/lib.rs:315]
- [x] [Review][Patch] local validation failures exit as app errors instead of usage errors [notey-cli/src/lib.rs:287]
- [x] [Review][Patch] `--help` still exposes clap's generated `help` subcommand [notey-cli/src/lib.rs:123]

#### Review Ledger (2026-06-13)

patch: `add --stdin` bypasses runtime content validation and stdin draining [notey-cli/src/lib.rs:344] — fixed by reading stdin eagerly and validating it before the deferred `NotRunning` path.
patch: `add` accepts both `<TEXT>` and `--stdin` without resolving the conflict [notey-cli/src/lib.rs:315] — fixed by rejecting the mixed-input form during parse.
patch: local validation failures exit as app errors instead of usage errors [notey-cli/src/lib.rs:287] — fixed by returning exit code `2` for local validation failures before IPC.
patch: `--help` still exposes clap's generated `help` subcommand [notey-cli/src/lib.rs:123] — fixed by disabling clap's autogenerated help subcommand and strengthening the acceptance test.
dismiss: rejecting workspace names containing `..` is intentional [notey-cli/src/lib.rs:225] — the frozen story contract explicitly rejects any `..` substring.
dismiss: workspace canonicalization/existence checks are out of scope for Story 6.1 [notey-cli/src/lib.rs:225] — the frozen story contract narrows 6.1 to name validation, not filesystem resolution.
dismiss: `parse_args()` treating help/version as parse results is acceptable [notey-cli/src/lib.rs:191] — Story 6.1 specifies binary exit behavior, not a distinct library error taxonomy.
dismiss: non-UTF-8 content acceptance is not a 6.1 contract break [notey-cli/src/lib.rs:209] — the story only requires size and control-character validation.

**Acceptance Criteria:**

- Given the `notey-cli` crate, when `cargo test --manifest-path notey-cli/Cargo.toml` runs, then all 22 ATDD tests pass with no `#[ignore]` remaining.
- Given the binary, when `notey --help` / `notey add --help` / `notey list --help` / `notey search --help` run, then they display the AC-specified subcommands, positionals, and flags and exit 0.
- Given a built crate, when its dependency graph is checked, then it does not depend on `src-tauri/` (AC6).
- Given `cargo clippy --manifest-path notey-cli/Cargo.toml`, when it runs, then it is warning-clean.

## Design Notes

Use clap derive internally and convert to the already-declared public `Command` enum (the tests compare against `Command`, not against clap types):

```rust
#[derive(clap::Parser)]
#[command(name = "notey", about = "Terminal-native notes for Notey", version)]
struct Cli { #[command(subcommand)] command: CliSub }

#[derive(clap::Subcommand)]
enum CliSub {
    Add { text: Option<String>, #[arg(long)] stdin: bool,
          #[arg(long, value_enum, default_value = "markdown")] format: FormatArg },
    List { #[arg(long)] workspace: Option<String> },
    Search { query: String, #[arg(long)] workspace: Option<String> },
}
```

`cli_command()` returns `<Cli as clap::CommandFactory>::command()`. `parse_args` calls `Cli::try_parse_from(args)`, mapping `clap::Error` → `CliError::Parse(e.to_string())`, then the `add`-needs-input guard. Control-char rule: reject byte `< 0x20` unless it is `\t (0x09)`, `\n (0x0A)`, `\r (0x0D)`, and reject `0x7F`.

## Verification

**Commands:**

- `cargo test --manifest-path notey-cli/Cargo.toml` -- expected: all 22 tests pass, 0 ignored.
- `cargo clippy --manifest-path notey-cli/Cargo.toml --all-targets` -- expected: no warnings.
- `cargo run --manifest-path notey-cli/Cargo.toml -- --help` -- expected: lists `add`, `list`, `search`; exit 0.
- `cargo tree --manifest-path notey-cli/Cargo.toml | grep -i src-tauri` -- expected: no match (AC6).
