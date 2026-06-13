---
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-06-12'
---

# Test Design: Epic 3 - Search & Discovery

**Date:** 2026-06-12
**Author:** Pinkyd
**Status:** Draft

> **Backfill context.** Epic 3 shipped in April 2026 and already carries strong unit/integration
> coverage. This plan was commissioned by **Epic 5 retro action item `epic-5-retro-item-1`**
> (CRITICAL — gates Epic 6) to backfill the missing tests for prior epics. It therefore reads as
> a **gap audit**: every scenario is marked **✅ EXISTING** (already implemented) or **🆕 NEW**
> (the work this plan authorizes). The 14 🆕 scenarios are the deliverable.

---

## Executive Summary

**Scope:** Full epic-level test design for Epic 3 (5 stories, 30 acceptance criteria).

**Risk Summary:**

- Total risks identified: 10
- High-priority risks (≥6): 1 — `RISK-E3-001` (PERF, unmeasured `<100ms`/10K budget)
- Critical categories: PERF (latency budget), TECH (E2E gap, async race), DATA (FTS desync on evolution)
- **Gate posture: CONCERNS** — no score-9 blockers; clears to PASS once the perf benchmark and first E2E smoke land.

**Coverage Summary (inventory ≈ 64 scenarios):**

- ✅ EXISTING: ~50 scenarios (no new effort) — P0 path fully covered.
- 🆕 NEW (backfill): **14 scenarios** — 6 × P1, 8 × P2, **0 × P0** (no critical gaps).
- **Total backfill effort:** ~20–34 hours (~3–4.5 days), dominated by the perf-benchmark harness and the first feature E2E scaffold.

---

## Not in Scope

| Item | Reasoning | Mitigation |
| ---- | --------- | ---------- |
| **Re-testing already-covered P0 paths** | ~50 existing tests already cover trigger sync, ranking, workspace filter, trashed exclusion, overlay happy paths, keyboard nav, scope toggle | Listed as ✅ EXISTING for traceability; regression-protected by PR suite |
| **Real assistive-technology (screen reader) validation** | jsdom cannot assert live AT announcements; Tauri WebView varies by platform | A11y roles/aria covered in jsdom (`3.4-COMP-005`); real-AT pass deferred to manual QA checklist |
| **CodeMirror editor internals** | Owned by Epic 1; search only calls `loadNote` + focuses `.cm-content` | E2E smoke (`3.E2E-001`) validates the hand-off boundary only |
| **Multi-process IPC search path** | CLI search is Epic 6; this epic is in-app search only | Covered by Epic 6 test design when authored |

---

## Risk Assessment

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ---------- | ----- | -------- |
| RISK-E3-001 | PERF | `<100ms` @10K-notes budget (AC 3-2.4 / NFR3) never benchmarked; BM25 + `snippet()` over large content can regress silently at scale — no guard exists | 3 | 2 | **6** | Add timed integration/bench seeding 1K & 10K notes; assert p95 < budget (2× CI margin) + degradation <2×; trend-track | Dev | Before Epic 6 kickoff |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ---------- | ----- |
| RISK-E3-002 | TECH | No E2E for the search journey; hotkey→overlay→type→nav→Enter→open→focus only tested in isolation with mocked IPC (Epic 5 retro mandates first feature E2E) | 2 | 2 | **4** | Author `3.E2E-001` smoke against real Tauri runtime | Dev |
| RISK-E3-003 | TECH | No-debounce live search → multiple in-flight `searchNotes`; `requestIdRef`/`openingRef` guards untested → stale results / double-open (ties to `epic-5-retro-item-2` singleflight) | 2 | 2 | **4** | `3.3-COMP-010` stale-race + `3.3-COMP-011` double-open tests | Dev |
| RISK-E3-004 | DATA | FTS index desync on schema evolution / rebuild; `rebuild_fts_index` untested, migration idempotency only asserts schema equality not trigger/rank re-creation | 2 | 2 | **4** | `3.1-UNIT-001` rebuild + `3.1-INT-009` post-re-migration assertions | Dev |
| RISK-E3-005 | SEC | Snippet `<mark>` render of user-authored content — safe parse guarded at happy path, but nested/adjacent/malformed marks + mark-like raw content uncovered | 1 | 3 | **3** | `3.3-COMP-009` XSS-hardening edge cases | Dev |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ------ |
| RISK-E3-006 | TECH | Focus trap / focus-return validated only in jsdom; real focus/scroll + cross-WebView unverified | 2 | 1 | **2** | Monitor; manual QA |
| RISK-E3-007 | TECH | `SearchResultItem.tsx` has zero tests (rel-date, "No workspace" fallback, click→open) | 2 | 1 | **2** | `3.4-UNIT-001` |
| RISK-E3-008 | SEC | FTS5 query injection / panic from special chars | 1 | 2 | **2** | Covered; `3.2-INT-008` hardening |
| RISK-E3-009 | DATA | Workspace scope leakage / not reapplied on toggle | 1 | 2 | **2** | Covered |
| RISK-E3-010 | TECH | `commands/search.rs` handler untested directly (camelCase/param passthrough) | 1 | 2 | **2** | Compile-time + serialization test; `3.2-INT-010` optional |

