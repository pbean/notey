---
workflowStatus: 'completed'
mode: 'epic-level'
epic_num: 6
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-06-12'
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/project-context.md
  - _bmad-output/test-artifacts/test-design/test-design-architecture.md
  - _bmad-output/test-artifacts/test-design/test-design-qa.md
---

# Test Design: Epic 6 - CLI Integration

**Date:** 2026-06-12
**Author:** Pinkyd
**Status:** Draft

> **Forward-looking (pre-implementation / ATDD) design.** Epic 6 is `backlog` in
> `sprint-status.yaml` — no `notey-cli/` crate, no `src-tauri/src/ipc/`, `interprocess` not yet a
> dependency, **0 existing Epic-6 tests**. This is the **red-phase contract to build alongside the
> implementation**, derived from the Epic 6 / Stories 6.1–6.7 acceptance criteria in `epics.md` plus
> architecture context (`architecture.md`, `project-context.md`, the completed System-Level test
> design). It contrasts with the Epics 3–5 documents, which were **residual-risk backfill** against
> shipped code; that backfill range (`epic-5-retro-item-1`) is complete. Test IDs use
> `6.{STORY}-{LEVEL}-{SEQ}`; **every row is 🆕 NEW**, and a **TEA ref** column maps each to the
> epic's pre-assigned scenario IDs (P0-UNIT-004…006, P0-INT-007/008, P1-INT-001…008).

---

## Executive Summary

**Scope:** Epic-level test design for Epic 6 (stories 6-1 … 6-7: CLI crate + arg parsing, IPC socket
server, `add`/`list`/`search` commands, real-time desktop sync, error handling & user isolation).

**Risk Summary:**

- Total risks identified: **10**
- High-priority risks (score ≥6): **2** — RISK-E6-001 (CLI input injection, SEC) and
  RISK-E6-002 (socket permission / user isolation, SEC)
