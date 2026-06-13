---
workflowStatus: 'completed'
mode: 'epic-level'
epic_num: 5
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-06-12'
inputDocuments:
  - _bmad-output/implementation-artifacts/spec-5-1-soft-delete-note-to-trash-with-toast.md
  - _bmad-output/implementation-artifacts/spec-5-2-trash-view-note-restoration.md
  - _bmad-output/implementation-artifacts/spec-5-3-permanent-delete-with-confirmation-dialog.md
  - _bmad-output/implementation-artifacts/spec-5-4-trash-auto-purge.md
  - _bmad-output/implementation-artifacts/spec-5-5-markdown-export-with-native-file-picker.md
  - _bmad-output/implementation-artifacts/spec-5-6-json-export.md
  - _bmad-output/implementation-artifacts/epic-5-context.md
  - _bmad-output/implementation-artifacts/epic-5-retro-2026-06-12.md
  - _bmad-output/project-context.md
  - _bmad-output/test-artifacts/test-design/test-design-architecture.md
  - _bmad-output/test-artifacts/test-design/test-design-qa.md
---

# Test Design: Epic 5 - Note Lifecycle & Data Export

**Date:** 2026-06-12
**Author:** Pinkyd
**Status:** Draft

> **Backfill design.** Epic 5 shipped 100% (6/6 stories) with 0 incidents and **+91 frontend
> tests** (332 FE / 187 Rust). This is not a pre-implementation plan — it is the **residual-risk
> backfill** mandated by Epic 5 retro action item `epic-5-retro-item-1` (CRITICAL): TEA test-design
> across Epics 3–5, the **first feature E2E (trash lifecycle + export file-write)**, and the
> **dedup→toast regression tests**, all gating Epic 6. Scope here is the **gap the ~94 existing
> Epic-5 tests do not catch**. Range progress: Epic 3 done · Epic 4 done · **Epic 5 (this doc)**.
> Test IDs use `{EPIC}.{STORY}-{LEVEL}-{SEQ}`; rows are marked **✅ EXISTING** or **🆕 NEW**
> (NEW = the backfill this plan authorizes).

---

## Executive Summary

**Scope:** Epic-level test design for Epic 5 (stories 5-1 … 5-6: soft-delete, trash view/restore,
permanent delete, 30-day auto-purge, Markdown export, JSON export).

**Risk Summary:**

- Total risks identified: **11**
- High-priority risks (score ≥6): **1** — RISK-E5-001 (export filesystem path-containment /
  symlink-escape, SEC/DATA)
- Critical categories: **SEC/DATA** (scoped-FS export surface), **TECH/UX** (dedup→false-toast bug
  class), **TECH** (zero feature E2E — the gating deliverable)
- Gate posture: **CONCERNS** (no score-9 blockers)

**Coverage Summary (backfill / NEW only — on top of ~94 existing Epic-5 tests):**

- P0 scenarios: **0** (no P0 functional gap — existing P0 coverage is solid)
- P1 scenarios: **8** (~18–30 h)
- P2/P3 scenarios: **7** (5× P2 + 2× P3; ~13–24 h)
- **Total backfill effort:** **~31–54 hours (~1–1.5 weeks)**

The dominant clusters are the **export filesystem surface** (the single MITIGATE + 2 export E2E +
the BufWriter regression + 2 perf benches) and the **dedup→false-toast bug class** (3 component
regressions across 5.2/5.3 — the same defect the adversarial review caught twice). The four E2E
scenarios retire the **5-epic zero-feature-E2E streak** and build the harness Epic 6's CLI/IPC
boundary will depend on.

---

## Not in Scope

| Item | Reasoning | Mitigation |
| ---- | --------- | ---------- |
| **Re-testing existing strong coverage** (store invariants, FTS triggers, restore inverse, RFC3339 strict-`<` boundary, sanitization unit tests) | ~94 Epic-5 tests already cover these at unit/component/service level with 0 incidents | Collapsed into ✅ EXISTING rows; retained as the regression baseline |
| **OS-native picker automation** (directory/save dialogs) | WebDriver/tauri-driver cannot drive OS-native dialogs | Picker `null`/cancel branch stays unit-tested; export E2E invokes the command with a temp path (real FS write still covered) |
| **Real assistive-technology validation** of the confirm dialog | jsdom cannot exercise a real screen reader / WebView focus trap | jsdom asserts `role=alertdialog`/`aria-modal`/Cancel-focus; real-AT deferred to manual QA (RISK-E5-009) |
| **Singleflight helper implementation** (Epic 5 retro Action Item 2) | That is a code refactor, not a test artifact | This plan's dedup→toast regression net (RISK-E5-003 tests) is the safety harness that must land **before** the refactor |
| **CLI / IPC boundary tests** | Epic 6 scope (greenfield socket server) | Out of this epic; the E2E harness built here is the deliberate prerequisite |
| **Settings-UI editing of `retentionDays`** | Config.toml-only this epic; UI editing is Epic 7 | Config round-trip is unit-tested; no UI surface exists to test |

