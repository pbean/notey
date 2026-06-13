---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-06-13'
generatedTestFiles:
  - notey-cli/tests/cli_atdd.rs
storyId: '6.1'
storyKey: '6-1-cli-crate-scaffold-argument-parsing'
storyFile: '_bmad-output/planning-artifacts/epics.md#epic-6-story-6.1'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-6-1-cli-crate-scaffold-argument-parsing.md'
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/test-artifacts/test-design-epic-6.md
  - _bmad-output/project-context.md
  - _bmad/tea/config.yaml
detectedStack: 'fullstack'
targetFramework: 'cargo test (Rust — new notey-cli/ crate)'
---

# ATDD Red-Phase Checklist — Story 6.1: CLI Crate Scaffold & Argument Parsing

## Step 1 — Preflight & Context Loading

**Story:** 6.1 — CLI Crate Scaffold & Argument Parsing (Epic 6: CLI Integration)
**Status at design time:** `backlog` — greenfield. No `notey-cli/` crate, no `interprocess` dep, **0 existing Epic-6 tests**. True red-phase ATDD.

**Detected stack:** fullstack (React frontend + Rust/Tauri backend). This story targets the **Rust CLI crate** → `cargo test` in a new `notey-cli/` crate.

**Framework decision:** Project uses Vitest (frontend) + cargo test (backend) + tauri-driver/WebDriver (E2E) — NOT Playwright/Cypress. Generic TEA Playwright/Cypress prerequisite treated as satisfied by the project's actual configured frameworks. Story 6.1 logic is pure CLI argument parsing + input validation → **cargo unit tests** are the correct level.

### Acceptance Criteria (from epics.md, Epic 6 / Story 6.1)

- **AC1:** New `notey-cli/` dir alongside `src-tauri/`; own `Cargo.toml`; deps `clap` (derive), `serde_json`, `interprocess`; builds as standalone binary named `notey`.
- **AC2:** `notey --help` shows subcommands `add`, `list`, `search`.
- **AC3:** `notey add --help` shows positional `<TEXT>`, `--stdin` flag, optional `--format` (markdown/plaintext, default markdown).
- **AC4:** `notey list --help` shows optional `--workspace <name>` filter.
- **AC5:** `notey search --help` shows positional `<QUERY>`, optional `--workspace <name>` filter.
- **AC6:** CLI crate shares NO code with `src-tauri/` — protocol types duplicated as simple JSON structs.

### Mapped Red-Phase Test Scenarios (from test-design-epic-6.md)

| ID | Priority | TEA ref | Coverage | Risk |
|---|---|---|---|---|
| 6.1-UNIT-001 | P0 | P0-UNIT-004 | clap parses `add <TEXT>`/`--stdin`/`--format` (default md, invalid rejected); `list --workspace`; `search <QUERY> --workspace`; `--help` lists 3 subcommands | RISK-E6-005 (AC1–AC5) |
| 6.1-UNIT-002 | P0 | P0-UNIT-005 | Input validation: >1MB rejected (1MB boundary OK / +1 reject); path-traversal & injection/control chars rejected/sanitized | RISK-E6-001 (score 6, MITIGATE) / NFR10 |
| 6.1-UNIT-003 | P0 | P0-UNIT-006 | Exit codes 0 success / 1 app-error / 2 not-running / 2 timeout | RISK-E6-005 |
| 6.1-UNIT-004 | P1 | P0-INT-008 (CLI side) | Duplicated protocol structs round-trip exact `{action,payload}`/`{success,data,error}` shapes (drift pin) | RISK-E6-008 |

### Notes / Assumptions carried from test design
- `--json` output flag and exit code `3` ("no results") are **NOT in scope** for 6.1 — absent from ACs; tests assert only AC-defined exit codes (0/1/2).
- Shared protocol crate is deferred post-v1; 6.1 mandates duplicated structs. Drift is pinned by `6.1-UNIT-004` (round-trip), not by shared code.

### Prerequisites Check
- [x] Story has clear acceptance criteria (epics.md) + pre-assigned TEA scenarios (test-design-epic-6.md)
- [x] Test framework available (cargo test; new crate to be scaffolded)
- [x] Stack detected (fullstack → Rust CLI target)

## Step 2 — Generation Mode

**Mode:** AI Generation (recording skipped).
**Rationale:** Backend/Rust CLI story — pure clap argument parsing, input validation, and exit-code logic with clear ACs and standard scenarios. No browser UI → no Playwright/MCP recording. Tests generated from ACs + test-design-epic-6.md as `cargo` unit tests in the new `notey-cli/` crate.

## Step 3 — Test Strategy

**Level selection:** All scenarios are **Unit** (pure CLI logic in the `notey-cli/` crate). Backend story → **no E2E**. No duplicate coverage across levels.