- Critical categories: **SEC** (a new untrusted input boundary AND a new local-IPC channel on
  multi-user systems — the epic's defining surface), **TECH/OPS** (IPC server robustness & lifecycle)
- Gate posture: **CONCERNS** (no score-9 blockers)

**Coverage Summary (all NEW — greenfield, 0 existing Epic-6 tests):**

- P0 scenarios: **7** (~16–26 h) — CLI validation/arg/exit + IPC bind/route/perms/protocol/param-query
- P1 scenarios: **15** (~22–40 h) — IPC robustness + CLI↔IPC command flows + error→exit mapping
- P2/P3 scenarios: **7 / 0** (~10–18 h) — TTY/pipe output, search filter/no-match, real-time sync
- **Plus a one-time harness build** (~12–20 h): an injectable-socket-path IPC integration rig + the
  `notey-cli` test scaffold
- **Total effort:** **~60–104 hours (~1.5–2.5 weeks)**

The center of gravity is **integration (20 of 29 scenarios)**: the IPC socket server is the epic's
riskiest new runtime surface. The two SEC MITIGATEs are pinned by P0s — injection
(`6.1-UNIT-002` + `6.2-INT-004`) and isolation (`6.2-INT-002` + `6.2-INT-008`). Exactly **one new
E2E** (real-time sync) respects the project's max-3-E2E budget (RISK-007). Most of the up-front cost
is the reusable IPC test harness, which the Epic 6 retro preview already anticipates as the strongest
case for integration/E2E investment.

---

## Not in Scope

| Item | Reasoning | Mitigation |
| ---- | --------- | ---------- |
| **Re-testing the existing service layer** (`create_note`/`list_notes`/`search_notes` + workspace detection) | Already unit/integration-tested (Epics 1–3); the IPC merely delegates to them | IPC tests assert **routing + protocol**, not service internals; service tests are the retained baseline |
| **OS-native dialog automation** | N/A — the CLI has no GUI file pickers; it is a terminal binary | The CLI is driven directly (argv/stdin/sockets) — fully automatable without a WebDriver dialog |
| **Windows named-pipe / macOS socket behavioral perms** | Dev + CI run Linux (Unix socket); platform perm semantics differ | Linux 0600/isolation tested in CI; Windows/macOS equivalence → manual/platform QA (RISK-E6-007) |
| **`--json` output flag & exit code `3` ("no results")** | Referenced in the System-Level test design but **absent from Epic 6 ACs** | Carried as flagged ASSUMPTIONS; confirm/drop at story drafting before scheduling tests |
| **CLI command round-trip latency benchmark** | **No sourced budget exists** (only the 5s connection timeout) | RISK-E6-010 (DOCUMENT); raise a budget at story drafting rather than invent one — no P3 bench fabricated |
| **Settings-UI / config surface for the socket** | Epic 7 scope; socket config is internal this epic | Out of scope; the path is an internal, test-injectable value |
| **Shared protocol crate (Cargo workspace)** | Architecture defers it post-v1 ("nice-to-have"); Story 6.1 mandates duplicated types | Drift covered by a round-trip pin (`6.1-UNIT-004` + `6.2-INT-003`), not by shared code |

---

## Risk Assessment

> Probability and Impact are scored 1–3; Score = P × I. This is a **forward-looking** design, so
> risks are framed as **inherent risk of the planned design** — the ATDD contract to satisfy as code
> lands. Mitigation owner is **Dev/QA**; timeline is **during Epic 6** (the two SEC MITIGATEs are
> acceptance-criteria-level gates that must be green before Epic 6 is `done` / before Epic 7).

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ---------- | ----- | -------- |
| RISK-E6-001 | SEC | **CLI input-injection surface — the epic's named blocker-class risk (RISK-006).** The CLI is a NEW untrusted input boundary: note content from argv/stdin/pipes, a `--workspace` name, and an auto-detected git path from CWD, all crossing the socket into the DB layer. Threats: **path traversal** (workspace/CWD), **command/SQL injection via content**, **oversized input** (no 1MB cap → memory DoS). SQL is largely guarded by existing parameterized queries, but the new path-handling + size-cap + "all IPC payloads validated" assumption are unproven. The epic mandates input-validation tests as **acceptance criteria**. | 2 | 3 | **6** | `6.1-UNIT-002` (1MB boundary + traversal/injection reject) + `6.2-INT-004` (parameterized-query enforcement — payload stored literally, no SQL/path effect) | Dev/QA | Epic 6 gate (before done) |
| RISK-E6-002 | SEC | **Socket permission + user-isolation failure (NFR11/FR37).** The socket must be `0600`, on a **user-scoped path** (`/run/user/<uid>/notey.sock`), with **no cross-user access**, removed on exit. A wrong perm/umask, a world-accessible path, or a Windows named-pipe ACL mistake lets **another local user read or write your notes** — a confidentiality/integrity breach on multi-user systems. New platform-specific code, easy to get wrong (esp. Windows). | 2 | 3 | **6** | `6.2-INT-002` (mode==0600 + per-user path) + `6.2-INT-008` (cross-user inaccessible) + `6.2-INT-005` (cleanup on exit) | Dev/QA | Epic 6 gate (before done) |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ---------- | ----- |
| RISK-E6-003 | TECH/OPS | **IPC server robustness** — a malformed / oversized / unknown-action / truncated request or a slow-loris client crashes or hangs the desktop app (the server runs **inside** the GUI process; in-flight edits at risk). | 2 | 2 | **4** | `6.2-INT-003` (malformed→error, no panic) + `6.2-INT-006` (concurrent) + `6.2-INT-007` (oversized/slow client) | Dev/QA |
| RISK-E6-004 | OPS | **Socket lifecycle / stale-socket handling.** Cleanup removes the socket on **graceful** exit only; a crash leaves a stale file → next launch may fail to bind, or a CLI hangs on a dead socket (bounded only by the 5s timeout). Rebind + dead-socket detection are new, untested. | 2 | 2 | **4** | `6.2-INT-005` (cleanup + stale rebind) + `6.7-INT-002/004` (refused / timeout → exit 2) | Dev/QA |
| RISK-E6-005 | TECH | **CLI↔app contract: exit-code mapping & protocol routing.** The CLI's value is scripting/piping, which depends on exact exit codes (0/1/2 + timeout) and stable `{action,payload}`→`{success,data,error}` routing. A mis-mapped code or mis-routed action silently breaks downstream scripts and the pipe contract. | 2 | 2 | **4** | `6.1-UNIT-003` (exit codes) + `6.2-INT-001` (routing) + `6.7-INT-001/003` (error→code) | Dev/QA |
| RISK-E6-006 | DATA | **CLI-supplied workspace resolution diverges from GUI auto-assignment.** The CLI sends an auto-detected git workspace (name + path); the app must resolve/create it with the **same** canonicalization, dedup, and validation as the GUI (Epic 2). Divergence → duplicate/wrong/orphan workspace rows from CLI-created notes (overlaps the path-validation seam of RISK-E6-001). | 2 | 2 | **4** | `6.3-INT-003` (auto-detected workspace included + resolved consistently with GUI, no dup/orphan) | Dev/QA |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ------ |
| RISK-E6-007 | TECH | **Cross-platform socket behavior unverified off Linux.** Windows named-pipe perms/ACL + path and macOS path differ; the release matrix *builds* but won't *behaviorally* exercise socket perms/isolation off Linux — the platform where isolation is most likely to silently differ. | 1 | 2 | **2** | Document; Linux behavioral tests in CI, Windows/macOS perm-equivalence → manual/platform QA |
| RISK-E6-008 | TECH | **Protocol drift between duplicated CLI structs and app serde structs.** Story 6.1 mandates no shared code; as the protocol evolves the two hand-written representations can silently diverge (rename, casing, new required field) with no compiler to catch it. | 2 | 1 | **2** | `6.1-UNIT-004` + `6.2-INT-003` round-trip pin the request/response shape |
| RISK-E6-009 | TECH/UX | **Real-time sync (Story 6.6) miss or event-storm.** A missed `note-created` emit / non-refresh leaves the desktop list stale (user may re-create → duplicate); an unbatched storm from a scripted `notey add` loop could flood re-renders (FR36 requires batching). The note **is** persisted regardless → cosmetic/trust, not data-loss. | 2 | 1 | **2** | `6.6-UNIT-001` (emit) + `6.6-COMP-001/002` (refresh + batching) + `6.E2E-001` |
| RISK-E6-010 | PERF | **No explicit CLI round-trip latency budget.** Unlike the GUI (hotkey<150ms, save<500ms), no per-command CLI target is stated; the only bounds are the 5s connection timeout and the 1MB cap. Met by construction today, unbudgeted → silent regression possible. **UNKNOWN threshold.** | 1 | 1 | **1** | Document; clarification item at story drafting — do **not** invent a value |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, robustness)
- **SEC**: Security (access controls, isolation, injection, data exposure)
- **PERF**: Performance (budget violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors)
- **OPS**: Operations (startup, lifecycle, config, maintenance)

