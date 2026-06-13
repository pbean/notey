---
workflowStatus: 'completed'
mode: 'epic-level'
epic_num: 4
epic_title: 'Multi-Tab Editing & Command Palette'
totalSteps: 5
lastSaved: '2026-06-12'
gate_posture: 'CONCERNS'
---

# Test Design: Epic 4 — Multi-Tab Editing & Command Palette

**Date:** 2026-06-12
**Author:** Pinkyd (Master Test Architect: Murat)
**Status:** Draft
**Mode:** Epic-Level (backfill — residual-risk framing)

> **Driver:** Epic 5 retro action item `epic-5-retro-item-1` (CRITICAL) — TEA test-design +
> backfill missing tests for Epics 3–5; gates Epic 6. Epic 3 ✅ complete (`test-design-epic-3.md`).
> **This is Epic 4 — second of the range.** All 9 Epic 4 stories are `done`; this plan assesses
> **residual risk current tests do NOT catch** and authorizes the 🆕 NEW backfill scope.
> Architecture context: completed System-Level test design (`test-design/`, 2026-04-03) +
> `project-context.md` — used as context, not regenerated.

---

## Executive Summary

**Scope:** Epic-level test design for Epic 4 (stories 4-1 … 4-9), focused on backfilling the
gaps in an already-shipped epic (100% delivered, 0 incidents, ~160 existing Epic-4 tests).

**Risk Summary:**

- Total risks identified: **11**
- High-priority risks (≥6): **1** (RISK-E4-001 — thin coverage on the data-critical multi-tab switch path)
- Critical categories: **TECH/DATA** (tab-switch integrity, session round-trip), with the cross-cutting **E2E gap** (4-epic streak) as the mandated gating deliverable
- **Gate posture: CONCERNS** — no score-9 blockers

**Coverage Summary (backfill / 🆕 NEW only — on top of ~160 ✅ existing):**

- P0 scenarios: **0** (existing P0 coverage on store invariants / createNewNote / dedup is solid — no P0 gaps)
- P1 scenarios: **10** (~16–26 h) — 6 are the Story 4.4 multi-tab switch-flow backfill
- P2 scenarios: **14** (~12–20 h) — edge/boundary/Rust/E2E hardening
- **Total backfill effort: ~28–46 hours (~1–1.5 weeks)** for 24 NEW scenarios

---

## Not in Scope

| Item | Reasoning | Mitigation |
|------|-----------|------------|
| **Re-testing the ~160 existing passing Epic-4 tests** | Strong store/component coverage already exists; this is a gap-backfill, not a re-write | Existing suite runs in CI as regression baseline; this plan only adds NEW rows |
| **Real assistive-technology (screen reader) a11y validation** | jsdom cannot assert real AT/focus/scroll behavior | ARIA roles covered in jsdom (4.2/4.5/4.8); real-AT pass deferred to manual QA |
| **Trash-side of "delete a note open in a tab" (RISK-E4-006)** | The trash/soft-delete mechanics belong to Epic 5 test design | The **tab side** is covered here (`4.E2E-003`); coordinate the trash side with Epic 5 backfill |
| **Global perf budgets (hotkey<150ms, keystroke-to-save<500ms, cold start<1s)** | Inherited from project-context; not new Epic-4 surface | Tracked at system level; only the Epic-4-specific `<50ms` palette filter is in scope |
| **Specta i64→BigInt precision** | Upstream dependency, intentionally parked (user memory) | Monitor specta releases; no workaround tests |

---

## Risk Assessment

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | P | I | Score | Mitigation | Owner | Timeline |
|---------|----------|-------------|---|---|-------|------------|-------|----------|
| RISK-E4-001 | TECH/DATA | **Story 4.4 multi-tab editor switch is THIN-tested on a data-critical async path** — single-`EditorView`+`setState()` swap, `flushSave()`-before-switch, per-tab `EditorState`/scroll/cursor restore, `langCompartment` format swap, and the `switchIdRef` cancellation pattern have only 1 shallow render test. Home of the shipped-then-patched **stale-`editorView`→wrong-tab** bug; a regression could save content to the wrong note or lose unsaved edits. Actively exercised by Epic 5 (deleting a note open in a tab). | 2 | 3 | **6** | Backfill EditorPane switch-flow component tests (`4.4-COMP-002…008`) + `4.E2E-001` smoke | Dev/QA | Before Epic 6 |