### Scenario breakdown

**6.1-UNIT-001 — clap argument parsing** (P0, AC1–AC5, RISK-E6-005)
- `add <TEXT>` positional parses
- `add --stdin` flag parses
- `add --format markdown` / `--format plaintext` parse
- `--format` defaults to `markdown` when omitted
- `add --format foo` (invalid value) → parse error (non-zero clap exit)
- `list` with no args; `list --workspace <name>`
- `search <QUERY>` positional; `search --workspace <name>`
- `--help` (and no-args) surfaces exactly subcommands `add`, `list`, `search`
- Negative: `search` with no query → error; `add` with neither text nor `--stdin` → error

**6.1-UNIT-002 — input validation** (P0, RISK-E6-001 score 6 MITIGATE / NFR10) — security, top priority
- content == 1 MB → accepted (boundary OK)
- content == 1 MB + 1 byte → rejected
- stdin payload > 1 MB → rejected
- `--workspace ../../etc/passwd` (path traversal) → rejected/sanitized
- null byte / control chars in content → rejected/sanitized

**6.1-UNIT-003 — exit codes** (P0, RISK-E6-005)
- success → exit 0
- app-error → exit 1
- app-not-running → exit 2
- timeout → exit 2
- Out of scope (asserted absent / not added): exit code `3` ("no results"), `--json` flag

**6.1-UNIT-004 — protocol struct round-trip** (P1, RISK-E6-008 drift pin)
- Request struct serializes to exact `{action, payload}` JSON shape
- Response struct round-trips exact `{success, data, error}` shape
- Field names/casing pinned so duplicated CLI structs can't silently drift from `src-tauri` serde structs

### Priorities
- **P0:** 6.1-UNIT-001, 6.1-UNIT-002, 6.1-UNIT-003 (parsing correctness, security validation, scripting/exit-code contract)
- **P1:** 6.1-UNIT-004 (contract drift guard)

### Red-phase guarantee
All tests reference a `notey-cli` crate + a validation function + an exit-code mapper + protocol structs that **do not exist yet** → suite fails to compile/run until Story 6.1 is implemented. Intended red state.

## Step 4 / 4C — Generation & Aggregation (TDD RED PHASE)

**Mode:** AI generation, sequential (cargo unit; no E2E — backend CLI story).

### Generated files (written to disk)

| File | Purpose |
|---|---|
| `notey-cli/Cargo.toml` | Standalone crate (AC1): `clap`(derive)/`serde`/`serde_json`/`interprocess`; `[[bin]] name = "notey"`; `[lib] name = "notey_cli"`. Verified-current versions (clap 4, serde 1, serde_json 1, interprocess 2). No shared code with `src-tauri` (AC6). |
| `notey-cli/src/lib.rs` | Public API surface as `todo!()` stubs: `parse_args`, `cli_command`, `validate_content`, `validate_workspace`, `exit_code_for`, `run`. Data types `Format`/`Command`/`CliError`/`CommandOutcome`. Protocol structs `CliRequest`/`CliResponse` implemented (AC6 wire contract). |
| `notey-cli/src/main.rs` | Thin binary entrypoint → `notey_cli::run`. |
| `notey-cli/tests/cli_atdd.rs` | **22 `#[ignore]` red-phase cargo tests** (Rust analogue of `test.skip()`). |
| `notey-cli/.gitignore` | `/target/` (mirrors `src-tauri/.gitignore`). |

### Red-phase verification (run results)
- `cargo test -p notey-cli` → **compiles clean; 22 tests, all `ignored`** (red phase intact).
- Activate a logic test (`--ignored add_parses_positional_text`) → **FAILED** with `not yet implemented` panic → genuine RED. ✅
- Activate the drift-pin (`--ignored response_round_trips_success_data_error_shape`) → **ok** → GREEN, as designed for a contract pin (the `CliRequest`/`CliResponse` structs are part of the AC6 scaffold; the pin fails only on future wire-shape drift). ✅

### Scenario → test coverage

| Scenario | Pri | Tests | Status |
|---|---|---|---|
| 6.1-UNIT-001 (clap parsing) | P0 | 10 | RED (todo!) |
| 6.1-UNIT-002 (input validation) | P0 | 6 | RED (todo!) |
| 6.1-UNIT-003 (exit codes) | P0 | 4 | RED (todo!) |
| 6.1-UNIT-004 (protocol drift pin) | P1 | 2 | GREEN-on-activate (pin) |
| **Total** | | **22** | all `#[ignore]` |

