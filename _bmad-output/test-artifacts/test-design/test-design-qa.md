---
type: test-design-qa
scope: system-level
project: notey
version: 1.0
date: 2026-04-03
status: draft
author: QA/Test Architecture
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/test-artifacts/test-design/test-design-architecture.md
---

# Test Design for QA — Notey

**Purpose:** Test execution recipe for QA. Defines what to test, how to test it, and what QA needs from other teams.

| Field | Value |
|-------|-------|
| Date | 2026-04-03 |
| Author | QA/Test Architecture |
| Status | Draft |
| Project | Notey — floating, keyboard-driven developer notepad |
| Stack | Tauri v2 (Rust + React/TypeScript), SQLite + FTS5, CLI companion, cross-platform |

**Related:** See `test-design-architecture.md` for testability concerns, architectural blockers, and risk mitigation plans.

---

## Executive Summary

**Scope:** System-level test design for Notey MVP covering all 58 functional requirements, 23 non-functional requirements, and 57 UX design requirements across the Rust backend, React frontend, CLI companion, and cross-platform behavior.

**Risk Summary:**

- Total Risks: 12 (5 high-priority score >= 6, 2 medium, 5 low)
- No blockers (score 9). Architecture supports testing well overall.
- Critical Categories: DATA (crash recovery, FTS5 sync), SEC (CLI injection), TECH (E2E tooling, WebView divergence)

**Coverage Summary:**

- P0 tests: 15 (critical paths, security, data integrity)
- P1 tests: 28 (important features, CLI integration, component tests)
- P2 tests: 21 (secondary features, accessibility, edge cases)
- P3 tests: 13 (benchmarks, visual regression, manual QA)
- **Total**: 77 tests (~75-115 hours, ~9-14.5 weeks with 1 QA engineer)

---

## Not in Scope

**Components and features explicitly excluded from this test plan:**

| Item | Reasoning | Mitigation |
|------|-----------|------------|
| **Growth/Phase 2 features** (clipboard capture, Wayland native hotkeys, Boolean search, vim keybindings, tagging) | Deferred per PRD | Tested when implemented |
| **Dynamic plugin loading** | Phase 3 vision | Architecture supports trait-based extension points |
| **Cloud sync, encryption at rest** | Phase 3 vision | No network, no encryption in v1 |
| **Code signing validation** | Deferred per architecture | Target audience can bypass Gatekeeper/SmartScreen |

**Note:** Items listed here have been reviewed and accepted as out-of-scope by QA, Dev, and PM.

---

## Dependencies & Test Blockers

**CRITICAL:** QA cannot proceed without these items from other teams.

### Backend/Architecture Dependencies (Pre-Implementation)

**Source:** See Architecture doc (`test-design-architecture.md`) TC-3 and TC-2 for detailed mitigation plans.

1. **IPC Test Harness** — Dev Lead — Pre-implementation
   - QA needs a Rust test harness that spawns the IPC server without the full Tauri runtime
   - Blocks all CLI integration testing (P1-INT-001 through P1-INT-008)

2. **CI Pipeline with xvfb + multi-platform matrix** — DevOps — Sprint 1
   - QA needs a headed Linux environment for E2E test execution
   - Blocks E2E test execution in CI (P0-E2E-001, P1-E2E-001, P1-E2E-002)

### QA Infrastructure Setup (Pre-Implementation)

1. **Test Data Factories** — QA
   - SQLite in-memory database fixtures with note/workspace factory functions
   - Auto-cleanup for parallel test safety

2. **Test Environments** — QA
   - Local: `cargo test` + `vitest`
   - CI: GitHub Actions matrix (Linux, macOS, Windows)

**Example factory patterns:**

```rust
// src-tauri/tests/helpers/factories.rs
pub fn create_test_note(overrides: Option<NoteInput>) -> NoteInput {
    let defaults = NoteInput {
        title: Some(format!("Test Note {}", uuid::Uuid::new_v4())),
        content: "Test content".to_string(),
        format: NoteFormat::Markdown,
        workspace_id: None,
    };
    // merge overrides...
    defaults
}
```

```typescript
// src/test-utils/factories.ts
export function createTestNote(overrides?: Partial<Note>): Note {
  return {
    id: Math.floor(Math.random() * 10000),
    title: `Test Note ${crypto.randomUUID().slice(0, 8)}`,
    content: 'Test content',
    format: 'markdown',
    workspaceId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isTrashed: false,
    ...overrides,
  };
}
```