### Medium-Priority Risks (Score 3–4)

| Risk ID | Category | Description | P | I | Score | Mitigation | Owner |
|---------|----------|-------------|---|---|-------|------------|-------|
| RISK-E4-002 | TECH | **Zero E2E for the tab/palette/session journey** — real key bindings, IPC, CodeMirror focus, and localStorage round-trip across restart never validated together. Epic 5 retro mandates the first feature E2E (gates Epic 6). | 2 | 2 | **4** | `4.E2E-001` (gating deliverable) | QA |
| RISK-E4-003 | DATA | **Session-restore round-trip (4.9) only unit-tested with mocked `getNote`** — real save→quit→relaunch→restore (skip-deleted, cursor clamp, scroll, workspace fallback) never run end-to-end; Rust config/session commands thin. | 2 | 2 | **4** | `4.E2E-001` + `4.9-UNIT-007` + `4.9-INT-001` | QA/Dev |
| RISK-E4-004 | TECH | **Overlay mutual-exclusion invariant under-tested as a whole** — "overlays don't stack" + "Esc → Layer 0" across search↔palette↔note-list; tested per-store, not as one coordinated invariant via `overlays/manager.ts`. | 2 | 2 | **4** | `4.INT-001` coordinated exclusion + focus-return test | Dev |
| RISK-E4-005 | TECH | **Boundary/identity bugs are the epic's actual bug class** — `splice(NaN)`→0, out-of-bounds `selectedIndex`, stale ref. Index math not covered systematically. | 2 | 2 | **4** | `4.1-UNIT-008` property/boundary sweep | Dev |
| RISK-E4-006 | DATA | **Soft-delete a note open in a tab (Epic 4↔5 interaction)** — orphan-tab foundation exists (4.8 + 4.9) but the live delete-while-open path needs explicit coverage; flagged in Epic 5 retro preview. | 2 | 2 | **4** | `4.E2E-003` (tab side); coordinate trash side w/ Epic 5 | QA |

### Low-Priority Risks (Score 1–2)

| Risk ID | Category | Description | P | I | Score | Action |
|---------|----------|-------------|---|---|-------|--------|
| RISK-E4-007 | PERF | Command-palette `<50ms` fuzzy-filter never benchmarked (met by construction today; no guard, list grows) | 2 | 1 | **2** | DOCUMENT — add `4.5-PERF-001` lightweight guard |
| RISK-E4-008 | TECH | Tab-shortcut **palette-open guard** untested (only search-open guard tested); `Ctrl+W` could fire under palette | 2 | 1 | **2** | DOCUMENT — `4.3-UNIT-006` |
| RISK-E4-009 | TECH | DnD reordering verified only via synthetic `MouseEvent` (no real `DragEvent`); drop-outside-cancel/drag-to-end unverified in real WebView | 2 | 1 | **2** | DOCUMENT — `4.2-COMP-006`, `4.7-COMP-005`; real path via `4.E2E` later |
| RISK-E4-010 | TECH | `EditorView`/`editorViewRef` lifecycle — wrong cleanup ordering across many switches could leak/stale-ref | 1 | 2 | **2** | DOCUMENT — covered indirectly by `4.4-COMP-*` |
| RISK-E4-011 | DATA | localStorage session payload robustness — negative/`NaN`/`Infinity` cursor/scroll, huge tab counts, quota-exceeded uncovered | 1 | 2 | **2** | DOCUMENT — `4.9-UNIT-007` |

### Risk Category Legend

- **TECH** Technical/Architecture · **SEC** Security · **PERF** Performance · **DATA** Data Integrity · **BUS** Business Impact · **OPS** Operations

---

## NFR Planning

**Purpose:** Epic-specific NFR thresholds, planned validation, and evidence for later `nfr-assess`. Not a final evidence audit.

