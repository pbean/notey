---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-04-03'
status: complete
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/epics.md
  - resources/knowledge/adr-quality-readiness-checklist.md
  - resources/knowledge/test-levels-framework.md
  - resources/knowledge/risk-governance.md
  - resources/knowledge/test-quality.md
  - resources/knowledge/probability-impact.md
---

## Step 1: Mode Detection

- **Mode:** System-Level
- **Reason:** User chose System-Level (A). All prerequisites confirmed — PRD, Architecture, and Epics available.
- **Prerequisites:**
  - PRD: `_bmad-output/planning-artifacts/prd.md` ✅
  - Architecture: `_bmad-output/planning-artifacts/architecture.md` ✅
  - Epics: `_bmad-output/planning-artifacts/epics.md` ✅ (supplementary)

## Step 2: Context Loading

- **Configuration:** tea_use_playwright_utils=true, tea_use_pactjs_utils=false, tea_pact_mcp=none, tea_browser_automation=auto, test_stack_type=auto
- **Detected Stack:** fullstack (Rust + React/TypeScript, Tauri v2)
- **Testing Framework (from architecture):** Vitest (frontend), cargo test (Rust), WebDriver/tauri-driver (E2E)
- **Artifacts Loaded:** PRD (58 FRs, 23 NFRs, 57 UX-DRs), Architecture (schema, IPC, security, frontend, platform abstraction), Epics (full requirements inventory)
- **Knowledge Fragments:** adr-quality-readiness-checklist, test-levels-framework, risk-governance, test-quality, probability-impact
- **Not Loaded (not relevant):** Pact.js utils, Pact MCP, contract testing (single-user desktop app, no microservices)

## Step 3: Testability & Risk Assessment

### Testability Concerns

| ID | Concern | Status | Recommendation |
|----|---------|--------|----------------|
| TC-1 | Tauri E2E tooling maturity (tauri-driver less mature than Playwright/Cypress) | ACTIONABLE | Minimize E2E surface. Test 4 critical journeys only. Push coverage to unit/integration. |
| TC-2 | Global hotkey + focus restoration untestable in headless CI | ACTIONABLE | Use xvfb on Linux CI. Accept macOS/Windows focus tests require manual QA. |
| TC-3 | IPC integration test setup complexity (two processes) | ACTIONABLE | Build Rust test harness that spawns IPC server without full Tauri runtime. |
| TC-4 | Cross-platform WebView divergence | ACTIONABLE | Conservative Tailwind CSS. Run unit/integration on all platforms. E2E on Linux CI only. |
| TC-5 | Performance NFR validation flakiness in CI | FYI | 2x margins in CI, strict benchmarks locally, trend tracking. |

### Testability Strengths

- Offline-only architecture (zero external dependencies, 100% reproducible)
- Trait-based platform abstraction (mockable HotkeyProvider, Platform)
- Thin Tauri command handlers (service layer independently testable)
- SQLite as sole data store (in-memory for fast isolated tests)
- tauri-specta compile-time type safety (catches IPC contract bugs without tests)
- Single-user local architecture (no auth, no multi-tenancy)
- CLI as separate binary (testable against mock socket)
- Feature-based Zustand stores (pure JS, trivially testable)

### ASRs (Architecturally Significant Requirements)

| ID | Requirement | Status |
|----|-------------|--------|
| ASR-1 | Sub-150ms hotkey-to-visible (NFR1) | ACTIONABLE |
| ASR-2 | Zero data loss including crash/power-loss (NFR13-15) | ACTIONABLE |
| ASR-3 | FTS5 external content trigger sync | ACTIONABLE |
| ASR-4 | Tauri v2 capability/permission ACL (NFR8) | ACTIONABLE |
| ASR-5 | CLI ↔ App IPC protocol compliance | ACTIONABLE |
| ASR-6 | Cross-platform parity (FR56-58) | FYI |
| ASR-7 | User-scoped socket isolation (NFR11) | ACTIONABLE |

### Risk Assessment Matrix