---

## NFR Planning

**Purpose:** Capture epic-specific NFR thresholds, planned validation, and the evidence a later
`nfr-assess` should consume. This is not a final evidence audit.

| NFR Category | Requirement / Threshold | Risk Link | Planned Validation | Evidence Needed |
| ------------ | ----------------------- | --------- | ------------------ | --------------- |
| Security (input) | Reject path traversal + command/SQL injection via note content; **stdin ≤ 1MB** (NFR10; Story 6.3) | RISK-E6-001 | `notey-cli` unit (1MB boundary reject; traversal/injection corpus) + IPC integration that all DB writes use parameterized queries | `cargo test` report (CLI crate + `ipc_tests.rs`) |
| Security (channel) | Socket **0600**, user-scoped path `/run/user/<uid>/notey.sock`, no cross-user access, removed on exit (NFR11/FR37) | RISK-E6-002 | `6.2-INT-002` (mode + path) + `6.2-INT-008` (cross-user) + `6.2-INT-005` (cleanup) | `ipc_tests.rs` socket-stat assertions |
| Reliability | Server survives malformed/oversized/unknown-action/concurrent without crashing app; **client 5s timeout** (Story 6.2/6.7; P1-INT-001…008) | RISK-E6-003, RISK-E6-004 | `6.2-INT-003/006/007` + `6.7-INT-004` | `cargo test` integration report |
| Maintainability | Exit 0/1/2 (+timeout); `{action,payload}`→`{success,data,error}`; correct routing (Story 6.7/6.2) | RISK-E6-005, RISK-E6-008 | `6.1-UNIT-003/004` + `6.2-INT-003` + `6.7-INT-001..003` | CLI-crate + integration reports |

**Unknown thresholds:** No values invented. The only hard budgets are **stdin ≤ 1MB** (NFR10),
**socket 0600 / user-scoped** (NFR11/FR37), and the **5s CLI connection timeout** (Story 6.7).
Outstanding UNKNOWNs raised (not guessed): (1) **no explicit CLI command latency budget** → clarify
or waive (RISK-E6-010); (2) **Windows/macOS socket-perm equivalence** to Linux 0600 →
clarify + manual-QA depth (RISK-E6-007); (3) the System-Level `--json` flag and exit code `3` are
**absent from the epic ACs** → confirm/drop at story drafting.

---

## Entry Criteria

- [ ] Epic 6 stories 6-1 … 6-7 drafted with finalized ACs (incl. resolution of the `--json` /
      exit-code-3 / latency-budget UNKNOWNs)
- [ ] **Story 6.2 exposes an injectable socket path** (env/config/ctor arg) so IPC integration tests
      bind a temp socket in a `TempDir` against a temp DB (testability ASR — build-time gate)
- [ ] IPC action handlers return **structured errors** in the response envelope (observability ASR)
- [ ] Server start/stop is programmatically driveable (start vs seeded DB, accept, assert, shut down,
      remove socket) — mirrors the existing `create_temp_db()` guard
- [ ] `notey-cli` crate scaffolded (clap) so CLI-unit tests (parse/validate/exit/output) can run
      without a running app
- [ ] Temp-socket + multi-uid fixtures for the isolation/permission assertions

## Exit Criteria

- [ ] All P0 scenarios passing (100%) — incl. both SEC MITIGATEs green
- [ ] All P1 scenarios passing (≥95%, or failures triaged)
- [ ] Both SEC MITIGATEs (`6.1-UNIT-002`+`6.2-INT-004` injection; `6.2-INT-002`+`6.2-INT-008`
      isolation) green — acceptance-criteria gate per the epic
- [ ] Pre-assigned TEA P0 set green (P0-UNIT-004/005/006, P0-INT-007/008)
- [ ] No open high-priority (≥6) items unmitigated
- [ ] `6.E2E-001` (real-time sync) green
- [ ] Cross-platform socket-perm check (Windows/macOS) recorded (manual QA; advisory)

---

## Test Coverage Plan

> **Priority ≠ execution timing.** P0/P1/P2/P3 denote **priority/risk class only**; scheduling
> (PR / Nightly / Weekly) is handled in **Execution Strategy**. **All scenarios are NEW** — Epic 6 is
> greenfield. **Level strategy:** most coverage is cheap at **unit** (CLI crate: clap/validation/
> exit-codes/output — no running app) and **integration** (Rust IPC server bound to a temp socket +
> temp DB). **E2E is deliberately one journey** (real-time sync) — the only behavior needing the real
> WebView + tauri-specta event — keeping within the max-3-E2E budget (RISK-007).

### P0 (Critical)