---

## Risk Assessment

> Probability and Impact are scored 1–3; Score = P × I. Risks are framed as **residual risk the
> current tests do not catch**. Mitigation owner is **Dev/QA**; timeline **Before Epic 6** (the
> retro's gate), unless noted.

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ---------- | ----- | -------- |
| RISK-E5-001 | SEC/DATA | Export filesystem **path-containment / symlink-escape** is thin on the markdown side. Review caught real escapes (symlink-target escape 5.6; `..`/Windows-device-name/byte-length 5.5). JSON has ~4 command-level path tests (incl. symlink rejection); **markdown export has no symlink/traversal boundary test** and relies on "no separators in generated filename" by construction. A regression could write **outside the chosen directory** or follow a symlink to clobber a file elsewhere — a scoped-FS/data-integrity breach. Sanitization + canonicalization are the only guards (no `tauri-plugin-fs`). | 2 | 3 | **6** | Add markdown path-containment Rust tests (`5.5-UNIT-005`) + assert file-location confinement in export E2E (`5.E2E-002/003`) | Dev/QA | Before Epic 6 |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ---------- | ----- |
| RISK-E5-002 | TECH | **Zero feature E2E** for trash lifecycle AND export file-write. Real picker → IPC → actual FS write → content verification, and trash→view→restore/delete→FTS, validated by hand only. The retro defines the first feature E2E as exactly this; gates Epic 6; retires the 5-epic streak. | 2 | 2 | **4** | First feature E2E suite (`5.E2E-001/002`) — gating deliverable | Dev/QA |
| RISK-E5-003 | TECH/UX | **dedup→false-failure-toast** (and stale-dialog) bug class. Same defect caught in **both 5.2 and 5.3**; 6 hand-rolled guards. Store-level dedup is tested; the component-layer `null`→false-toast and in-flight-completes-newer-dialog paths are not locked. The planned singleflight refactor will touch all six sites. | 2 | 2 | **4** | Component regression net (`5.2-COMP-002`, `5.3-COMP-003/004`) — safety harness for Action Item 2 | Dev/QA |
| RISK-E5-004 | DATA/OPS | **Startup auto-purge wiring** untested at the seam. Service is well unit-tested; the `lib.rs` `.setup()` hook (runs once, silent on success, non-fatal on error, reads retention before config move) has no integration test. Regression could panic/block start, use wrong retention, or silently not run. | 2 | 2 | **4** | `5.4-INT-001` startup-wiring integration test + `5.E2E-004` purge-after-restart | Dev/QA |
| RISK-E5-005 | PERF | **Bulk-export 10k/30s budget never benchmarked.** Epic constraint: 10,000 notes < 30s, streaming. Markdown streams per-file; JSON collects-then-writes. No large-N timing/peak-memory guard; silent regression possible as note counts grow. | 2 | 2 | **4** | `5.5-PERF-001` + `5.6-PERF-001` seeded 10k benches (nightly, trend) | Dev/QA |
| RISK-E5-006 | TECH | **Boundary/identity/staleness** is the recurring epic class — stale `selectedIndex` on last-row removal (5.2), older trash loads winning races (5.2), in-flight delete closing the wrong dialog (5.3), editor swap at same tab index (5.1). Spot-tested, not systematic. | 2 | 2 | **4** | `5.1-COMP-001`, `5.2-UNIT-005` + the 5.3 dialog-identity test (`5.3-COMP-004`) | Dev/QA |
| RISK-E5-007 | DATA | **JSON export can write truncated-but-"successful" data** on a late `BufWriter` failure. Patch added a flush check; regression coverage thin. Silent corruption of a backup/export file violates the epic's "never locked in / your data" promise. | 1 | 3 | **3** | `5.6-UNIT-004` flush-failure regression (simulate write error → `Io`, not `Ok`) | Dev/QA |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ------ |
| RISK-E5-008 | TECH | Markdown filename sanitization (Windows device names, `..`, multibyte byte-length) is unit-tested but validated only on the dev OS (Linux); real Windows path/reserved-name behavior unverified. | 1 | 2 | **2** | Document; defer real-Windows behavioral export check to the CI release matrix |
| RISK-E5-009 | TECH/UX | Permanent-delete confirmation a11y (`role=alertdialog`, `aria-modal`, Cancel default-focus) is only jsdom-validated; real assistive-tech + WebView focus-trap unverified. | 1 | 2 | **2** | Document; retain jsdom assertions, defer real-AT to manual QA |
| RISK-E5-010 | PERF/UX | Markdown progress-toast cadence (throttle ~every 50 + final, 2s threshold, `0/0` guard) tested in isolation but not exercised against a real backend over a large export. | 1 | 1 | **1** | Document; covered incidentally by `5.5-PERF-001` |
| RISK-E5-011 | DATA | Restore/export of a note whose `workspace_id` references a deleted workspace (`LEFT JOIN` → `workspace: ""`/`null`) is handled but never explicitly asserted. | 1 | 2 | **2** | `5.6-UNIT-005` orphan-workspace assertion |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, path traversal, data exposure)
- **PERF**: Performance (budget violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, truncation, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors)
- **OPS**: Operations (startup, config, maintenance)