### Risk Category Legend

- **TECH**: Technical/Architecture · **SEC**: Security · **PERF**: Performance · **DATA**: Data Integrity · **BUS**: Business Impact · **OPS**: Operations

---

## NFR Planning

**Purpose:** Capture epic-specific NFR thresholds, planned validation, and evidence expected for later `nfr-assess`. Not a final evidence audit.

| NFR Category | Requirement / Threshold | Risk Link | Planned Validation | Evidence Needed |
| ------------ | ----------------------- | --------- | ------------------ | --------------- |
| Performance | Search p95 `<100ms` @1K; `<100ms` (2× CI margin) @10K; degradation to 10K `<2×` baseline (AC 3-2.4 / NFR3 + project-context budgets) | RISK-E3-001 | `3.2-PERF-001/002` — timed integration / `cargo bench` seeding 1K & 10K notes | Timing/bench report + trend history |
| Security | No `dangerouslySetInnerHTML`; safe `<mark>` parse of user content (AC 3-3.5) | RISK-E3-005 | `3.3-COMP-008` (exists) + `3.3-COMP-009` (new) — render-inert assertions | Component test report |
| Security | FTS5 never panics on operators/Unicode/oversized input; sanitized (AC 3-2.6) | RISK-E3-008 | `3.2-INT-007` (exists) + `3.2-INT-008` (new) | cargo test report |
| Reliability | FTS index reflects all CRUD with no app code; survives rebuild + schema evolution (AC 3-1.4) | RISK-E3-004 | `3.1-INT-008` (exists) + `3.1-UNIT-001`/`3.1-INT-009` (new) | cargo test report |
| Maintainability | Rust service ≥80%, TS stores/utils ≥75% coverage | — | Coverage gate in CI | Coverage report |

**Unknown thresholds:** None invented. The only gap is the **known-but-unmeasured** `<100ms`/10K target → captured as RISK-E3-001 (not an UNKNOWN, a missing measurement).

---

## Entry Criteria

- [x] Requirements + ACs available (5 story specs, 30 ACs)
- [x] Test environment: `cargo test` + Vitest operational; `e2e/run.mjs` (tauri-driver) harness exists
- [x] Test data factories available (Rust + TS factories from Epic 1/2 retro items)
- [x] Feature implemented and merged (Epic 3 done)
- [ ] 10K-note seed helper for perf benchmark provisioned (new prerequisite — see Mitigation R-001)

## Exit Criteria

- [ ] All P0 tests passing (already green — keep green)
- [ ] All 6 🆕 P1 backfill tests passing
- [ ] RISK-E3-001 perf benchmark green within budget (gates Epic 6)
- [ ] `3.E2E-001` search smoke passing (satisfies "first feature E2E" commitment)
- [ ] No open high-priority bugs surfaced by new tests

---

## Test Coverage Plan

> Full scenario matrices (with test IDs, levels, and ✅/🆕 status per story) live in
> `test-design-progress.md` Step 4. Summarized here by priority; **NEW work bolded**.
>
> **Note:** P0/P1/P2/P3 denote **priority/risk**, not execution timing. When each suite runs
> is defined separately in the **Execution Strategy** section below.

### P0 (Critical)