---

## Risk Assessment

**Note:** Full risk details, mitigation plans, and ownership in `test-design-architecture.md`. This section summarizes risks relevant to QA test planning.

### High-Priority Risks (Score >= 6)

| Risk ID | Category | Description | Score | QA Test Coverage |
|---------|----------|-------------|-------|------------------|
| **RISK-001** | TECH | WebView cross-platform behavioral divergence | **6** | Visual regression tests on CI artifacts |
| **RISK-002** | DATA | Data loss during crash or power loss | **6** | WAL crash recovery integration tests (P0-INT-002, P0-INT-003) |
| **RISK-005** | OPS | macOS accessibility permission blocks hotkey on first install | **6** | First-run onboarding E2E test (P1-E2E-002) |
| **RISK-006** | SEC | CLI input injection (path traversal, oversized stdin) | **6** | Injection boundary unit tests + fuzzing (P0-UNIT-004 through P0-INT-008) |
| **RISK-007** | TECH | Tauri E2E test tooling immaturity | **6** | Minimize E2E to 3 journeys, maximize unit/integration |

### Medium/Low-Priority Risks

| Risk ID | Category | Description | Score | QA Test Coverage |
|---------|----------|-------------|-------|------------------|
| RISK-003 | DATA | FTS5 index desync from content table | 4 | Trigger validation integration tests (P0-INT-004, P0-INT-005) |
| RISK-004 | PERF | 150ms hotkey-to-visible regression | 4 | Instrumented benchmarks, weekly cadence (P3-BENCH-001) |
| RISK-008 through RISK-012 | Various | Low-priority (Wayland, hotkey conflicts, socket permissions, multi-monitor, CI flakiness) | 1-3 | Documented, monitored, or manual QA |

---

## Entry Criteria

**QA testing cannot begin until ALL of the following are met:**

- [ ] All requirements and assumptions agreed upon by QA, Dev, PM
- [ ] Test environments provisioned (`cargo test` + `vitest` work locally, CI pipeline ready)
- [ ] Test data factories ready (Rust + TypeScript)
- [ ] Pre-implementation blockers resolved (IPC harness, CI xvfb)
- [ ] Feature deployed to test environment (stories implement tests alongside code)

## Exit Criteria

**Testing phase is complete when ALL of the following are met:**

- [ ] All P0 tests passing (100%)
- [ ] All P1 tests passing or failures triaged (>= 95%)
- [ ] No open P0/P1 severity bugs
- [ ] Test coverage agreed as sufficient by Dev Lead
- [ ] Performance benchmarks within 2x of NFR targets

---

## Test Coverage Plan

**IMPORTANT:** P0/P1/P2/P3 = **priority and risk level** (what to focus on if time-constrained), NOT execution timing. See "Execution Strategy" for when tests run.

### P0 (Critical) — 15 tests

**Criteria:** Blocks core functionality + High risk (>= 6) + No workaround + Affects majority of users

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| **P0-UNIT-001** | Note CRUD returns correct data (FR1-5) | Unit (Rust) | — | Core data path |
| **P0-UNIT-002** | Soft-delete sets is_trashed + deleted_at (FR5) | Unit (Rust) | — | Data integrity |
| **P0-UNIT-003** | Permanent delete removes note + FTS5 entry (FR7) | Unit (Rust) | — | Irreversible action |
| **P0-UNIT-004** | CLI rejects path traversal input (NFR10) | Unit (Rust) | RISK-006 | Injection prevention |
| **P0-UNIT-005** | CLI enforces 1MB max note size (NFR10) | Unit (Rust) | RISK-006 | Stdin protection |
| **P0-UNIT-006** | canonicalize() rejects escape paths (NFR10) | Unit (Rust) | RISK-006 | Path traversal |
| **P0-INT-001** | Auto-save persists within 500ms debounced (NFR2) | Integration (Rust) | RISK-002 | Data integrity |
| **P0-INT-002** | DB survives process kill during write (NFR14) | Integration (Rust) | RISK-002 | WAL recovery |
| **P0-INT-003** | DB passes integrity_check after power loss sim (NFR15) | Integration (Rust) | RISK-002 | Crash-safe |
| **P0-INT-004** | FTS5 stays synced after INSERT/UPDATE/DELETE (FR11) | Integration (Rust) | RISK-003 | Trigger sync |
| **P0-INT-005** | FTS5 search correct after content update | Integration (Rust) | RISK-003 | Search accuracy |
| **P0-INT-006** | Tauri ACL rejects unauthorized commands (NFR8) | Integration (Rust) | — | Default-deny |
| **P0-INT-007** | IPC socket created with 0600 permissions (NFR11) | Integration (Rust) | RISK-010 | User isolation |
| **P0-INT-008** | Parameterized queries prevent SQL injection | Integration (Rust) | RISK-006 | OWASP |
| **P0-E2E-001** | Capture loop: hotkey -> type -> save -> Esc -> focus restored | E2E | RISK-007 | Core product loop |