---

## NFR Planning

**Purpose:** Capture epic-specific NFR thresholds, planned validation, and the evidence a later
`nfr-assess` should consume. This is not a final evidence audit.

| NFR Category | Requirement / Threshold | Risk Link | Planned Validation | Evidence Needed |
| ------------ | ----------------------- | --------- | ------------------ | --------------- |
| Security | Writes confined to user-selected dir/file; symlink target rejected; no `..`/separators in generated filenames; no `tauri-plugin-fs`/broad FS (epic-context + 5.5/5.6 ACs) | RISK-E5-001 | Rust command path-validation (symlink, `..`, traversal, non-existent parent) for **both** `export_markdown` & `export_json`; E2E asserts files land **only** under the chosen dir | `cargo test` report + E2E run log |
| Performance | **10,000 notes < 30s**, streaming (epic-context Requirements & Constraints) | RISK-E5-005 | Seeded large-N benches (md per-file streaming peak-memory + json collect); wall-clock + memory, trend | Perf assertion in `cargo` report (nightly) |
| Reliability | Trash recoverable **≥30 days** (strict-`<` cutoff); startup purge once/silent/non-fatal; never hard-deletes active; JSON export not truncated (`BufWriter` flush) (5.4/5.6 + project-context) | RISK-E5-004, RISK-E5-007 | `5.4-INT-001` startup wiring + `5.E2E-004` purge-after-restart + `5.6-UNIT-004` flush-failure | `cargo` integration report + E2E log |
| Maintainability | Confirmation modal `role=alertdialog`, `aria-modal`, Cancel default-focused, Esc/backdrop dismiss (5.3 ACs) | RISK-E5-009 | Existing jsdom assertions retained; real-AT deferred to manual QA | Vitest component report + manual QA note |

**Unknown thresholds:** None invented. The only hard budgets are **10k-notes/30s export** (PERF)
and **≥30-day retention with strict-`<` cutoff** (RELIABILITY/DATA); both trace to explicit epic
constraints/ACs. Global perf budgets (cold-start <1s, idle memory <80MB) are inherited from
project-context and out of this epic's new scope.

---

## Entry Criteria

- [ ] Epic 5 stories 5-1 … 5-6 merged and `done` (confirmed in `sprint-status.yaml`)
- [ ] tauri-driver / WebDriver E2E harness extended to mount the editor + command palette + trash overlay (new — first feature-E2E scaffold)
- [ ] Seeded test-DB factory able to generate N notes (incl. 10k) with controllable titles/workspaces/`deleted_at` ages
- [ ] Temp-directory fixtures for export E2E (auto-cleanup) with a symlinked-target case for the containment assertion
- [ ] CI release matrix (Windows) available for the RISK-E5-008 sanitization behavioral check

## Exit Criteria

- [ ] All P0 baseline (existing) tests still pass (no regression)
- [ ] All P1 backfill scenarios passing (≥95%); RISK-E5-001 mitigation green
- [ ] `5.E2E-001` (trash lifecycle) and `5.E2E-002` (markdown file-write) green — first feature E2E
- [ ] dedup→toast regression net (`5.2-COMP-002`, `5.3-COMP-003/004`) green
- [ ] No open high-priority (≥6) items unmitigated
- [ ] 10k/30s export benches recorded (advisory baseline, not a blocker)

---

## Test Coverage Plan

> **Priority ≠ execution timing.** P0/P1/P2/P3 below denote **priority/risk class only**.
> Scheduling (PR / Nightly / Weekly) is handled separately in **Execution Strategy**. Counts are
> **NEW backfill** scenarios; ~94 existing Epic-5 tests are the retained baseline (collapsed into
> the per-story matrices that follow).

