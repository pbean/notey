---
type: test-design-architecture
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
---

# Test Design for Architecture — Notey

**Purpose:** Contract between QA and Engineering on testability concerns, architectural risks, and risk mitigations for the Notey MVP. This document does not contain test code, test scripts, quality gate criteria, test level strategy, or test environment setup.

| Field | Value |
|-------|-------|
| Scope | System-level test design |
| Requirements | 58 FRs, 23 NFRs, 57 UX design requirements |
| Architecture | Tauri v2 + React 19 + SQLite/FTS5, CLI via JSON-over-Unix-sockets IPC |
| Test Scenarios | ~77 tests (~75-115 hours for 1 engineer) |

---

## Executive Summary

Notey is a floating, keyboard-driven developer notepad built on Tauri v2 (Rust backend, React/TypeScript frontend) with SQLite/FTS5 for storage, a CLI companion binary communicating over JSON-based Unix socket IPC, and CodeMirror 6 as the editor. The frontend uses per-feature Zustand stores. Platform-specific behavior is abstracted behind Rust traits.

**Business context:** Open-source developer capture tool (MIT license) replacing ad-hoc workarounds. Target: 1,000+ GitHub stars within 3 months of release.

**Risk summary:** 12 risks identified. 5 high-priority (score >= 6), 2 medium (score 4), 5 low (score 1-3). No blockers (score 9). The architecture supports testing well overall — offline-only, trait-based abstraction, thin command handlers, and in-memory SQLite make most layers independently testable.

---

## Quick Guide

### :rotating_light: Blockers (0)

No pre-implementation blockers. Architecture supports testing well — offline-only, trait-based abstraction, thin command handlers, in-memory SQLite.

### :warning: High Priority (3 items for team to validate)

1. **TC-1: E2E Tooling Strategy** — tauri-driver is less mature than Playwright/Cypress. Recommendation: minimize E2E to 3 critical journeys, push coverage to unit/integration. Dev team should validate this approach. *(Owner: Dev Lead)*
2. **TC-3: IPC Integration Test Harness** — Testing CLI-to-App requires both processes running. Recommendation: build Rust test harness that spawns IPC server without full Tauri runtime. *(Owner: Dev Lead)*
3. **TC-2: CI Headed Environment** — Global hotkey and focus restoration tests require a real desktop session. Recommendation: xvfb on Linux CI, defer macOS/Windows focus tests to manual QA. *(Owner: DevOps)*

### :clipboard: Info Only

1. Test strategy: Unit 60% | Integration 25% | E2E 15% (risk-driven pyramid)
2. Tooling: Vitest (frontend), cargo test (Rust), WebDriver/tauri-driver (E2E)
3. Execution targets: PR < 12min | Nightly < 30min | Weekly < 45min
4. Coverage: 77 test scenarios prioritized P0-P3
5. Quality gates: P0 = 100%, P1 >= 95%

---

## Risk Assessment

### Full Risk Matrix

| ID | Cat | Risk | P | I | Score | Mitigation | Owner | Timing |
|----|-----|------|---|---|-------|------------|-------|--------|
| RISK-001 | TECH | WebView cross-platform behavioral divergence (WebKit vs WebView2) | 3 | 2 | **6** | Conservative Tailwind CSS, CI on all platforms, visual regression | Dev Lead | Implementation |
| RISK-002 | DATA | Data loss during crash or power loss | 2 | 3 | **6** | WAL mode + synchronous=NORMAL, crash recovery tests | Dev Lead | Pre-implementation |
| RISK-005 | OPS | macOS accessibility permission blocks hotkey on first install | 3 | 2 | **6** | First-run detection flow (FR54), guided grant UX | Dev Lead | Implementation |
| RISK-006 | SEC | CLI input injection (path traversal, oversized stdin) | 2 | 3 | **6** | Parameterized queries, 1MB max, canonicalize() | Dev Lead | Implementation |
| RISK-007 | TECH | Tauri E2E test tooling immaturity limits automation | 3 | 2 | **6** | Minimize E2E surface, maximize unit/integration | QA + Dev | Pre-implementation |
| RISK-003 | DATA | SQLite FTS5 index desync from content table | 2 | 2 | 4 | Trigger validation tests, REBUILD recovery | Dev | Implementation |
| RISK-004 | PERF | Performance regression on 150ms hotkey target | 2 | 2 | 4 | Pre-created hidden window, instrumented benchmarks | Dev | Implementation |
| RISK-008 | TECH | Wayland global hotkey latency (XWayland fallback) | 3 | 1 | 3 | XWayland for v1, portal fast-follow | Dev | Implementation |
| RISK-009 | TECH | Global hotkey conflicts with other applications | 3 | 1 | 3 | Conflict detection (FR18) | Dev | Implementation |
| RISK-010 | SEC | IPC socket permission escalation on shared systems | 1 | 3 | 3 | User-scoped paths, 0600 permissions | Dev | Implementation |
| RISK-011 | TECH | Multi-monitor window positioning inconsistency | 2 | 1 | 2 | Active-monitor centering (UX-DR18) | Dev | Implementation |
| RISK-012 | PERF | Performance NFR flakiness in CI timing assertions | 2 | 1 | 2 | 2x margins in CI, strict locally | QA | Ongoing |

---

## Testability Concerns

### Actionable Concerns