| NFR Category | Requirement / Threshold | Risk Link | Planned Validation | Evidence Needed |
|--------------|-------------------------|-----------|--------------------|-----------------|
| Reliability / Data | `flushSave()` completes before next tab loads; active content saved to the **correct** note; "never leave unsaved state" | RISK-E4-001 | `4.4-COMP-002…007` — assert save-before-swap order, correct-note target, scroll/cursor restore, `switchIdRef` stale-abort | Component test report |
| Reliability | Restart restores tabs/active/cursor/workspace; skip deleted; corrupt→empty (ACs 4-9.1–5) | RISK-E4-003 | `4.E2E-001` real restart round-trip + `4.9-UNIT-007` boundary + `4.9-INT-001` Rust config IPC | E2E run log + cargo/vitest reports |
| Performance | Palette fuzzy filter **`<50ms`** client-side (epic constraint / AC 4-5.2) | RISK-E4-007 | `4.5-PERF-001` timed assertion over full command list; trend if list grows | Perf assertion in component report |
| Maintainability / UX | Overlays never stack; Esc → Layer 0; focus returns to `.cm-content` | RISK-E4-004 | `4.INT-001` coordinated exclusion + focus-return through `overlays/manager.ts` | Integration test report |
| Maintainability / UX (a11y) | `role=tablist/tab`+`aria-selected`; cmdk `combobox/listbox`; note-list `navigation/listbox`; focus traps | — | Existing jsdom role/aria coverage retained | Component reports (jsdom); real-AT deferred to manual QA |
| Security | No new IPC/network; session payload = non-sensitive tab **metadata**, never note content | — | `4.9-UNIT-008` assert serialized session excludes content | Unit assertion |

**Unknown thresholds:** None invented. The only explicit numeric budget is `<50ms` palette filter (met by construction today → RISK-E4-007). Global perf budgets are inherited from project-context and out of this epic's new scope.

---

## Entry Criteria

- [ ] Story specs 4-1…4-9 with ACs available (✅ present)
- [ ] Architecture context loaded (system-level test design + project-context) (✅)
- [ ] Test environment: `vitest` + `cargo test` runnable; `tauri-driver`/WebDriver available for the new E2E (`e2e/run.mjs` harness)
- [ ] Test data: existing Rust temp-DB factories + frontend `resetAllStores()` utility usable for new tests
- [ ] Epic 4 features deployed/buildable on the target branch

## Exit Criteria

- [ ] All P0 tests passing (existing baseline holds — no P0 gaps introduced)
- [ ] All NEW P1 tests passing (or failures triaged) — esp. the Story 4.4 switch-flow set
- [ ] `4.E2E-001` first-feature E2E green (gates Epic 6)
- [ ] Overlay invariant (`4.INT-001`) green
- [ ] No open high-priority bugs surfaced by the backfill
- [ ] RISK-E4-001 mitigation evidence captured for `nfr-assess`

---

## Test Coverage Plan

> **P0/P1/P2/P3 denote priority / risk — NOT execution timing.** Execution cadence is defined
> separately under *Execution Strategy*. Matrix marks ✅ EXISTING vs 🆕 NEW; **NEW = the backfill
> this plan authorizes.** Full per-story matrices (existing + new) live in `test-design-progress.md`;
> below summarizes by priority with the NEW scope enumerated.

### P0 (Critical)

**Criteria:** Blocks core journey + High risk (≥6) + No workaround.

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
|-------------|-----------|-----------|-----------|-------|-------|
| Tab store invariants (open/dedup/close-neighbor/close-last) | Unit | — | ~10 ✅ | Dev | `4.1-UNIT-001…004` existing, solid |
| `createNewNote` flush+create+openTab+load (+ rollback) | Unit | — | ~3 ✅ | Dev | `4.6-UNIT-001` existing |
| Excludes-trashed / dedup behaviors | Unit/Comp | — | existing ✅ | Dev | covered |

**Total NEW P0:** 0 — existing P0 coverage is sufficient; no gaps.

### P1 (High)

**Criteria:** Important features + Medium/high risk + Common workflows.