**Criteria**: Blocks core journey + data-integrity/security + no workaround. **All P0 already covered — zero backfill.**

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| ----------- | ---------- | --------- | ---------- | ----- | ----- |
| FTS triggers + backfill keep index correct | Integration | RISK-E3-004 | 5 | Dev | ✅ `3.1-INT-001..005` |
| Ranking + trashed-exclusion + workspace filter | Integration | RISK-E3-009 | 3 | Dev | ✅ `3.2-INT-001,004,005` |
| FTS special chars never panic | Integration | RISK-E3-008 | 1 | Dev | ✅ `3.2-INT-007` |
| Live search renders results | Component | — | 1 | Dev | ✅ `3.3-COMP-002` |
| Safe `<mark>` render (no innerHTML) | Component | RISK-E3-005 | 1 | Dev | ✅ `3.3-COMP-008` |
| Enter opens note + closes + focuses editor | Component | — | 1 | Dev | ✅ `3.4-COMP-002` |

**Total P0**: 12 tests — all ✅ EXISTING, 0 hours.

### P1 (High)

**Criteria**: Important features + Medium risk (3-4) + common workflows.

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| ----------- | ---------- | --------- | ---------- | ----- | ----- |
| **Search latency within budget @1K** | **Perf** | **RISK-E3-001** | **1** | **Dev** | **🆕 `3.2-PERF-001`** |
| **Search latency @10K + degradation <2×** | **Perf/Bench** | **RISK-E3-001** | **1** | **Dev** | **🆕 `3.2-PERF-002` (nightly)** |
| **`rebuild_fts_index` restores index (direct)** | **Unit** | **RISK-E3-004** | **1** | **Dev** | **🆕 `3.1-UNIT-001`** |
| **`<mark>` XSS-hardening edge cases** | **Component** | **RISK-E3-005** | **1** | **Dev** | **🆕 `3.3-COMP-009`** |
| **Stale-request race shows only latest** | **Component** | **RISK-E3-003** | **1** | **Dev** | **🆕 `3.3-COMP-010`** |
| **Search journey E2E smoke** | **E2E** | **RISK-E3-002** | **1** | **Dev** | **🆕 `3.E2E-001`** |
| Store actions, overlay open/focus, Esc, error path, whitespace, count/empty header | Unit/Component | — | 18 | Dev | ✅ store(12)+`3.3-COMP-001,003,006,007` |
| Keyboard nav, click, focus trap, a11y roles | Component | RISK-E3-006 | 4 | Dev | ✅ `3.4-COMP-001,003,004,005` |
| Workspace scope default/toggle/persist | Component | RISK-E3-009 | 5 | Dev | ✅ `3.5-COMP-001,002,003,004,006` |

**Total P1**: ~33 tests — 27 ✅ EXISTING + **6 🆕 NEW**.

### P2 (Medium)

**Criteria**: Secondary features + low risk (1-2) + edge cases.

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| ----------- | ---------- | --------- | ---------- | ----- | ----- |
| **Post-re-migration trigger/rank reapplied** | **Integration** | **RISK-E3-004** | **1** | **Dev** | **🆕 `3.1-INT-009`** |
| **Unicode/emoji + oversized-query robustness** | **Integration** | **RISK-E3-008** | **1** | **Dev** | **🆕 `3.2-INT-008`** |
| **Snippet edge cases (title-only/short/no-term)** | **Integration** | — | **1** | **Dev** | **🆕 `3.2-INT-009`** |
| **Command handler → service + camelCase IPC** | **Integration** | **RISK-E3-010** | **1** | **Dev** | **🆕 `3.2-INT-010` (optional)** |
| **Rapid-Enter does not double-open** | **Component** | **RISK-E3-003** | **1** | **Dev** | **🆕 `3.3-COMP-011`** |
| **Selected result scrolls into view** | **Component** | — | **1** | **Dev** | **🆕 `3.4-COMP-007`** |
| **`SearchResultItem` (click/fallback/date/snippet)** | **Component** | **RISK-E3-007** | **1** | **Dev** | **🆕 `3.4-UNIT-001`** |
| Sanitize-preserves-text, empty-content, scope edge/a11y/no-empty-search | Unit/Component | — | 6 | Dev | ✅ `3.2-UNIT-002`,`3.1-INT-007`,`3.4-COMP-006`,`3.5-COMP-005,007`,`3.5-UNIT-001` |

**Total P2**: ~13 tests — 6 ✅ EXISTING + **7 🆕 NEW**.

### P3 (Low)

**Criteria**: Nice-to-have + exploratory + benchmark variants.