**TC-1: Tauri E2E tooling maturity**
tauri-driver is less mature than Playwright or Cypress — limited documentation, smaller community. This constrains E2E velocity and reliability. Minimize E2E to 3 critical journeys; push remaining coverage to unit and integration layers.
*Owner: Dev + QA. Timeline: Pre-implementation.*

**TC-2: Global hotkey + focus restoration untestable in headless CI**
The core capture loop (summon, type, dismiss, restore focus) requires a real desktop session. Headless runners cannot exercise this path. Use xvfb on Linux CI for basic coverage; accept that macOS/Windows focus tests require manual QA.
*Owner: DevOps. Timeline: CI setup (sprint 1).*

**TC-3: IPC integration test harness**
CLI-to-App integration requires both the CLI binary and the IPC socket server running concurrently. Build a Rust test harness that spawns the IPC server without the full Tauri runtime to enable fast, isolated integration tests.
*Owner: Dev Lead. Timeline: Pre-implementation.*

**TC-4: Cross-platform WebView divergence**
WebKit (Linux) and WebView2 (Windows) render differently. Use conservative Tailwind CSS, run unit/integration on all 3 platforms, and limit E2E to Linux CI only. Visual regression screenshots in CI artifacts for manual comparison.
*Owner: Dev. Timeline: Ongoing.*

**TC-5: Performance NFR flakiness** *(FYI)*
Timing assertions are noisy in shared CI runners. Use 2x margins in CI; run strict benchmarks locally and in pre-release.

### Testability Strengths

- **Offline-only** — zero external dependencies, 100% reproducible test environments
- **Trait-based platform abstraction** — HotkeyProvider, Platform traits are mockable
- **Thin Tauri command handlers** — service layer testable independently of Tauri runtime
- **SQLite in-memory mode** — fast isolated tests with no filesystem cleanup
- **tauri-specta compile-time type safety** — catches IPC contract bugs at build time
- **Single-user architecture** — no auth or multi-tenancy complexity
- **CLI as separate binary** — testable against a mock socket
- **Feature-based Zustand stores** — pure JS functions, trivially testable

### Accepted Trade-offs

- E2E coverage limited to 3 journeys (acceptable given tooling maturity)
- macOS/Windows focus management tests deferred to manual QA
- Performance benchmarks use 2x margins in CI (strict validation is pre-release manual)

---

## Risk Mitigation Plans

Plans are required for all risks with score >= 6. Each plan includes concrete steps, ownership, and verification criteria.

### RISK-001: WebView Cross-Platform Divergence (Score 6)

1. Use conservative Tailwind CSS baseline — no platform-specific CSS hacks
2. Run Vitest + cargo test on all 3 platforms (Linux, macOS, Windows) in CI matrix
3. Capture visual regression screenshots as CI artifacts for manual comparison

*Owner: Dev Lead. Timeline: Implementation. Status: Planned.*
*Verification: CI passes on all 3 platform builds.*

### RISK-002: Data Loss During Crash or Power Loss (Score 6)

1. Enable WAL mode + `PRAGMA synchronous=NORMAL` from schema v1
2. Integration tests: kill process during active write, verify recovery
3. Integration tests: `PRAGMA integrity_check` after simulated power loss

*Owner: Dev Lead. Timeline: Pre-implementation (schema design). Status: Planned.*
*Verification: All crash recovery tests pass.*

### RISK-005: macOS Accessibility Permission Blocks Hotkey (Score 6)

1. Implement first-run permission detection (FR54)
2. Guide user through System Settings grant flow with clear UX
3. E2E test for onboarding flow on macOS CI runner

*Owner: Dev Lead. Timeline: Implementation. Status: Planned.*
*Verification: First-run E2E passes on macOS CI.*

### RISK-006: CLI Input Injection (Score 6)

1. Parameterized queries for all database operations (mandated by architecture)
2. Enforce 1MB max note size for stdin input
3. Path validation via `std::fs::canonicalize()` for all file operations
4. Fuzzing tests for CLI input boundaries

*Owner: Dev Lead. Timeline: Implementation. Status: Planned.*
*Verification: Injection test suite passes (P0-UNIT-004 through P0-INT-008).*

### RISK-007: Tauri E2E Tooling Immaturity (Score 6)

1. Minimize E2E test surface to 3 critical user journeys
2. Push 80%+ coverage to unit and integration tests
3. Evaluate Playwright connecting to WebView2 as alternative for richer E2E if needed

*Owner: QA + Dev. Timeline: Pre-implementation. Status: Planned.*
*Verification: E2E suite completes reliably in CI.*

---

## Assumptions and Dependencies

### Assumptions

1. Tauri v2.10.3 stable APIs will not introduce breaking changes during implementation
2. tauri-driver provides sufficient WebDriver capabilities for 3 E2E journeys
3. GitHub Actions runners support xvfb for headed Linux E2E tests
4. SQLite WAL mode provides crash-safe recovery per its documented guarantees

### Dependencies

1. **IPC test harness design** — required before CLI integration testing begins *(Dev Lead, pre-implementation)*
2. **CI pipeline with xvfb and multi-platform matrix** — required before E2E tests run *(DevOps, sprint 1)*

### Risks to This Plan

If tauri-driver proves insufficient for the 3 E2E journeys, the fallback is manual QA for user journey validation. Impact: slower feedback on UI regressions. Contingency: evaluate Playwright + WebView2 connection as an alternative E2E driver.