### P0 (Critical)

**Criteria:** Blocks core journey + High risk (≥6) + No workaround.

No NEW P0 scenarios. Existing P0 coverage is solid: soft-delete `is_trashed=1` guard, trashed-only
permanent-delete guard, restore inverse, FTS trigger sync, and the RFC3339 strict-`<` retention
boundary are all unit-tested. **Total NEW P0: 0.**

### P1 (High)

**Criteria:** Critical paths + Medium/High risk + the retro's gating deliverables.

| Test ID | Requirement | Test Level | Risk Link | Test Count | Notes |
| ------- | ----------- | ---------- | --------- | ---------- | ----- |
| 5.5-UNIT-005 | Markdown export confined to canonicalized dir; no separators/`..`; symlink cannot redirect a write outside dir | Unit (Rust) | RISK-E5-001 | 1 | The MITIGATE; the asymmetric gap vs JSON |
| 5.2-COMP-002 | Concurrent restore → deduped `null` shows **no** false "Couldn't restore note" toast | Component | RISK-E5-003 | 1 | Bug caught in 5.2 review |
| 5.3-COMP-003 | Duplicate "Delete Forever" → single backend call, **no** false "Couldn't delete note" toast | Component | RISK-E5-003 | 1 | Same defect, caught in 5.3 review |
| 5.3-COMP-004 | In-flight delete completion does **not** close a newer confirmation dialog (dialog identity) | Component | RISK-E5-003/006 | 1 | Stale-dialog patch |
| 5.4-INT-001 | Startup `.setup()` purge: runs once, silent on success, non-fatal on error, correct retention | Integration (Rust) | RISK-E5-004 | 1 | The untested seam |
| 5.6-UNIT-004 | BufWriter final-flush failure surfaces `NoteyError::Io` (no truncated-but-success JSON) | Unit (Rust) | RISK-E5-007 | 1 | Backup-durability regression |
| 5.E2E-001 | Trash lifecycle: trash → view → restore → trash → permanent delete → gone from list + FTS | E2E | RISK-E5-002 | 1 | **First feature E2E** |
| 5.E2E-002 | Markdown export file-write: files on disk, frontmatter+body, safe filenames, **confined to dir** | E2E | RISK-E5-001/002 | 1 | First export E2E |

**Total NEW P1: 8 tests (~18–30 hours).** Most of the estimate is the one-time E2E harness.

### P2 (Medium)

**Criteria:** Secondary flows + Low/medium risk + recurring edge classes.

| Test ID | Requirement | Test Level | Risk Link | Test Count | Notes |
| ------- | ----------- | ---------- | --------- | ---------- | ----- |
| 5.1-COMP-001 | Editor swap re-runs when active note changes at the same tab index (no stale note) | Component | RISK-E5-006 | 1 | 5.1 review patch |
| 5.2-UNIT-005 | Trash-load race: older `listTrashedNotes` resolution cannot overwrite a newer one | Unit | RISK-E5-006 | 1 | `latestTrashLoadRequestId` |
| 5.6-UNIT-005 | Export of a note whose workspace was deleted → `workspaceName: null` (orphan LEFT JOIN) | Unit (Rust) | RISK-E5-011 | 1 | Orphan-workspace assertion |
| 5.E2E-003 | JSON export file-write: re-parse file, N × 7 fields, 2-space indent, confined to dir | E2E | RISK-E5-001/002/007 | 1 | Second export E2E |
| 5.E2E-004 | Startup auto-purge after restart: aged trashed gone, fresh survives, silent | E2E | RISK-E5-004 | 1 | Restart variant of 5.4-INT-001 |

**Total NEW P2: 5 tests (~10–18 hours).**

### P3 (Low)

**Criteria:** Benchmarks + performance budgets.

| Test ID | Requirement | Test Level | Test Count | Notes |
| ------- | ----------- | ---------- | ---------- | ----- |
| 5.5-PERF-001 | 10k-note markdown export < 30s, bounded peak memory (streaming) | Perf (Rust) | 1 | Trend, advisory |
| 5.6-PERF-001 | 10k-note JSON export < 30s, bounded memory (collect-then-write) | Perf (Rust) | 1 | Trend, advisory |

**Total NEW P3: 2 tests (~3–6 hours).**

---

### Per-Story Coverage Matrices (✅ EXISTING vs 🆕 NEW)

**Story 5-1 (soft-delete + toast) · ~31 existing**