| Requirement | Test Level | Test Count | Owner | Notes |
| ----------- | ---------- | ---------- | ----- | ----- |
| **Workspace-scoped filter end-to-end** | **E2E** | **1** | **Dev** | **🆕 `3.E2E-002` (optional, nightly)** |

**Total P3**: **1 🆕 NEW**.

---

## Execution Strategy

**Philosophy:** run everything in PRs (`cargo test` + Vitest finish in well under 15 min); defer only what is genuinely expensive or long-running (the 10K-note seed + full E2E).

| Trigger | Suite | Target |
| ------- | ----- | ------ |
| **PR (every push)** | All functional `cargo test` + Vitest (existing + 🆕 unit/integration/component) · 🆕 `3.2-PERF-001` (@1K, fast) · 🆕 `3.E2E-001` smoke | < 12 min |
| **Nightly** | 🆕 `3.2-PERF-002` (@10K seed + degradation ratio) · full E2E incl. 🆕 `3.E2E-002` | < 30 min |
| **Weekly / pre-Epic-6** | Perf trend report; confirm RISK-E3-001 mitigation evidence captured (Epic 6 gate) | — |

---

## Resource Estimates

### Test Development Effort (backfill / 🆕 NEW only — existing tests = 0h)

| Priority | New Count | Effort/Test | Total Hours | Notes |
| -------- | --------- | ----------- | ----------- | ----- |
| P0 | 0 | — | 0 | Fully covered |
| P1 | 6 | — | ~12–20 | Perf harness (1K+10K seed + timing infra) and E2E scaffold dominate; others standard |
| P2 | 7 | ~0.5–1 | ~6–11 | Mostly mechanical component/integration |
| P3 | 1 | ~1–2 | ~2–3 | E2E variant reusing smoke scaffold |
| **Total** | **14** | **—** | **~20–34** | **~3–4.5 days** |

### Prerequisites

**Test Data:**

- Existing Rust note/workspace factories + temp-SQLite harness (reuse).
- **NEW:** bulk-seed helper to populate 1K / 10K notes for `3.2-PERF-001/002`.

**Tooling:**

- `cargo test` (Rust unit/integration) · `cargo bench` or timed harness for perf.
- Vitest + React Testing Library (component/unit) — mock IPC at the tauri-specta boundary.
- `tauri-driver` / WebDriver via `e2e/run.mjs` for `3.E2E-001/002` (Linux CI + xvfb).

**Environment:**

- Linux CI with xvfb for E2E (per system-level TC-2).
- Deterministic clock/seed for perf trend comparability.

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (keep green) · **P1 pass rate**: ≥95% · **P2/P3**: ≥90% (informational).
- **High-risk mitigations**: RISK-E3-001 must be mitigated + green before Epic 6 kickoff.

### Coverage Targets

- Critical paths ≥80% · Security scenarios (SEC) 100% · Business logic ≥70% · Rust service ≥80%, TS stores/utils ≥75%.

### Non-Negotiable Requirements

- [ ] All P0 tests pass.
- [ ] No high-risk (≥6) item unmitigated → RISK-E3-001 closed.
- [ ] SEC scenarios pass 100% (no `dangerouslySetInnerHTML`; FTS no-panic).
- [ ] PERF targets met (`3.2-PERF-001/002` within budget).
- [ ] `3.E2E-001` smoke passes (first feature E2E commitment).

---

## Mitigation Plans

### RISK-E3-001: Unmeasured `<100ms`/10K search budget (Score: 6)

**Mitigation Strategy:** Build a seed helper for 1K and 10K notes; add `3.2-PERF-001` (PR, @1K) and `3.2-PERF-002` (nightly, @10K) timed tests/benches asserting p95 < budget with a 2× CI margin and degradation <2× vs the 1K baseline. Record results for trend tracking and as `nfr-assess` evidence.
**Owner:** Dev
**Timeline:** Before Epic 6 kickoff (this item gates Epic 6).
**Status:** Planned
**Verification:** Green perf test in CI + recorded baseline/trend artifact.

### RISK-E3-002: No end-to-end search journey (Score: 4)

**Mitigation Strategy:** Author `3.E2E-001` against the real Tauri runtime via `e2e/run.mjs`: seed notes → `Ctrl/Cmd+F` → type → assert results → ArrowDown → Enter → assert note content visible in editor → assert overlay closed. Run in PR smoke (Linux + xvfb).
**Owner:** Dev
**Timeline:** Before Epic 6 kickoff.
**Status:** Planned
**Verification:** Passing E2E in CI; doubles as the project's first feature E2E template.