**Total P0:** 15 tests (6 unit, 8 integration, 1 E2E)

---

### P1 (High) — 28 tests

**Criteria:** Important features + Medium risk (3-4) + Common workflows + Workaround exists but difficult

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| **P1-UNIT-001** | FTS5 fuzzy search returns ranked results (FR11-13) | Unit (Rust) | — | Core retrieval |
| **P1-UNIT-002** | Search scoped to workspace (FR12) | Unit (Rust) | — | Workspace isolation |
| **P1-UNIT-003** | Workspace detection via git2 (FR29) | Unit (Rust) | — | Core differentiator |
| **P1-UNIT-004** | Workspace fallback for non-git directories (FR31) | Unit (Rust) | — | Graceful degradation |
| **P1-UNIT-005** | Note format toggle persists (FR9) | Unit (Rust) | — | |
| **P1-UNIT-006** | Migration applies on fresh + existing DB | Unit (Rust) | — | Schema evolution |
| **P1-UNIT-007** | NoteyError serializes across IPC | Unit (Rust) | — | Error propagation |
| **P1-UNIT-008** | useEditorStore tab state (FR23-26) | Unit (Vitest) | — | Multi-tab |
| **P1-UNIT-009** | useSearchStore query + results | Unit (Vitest) | — | State management |
| **P1-UNIT-010** | useWorkspaceStore switches workspace | Unit (Vitest) | — | State management |
| **P1-INT-001** | CLI `notey add "text"` creates note via IPC (FR2) | Integration (Rust) | — | |
| **P1-INT-002** | CLI `notey add --stdin` from pipe (FR3) | Integration (Rust) | — | Pipeline |
| **P1-INT-003** | CLI `notey search "query"` returns matches (FR14) | Integration (Rust) | — | |
| **P1-INT-004** | CLI `notey list --workspace` filters (FR15) | Integration (Rust) | — | |
| **P1-INT-005** | CLI exits code 2 when app not running (FR38) | Integration (Rust) | — | Error handling |
| **P1-INT-006** | CLI --json outputs valid JSON (scripting) | Integration (Rust) | — | |
| **P1-INT-007** | IPC valid request -> success response | Integration (Rust) | — | Protocol |
| **P1-INT-008** | IPC malformed request -> error response | Integration (Rust) | — | Protocol |
| **P1-INT-009** | Export to Markdown with YAML frontmatter (FR49) | Integration (Rust) | — | |
| **P1-INT-010** | Export to JSON (FR50) | Integration (Rust) | — | |
| **P1-INT-011** | Search <100ms with 1K notes (NFR3) | Integration (Rust) | RISK-004 | Performance |
| **P1-INT-012** | Window show/hide lifecycle (hidden window) | Integration (Rust) | — | NFR1 foundation |
| **P1-COMP-001** | EditorPane renders CodeMirror + Markdown (FR10) | Component (Vitest) | — | |
| **P1-COMP-002** | SearchOverlay results with highlighted matches | Component (Vitest) | — | |
| **P1-COMP-003** | CommandPalette fuzzy matches + executes (FR27-28) | Component (Vitest) | — | |
| **P1-COMP-004** | TabBar keyboard nav (Ctrl+Tab, Ctrl+1-9) | Component (Vitest) | — | |
| **P1-E2E-001** | CLI Power User Journey (Kai): stdin -> workspace -> search | E2E | RISK-007 | Journey 1 |
| **P1-E2E-002** | First-Run Journey (Marcus): install -> onboard -> hotkey -> workspace | E2E | RISK-005 | Journey 3 |

**Total P1:** 28 tests (10 unit, 12 integration, 4 component, 2 E2E)