| ID | Scenario | Level | Pri | AC/Risk | Status |
|----|----------|-------|-----|---------|--------|
| 5.1-UNIT-001 | (Rust) `trash_note` sets fields; `NotFound` on missing/already-trashed | Unit | P0 | AC1,5 | ✅ |
| 5.1-UNIT-002 | `closeTabByNoteId` closes + reselects adjacent; no-op when absent | Unit | P1 | AC3 | ✅ |
| 5.1-UNIT-003 | `trashNote` success closes tab + refetch + returns note; error → null + `notesError` | Unit | P1 | AC1,5 | ✅ |
| 5.1-UNIT-004 | Toast auto-dismiss 3s; `dismissToast` by id; unique ids | Unit | P1 | AC2 | ✅ |
| 5.1-COMP-001 | **Editor swap re-runs on same-index active-note change (no stale note)** | Component | P2 | RISK-E5-006 | 🆕 |

**Story 5-2 (trash view + restore) · ~39 existing**

| ID | Scenario | Level | Pri | AC/Risk | Status |
|----|----------|-------|-----|---------|--------|
| 5.2-UNIT-001 | (Rust) `restore_note` clears fields, preserves `workspace_id`; `NotFound` on missing/active | Unit | P0 | AC1 | ✅ |
| 5.2-UNIT-002 | (Rust) `list_trashed_notes` only trashed, `deleted_at DESC` | Unit | P1 | AC1 | ✅ |
| 5.2-UNIT-003 | Store `restoreNote` success/err; single call on concurrent same-id | Unit | P1 | AC3, RISK-E5-003 | ✅ |
| 5.2-UNIT-004 | `selectedIndex` clamp after removing selected last row | Unit | P2 | RISK-E5-006 | ✅ |
| 5.2-COMP-001 | Renders "deleted {relative}" ordered; empty state; Restore toast; Esc closes | Component | P1 | AC2,3 | ✅ |
| 5.2-COMP-002 | **Concurrent restore → no false "Couldn't restore note" toast** | Component | P1 | RISK-E5-003 | 🆕 |
| 5.2-UNIT-005 | **Trash-load race: older load cannot overwrite newer** | Unit | P2 | RISK-E5-006 | 🆕 |

**Story 5-3 (permanent delete + dialog) · ~15 existing**

| ID | Scenario | Level | Pri | AC/Risk | Status |
|----|----------|-------|-----|---------|--------|
| 5.3-UNIT-001 | (Rust) `delete_note_permanently` trashed-only DELETE (+FTS); `NotFound` on missing/active/gone | Unit | P0 | AC1 | ✅ |
| 5.3-UNIT-002 | Store request/cancel toggle; success removes+clamps+clears; concurrent → single call | Unit | P1 | AC3, RISK-E5-003 | ✅ |
| 5.3-COMP-001 | Dialog `role=alertdialog`+`aria-modal`; Cancel default-focus; "Delete Forever" `var(--error)` | Component | P1 | AC2 | ✅ |
| 5.3-COMP-002 | Cancel/Esc → no call, note stays, **Trash panel stays open** | Component | P1 | AC4 | ✅ |
| 5.3-COMP-003 | **Duplicate confirm → single call, no false "Couldn't delete note" toast** | Component | P1 | RISK-E5-003 | 🆕 |
| 5.3-COMP-004 | **In-flight completion does not close a NEWER dialog** | Component | P1 | RISK-E5-003/006 | 🆕 |

**Story 5-4 (auto-purge 30-day) · ~7 existing**

| ID | Scenario | Level | Pri | AC/Risk | Status |
|----|----------|-------|-----|---------|--------|
| 5.4-UNIT-001 | (Rust) purge aged; keep within-window; **keep exactly-N-days (strict `<`)**; ignore active | Unit | P0 | AC2 | ✅ |
| 5.4-UNIT-002 | (Rust) `retentionDays=0` purges all; oversized-N guarded; returns 0 when none qualify | Unit | P1 | AC2 | ✅ |
| 5.4-UNIT-003 | (Rust) config default 30; `[trash] retentionDays=7`→7; missing key → default | Unit | P1 | AC1 | ✅ |
| 5.4-INT-001 | **Startup `.setup()` purge wiring: once / silent-on-success / non-fatal-on-error / correct retention** | Integration | P1 | AC3, RISK-E5-004 | 🆕 |

**Story 5-5 (markdown export) · ~22 existing**