| Test ID | Requirement | Test Level | Risk Link | Status | Notes |
|---------|-------------|-----------|-----------|--------|-------|
| 4.4-COMP-002 | Switch A→B flushes save A **before** B loads (order asserted) | Component | RISK-E4-001 | 🆕 | data-loss guard |
| 4.4-COMP-003 | Return to B restores `EditorState`+`scrollTop`+cursor | Component | RISK-E4-001 | 🆕 | |
| 4.4-COMP-004 | md ↔ plaintext swaps `langCompartment` per tab | Component | RISK-E4-001 | 🆕 | |
| 4.4-COMP-005 | All tabs closed → editor resets to empty | Component | RISK-E4-001 | 🆕 | |
| 4.4-COMP-006 | `switchIdRef` cancellation: rapid A→B→C, content lands in C not B | Component | RISK-E4-001 | 🆕 | async race |
| 4.4-COMP-007 | Staleness after `getNote` await: never write wrong tab slot | Component | RISK-E4-001 | 🆕 | the shipped-bug shape |
| 4.5-COMP-004 | Ctrl/Cmd+P opens + input auto-focused | Component | RISK-E4-002 | 🆕 | |
| 4.5-COMP-005 | Type → fuzzy filter narrows commands per keystroke | Component | AC 4-5.2 | 🆕 | |
| 4.INT-001 | Overlay invariant: open-one-closes-others; Esc→Layer 0 + focus `.cm-content` | Integration | RISK-E4-004 | 🆕 | via `overlays/manager.ts` |
| 4.E2E-001 | Tab+session journey smoke (New Note→type→2nd note→Ctrl+Tab→quit→relaunch→restored) | E2E | RISK-E4-001/002/003 | 🆕 | **first feature E2E — gates Epic 6** |

**Total NEW P1:** 10 (~16–26 h). Plus ~70 existing P1 across stories (✅ regression baseline).

### P2 (Medium)

**Criteria:** Secondary flows + Low/medium risk + Edge cases.

| Test ID | Requirement | Test Level | Risk Link | Status | Notes |
|---------|-------------|-----------|-----------|--------|-------|
| 4.1-UNIT-008 | Property/boundary sweep across index math (NaN/float/out-of-range) | Unit | RISK-E4-005 | 🆕 | |
| 4.2-COMP-006 | Drag-cancel / dragLeave clears drop indicator | Component | RISK-E4-009 | 🆕 | |
| 4.3-UNIT-006 | Palette-open guard suppresses tab shortcuts | Unit | RISK-E4-008 | 🆕 | |
| 4.4-COMP-008 | `isHydrating` suppresses false auto-save on `setState()` | Component | RISK-E4-001 | 🆕 | |
| 4.5-COMP-006 | Esc returns focus to `.cm-content` | Component | AC 4-5.3 | 🆕 | |
| 4.5-PERF-001 | Fuzzy filter `<50ms` over full command list | Perf | RISK-E4-007 | 🆕 | lightweight guard |
| 4.6-INT-001 | Global Ctrl/Cmd+N + Ctrl/Cmd+Shift+T handlers (overlay+repeat guards) | Integration | RISK-E4-004 | 🆕 | CaptureWindow wiring |
| 4.7-COMP-005 | Drop outside tab bar → no reorder, indicator removed | Component | RISK-E4-009 | 🆕 | |
| 4.8-COMP-005 | Already-open note → activates existing tab (dedup), no duplicate | Component | I/O gap | 🆕 | |
| 4.9-UNIT-007 | Boundary: negative/NaN/Infinity cursor/scroll clamped on restore | Unit | RISK-E4-011 | 🆕 | |
| 4.9-UNIT-008 | Session payload NEVER contains note content (security guard) | Unit | NFR-SEC | 🆕 | |
| 4.9-INT-001 | (Rust) `get_config`/`update_config` IPC round-trip + partial-update validation | Integration | RISK-E4-003 | 🆕 | backend thin |
| 4.E2E-002 | Command palette journey: Ctrl/Cmd+P→filter→Enter→close+focus | E2E | RISK-E4-002 | 🆕 | |
| 4.E2E-003 | Delete a note open in a tab → tab closes/flags; restart skips it | E2E | RISK-E4-006 | 🆕 | coordinate w/ Epic 5 |

**Total NEW P2:** 14 (~12–20 h).

### P3 (Low)

**Criteria:** Nice-to-have + Exploratory + Benchmarks. **None in this backfill** — the `<50ms`
palette guard is scoped as a P2 functional assertion rather than a standalone benchmark.

---

## Execution Strategy

**Philosophy:** Run everything in PRs if the suite stays <15 min; defer only genuinely
expensive/long-running suites to nightly. (Tauri E2E via `tauri-driver` is the only meaningfully
slow surface here.)