### Acceptance-criteria coverage
- **AC1** crate/deps/binary `notey` → Cargo.toml + `content_at_size_cap`, `help_lists_three_subcommands` exercise the crate
- **AC2** `--help` lists add/list/search → `help_lists_three_subcommands`
- **AC3** add `<TEXT>`/`--stdin`/`--format`(default md, invalid rejected) → 5 tests
- **AC4** list `--workspace` optional → `list_parses_with_and_without_workspace`
- **AC5** search `<QUERY>`/`--workspace` → `search_parses_query_and_workspace`, `search_without_query_is_rejected`
- **AC6** duplicated protocol structs, no shared code → `CliRequest`/`CliResponse` + 2 drift-pin tests; crate is standalone (no `src-tauri` dependency)

> **Note on validation spec encoded by the tests:** `validate_content` must allow tab/newline/CR but reject NUL and other C0 control chars; `validate_workspace` must reject `..`, path separators (`/`), absolute paths, and NUL. These are the executable contract the dev implements.

## Next Steps — Task-by-Task RED → GREEN Activation

During implementation of Story 6.1:

1. Pick the scenario you're implementing and **remove its `#[ignore]`** in `notey-cli/tests/cli_atdd.rs` (or run with `-- --ignored <test_name>`).
2. Run `cargo test -p notey-cli -- --ignored <test_name>` → confirm it **fails first** (RED).
3. Replace the matching `todo!()` in `notey-cli/src/lib.rs` with the implementation.
4. Re-run → confirm **green**. If still red, fix impl (or fix the test if the test is wrong).
5. Once a scenario group is green, delete its `#[ignore]` attributes so the tests run in CI by default.
6. Commit.

### Handoff / wiring TODOs (out of ATDD scope, flag for dev)
- **CI:** `notey-cli` is a standalone crate (no root workspace). Add `cargo test --manifest-path notey-cli/Cargo.toml` to the CI matrix (alongside the existing `src-tauri` cargo test job).
- The `interprocess` dependency is declared per AC1 but unused until Story 6.2 (IPC socket client) — expected.
- Manual handoff: this checklist is the ATDD artifact for Story 6.1 (no dedicated story spec file exists yet; ACs sourced from `epics.md` + `test-design-epic-6.md`).

## Step 5 — Validation & Completion

**Validated against `checklist.md`** (Playwright/Cypress items adapted to this project's Rust/cargo stack):

| Check | Result |
|---|---|
| Story has clear, testable acceptance criteria | ✅ (epics.md Story 6.1, 6 AC blocks) |
| Test framework available | ✅ cargo test (Playwright/Cypress N/A — backend CLI story) |
| Red-phase scaffolds marked skipped | ✅ 22 `#[ignore]` tests (Rust analogue of `test.skip()`) |
| Tests assert EXPECTED behavior (no placeholders) | ✅ no `assert!(true)` placeholders |
| Duplicate coverage avoided | ✅ all unit-level, distinct concerns |
| P0–P3 prioritization applied | ✅ P0×20, P1×2 |
| Compiles & red verified | ✅ compiles; logic tests fail-on-activation; pin passes |
| Story metadata + handoff paths captured | ✅ frontmatter (`storyId`/`storyKey`/`storyFile`/`generatedTestFiles`) |
| Browser/CLI sessions cleaned up | ✅ N/A (no browser launched) |
| Artifacts in `{test_artifacts}/` | ✅ checklist in `_bmad-output/test-artifacts/`; ephemeral worker JSON in `/tmp` per workflow contract |

### Key risks & assumptions
- **RISK-E6-001 (CLI injection, score 6)** is the gating risk — covered by `6.1-UNIT-002` (size cap + path traversal + control-char rejection). These input-validation tests are **required acceptance criteria** per the epic gate.
- **Assumption (encoded in tests):** `validate_content` allows tab/newline/CR, rejects NUL + other C0 controls; `validate_workspace` rejects `..`, `/`, absolute paths, NUL. Confirm at implementation; adjust tests if the product decision differs.
- **Out of scope (asserted, not added):** exit code `3` ("no results") and `--json` flag — absent from Story 6.1 ACs.
- `interprocess` dep present per AC1 but exercised only from Story 6.2 onward.

### Completion summary
- **Test files:** `notey-cli/tests/cli_atdd.rs` (+ stub crate `Cargo.toml`, `src/lib.rs`, `src/main.rs`, `.gitignore`)
- **Checklist:** `_bmad-output/test-artifacts/atdd-checklist-6-1-cli-crate-scaffold-argument-parsing.md`
- **Story key:** `6-1-cli-crate-scaffold-argument-parsing` · **Story ID:** `6.1` · **AC source:** `epics.md` + `test-design-epic-6.md`
- **Next workflow:** implement Story 6.1 (`dev-story` / `bmad-quick-dev`), activating tests RED→GREEN per task. After implementation, run `automate` to expand coverage and update the Epic 6 trace matrix.