| ID | Scenario | Level | Pri | AC/Risk | Status |
|----|----------|-------|-----|---------|--------|
| 5.5-UNIT-001 | (Rust) one `.md`/note; exact frontmatter (5 quoted+escaped keys)+body; 0→0; NULL ws→`""` | Unit | P1 | AC1 | ✅ |
| 5.5-UNIT-002 | (Rust) sanitize reserved/control/dots, ≤200, Windows device names; empty→`untitled` | Unit | P1 | AC1 | ✅ |
| 5.5-UNIT-003 | (Rust) dedup ` (2)` + no-overwrite existing files; YAML control-char escaping | Unit | P1 | AC1 | ✅ |
| 5.5-UNIT-004 | (Rust) progress callback increasing → total | Unit | P2 | AC3 | ✅ |
| 5.5-FE-001 | Picker null→no toast; success/error toasts; double-invoke guarded; >2s progress toast | Unit | P1 | AC2,3,4 | ✅ |
| 5.5-UNIT-005 | **(Rust) Path containment: no separators/`..`; confined to canonical dir; symlink cannot escape** | Unit | P1 | RISK-E5-001 | 🆕 |
| 5.5-PERF-001 | **(Rust) 10k-note markdown export < 30s, bounded peak memory** | Perf | P3 | RISK-E5-005 | 🆕 |

**Story 5-6 (JSON export) · ~12 existing**

| ID | Scenario | Level | Pri | AC/Risk | Status |
|----|----------|-------|-----|---------|--------|
| 5.6-UNIT-001 | (Rust) single 2-space array; 7 camelCase fields; special-char round-trip; `updated_at DESC`; 0→`[]` | Unit | P1 | AC1 | ✅ |
| 5.6-UNIT-002 | (Rust) NULL ws→`workspaceName: null`; populated→name; trashed excluded | Unit | P1 | AC2 | ✅ |
| 5.6-UNIT-003 | (Rust) cmd: parent canonicalized, **symlink rejected**, no-parent/no-filename→`Validation`; missing-dir≠`Io` | Unit | P1 | AC5, RISK-E5-001 | ✅ |
| 5.6-FE-001 | Save dialog null→no toast; success/error toasts; double-invoke guarded | Unit | P1 | AC3,4 | ✅ |
| 5.6-UNIT-004 | **(Rust) BufWriter final-flush failure → `Io` (no truncated-but-success)** | Unit | P1 | RISK-E5-007 | 🆕 |
| 5.6-UNIT-005 | **(Rust) Orphan workspace (deleted) → `workspaceName: null`** | Unit | P2 | RISK-E5-011 | 🆕 |
| 5.6-PERF-001 | **(Rust) 10k-note JSON export < 30s, bounded memory** | Perf | P3 | RISK-E5-005 | 🆕 |

**Cross-Story · feature E2E (real Tauri runtime, real FS) · 0 existing**

| ID | Scenario | Level | Pri | AC/Risk | Status |
|----|----------|-------|-----|---------|--------|
| 5.E2E-001 | Trash lifecycle: trash (toast, tab closes) → view → restore → trash → permanent delete → gone from list + FTS | E2E | P1 | RISK-E5-002 | 🆕 |
| 5.E2E-002 | Markdown export file-write: `.md`/note on disk, frontmatter+body, safe filenames, **confined to dir** | E2E | P1 | RISK-E5-001/002 | 🆕 |
| 5.E2E-003 | JSON export file-write: re-parse valid array, 7 fields, `workspaceName:null` loose note, confined to dir | E2E | P2 | RISK-E5-001/002/007 | 🆕 |
| 5.E2E-004 | Startup auto-purge after restart: aged gone, fresh survives, silent | E2E | P2 | RISK-E5-004 | 🆕 |

---

## NFR Coverage and Evidence Plan

- **Security (export path containment) — MITIGATE / gates Epic 6:** `5.5-UNIT-005` (markdown
  symlink/traversal/no-separator confinement) + existing `5.6-UNIT-003` (json symlink rejection +
  parent canonicalization) + `5.E2E-002`/`5.E2E-003` (files land only under chosen dir on real FS).
  Evidence: `cargo test` report + E2E run log.
- **Performance (10k/30s export):** `5.5-PERF-001` + `5.6-PERF-001` seeded benches; wall-clock < 30s
  + bounded peak memory; trend across epics. Evidence: nightly `cargo` perf report.
- **Reliability/Data (retention + durability):** `5.4-INT-001` (startup wiring) + `5.E2E-004`
  (purge-after-restart) + `5.6-UNIT-004` (no truncated JSON). Evidence: integration report + E2E log.
- **Reliability/UX (dedup→toast correctness):** `5.2-COMP-002` + `5.3-COMP-003` + `5.3-COMP-004` —
  the false-toast / stale-dialog regression net (and the harness for Action Item 2). Evidence:
  vitest component report.