---

### P2 (Medium) — 21 tests

**Criteria:** Secondary features + Low risk (1-2) + Edge cases + Regression prevention

| Test ID | Requirement | Test Level | Risk Link | Notes |
|---------|-------------|------------|-----------|-------|
| **P2-UNIT-001** | Restore from trash (FR6) | Unit (Rust) | — | |
| **P2-UNIT-002** | Search ranking by relevance (FR13) | Unit (Rust) | — | |
| **P2-UNIT-003** | Config TOML roundtrip (FR47) | Unit (Rust) | — | |
| **P2-UNIT-004** | Hotkey conflict detection (FR18) | Unit (Rust) | — | |
| **P2-UNIT-005** | ISO 8601 date format enforcement | Unit (Rust) | — | |
| **P2-INT-001** | Workspace switch filters note list | Integration (Vitest) | — | |
| **P2-INT-002** | All-workspaces unscoped view (FR34) | Integration (Vitest) | — | |
| **P2-INT-003** | Auto-start persists across reboot (FR41-42) | Integration (Rust) | — | |
| **P2-INT-004** | System tray show/quit (FR40) | Integration (Rust) | — | |
| **P2-INT-005** | Config changes persist to TOML (FR44-47) | Integration (Rust) | — | |
| **P2-INT-006** | Soft-delete recoverable 30 days (NFR16) | Integration (Rust) | — | |
| **P2-INT-007** | Manual workspace reassignment (FR35) | Integration (Rust) | — | |
| **P2-COMP-001** | Theme toggle CSS variable swap | Component (Vitest) | — | |
| **P2-COMP-002** | StatusBar workspace + note count | Component (Vitest) | — | |
| **P2-COMP-003** | SaveIndicator state transitions | Component (Vitest) | — | |
| **P2-COMP-004** | NoteListPanel slide + Esc dismiss | Component (Vitest) | — | |
| **P2-COMP-005** | Empty state patterns | Component (Vitest) | — | |
| **P2-COMP-006** | Tab reordering | Component (Vitest) | — | |
| **P2-A11Y-001** | All elements reachable via Tab (NFR21) | Component (Vitest) | — | |
| **P2-A11Y-002** | Focus indicators 2px/3:1 contrast (NFR22) | Component (Vitest) | — | |
| **P2-A11Y-003** | ARIA roles on overlays, tabs, search (UX-DR41-47) | Component (Vitest) | — | |

**Total P2:** 21 tests (5 unit, 7 integration, 9 component)

---

### P3 (Low) — 13 tests

**Criteria:** Performance benchmarks + Exploratory + Visual regression + Manual validation

| Test ID | Requirement | Test Level | Notes |
|---------|-------------|------------|-------|
| **P3-BENCH-001** | Hotkey-to-visible <150ms (NFR1) | Benchmark (Rust) | Instrumented |
| **P3-BENCH-002** | Search <100ms with 10K notes (NFR3) | Benchmark (Rust) | |
| **P3-BENCH-003** | Cold start <1s (NFR4) | Benchmark (Rust) | |
| **P3-BENCH-004** | Idle memory <80MB (NFR5) | Benchmark | |
| **P3-BENCH-005** | Installer <10MB (NFR6) | CI check | |
| **P3-BENCH-006** | Export 10K notes <30s (NFR20) | Benchmark (Rust) | |
| **P3-BENCH-007** | Search degradation <=2x from 1K to 10K (NFR18) | Benchmark (Rust) | |
| **P3-EDGE-001** | Monorepo nested git repo detection | Unit (Rust) | Edge case |
| **P3-EDGE-002** | Concurrent CLI commands during save | Integration (Rust) | Concurrency |
| **P3-EDGE-003** | Cross-platform visual consistency | Visual Regression | RISK-001 |
| **P3-MANUAL-001** | Multi-monitor positioning | Manual QA | |
| **P3-MANUAL-002** | Wayland XWayland hotkey fallback | Manual QA | |
| **P3-MANUAL-003** | macOS accessibility grant flow | Manual QA | |

**Total P3:** 13 tests (7 benchmark, 1 unit, 1 integration, 1 visual regression, 3 manual)

---

## Execution Strategy

**Philosophy:** Run functional tests in every PR for fast feedback. Reserve expensive benchmarks and cross-platform runs for nightly and weekly cadences. This is a desktop app using `cargo test` + Vitest, not a web app using Playwright.