**Criteria:** Blocks core journey + High risk (≥6) + No workaround. *(P0 count is epic-driven: the
epic designates the input-validation + isolation + protocol scenarios as acceptance-criteria-level
P0 per RISK-006, so the P0 share exceeds the usual <10% guideline by design — security is this
epic's core.)*

| Test ID | Requirement | Test Level | Risk Link | TEA ref | Test Count |
| ------- | ----------- | ---------- | --------- | ------- | ---------- |
| 6.1-UNIT-001 | clap parses `add`/`list`/`search` + flags; `--format` default markdown / invalid rejected; `--help` lists subcommands | Unit (CLI) | RISK-E6-005 | P0-UNIT-004 | 1 |
| 6.1-UNIT-002 | **Input validation: >1MB rejected (boundary 1MB OK / +1 reject); path-traversal & injection/control chars rejected/sanitized** | Unit (CLI) | RISK-E6-001 (MITIGATE) | P0-UNIT-005 | 1 |
| 6.1-UNIT-003 | Exit codes: 0 success / 1 app-error / 2 not-running / 2 timeout | Unit (CLI) | RISK-E6-005 | P0-UNIT-006 | 1 |
| 6.2-INT-001 | Server binds on start; accepts client; routes `create_note`/`list_notes`/`search_notes` to services; `{success,data,error}` envelope | Integration | RISK-E6-005 | P0-INT-007 | 1 |
| 6.2-INT-002 | **Socket mode == `0600` AND path under per-user runtime dir; owner-only** | Integration | RISK-E6-002 (MITIGATE) | P0-INT-007 | 1 |
| 6.2-INT-003 | Protocol: well-formed→success; **malformed JSON → error envelope, NO panic**; unknown action → error | Integration | RISK-E6-003/008 | P0-INT-008 | 1 |
| 6.2-INT-004 | **Injection payload (SQL/`..`/control) in `create_note` stored literally via parameterized queries — no SQL/path effect** | Integration | RISK-E6-001 (MITIGATE) | P0-INT-008 | 1 |

**Total NEW P0: 7 tests (~16–26 hours).** The two SEC MITIGATEs live here.

### P1 (High)

**Criteria:** Important features + Medium risk (3-4) + Common workflows.

| Test ID | Requirement | Test Level | Risk Link | TEA ref | Test Count |
| ------- | ----------- | ---------- | --------- | ------- | ---------- |
| 6.1-UNIT-004 | Duplicated protocol structs serialize/deserialize the exact `{action,payload}` / `{success,data,error}` shapes (drift pin) | Unit (CLI) | RISK-E6-008 | P0-INT-008 (CLI side) | 1 |
| 6.2-INT-005 | Socket removed on graceful exit; **stale-socket rebind** on restart | Integration | RISK-E6-004 | P1-INT (lifecycle) | 1 |
| 6.2-INT-006 | **N concurrent client connections** each get correct, independent responses | Integration | RISK-E6-003 | P1-INT (concurrency) | 1 |
| 6.2-INT-007 | Oversized/truncated frame + slow/never-closing client handled without blocking accept loop or crashing | Integration | RISK-E6-003 | P1-INT (malformed/timeout) | 1 |
| 6.2-INT-008 | **User isolation: client cannot reach another user's socket; per-user scoping** (covers 6.7 AC4 server-side) | Integration | RISK-E6-002 (MITIGATE) | P1-INT (permission) | 1 |
| 6.3-INT-001 | `notey add "X"` → `create_note`, response has id, stdout `✓ Note created` | Integration | RISK-E6-005 | P1-INT-001 | 1 |
| 6.3-INT-002 | `echo X \| notey add --stdin` reads to EOF → note created; **1MB cap end-to-end** | Integration | RISK-E6-001 | P1-INT-002 | 1 |
| 6.3-INT-003 | Git-repo CWD → auto-detected workspace name+path included; **resolved consistently with GUI (no dup/orphan)** | Integration | RISK-E6-006 | P1-INT (workspace) | 1 |
| 6.4-INT-001 | `notey list` → one line/note: title (≤50), relative date, workspace; pipe-friendly | Integration | RISK-E6-005 | P1-INT (list) | 1 |
| 6.4-INT-002 | `notey list --workspace <name>` returns only that workspace's notes | Integration | — | P1-INT-004 | 1 |
| 6.5-INT-001 | `notey search "Q"` → results: title, 30-char snippet, workspace, relative date | Integration | RISK-E6-005 | P1-INT-003 | 1 |
| 6.7-INT-001 | App not running → exit **2** + stderr `✕ Notey is not running. Start the application first.` | Integration | RISK-E6-005 | P1-INT-005 | 1 |
| 6.7-INT-002 | Socket exists but connection refused → exit **2**, same message | Integration | RISK-E6-004 | P1-INT-005 | 1 |
| 6.7-INT-003 | App returns `{success:false,error}` → exit **1** + stderr `✕ [error]` | Integration | RISK-E6-005 | P1-INT (error map) | 1 |
| 6.7-INT-004 | Connection > **5s** → timeout, exit **2** + timeout message | Integration | RISK-E6-003/004 | P1-INT (timeout) | 1 |

**Total NEW P1: 15 tests (~22–40 hours).** Mostly IPC integration sharing the one-time harness;
`6.1-UNIT-004`/`6.4-INT-002`/`6.5-INT-001` are feature-correctness P1s without a medium-risk link.

### P2 (Medium)

**Criteria:** Secondary flows + Low risk (1-2) + Edge cases.

| Test ID | Requirement | Test Level | Risk Link | Test Count |
| ------- | ----------- | ---------- | --------- | ---------- |
| 6.3-UNIT-001 | TTY → ANSI green success; piped (non-TTY) → plain text, no ANSI | Unit (CLI) | — | 1 |
| 6.5-INT-002 | `notey search "Q" --workspace <name>` filters results | Integration | — | 1 |
| 6.5-INT-003 | No match → stdout `No notes matching 'query'` (no-match exit code is an ASSUMPTION) | Integration | RISK-E6-005 | 1 |
| 6.6-UNIT-001 | (Rust) IPC `create_note` emits `note-created` `{ timestamp, data:{noteId} }` | Unit (Rust) | RISK-E6-009 | 1 |
| 6.6-COMP-001 | (FE) `note-created` listener refreshes note list; respects active-workspace filter | Component | RISK-E6-009 | 1 |
| 6.6-COMP-002 | (FE) rapid event burst batched — no excessive re-renders/flicker | Component | RISK-E6-009 | 1 |
| 6.E2E-001 | **Real-time sync**: app running → create note via IPC → desktop list shows it without manual refresh | E2E | RISK-E6-009 | 1 |

**Total NEW P2: 7 tests (~10–18 hours).**

### P3 (Low)

**Criteria:** Benchmarks + exploratory.

**None.** No CLI latency budget exists to benchmark (RISK-E6-010, UNKNOWN) — no benchmark is
fabricated. If a budget is set at story drafting, add a round-trip timing assertion then.

---

### Per-Story Coverage Matrices (all 🆕 NEW · 0 existing)

**Story 6-1 (CLI crate scaffold & arg parsing) · CLI-unit (no app)**

| ID | Scenario | Level | Pri | AC/Risk | TEA ref | Status |
|----|----------|-------|-----|---------|---------|--------|
| 6.1-UNIT-001 | clap parses `add <TEXT>`/`--stdin`/`--format`(default md, invalid rejected); `list --workspace`; `search <QUERY> --workspace`; `--help` lists 3 subcommands | Unit | P0 | AC1 | P0-UNIT-004 | 🆕 |
| 6.1-UNIT-002 | **>1MB rejected (boundary); path-traversal & injection/control chars rejected/sanitized** | Unit | P0 | RISK-E6-001, NFR10 | P0-UNIT-005 | 🆕 |
| 6.1-UNIT-003 | Exit codes 0/1/2(+timeout=2) | Unit | P0 | RISK-E6-005 | P0-UNIT-006 | 🆕 |
| 6.1-UNIT-004 | Duplicated protocol structs round-trip exact `{action,payload}`/`{success,data,error}` | Unit | P1 | RISK-E6-008 | P0-INT-008 | 🆕 |

**Story 6-2 (IPC socket server) · Rust integration**

| ID | Scenario | Level | Pri | AC/Risk | TEA ref | Status |
|----|----------|-------|-----|---------|---------|--------|
| 6.2-INT-001 | Binds on start; accepts client; routes 3 actions to services; `{success,data,error}` envelope | Integration | P0 | AC2,3 | P0-INT-007 | 🆕 |
| 6.2-INT-002 | **Socket mode==0600 + per-user path; owner-only** | Integration | P0 | RISK-E6-002, NFR11 | P0-INT-007 | 🆕 |
| 6.2-INT-003 | Well-formed→success; **malformed→error, no panic**; unknown action→error | Integration | P0 | RISK-E6-003 | P0-INT-008 / P1-INT-007/008 | 🆕 |
| 6.2-INT-004 | **Injection payload stored literally (parameterized) — no SQL/path effect** | Integration | P0 | RISK-E6-001 | P0-INT-008 | 🆕 |
| 6.2-INT-005 | Cleanup on graceful exit; **stale-socket rebind** | Integration | P1 | RISK-E6-004 | P1-INT (lifecycle) | 🆕 |
| 6.2-INT-006 | **N concurrent clients** → correct independent responses | Integration | P1 | RISK-E6-003 | P1-INT (concurrency) | 🆕 |
| 6.2-INT-007 | Oversized/truncated/slow client → no accept-loop block / crash | Integration | P1 | RISK-E6-003 | P1-INT (malformed/timeout) | 🆕 |
| 6.2-INT-008 | **Cross-user socket inaccessible; per-user scoping** | Integration | P1 | RISK-E6-002, FR37 | P1-INT (permission) | 🆕 |

**Story 6-3 (`add` text + stdin) · CLI↔IPC integration + CLI unit**

| ID | Scenario | Level | Pri | AC/Risk | TEA ref | Status |
|----|----------|-------|-----|---------|---------|--------|
| 6.3-INT-001 | `notey add "X"` → create_note; response id; stdout `✓ Note created` | Integration | P1 | AC1, FR2 | P1-INT-001 | 🆕 |
| 6.3-INT-002 | `--stdin` reads EOF → note created; **1MB cap end-to-end** | Integration | P1 | AC2, FR3, NFR10 | P1-INT-002 | 🆕 |
| 6.3-INT-003 | Git CWD → workspace name+path included; **resolved consistently with GUI (no dup/orphan)** | Integration | P1 | AC3, FR29, RISK-E6-006 | P1-INT (workspace) | 🆕 |
| 6.3-UNIT-001 | TTY → ANSI green; piped → plain text, no ANSI | Unit | P2 | AC4,5, UX-DR61 | — | 🆕 |

**Story 6-4 (`list`) · CLI↔IPC integration**

| ID | Scenario | Level | Pri | AC/Risk | TEA ref | Status |
|----|----------|-------|-----|---------|---------|--------|
| 6.4-INT-001 | `notey list` → one line/note: title(≤50)+relative date+workspace; pipe-friendly | Integration | P1 | AC1,3, FR15 | P1-INT (list) | 🆕 |
| 6.4-INT-002 | `--workspace <name>` filters to that workspace only | Integration | P1 | AC2 | P1-INT-004 | 🆕 |

**Story 6-5 (`search`) · CLI↔IPC integration**

| ID | Scenario | Level | Pri | AC/Risk | TEA ref | Status |
|----|----------|-------|-----|---------|---------|--------|
| 6.5-INT-001 | `notey search "Q"` → title + 30-char snippet + workspace + relative date | Integration | P1 | AC1, FR14 | P1-INT-003 | 🆕 |
| 6.5-INT-002 | `--workspace` filters search | Integration | P2 | AC2 | P1-INT (search-ws) | 🆕 |
| 6.5-INT-003 | No match → `No notes matching 'query'` (exit code = ASSUMPTION) | Integration | P2 | AC3, RISK-E6-005 | — | 🆕 |

**Story 6-6 (real-time desktop sync) · Rust emit + FE component + 1 E2E**

| ID | Scenario | Level | Pri | AC/Risk | TEA ref | Status |
|----|----------|-------|-----|---------|---------|--------|
| 6.6-UNIT-001 | (Rust) IPC create emits `note-created` `{timestamp, data:{noteId}}` | Unit | P2 | AC1, FR36 | — | 🆕 |
| 6.6-COMP-001 | (FE) listener refreshes list; respects active-workspace filter | Component | P2 | AC2, FR36 | — | 🆕 |
| 6.6-COMP-002 | (FE) rapid event burst batched — no flicker/excessive re-renders | Component | P2 | AC3, RISK-E6-009 | — | 🆕 |

**Story 6-7 (error handling & user isolation) · CLI↔IPC integration**

| ID | Scenario | Level | Pri | AC/Risk | TEA ref | Status |
|----|----------|-------|-----|---------|---------|--------|
| 6.7-INT-001 | App not running → exit 2 + `✕ Notey is not running…` | Integration | P1 | AC1, FR38 | P1-INT-005 | 🆕 |
| 6.7-INT-002 | Connection refused → exit 2, same message | Integration | P1 | AC2, RISK-E6-004 | P1-INT-005 | 🆕 |
| 6.7-INT-003 | `{success:false,error}` → exit 1 + `✕ [error]` | Integration | P1 | AC3, RISK-E6-005 | P1-INT (error map) | 🆕 |
| 6.7-INT-004 | Connection > 5s → timeout, exit 2 | Integration | P1 | AC5, RISK-E6-003/004 | P1-INT (timeout) | 🆕 |

> Story 6.7 AC4 (multi-user isolation, FR37) is covered server-side by **6.2-INT-008** — not
> duplicated here (no redundant cross-level coverage).

**Cross-Story · feature E2E (real Tauri runtime) · 0 existing**

| ID | Scenario | Level | Pri | AC/Risk | TEA ref | Status |
|----|----------|-------|-----|---------|---------|--------|
| 6.E2E-001 | Real-time sync: app running → create via IPC → desktop list shows it without manual refresh | E2E | P2 | Story 6.6, RISK-E6-009 | — | 🆕 |

---

## NFR Coverage and Evidence Plan

- **Security — injection (RISK-E6-001, MITIGATE / top priority):** `6.1-UNIT-002` (1MB boundary +
  traversal/injection reject) + `6.2-INT-004` (parameterized-query enforcement). Evidence:
  `cargo test` (CLI crate + `ipc_tests.rs`) + negative-input corpus. **Gates Epic 6 done.**
- **Security — channel isolation (RISK-E6-002, MITIGATE):** `6.2-INT-002` (0600 + per-user path) +
  `6.2-INT-008` (cross-user inaccessible) + `6.2-INT-005` (cleanup). Evidence: socket-stat assertions.
  Windows/macOS equivalence → manual/platform QA (RISK-E6-007).
- **Reliability — IPC robustness + lifecycle:** `6.2-INT-003/006/007` + `6.2-INT-005` +
  `6.7-INT-004`. Evidence: `cargo test` integration report.
- **Maintainability — contract + exit codes:** `6.1-UNIT-003/004` + `6.2-INT-003` + `6.7-INT-001..003`.
  Evidence: CLI-crate + integration reports.
- **Performance — CLI latency:** no test (no sourced budget; RISK-E6-010 UNKNOWN). The 5s timeout
  ceiling is covered functionally by `6.7-INT-004`.

Final PASS/CONCERNS/FAIL is deferred to `nfr-assess` once these tests/implementation exist.

---

## Execution Strategy

Simple **PR / Nightly / Weekly** model. Philosophy: run everything in PRs unless it is expensive or
long-running; defer only the real-runtime E2E and any concurrency soak. Tests are not re-listed
here — see the Coverage Plan.

| Trigger | Suite | Target |
| ------- | ----- | ------ |
| **PR** | All CLI-crate unit (`6.1-*`, `6.3-UNIT-001`) + all Rust IPC integration (`6.2-*`, `6.3-INT-*`, `6.4-*`, `6.5-*`, `6.7-*`) + FE component (`6.6-COMP-*`) — fast, hermetic (temp socket + temp DB) | < 15 min |
| **Nightly** | `6.E2E-001` (real-time sync, real Tauri runtime) + longer concurrency/slow-client soak on `6.2-INT-006/007` | < 30 min |
| **Weekly / pre-Epic-7** | Confirm both SEC MITIGATEs green (injection + isolation); manual cross-platform socket-perm check on Windows/macOS (RISK-E6-007) | — |

---

## Resource Estimates

Interval ranges (no false precision). **All NEW** — greenfield epic, plus a one-time harness build.

| Bucket | Count | Effort | Notes |
| ------ | ----- | ------ | ----- |
| Harness (one-time) | — | ~12–20 h | **Injectable-socket-path IPC integration rig** (start server vs temp socket+DB, client driver, start/stop/cleanup guard) + `notey-cli` test scaffold — prerequisite for the whole integration tier |
| P0 | 7 | ~16–26 h | CLI validation/arg/exit + IPC bind/route/perms/protocol/param-query — both SEC MITIGATEs |
| P1 | 15 | ~22–40 h | IPC robustness (concurrency/timeout/lifecycle/isolation) + CLI↔IPC flows + error→exit mapping |
| P2 | 7 | ~10–18 h | TTY/pipe output, search filter/no-match, real-time sync (emit+2 component+1 E2E) |
| P3 | 0 | — | none (no CLI latency budget to benchmark) |
| **Total** | **29** | **~60–104 h (~1.5–2.5 weeks)** | Most up-front cost is the reusable IPC harness, reused by later epics |

### Prerequisites

**Test Data:**

- Seeded temp-DB factory (reuse `create_temp_db()` / `NoteBuilder`) with controllable workspaces
  (incl. git-path cases), titles, and content (incl. injection/oversized corpus)
- Multi-uid / temp-socket fixtures for the isolation + permission assertions (auto-cleanup)

**Tooling:**

- `cargo test` (CLI-crate unit + Rust IPC integration) · `vitest` + React Testing Library
  (`6.6-COMP-*`) · `tauri-driver` / WebDriver (`e2e/run.mjs`) for `6.E2E-001`
- `interprocess` (Story 6.1 dep) drives the client side of the IPC integration tests

**Environment:**

- Injectable socket path in Story 6.2 (build-time testability gate)
- Linux CI for behavioral socket-perm/isolation tests; Windows/macOS manual QA for perm-equivalence
- Nightly runner for the real-runtime E2E + concurrency soak

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate:** 100% (no exceptions)
- **P1 pass rate:** ≥95% (waivers required for failures)
- **P2/P3 pass rate:** ≥90% (informational)
- **High-risk mitigations:** both score-6 SEC risks (RISK-E6-001 injection, RISK-E6-002 isolation)
  complete and green

### Coverage Targets (inherited from system-level)

- Rust service/IPC ≥ 80%; `notey-cli` crate ≥ 75%
- Security scenarios (input validation + channel isolation): 100% of the in-scope surface
- Protocol/exit-code contract: every action + every exit code asserted

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (≥6) item unmitigated — both SEC MITIGATEs green
- [ ] Security tests (SEC) pass 100% — injection (`6.1-UNIT-002`+`6.2-INT-004`) and isolation
      (`6.2-INT-002`+`6.2-INT-008`)
- [ ] Pre-assigned TEA P0 set green (P0-UNIT-004/005/006, P0-INT-007/008)
- [ ] Testability ASR met: Story 6.2 ships an injectable socket path (else the integration tier
      cannot run in CI) — build-time gate
- [ ] Planned NFR evidence exists or `nfr-assess` records CONCERNS/waivers

---

## Mitigation Plans

### RISK-E6-001: CLI input injection (Score: 6)

**Mitigation Strategy:**
1. In the `notey-cli` crate, unit-test input validation (`6.1-UNIT-002`): content/stdin > 1MB is
   rejected at the boundary (exactly 1MB accepted, +1 byte rejected); `..`/path-separators in the
   `--workspace` value and the auto-detected CWD path are rejected or sanitized; control/injection
   characters in note content are handled without escaping the intended payload.
2. At the IPC seam, integration-test (`6.2-INT-004`) that an injection payload (`'; DROP …`, `..`,
   control chars) sent as `create_note` content is stored **literally** via parameterized queries —
   no SQL effect, no path escape — confirming the app's existing parameterized-query guard holds for
   the new boundary.
3. Keep the "no `tauri-plugin-fs`, no broad FS capability" invariant asserted in the ACL test; if the
   IPC adds Tauri commands/permissions, extend `EXPECTED_COMMANDS`.

**Owner:** Dev/QA · **Timeline:** Epic 6 gate (before done) · **Status:** Planned
**Verification:** `cargo test` (CLI validation + `ipc_tests.rs` injection cases) green; ACL test
confirms no broad FS capability.

### RISK-E6-002: Socket permission / user isolation (Score: 6)

**Mitigation Strategy:**
1. Integration-test (`6.2-INT-002`) that the created socket file's mode is exactly `0600` and its
   path resolves under the per-user runtime dir (`/run/user/<uid>/…` on Linux; platform equivalent).
2. Integration-test (`6.2-INT-008`) that a client bound to a different user's socket path cannot
   reach this user's server (per-user scoping; no cross-user read/write).
3. Assert cleanup (`6.2-INT-005`): the socket file is removed on graceful exit, and a stale file from
   a prior crash is rebound (not duplicated/leaked).
4. Defer Windows named-pipe / macOS perm-equivalence to manual/platform QA, documented as
   RISK-E6-007 (the release matrix builds but does not behaviorally exercise off-Linux socket perms).

**Owner:** Dev/QA · **Timeline:** Epic 6 gate (before done) · **Status:** Planned
**Verification:** `cargo test` socket-stat assertions green on Linux; manual perm check recorded for
Windows/macOS.

---

## Assumptions and Dependencies

### Assumptions

1. **Story 6.2 will expose an injectable socket path** (env/config/ctor). Without it the 18
   integration scenarios cannot run hermetically in CI — this is the load-bearing testability
   assumption (raised as an Entry Criterion + build-time gate).
2. The IPC actions **delegate to the existing service functions** (`create_note`/`list_notes`/
   `search_notes`), so IPC tests assert routing + protocol, not service internals.
3. **`--json` output (P1-INT-006) and exit code `3` ("no results") are NOT in scope** — they appear
   in the System-Level test design but not the Epic 6 ACs; confirm/drop at story drafting before
   adding tests. `6.1-UNIT-003`/`6.5-INT-003` assert only the AC-defined exit codes (0/1/2).
4. No CLI command-latency budget is invented; only the 5s connection timeout and 1MB cap are
   asserted (RISK-E6-010 left as a clarification item).
5. `interprocess` (the chosen socket lib) supports binding a test socket at an arbitrary temp path on
   the CI platform (Linux).

### Dependencies

1. **Injectable-socket-path IPC test harness** (start server vs temp socket+DB, client driver,
   cleanup guard) — required before the integration tier; reused by later epics.
2. **`notey-cli` crate scaffold** (Story 6.1) — required before CLI-unit tests.
3. **Finalized Epic 6 story ACs** resolving the `--json` / exit-code-3 / latency-budget /
   cross-platform-perm UNKNOWNs — required before scheduling the affected tests.

### Risks to Plan

- **Risk:** Story 6.2 ships without an injectable socket path.
  - **Impact:** The 18 integration scenarios can't run in CI (or run flakily against the real
    per-user socket); the whole integration tier stalls.
  - **Contingency:** Raise the injectable-path ASR as a build-time gate now (Entry Criterion); if
    missed, fall back to a feature-flagged test-only path override.