- **Maintainability/A11y:** existing jsdom `role=alertdialog`/`aria-modal`/Cancel-focus retained;
  real-AT deferred to manual QA (RISK-E5-009).

Final PASS/CONCERNS/FAIL is deferred to `nfr-assess` once these tests exist.

---

## Execution Strategy

Simple **PR / Nightly / Weekly** model. Philosophy: run everything in PRs unless it is expensive or
long-running; defer only the seeded large-N benches and the heavier E2E. Tests are not re-listed
here — see the Coverage Plan.

| Trigger | Suite | Target |
| ------- | ----- | ------ |
| **PR** | All functional `vitest` + `cargo test` (existing + NEW unit/component/integration incl. `5.2-COMP-002`, `5.3-COMP-003/004`, `5.4-INT-001`, `5.5-UNIT-005`, `5.6-UNIT-004/005`) · `5.E2E-001` smoke (trash lifecycle) | < 15 min |
| **Nightly** | Full E2E incl. `5.E2E-002/003` (export file-write) + `5.E2E-004` (purge-after-restart) · `5.5-PERF-001` + `5.6-PERF-001` (10k seeded benches) | < 30 min |
| **Weekly / pre-Epic-6** | Confirm RISK-E5-001 (path-containment) green + first feature E2E (`5.E2E-001/002`) green + dedup→toast net green — the gating obligations | — |

---

## Resource Estimates

Interval ranges (no false precision). Backfill / NEW only; ~94 existing tests are the baseline.

| Priority | Count | Effort | Notes |
| -------- | ----- | ------ | ----- |
| P0 | 0 | — | No NEW P0 (existing coverage solid) |
| P1 | 8 | ~18–30 h | Driver is the **one-time first-feature E2E harness** (tauri-driver: trash lifecycle + export file-write to temp FS) + path-containment Rust tests + dedup→toast component regressions + startup-purge integration |
| P2 | 5 | ~10–18 h | Boundary/identity component+unit, orphan-workspace, two more E2E |
| P3 | 2 | ~3–6 h | 10k seeded export benches (mostly fixture generation) |
| **Total** | **15** | **~31–54 h (~1–1.5 weeks)** | Most of P1 is harness, not test count |

### Prerequisites

**Test Data:**

- N-note seeded-DB factory (10k-capable; controllable titles incl. reserved chars / duplicates / empty, workspace assignment incl. NULL and orphan, `deleted_at` ageing)
- Temp-directory + symlinked-target fixtures for export E2E (auto-cleanup)

**Tooling:**

- `tauri-driver` / WebDriver (`e2e/run.mjs`) — extended for the first feature-E2E suite
- `vitest` + React Testing Library (component regressions); `cargo test` (Rust unit/integration/perf)

**Environment:**

- CI release matrix (Windows) for the RISK-E5-008 sanitization behavioral check
- Nightly runner budget for the 10k-note benches

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate:** 100% (existing baseline must not regress)
- **P1 pass rate:** ≥95% (waivers required for failures)
- **P2/P3 pass rate:** ≥90% (informational); P3 benches advisory/trend, not a blocker
- **High-risk mitigations:** RISK-E5-001 (export path-containment) complete and green

### Coverage Targets (inherited from system-level)

- Rust service ≥ 80%; TS stores/utils ≥ 75%
- Security scenarios (path containment): 100% of the in-scope export surface
- Edge/boundary: the recurring identity/staleness class systematically covered

### Non-Negotiable Requirements

- [ ] Existing P0 baseline passes (no regression)
- [ ] No high-risk (≥6) item unmitigated — RISK-E5-001 green
- [ ] Security (export path containment) tests pass 100%
- [ ] First feature E2E (`5.E2E-001` + `5.E2E-002`) green — satisfies `epic-5-retro-item-1`, gates Epic 6
- [ ] dedup→toast regression net green **before** the Action Item 2 singleflight migration lands
- [ ] Planned NFR evidence exists or `nfr-assess` records CONCERNS/waivers

---

## Mitigation Plans

### RISK-E5-001: Export filesystem path-containment / symlink-escape (Score: 6)

