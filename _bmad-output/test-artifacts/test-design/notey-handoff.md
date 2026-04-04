---
title: 'TEA Test Design → BMAD Handoff Document'
version: '1.0'
workflowType: 'testarch-test-design-handoff'
inputDocuments:
  - _bmad-output/test-artifacts/test-design/test-design-architecture.md
  - _bmad-output/test-artifacts/test-design/test-design-qa.md
sourceWorkflow: 'testarch-test-design'
generatedBy: 'TEA Master Test Architect'
generatedAt: '2026-04-03'
projectName: 'notey'
---

# TEA Test Design → BMAD Handoff Document

**Project:** Notey — floating, keyboard-driven developer notepad

This document bridges TEA test design outputs with BMAD's epic/story decomposition workflow. It provides the quality requirements, risk mappings, and test scenario references that BMAD agents must consume when creating epics and stories.

---

## 1. TEA Artifacts Inventory

| Artifact | Path | Provides |
|---|---|---|
| Test Design (Architecture) | `_bmad-output/test-artifacts/test-design/test-design-architecture.md` | Epic quality requirements, story acceptance criteria |
| Test Design (QA) | `_bmad-output/test-artifacts/test-design/test-design-qa.md` | Story test requirements, execution recipe |
| Risk Assessment | Embedded in both documents | Epic risk classification, story priority |
| Coverage Strategy | Embedded in QA doc | Story test requirements |

---

## 2. Epic-Level Integration Guidance

### 2.1 Risk References

P0/P1 risks serve as epic-level quality gates:

- **RISK-002** (Data loss, Score 6) — Epic covering Note CRUD and database layer must include crash recovery tests as acceptance criteria.
- **RISK-006** (CLI injection, Score 6) — Epic covering CLI binary must include input validation tests as acceptance criteria.
- **RISK-007** (E2E tooling, Score 6) — All epics must favor unit/integration tests over E2E. Only 3 E2E journeys total across all epics.

### 2.2 Quality Gates Per Epic

- P0 tests from the epic must pass at **100%** before story completion.
- P1 tests must pass at **≥95%**.
- No open high-severity bugs in the epic's scope.
- Performance benchmarks tracked for perf-sensitive stories.

---

## 3. Story-Level Integration Guidance

### 3.1 P0/P1 Test Scenarios → Story Acceptance Criteria

| Story Scope | Required Test Scenarios |
|---|---|
| Note CRUD service | P0-UNIT-001, P0-UNIT-002, P0-UNIT-003, P0-INT-001 |
| FTS5 search | P0-INT-004, P0-INT-005, P1-UNIT-001, P1-UNIT-002 |
| CLI binary | P0-UNIT-004, P0-UNIT-005, P0-UNIT-006, P0-INT-008 |
| IPC socket server | P0-INT-007, P1-INT-001 through P1-INT-008 |
| Global hotkey + window management | P0-E2E-001, P1-INT-012 |
| Export | P1-INT-009, P1-INT-010 |
| Onboarding | P1-E2E-002 |
| Workspace detection | P1-UNIT-003, P1-UNIT-004 |

### 3.2 Data-TestId Requirements

Stories that implement UI components must include these `data-testid` attributes:

**Editor:**
- `data-testid="editor-pane"`
- `data-testid="tab-bar"`
- `data-testid="tab-{id}"`

**Search:**
- `data-testid="search-overlay"`
- `data-testid="search-input"`
- `data-testid="search-result-{id}"`

**Status:**
- `data-testid="status-bar"`
- `data-testid="save-indicator"`
- `data-testid="workspace-name"`

**Command Palette:**
- `data-testid="command-palette"`
- `data-testid="command-input"`

**Onboarding:**
- `data-testid="onboarding-overlay"`
- `data-testid="hotkey-display"`

---

## 4. Risk-to-Story Mapping

| Risk ID | Category | Score | Maps to Epic/Story | Test Type |
|---|---|---|---|---|
| RISK-001 | TECH | 6 | Cross-platform polish epic | E2E + Visual |
| RISK-002 | DATA | 6 | Database layer / Note CRUD stories | Integration |
| RISK-003 | DATA | 4 | FTS5 search story | Integration |
| RISK-004 | PERF | 4 | Window management / hotkey story | Benchmark |
| RISK-005 | OPS | 6 | Onboarding / first-run story | E2E |
| RISK-006 | SEC | 6 | CLI binary story | Unit + Integration |
| RISK-007 | TECH | 6 | All epics (test strategy constraint) | Unit + Integration |

---

## 5. Workflow Sequence

```
1. TEA Test Design (TD) → produces this handoff document
2. BMAD Create Epics & Stories → consumes this handoff, embeds quality requirements
3. TEA ATDD (AT) → generates acceptance tests per story
4. BMAD Implementation → developers implement with test-first guidance
5. TEA Automate (TA) → generates full test suite
6. TEA Trace (TR) → validates coverage completeness
```

---

## 6. Phase Transition Quality Gates

| Transition | Gate Criteria |
|---|---|
| Test Design → Epic/Story Creation | All P0 risks have mitigation strategy (5/5 complete) |
| Epic/Story Creation → ATDD | Stories have acceptance criteria from test design |
| ATDD → Implementation | Failing acceptance tests exist for P0/P1 scenarios |
| Implementation → Test Automation | All acceptance tests pass |
| Test Automation → Release | Trace matrix shows ≥80% coverage of P0/P1 requirements |