| ID | Risk | Cat | P | I | Score | Action |
|----|------|-----|---|---|-------|--------|
| RISK-001 | WebView cross-platform behavioral divergence | TECH | 3 | 2 | 6 | MITIGATE |
| RISK-002 | Data loss during crash or power loss | DATA | 2 | 3 | 6 | MITIGATE |
| RISK-003 | SQLite FTS5 index desync | DATA | 2 | 2 | 4 | MONITOR |
| RISK-004 | Performance regression on 150ms hotkey target | PERF | 2 | 2 | 4 | MONITOR |
| RISK-005 | macOS accessibility permission blocks hotkey | OPS | 3 | 2 | 6 | MITIGATE |
| RISK-006 | CLI input injection (path traversal, oversized stdin) | SEC | 2 | 3 | 6 | MITIGATE |
| RISK-007 | Tauri E2E test tooling immaturity | TECH | 3 | 2 | 6 | MITIGATE |
| RISK-008 | Wayland global hotkey latency | TECH | 3 | 1 | 3 | DOCUMENT |
| RISK-009 | Global hotkey conflicts | TECH | 3 | 1 | 3 | DOCUMENT |
| RISK-010 | IPC socket permission escalation | SEC | 1 | 3 | 3 | DOCUMENT |
| RISK-011 | Multi-monitor window positioning | TECH | 2 | 1 | 2 | DOCUMENT |
| RISK-012 | Performance NFR flakiness in CI | PERF | 2 | 1 | 2 | DOCUMENT |

### Risk Summary

- 5 risks at score 6 (MITIGATE): RISK-001, RISK-002, RISK-005, RISK-006, RISK-007
- 2 risks at score 4 (MONITOR): RISK-003, RISK-004
- 5 risks at score 2-3 (DOCUMENT): RISK-008 through RISK-012
- No score-9 blockers. Gate assessment: CONCERNS — proceed with mitigation plans.
- Key strategic implication: Push coverage down the test pyramid aggressively. E2E reserved for 4 critical user journeys only.

## Step 4: Coverage Plan & Execution Strategy

### Coverage Summary

| Priority | Unit | Integration | Component | E2E | Benchmark | Manual | Total |
|----------|------|-------------|-----------|-----|-----------|--------|-------|
| P0 | 6 | 8 | 0 | 1 | 0 | 0 | 15 |
| P1 | 10 | 12 | 4 | 2 | 0 | 0 | 28 |
| P2 | 5 | 7 | 9 | 0 | 0 | 0 | 21 |
| P3 | 0 | 1 | 0 | 0 | 7 | 3 | 13 |
| **Total** | **21** | **28** | **13** | **3** | **7** | **3** | **77** |

Test pyramid ratio: Unit+Component 44% | Integration 36% | E2E 4% | Benchmark+Manual 16%

### Execution Strategy

| Trigger | Suite | Target Time |
|---------|-------|-------------|
| PR | P0+P1 functional (cargo test + vitest + E2E capture loop) | < 12 min |
| Nightly | Full P0-P2 + E2E journeys + visual regression | < 30 min |
| Weekly | P3 benchmarks (10K notes, timing, memory) + full E2E all platforms | < 45 min |
| Pre-release | All P0-P3 + manual QA checklist | < 60 min |

### Resource Estimates

| Priority | Effort |
|----------|--------|
| P0 | ~20–30 hours |
| P1 | ~30–45 hours |
| P2 | ~15–25 hours |
| P3 | ~10–15 hours |
| **Total** | **~75–115 hours** |

### Quality Gates

- P0 pass rate: 100% (PR blocker)
- P1 pass rate: ≥ 95% (PR blocker)
- P2 pass rate: ≥ 90% (nightly report)
- Unit coverage (Rust): ≥ 80% on service layer
- Unit coverage (TypeScript): ≥ 75% on stores + utils
- E2E capture loop: must pass (pre-release gate)
- High-risk mitigations complete before release
- No score-9 risks in OPEN status
- Performance benchmarks within 2x of NFR targets in CI
- Installer size < 10MB (CI artifact check)

## Step 5: Output Generation

### Output Files

| Document | Path | Lines |
|----------|------|-------|
| Architecture Doc | `_bmad-output/test-artifacts/test-design/test-design-architecture.md` | ~193 |
| QA Doc | `_bmad-output/test-artifacts/test-design/test-design-qa.md` | ~423 |
| BMAD Handoff | `_bmad-output/test-artifacts/test-design/notey-handoff.md` | ~132 |

### Checklist Validation Summary

- Mode: System-Level (two-document + handoff)
- Execution mode: Sequential (auto-resolved)
- All prerequisites met (PRD, Architecture, Epics)
- All process steps completed (5/5)
- Architecture doc: actionable-first structure, no test code, ~193 lines
- QA doc: full coverage plan (77 tests), execution strategy, effort estimates
- Handoff doc: artifacts inventory, risk-to-story mapping, quality gates
- Cross-document consistency: same risk IDs, same priorities, same blockers
- No duplicate content between documents (cross-references used)
- No score-9 blockers. Gate: CONCERNS with mitigation plans.