**Mitigation Strategy:**
1. Add Rust unit tests (`5.5-UNIT-005`) asserting the markdown export's generated filenames contain
   no path separators or `..`, that every write resolves under the canonicalized chosen directory,
   and that a symlink placed at a generated filename cannot redirect a write outside the directory
   (parity with the JSON command's existing `5.6-UNIT-003` symlink rejection).
2. In `5.E2E-002`/`5.E2E-003`, after a real export, assert the full set of written paths is a subset
   of the chosen directory subtree (no escape) and that file contents match expectations.
3. Keep the "no `tauri-plugin-fs`, no broad FS capability" invariant asserted in the ACL test.

**Owner:** Dev/QA · **Timeline:** Before Epic 6 · **Status:** Planned
**Verification:** `cargo test` (path-containment + symlink cases) green for both export commands;
E2E confinement assertions green; ACL test confirms no broad FS capability.

---

## Assumptions and Dependencies

### Assumptions

1. The ~94 existing Epic-5 tests accurately reflect current behavior and pass on `main` (verified by repo scan; treated as the regression baseline).
2. tauri-driver can launch the app, dispatch keyboard shortcuts (Ctrl/Cmd+P, etc.), and the export commands accept a directory/file path argument directly (bypassing the OS picker, which cannot be automated).
3. A symlinked-target filesystem fixture is creatable in the CI environment (Linux nightly) for the containment assertion; Windows behavioral checks ride the existing release matrix.
4. The Action Item 2 singleflight refactor lands **after** the dedup→toast regression net, using it as the safety harness.

### Dependencies

1. First-feature E2E harness scaffold (editor + palette + trash overlay mountable under tauri-driver) — Required before Epic 6.
2. 10k-note seeded-DB factory — Required for `5.5-PERF-001` / `5.6-PERF-001` (nightly).
3. CI Windows runner — Required for the RISK-E5-008 sanitization behavioral check.

### Risks to Plan

- **Risk:** OS-native picker cannot be driven in E2E, so the picker→command seam is split (picker
  unit-tested, command E2E-tested).
  - **Impact:** The exact "user clicks folder in OS dialog" step is not end-to-end automated.
  - **Contingency:** Cover the OS-dialog `null`/cancel branch in `exportMarkdown.test.ts` /
    `exportJson.test.ts`; manual QA exercises the real picker once per release.
- **Risk:** Building the first tauri-driver feature suite may take the upper end of the estimate.
  - **Impact:** P1 effort skews toward ~30 h.
  - **Contingency:** The harness is a one-time investment reused by Epic 6; schedule it first.

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| ----------------- | ------ | ---------------- |
| **`services/notes.rs` (trash/restore/purge)** | New integration test exercises the startup purge path | Existing `trash_note`/`restore_note`/`list_trashed_notes`/`delete_note_permanently`/`purge_expired_trash` unit tests must pass |
| **`services/export.rs` + `commands/export.rs`** | New path-containment + flush-failure tests; perf benches | Existing 12 md + 8 json + 4 path-validation tests must pass |
| **`features/trash/*` (store, TrashPanel, ConfirmDeleteDialog)** | New dedup→toast + dialog-identity component tests | Existing trash store / TrashPanel / ConfirmDeleteDialog tests must pass |
| **`features/editor/EditorPane.tsx`** | Same-index active-note swap regression (5.1) | Epic 4 editor-tab integration tests must pass (cross-epic) |
| **`lib.rs` `.setup()`** | New startup-purge wiring test | App boot path; capability ACL tests; bindings export test |
| **`e2e/run.mjs`** | First feature-E2E suite added | Existing Epic 1 capture-loop + window-mgmt E2E (7 tests) must pass |
| **`features/overlays/manager.ts`** | Trash overlay participates in mutual exclusion | Cross-overlay exclusion (search ↔ palette ↔ note-list ↔ trash) — inherited from Epic 4 |

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — Risk classification framework
- `probability-impact.md` — Risk scoring methodology (P × I)
- `test-levels-framework.md` — Test level selection
- `test-priorities-matrix.md` — P0–P3 prioritization
- `nfr-criteria.md` — NFR planning categories

### Related Documents

- Epic context: `_bmad-output/implementation-artifacts/epic-5-context.md`
- Epic 5 retro (driver): `_bmad-output/implementation-artifacts/epic-5-retro-2026-06-12.md` (`epic-5-retro-item-1`)
- Story specs: `spec-5-1` … `spec-5-6`
- System-level test design: `_bmad-output/test-artifacts/test-design/{test-design-architecture.md, test-design-qa.md}`
- Sibling backfill: `test-design-epic-3.md`, `test-design-epic-4.md`
- Project context: `_bmad-output/project-context.md`

### Follow-on Workflows (Manual)

- Run `*atdd` to scaffold the first feature-E2E + the P1 regression tests (separate workflow; not auto-run).
- Run `*automate` for broader coverage once the harness exists.
- Run `*nfr-assess` after evidence exists to assign final PASS/CONCERNS/FAIL.

---

**Generated by:** BMad TEA Agent — Test Architect Module
**Workflow:** `bmad-testarch-test-design`
**Version:** 4.0 (BMad v6)