### RISK-E3-003: Untested async race / stale-request guards (Score: 4)

**Mitigation Strategy:** `3.3-COMP-010` simulates a slow-then-fast query and asserts only the latest results render (validates `requestIdRef`); `3.3-COMP-011` fires rapid Enter and asserts a single `loadNote` (validates `openingRef`). Coordinate with `epic-5-retro-item-2` singleflight helper so the guard is shared, not re-hand-rolled.
**Owner:** Dev
**Timeline:** With backfill batch.
**Status:** Planned
**Verification:** Both component tests green; ideally exercising the shared singleflight helper.

---

## Assumptions and Dependencies

### Assumptions

1. Epic 3 source is stable; backfill adds tests only — no feature changes expected.
2. The tauri-driver/WebDriver E2E harness (`e2e/run.mjs`) can drive the search overlay headlessly on Linux CI (per system-level TC-2; xvfb available).
3. Performance budgets in `project-context.md` (Search 1K <100ms; degradation to 10K <2×) and AC 3-2.4 are the authoritative thresholds.

### Dependencies

1. Bulk note-seed helper — required before `3.2-PERF-001/002`.
2. `epic-5-retro-item-2` singleflight helper — preferred substrate for `3.3-COMP-010/011` (soft dependency; tests can land first against existing guards).

### Risks to Plan

- **Risk**: jsdom cannot validate real focus/scroll behavior.
  - **Impact**: `3.4-COMP-007` (scroll-into-view) asserts call wiring, not visual scroll.
  - **Contingency**: Cover the visual behavior inside the `3.E2E-001` journey assertion.
- **Risk**: Perf benchmarks are CI-flaky.
  - **Impact**: False failures on the gating test.
  - **Contingency**: 2× CI margin + p95 (not max) + degradation-ratio assertion rather than absolute-only.

---

## Follow-on Workflows (Manual)

- Run `*atdd` to scaffold the 6 🆕 P1 tests red-first (esp. `3.2-PERF-001/002`, `3.E2E-001`).
- Run `*automate` to implement the full 14-scenario backfill batch.
- Run `*trace` after implementation to produce the traceability matrix + gate decision.
- Re-run this workflow for **Epic 4** and **Epic 5** to complete the `epic-5-retro-item-1` backfill range.

---

## Approval

**Test Design Approved By:**

- [ ] Product Owner: Pinkyd — Date: ______
- [ ] Tech/QA Lead: ______ — Date: ______

**Comments:**

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| ----------------- | ------ | ---------------- |
| **notes table / migrations** | FTS triggers fire on every note CRUD | `3.1-INT-*` must pass after any `notes` schema migration (esp. Epic 5 trash/`is_trashed` and Epic 6 CLI writes) |
| **Editor (`loadNote` / `.cm-content`)** | Search opens notes into the editor | `3.4-COMP-002` + `3.E2E-001` must pass after editor changes |
| **Workspace store** | Scope filter depends on `activeWorkspaceId`/`isAllWorkspaces` | `3.5-COMP-*` must pass after workspace changes |
| **CLI search (Epic 6)** | Will reuse `search_service` | Epic 6 must keep `3.2-INT-*` green; shared service is the contract |

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — Risk classification framework
- `probability-impact.md` — Risk scoring methodology (P×I, 1–9)
- `test-levels-framework.md` — Test level selection
- `test-priorities-matrix.md` — P0–P3 prioritization
- `nfr-criteria.md` — NFR evidence planning

### Related Documents

- Story specs: `_bmad-output/implementation-artifacts/3-1…3-5-*.md`
- Research: `fts5-research.md`, `codemirror-multi-instance-research.md`
- Epic 3 retro: `epic-3-retro-2026-04-09.md`
- System-Level test design: `_bmad-output/test-artifacts/test-design/test-design-architecture.md`, `…/test-design-qa.md`
- Project context: `_bmad-output/project-context.md`
- Driver: Epic 5 retro `epic-5-retro-item-1` (sprint-status.yaml)

---

**Generated by**: BMad TEA Agent — Test Architect Module (Murat)
**Workflow**: `bmad-testarch-test-design` (Epic-Level)
**Version**: 4.0 (BMad v6)