- **Risk:** Cross-platform socket perms can't be behaviorally tested in CI (Windows named pipe).
  - **Impact:** RISK-E6-002's off-Linux assurance is manual-only.
  - **Contingency:** Document the gap (RISK-E6-007); add a manual perm-check step to the pre-Epic-7
    weekly gate.
- **Risk:** The IPC harness build takes the upper end of the estimate.
  - **Impact:** Total skews toward ~98 h.
  - **Contingency:** Harness is a one-time investment reused by Epic 6+; schedule it first.

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| ----------------- | ------ | ---------------- |
| **`services/notes.rs` (`create_note`/`list_notes`)** | IPC `create_note`/`list_notes` actions delegate here | Existing Epic 1–5 notes-service unit/integration tests must pass (no behavior change) |
| **`services/search_service.rs::search_notes`** | IPC `search_notes` action delegates here | Existing Epic 3 FTS5 search tests must pass |
| **`services/workspace_service.rs` (detect/resolve)** | CLI-supplied git path resolved via the same path (RISK-E6-006) | Existing Epic 2 workspace detection/isolation tests must pass |
| **`lib.rs` (app setup)** | New IPC socket-server start/stop wiring + `note-created` emit on CLI create | App boot path; capability ACL tests (`acl_tests.rs` `EXPECTED_COMMANDS`); bindings export test |
| **Frontend note-list / workspace store** | New `note-created` listener refresh + batching (Story 6.6) | Existing note-list + workspace-filter store/component tests must pass |
| **`src-tauri/tests/` (new `ipc_tests.rs`)** | New IPC integration suite added | Existing `db`/`search`/`workspace`/`acl` integration tests must pass |
| **`e2e/run.mjs`** | One new real-time-sync E2E added | Existing Epic 1 capture-loop + window-mgmt E2E (7 tests) must pass; stay within max-3-E2E budget |
| **New `notey-cli/` crate** | Greenfield sibling crate (not in `src-tauri/` build) | None pre-existing; establishes its own unit baseline; **no shared code** with `src-tauri/` (Story 6.1) |

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — Risk classification framework
- `probability-impact.md` — Risk scoring methodology (P × I)
- `test-levels-framework.md` — Test level selection
- `test-priorities-matrix.md` — P0–P3 prioritization
- `nfr-criteria.md` — NFR planning categories