| Trigger | Suite | Target |
|---------|-------|--------|
| **PR** | All functional `vitest` + `cargo test` (existing + NEW unit/component/integration incl. `4.4-COMP-*`, `4.INT-001`, `4.9-INT-001`) · `4.5-PERF-001` (fast) · `4.E2E-001` smoke | < 15 min |
| **Nightly** | Full E2E incl. `4.E2E-002` + `4.E2E-003` (delete-open-tab) · any slower seeded runs | < 30 min |
| **Weekly / pre-Epic-6** | Confirm RISK-E4-001 (4.4 switch-flow) green + `4.E2E-001` green — the gating obligations | — |

---

## Resource Estimates

Backfill (🆕 NEW) only — interval ranges, no false precision.

| Priority | Count | Total Hours | Notes |
|----------|-------|-------------|-------|
| P0 | 0 | — | No gaps; existing P0 coverage sufficient |
| P1 | 10 | ~16–26 h | Driver: 4.4 EditorPane switch-flow harness (real/mocked CodeMirror, async race + staleness) + first E2E scaffold (tauri-driver) + overlay-invariant test |
| P2 | 14 | ~12–20 h | Component/unit edge cases, Rust config IT, 2 more E2E — mostly mechanical |
| **Total** | **24** | **~28–46 h (~1–1.5 weeks)** | On top of ~160 existing tests |

### Prerequisites

**Test Data:** existing Rust temp-DB factories (per `db_tests.rs` pattern); frontend `resetAllStores()` + DOM cleanup (Epic 3 retro item 2).
**Tooling:** `tauri-driver`/WebDriver via `e2e/run.mjs` (new E2E surface — first use beyond capture/auto-save/window); `vitest` + RTL; `cargo test`.
**Environment:** buildable Tauri app on the target branch; jsdom limitations acknowledged (no real `DragEvent`/`ResizeObserver`/focus — real-path validation pushed to E2E/manual QA).

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate:** 100% (existing baseline must hold)
- **P1 pass rate:** ≥95% (waivers required) — including the NEW Story 4.4 switch-flow set
- **P2/P3 pass rate:** ≥90% (informational, nightly report)
- **High-risk mitigation:** RISK-E4-001 backfill complete & green **before Epic 6 starts**

### Coverage Targets (from system-level)

- TS stores/utils ≥ 75% · Rust service ≥ 80% · critical paths ≥ 80%

### Non-Negotiable Requirements

- [ ] RISK-E4-001 (Story 4.4 switch-flow backfill) green before Epic 6
- [ ] `4.E2E-001` first-feature E2E passes — satisfies `epic-5-retro-item-1` first-feature-E2E commitment (gates Epic 6); breaks the 4-epic zero-E2E streak
- [ ] Overlay invariant (`4.INT-001`) green
- [ ] Session payload excludes note content (`4.9-UNIT-008`)
- [ ] Planned NFR evidence exists, or `nfr-assess` records documented CONCERNS/waivers
- **Gate posture: CONCERNS** (no score-9 blockers) → clears to PASS once RISK-E4-001 + `4.E2E-001` land

---

## Mitigation Plans

### RISK-E4-001: Thin coverage on the data-critical multi-tab switch path (Score: 6)

**Mitigation Strategy:**
1. Build an EditorPane test harness that drives real tab switches (`4.4-COMP-002…008`): assert `flushSave()` resolves **before** the next tab's state loads; assert the active tab's content is saved to the **correct** `noteId`.
2. Cover restore fidelity: returning to a previously-viewed tab restores `EditorState`, `scrollTop`, and cursor (clamped).
3. Cover the `switchIdRef` cancellation pattern and post-`getNote` staleness — rapid A→B→C and switch-during-fetch must never write to the wrong tab slot (the exact shipped-then-patched bug).
4. Add `4.E2E-001` to validate the whole journey end-to-end in a real WebView (real focus, real IPC, real restart).

**Owner:** Dev/QA · **Timeline:** Before Epic 6 · **Status:** Planned
**Verification:** All `4.4-COMP-*` green in CI; `4.E2E-001` green; no wrong-tab/unsaved-loss reproduction.

### RISK-E4-002 / 003: E2E gap + session round-trip (Score: 4 each — gating deliverable)