| Trigger | Suite | Target Time | Purpose |
|---------|-------|-------------|---------|
| **PR** | P0+P1 functional: `cargo test` + `vitest` + E2E capture loop | < 12 min | Fast feedback |
| **Nightly** | Full P0-P2 + all E2E journeys + visual regression | < 30 min | Full regression |
| **Weekly** | P3 benchmarks (10K notes, timing, memory) + full E2E all platforms | < 45 min | Performance + platform parity |
| **Pre-release** | All P0-P3 + manual QA checklist | < 60 min | Release readiness |

---

## QA Effort Estimate

**QA test development effort only** (excludes DevOps pipeline work, backend IPC harness):

| Priority | Count | Effort Range | Notes |
|----------|-------|--------------|-------|
| P0 | 15 | ~2.5-4 weeks | IPC harness setup is biggest cost |
| P1 | 28 | ~3.5-5.5 weeks | CLI integration + component tests |
| P2 | 21 | ~2-3 weeks | Straightforward component + integration |
| P3 | 13 | ~1-2 weeks | Benchmarks need harness, manual needs checklists |
| **Total** | **77** | **~9-14.5 weeks** | **1 QA engineer, full-time. Tests written alongside stories.** |

**Assumptions:**

- Includes test design, implementation, debugging, CI integration
- Excludes ongoing maintenance (~10% effort)
- Assumes test infrastructure (factories, fixtures, IPC harness) ready before QA starts

---

## Interworking & Regression

**Services and components impacted — regression scope for each integration boundary:**

| Service/Component | Impact | Regression Scope | Validation Steps |
|-------------------|--------|------------------|------------------|
| **Tauri IPC** | Frontend <-> Rust backend | All command handler tests | Verify tauri-specta bindings match |
| **SQLite/FTS5** | Note CRUD -> search index | All FTS5 trigger tests | Verify index consistency after CRUD |
| **CLI binary** | Separate crate, IPC to app | All CLI integration tests | Verify protocol compliance |
| **Platform abstraction** | OS-specific hotkey/tray/autostart | Unit tests with mock traits | Verify trait implementations per platform |

**Regression test strategy:**

- All P0 + P1 tests must pass before any PR merges
- Nightly run catches P2 regressions within 24 hours
- Cross-platform matrix (Linux, macOS, Windows) validates platform abstraction parity

---

## Appendix A: Code Examples & Tagging

**Priority tags for selective execution.** Convention: include `@p0`, `@p1`, `@p2`, `@p3` in test names or describe blocks.

### Rust (cargo test)

```rust
// src-tauri/src/services/note_service.rs
#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_create_note_returns_correct_data() { // @p0
        let conn = Connection::open_in_memory().unwrap();
        apply_migrations(&conn).unwrap();
        let input = create_test_note(None);
        let note = NoteService::create(&conn, input.clone()).unwrap();
        assert_eq!(note.content, input.content);
        assert!(!note.is_trashed);
    }
}
```

### TypeScript (Vitest)

```typescript
// src/features/editor/store.test.ts
import { describe, it, expect } from 'vitest';
import { useEditorStore } from './store';

describe('useEditorStore @p1', () => {
  it('manages active tab state', () => {
    const store = useEditorStore.getState();
    store.setActiveTab(1);
    expect(useEditorStore.getState().activeTabId).toBe(1);
  });
});
```

### Running by priority

```bash
# Run P0 Rust tests (naming convention)
cargo test p0

# Run P0 TypeScript tests
npx vitest --grep p0

# Run all functional tests in PR
cargo test && npx vitest

# Run benchmarks (weekly)
cargo bench
```

---

## Appendix B: Knowledge Base References

- **Risk Governance:** `risk-governance.md` — Risk scoring methodology (probability x impact matrix)
- **Test Priorities Matrix:** `test-priorities-matrix.md` — P0-P3 criteria definitions
- **Test Levels Framework:** `test-levels-framework.md` — Unit vs Integration vs E2E selection guidance
- **Test Quality:** `test-quality.md` — Definition of Done (no hard waits, <300 lines, <1.5 min per test)
- **Probability-Impact:** `probability-impact.md` — Scoring reference for risk assessment

---

**Generated by:** BMad TEA Agent
**Workflow:** `bmad-testarch-test-design`
**Version:** 4.0 (BMad v6)