### Related Documents

- Epic + story ACs: `_bmad-output/planning-artifacts/epics.md` (Epic 6, Stories 6.1–6.7; TEA Quality
  Requirements; FR Coverage Map)
- PRD: `_bmad-output/planning-artifacts/prd.md` (FR2/3/14/15/29/36/37/38, NFR10/11)
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (IPC/CLI/socket sections)
- System-level test design: `_bmad-output/test-artifacts/test-design/{test-design-architecture.md,
  test-design-qa.md}` (source of the pre-assigned P0/P1 scenario IDs + RISK-006/RISK-010)
- Sibling backfill (completed): `test-design-epic-3.md`, `test-design-epic-4.md`, `test-design-epic-5.md`
- Project context: `_bmad-output/project-context.md`

### Follow-on Workflows (Manual)

- Run `*atdd` to scaffold the red-phase P0 tests (CLI validation/exit + IPC bind/perms/protocol) and
  the IPC integration harness (separate workflow; not auto-run).
- Run `*framework` if the `notey-cli` / IPC test harness needs initialization.
- Run `*automate` for broader coverage once the harness + implementation exist.
- Run `*nfr-assess` after evidence exists to assign final PASS/CONCERNS/FAIL.

---

**Generated by:** BMad TEA Agent — Test Architect Module
**Workflow:** `bmad-testarch-test-design`
**Version:** 4.0 (BMad v6)