**Mitigation Strategy:** Stand up the first feature E2E (`4.E2E-001`) exercising New Note → tab → switch → quit → relaunch → restore against real SQLite + localStorage; add Rust `get_config`/`update_config` IPC round-trip + partial-update validation (`4.9-INT-001`) and restore boundary tests (`4.9-UNIT-007`).
**Owner:** QA/Dev · **Timeline:** Before Epic 6 · **Status:** Planned
**Verification:** `4.E2E-001` green; cargo config IT green; boundary unit tests green.

---

## Assumptions and Dependencies

### Assumptions

1. Epic 4 source is stable on the target branch (no behavioral changes during backfill — tests pin current intended behavior).
2. `tauri-driver`/WebDriver E2E can run in CI (Linux) within the nightly window; the PR smoke (`4.E2E-001`) fits the <15-min budget or is gated to a fast path.
3. jsdom limits (no real `DragEvent`/`ResizeObserver`/focus/scroll) are accepted for component tests; real-path concerns are pushed to E2E/manual QA.
4. The `overlays/manager.ts` registry is the single coordination point for overlay exclusion (introduced during Epic 4 cleanup).

### Dependencies

1. E2E harness (`e2e/run.mjs`) extended to cover tabs/palette/session — required before `4.E2E-001/002/003`.
2. Coordination with **Epic 5 test design** on RISK-E4-006 (delete-note-open-in-tab) so the trash side and tab side aren't double-covered or dropped.
3. Epic 4 retro Action Items 1 & 2 (startup-config apply, toggle concurrency guard) already landed (DW-80/DW-81) — `4.6-UNIT-003` covers `applyStartupConfig`; no extra backfill needed there.

### Risks to Plan

- **Risk:** Real-CodeMirror behavior is hard to assert in jsdom, inflating `4.4-COMP-*` effort.
  - **Impact:** P1 estimate could push toward the upper bound (~26 h).
  - **Contingency:** Move the deepest fidelity assertions (scroll/focus) into `4.E2E-001` and keep component tests at the logic/order level.

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
|-------------------|--------|------------------|
| **EditorPane / editor store** | Tab-switch state-swap touches the core editing path | Existing editor + auto-save tests must stay green; `4.4-COMP-*` added |
| **Overlays (search ↔ palette ↔ note-list)** | Shared `overlays/manager.ts` coordination | `4.INT-001` + existing per-store exclusion tests |
| **Session persistence / workspace store** | Restore drives EditorPane via existing effect | `4.9-*` + workspace store tests; Rust config IT |
| **CaptureWindow (global hotkeys)** | Ctrl/Cmd+P/N/B/Shift+T + Ctrl+Tab/W bindings | `4.6-INT-001` + keyboard-nav tests |
| **Epic 5 (trash)** | Deleting a note open in a tab | `4.E2E-003` (tab side) — coordinate trash side with Epic 5 |

---

## Follow-on Workflows (Manual)

- Run `*atdd` to scaffold the P1 Story-4.4 switch-flow tests red-first (separate workflow; not auto-run).
- Run `*automate` to expand the NEW coverage once the harness exists.
- Run `*nfr-assess` after the backfill lands to convert planned evidence (RISK-E4-001, palette `<50ms`, session round-trip) into PASS/CONCERNS/FAIL.
- **Next in the backfill range:** Epic 5 test design (`epic-5-retro-item-1`) — coordinate RISK-E4-006.

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — risk classification framework
- `probability-impact.md` — P×I scoring methodology
- `test-levels-framework.md` — test-level selection (Unit/Integration/Component/E2E)
- `test-priorities-matrix.md` — P0–P3 prioritization
- `nfr-criteria.md` — NFR planning categories

### Related Documents

- Story specs: `implementation-artifacts/spec-4-1…spec-4-9`
- Epic context: `implementation-artifacts/epic-4-context.md`
- Epic 4 retro: `implementation-artifacts/epic-4-retro-2026-06-12.md`
- Architecture: `test-artifacts/test-design/test-design-architecture.md` + `test-design-qa.md`
- Project context: `project-context.md`
- Prior backfill: `test-artifacts/test-design-epic-3.md`
- Working notes: `test-artifacts/test-design-progress.md`

---

**Generated by:** BMad TEA Agent — Test Architect Module
**Workflow:** `bmad-testarch-test-design` (Epic-Level)
**Backfill range progress (epic-5-retro-item-1):** Epic 3 ✅ · **Epic 4 ✅ (this doc)** · Epic 5 ⏳ pending
