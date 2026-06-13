---
workflowStatus: 'completed'
mode: 'epic-level'
epic_num: 7
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-06-12'
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/project-context.md
  - _bmad-output/test-artifacts/test-design/test-design-architecture.md
  - _bmad-output/test-artifacts/test-design/test-design-qa.md
---

# Test Design: Epic 7 - Personalization & Accessibility

**Date:** 2026-06-12
**Author:** Pinkyd
**Status:** Draft

> **Forward-looking (pre-implementation) design with PARTIAL prior implementation.** Epic 7 is
> `backlog` — no story specs/code for the net-new surfaces. But several capabilities shipped
> earlier: **theme toggle** (Ctrl+Shift+T), **layout-density toggle**, the **TOML config service**
> (Story 1.14), and the **design-token system** (Story 1.6). So rows are marked 🆕 **NEW** (net-new)
> or ⚠️ **HARDEN** (built today, needs coverage against Epic 7 ACs). Derived from Epic 7 /
> Stories 7.1–7.8 ACs in `epics.md` + architecture context (`architecture.md`,
> `ux-design-specification.md`, `project-context.md`, System-Level test design). Sibling designs:
> Epics 3–5 backfill complete; Epic 6 forward-looking complete (`test-design-epic-6.md`). Test IDs
> use `7.{STORY}-{LEVEL}-{SEQ}`; a **TEA ref** column maps to the System-Level a11y/personalization
> scenarios where they align.

---

## Executive Summary

**Scope:** Epic-level test design for Epic 7 (stories 7-1 … 7-8: settings panel, theme switching,
font config, global-hotkey reconfig + conflict detection, layout-mode switching, keyboard-shortcut
config, comprehensive keyboard navigation, WCAG 2.1 AA accessibility audit).

**Risk Summary:**

- Total risks identified: **10**
- High-priority risks (score ≥6): **2** — RISK-E7-001 (hotkey-reconfig lockout, TECH/UX) and
  RISK-E7-002 (keyboard-only reachability, TECH/UX)
- Critical categories: **ACCESSIBILITY** (NFR21/22/23 + the 7.8 audit — the epic's defining surface)
  and **personalization safety** (the hotkey path is the app's primary entry point)
- Gate posture: **CONCERNS** (no score-9 blockers)

**Coverage Summary (NEW + HARDEN — mixed baseline):**

- P0 scenarios: **4** (~10–18 h) — both score-6 MITIGATEs (hotkey lockout-safety + keyboard reachability)
- P1 scenarios: **16** (~24–40 h) — settings/font/theme/config/conflict-UI/layout-geometry/axe + keyboard E2E
- P2/P3 scenarios: **7 / 0** (~8–16 h) — theme-swap harden, font family, reset, focus-ring, reduced-motion, geometry E2E
- **Plus a one-time tooling/harness build** (~8–16 h): add `jest-axe`/`axe-core` + a **computed
  token-contrast util** + a window-geometry integration driver
- **Total effort:** **~50–90 hours (~1.5–2.5 weeks)**

The plan is **component-dominant (15 of 27)** — accessibility + settings UI. The two MITIGATEs anchor
it: **hotkey lockout-safety** (`7.4-UNIT-001` + `7.4-INT-001`) and **keyboard reachability**
(`7.7-COMP-001` + `7.7-COMP-002` + the `7.E2E-001` keyboard-only walkthrough). The single
highest-leverage a11y test is **`7.2-UNIT-002`** — a computed token-contrast check across **both
themes** that needs no WebView and catches the currently-unverified light theme.

---

## Not in Scope

| Item | Reasoning | Mitigation |
| ---- | --------- | ---------- |
| **Re-testing the shipped theme/density/config baseline** | Theme toggle, layout-density toggle, and the TOML config service already pass | Collapsed into ⚠️ HARDEN rows where Epic 7 ACs add requirements; otherwise the retained baseline |
| **Cross-platform window-geometry + focus-ring rendering** (Win/mac/Linux/Wayland) | CI is Linux; per-OS/compositor behaviour differs — largely Epic 8's 8.6 scope | RISK-E7-008 (DOCUMENT); Linux E2E + manual platform QA; real Wayland deferred to Epic 8 |
| **Real assistive-technology behaviour** (screen-reader announcement timing) | jsdom/axe assert presence, not real-AT behaviour | RISK-E7-009; `aria-live`/`role` presence tested; real screen-reader pass is manual QA |
| **WCAG certification / full audit beyond AA baseline** | NFR23 is an "accessibility baseline, not certification" | Computed-contrast + jest-axe cover the AA baseline; formal audit out of scope |
| **macOS accessibility-permission / onboarding flows** | Epic 8 scope (8.2) | Out of this epic; referenced as a dependency |

---

## Risk Assessment

> Probability and Impact are scored 1–3; Score = P × I. **Forward-looking with partial prior
> implementation** — risks combine inherent risk of net-new surfaces with regression risk on the
> partially-built theme/layout/config paths. Mitigation owner is **Dev/QA**; timeline is **during
> Epic 7** (the two MITIGATEs are acceptance-criteria-level gates before Epic 8).

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ---------- | ----- | -------- |
| RISK-E7-001 | TECH/UX | **Global-hotkey reconfiguration can strand the user with no working summon shortcut.** Conflict detection (FR18) is **unbuilt** and platform-specific; the "unregister old → register new" sequence, if it fails or accepts an OS-conflicting combo, removes the app's **primary entry point** (the global hotkey, NFR1) with no obvious in-app recovery. Story 7.4 promises "on conflict the old stays active" — but that guarantee is exactly the untested new code. Losing the summon hotkey cripples the core instant-capture loop. | 2 | 3 | **6** | `7.4-UNIT-001` (conflict distinguishable from success) + `7.4-INT-001` (on conflict/failure the OLD stays registered — no lockout) + `7.4-COMP-001` (toast/reset) | Dev/QA | Epic 7 gate (before Epic 8) |
| RISK-E7-002 | TECH/UX | **Keyboard-only reachability gaps block AT / mouse-free users (NFR21/FR48).** "Every interactive element reachable via Tab/Shift+Tab" is a hard product promise; Epic 7 adds many new controls (settings panel, font slider, shortcut-rebind rows, hotkey capture) and 7.7 requires app-wide focus order (tab bar→editor→status bar) + overlay focus-trap (no escape to editor behind). A single unreachable control or a leaking trap **blocks a keyboard-only user from that feature entirely**. Overlays are trapped today; the new surfaces + full-app order are unaudited. | 2 | 3 | **6** | `7.7-COMP-001` (reachability/order) + `7.7-COMP-002` (focus-trap) + `7.1-COMP-003` (settings reachable) + `7.E2E-001` (keyboard-only walkthrough) | Dev/QA | Epic 7 gate (before Epic 8) |

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ---------- | ----- |
| RISK-E7-003 | TECH | **WCAG 2.1 AA contrast + focus-ring compliance is unverifiable with current tooling.** No `axe-core`/`jest-axe` in `package.json`; jsdom renders no CSS, so contrast (NFR23 4.5:1/3:1) and the 2px/≥3:1 focus ring (NFR22) can't be asserted in unit tests today. The **light theme is defined but never validated**. The epic's defining a11y claim ships unproven without a verification strategy. | 2 | 2 | **4** | Three-tier: `7.2-UNIT-002` (computed contrast both themes) + `7.8-COMP-001` (jest-axe) + `7.7-COMP-003`/`7.E2E-002` (focus-ring render). Add `jest-axe`/`axe-core`. | Dev/QA |
| RISK-E7-004 | DATA/OPS | **Config schema growth & forward-compatibility.** Epic 7 adds `[shortcuts]` (7.6), `[editor].font_family` (7.3), and a layout-geometry field (7.5). A missing section/key on an older config must **default cleanly** (the Epic 5 `[trash]` pattern); round-trip must preserve human-readable TOML (FR47). A regression resets user personalization or blocks startup. | 2 | 2 | **4** | `7.3-UNIT-001` + `7.6-UNIT-001` (round-trip + default-on-missing) | Dev/QA |
| RISK-E7-005 | TECH/DATA | **Story 7.5 layout-mode field overload.** The existing `config.general.layoutMode` is a **spacing-density** toggle (`comfortable`↔`compact`, Epic 4) — NOT the epic's **window-geometry** modes (Floating/Half-screen/Full-screen, FR22). Same name, different feature → restart-persistence collision, broken Epic-4 density toggle, or state-count mismatch. Design decision needed first. | 2 | 2 | **4** | `7.5-UNIT-001` (field disambiguation) + `7.5-INT-001` (geometry + persistence); raise field-semantics decision at story drafting | Dev/QA |
| RISK-E7-006 | TECH/UX | **Shortcut rebinding collisions & startup load (7.6).** Rebinding all UX-DR27 actions risks two actions on one combo, a binding shadowing a system/global shortcut, or custom bindings failing to load on startup → broken/ambiguous navigation. Conflict-warn + confirm/cancel + reset are all new. | 2 | 2 | **4** | `7.6-COMP-001` (collision warning) + `7.6-UNIT-001` (load on startup) + `7.6-UNIT-002` (reset) | Dev/QA |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| ------- | -------- | ----------- | ----------- | ------ | ----- | ------ |
| RISK-E7-007 | PERF/UX | **Theme/font live-apply regression (FR46 instant swap).** Theme must swap via CSS-variable change only (no React re-render); font must apply immediately to CodeMirror + type scale. A regression to a full re-render (or a clash with the Epic-4 `isTogglingTheme`/`isTogglingLayoutMode` guards) degrades the "instant" promise. | 2 | 1 | **2** | `7.2-COMP-001` asserts var-swap (no full re-render) + `7.3-COMP-001` live font apply |
| RISK-E7-008 | TECH | **Window-geometry (7.5) + focus-ring render diverge across platforms.** Always-on-top, edge-snap-50%, maximize, and the focus-ring outline render differently per OS/compositor; CI is Linux. Ties to system-level RISK-001 (WebView divergence); largely Epic 8's 8.6 scope. | 1 | 2 | **2** | Document; Linux E2E + manual cross-platform QA |
| RISK-E7-009 | TECH/UX | **Screen-reader announcements (7.8) only presence-assertable.** `aria-live="polite"` "Saved", `role="status"`, and "text+colour not colour-alone" can be asserted as present (jsdom/axe), but real-AT announcement timing/non-interruption needs a real screen reader. | 1 | 2 | **2** | `7.8-COMP-002`/`7.8-COMP-003` assert presence; real-AT pass is manual QA |
| RISK-E7-010 | TECH | **`prefers-reduced-motion` instant-focus path untested app-wide (7.7).** Respected in some code today but not systematically tested across the new surfaces. Low impact (motion preference). | 1 | 1 | **1** | `7.7-COMP-004` instant-focus assertion |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, robustness) — includes accessibility-as-technical-verification
- **SEC**: Security (access controls, isolation, injection)
- **PERF**: Performance (budget violations, degradation)
- **DATA**: Data Integrity (config/state loss, inconsistency)
- **BUS**: Business Impact (UX harm, product-promise failure)
- **OPS**: Operations (startup, config, maintenance)

---

## NFR Planning

**Purpose:** Capture epic-specific NFR thresholds, planned validation, and the evidence a later
`nfr-assess` should consume. This is not a final evidence audit.

| NFR Category | Requirement / Threshold | Risk Link | Planned Validation | Evidence Needed |
| ------------ | ----------------------- | --------- | ------------------ | --------------- |
| Keyboard navigation | **Every** interactive element reachable via Tab/Shift+Tab; focus order tab bar→editor→status bar; overlay focus trapped (NFR21/FR48; 7.7) | RISK-E7-002 | `7.7-COMP-001/002` + `7.1-COMP-003` + `7.E2E-001` (keyboard-only walkthrough) | Vitest component report + E2E run log |
| Focus indicator | **2px outline + 2px offset, ≥3:1** vs adjacent (NFR22; 7.7) | RISK-E7-003 | `7.7-COMP-003` (style present) + computed `--focus-ring` contrast (`7.2-UNIT-002`) + `7.E2E-002`/manual render | Vitest report + CI focus-ring screenshot |
| Colour contrast | **4.5:1 text / 3:1 UI**, BOTH themes (NFR23; 7.2/7.8) | RISK-E7-003 | **`7.2-UNIT-002` computed token-contrast (both themes)** + `7.8-COMP-001` jest-axe | Vitest report; manual real-WebView spot-check |
| Hotkey reconfig safety | Conflict → toast "conflicts with [app]" (5s), **old stays active**; valid → re-register; reset → Ctrl/Cmd+Shift+N (FR17/18; 7.4) | RISK-E7-001 | `7.4-UNIT-001` (conflict distinguishable) + `7.4-INT-001` (no lockout) + `7.4-COMP-001` + `7.4-INT-002` (restart load) | cargo unit/integration + vitest component |
| Config round-trip | Human-readable TOML; new `[shortcuts]`/`font_family`/layout field; **missing section → default** (FR45/46/47) | RISK-E7-004 | `7.3-UNIT-001` + `7.6-UNIT-001` (round-trip + default-on-missing) | cargo report |
| Live apply | Theme = CSS-var swap, **no re-render** (FR46); font applies immediately 12–24px (FR45) | RISK-E7-007 | `7.2-COMP-001` (var-swap) + `7.3-COMP-001` (live font); hotkey<150ms (NFR1) inherited, out of new scope | Vitest component report |
| Touch/click target | **≥24px** min height (7.8 AC) | RISK-E7-003 | `7.8-COMP-003` min-target assertion | Vitest report |

**Unknown thresholds / clarification items (raised, not guessed):**
1. **Min target-size discrepancy:** Story 7.8 AC says **24px**; the UX spec reportedly says **28px**.
   Confirm at story drafting (plan uses the AC's 24px, flagged).
2. **Story 7.5 layout-mode field semantics:** density (`comfortable/compact`) vs geometry
   (`floating/half/full`) — which field, migration, state count (RISK-E7-005).
3. **"Conflicts with [app]" name source:** whether `tauri-plugin-global-shortcut` can report the
   *owning application* of a conflicting OS shortcut, or only a generic registration failure; the
   toast copy must degrade gracefully if not (RISK-E7-001).
4. **a11y tooling decision:** add `jest-axe` (+ `axe-core`) — a **prerequisite** for the RISK-E7-003
   mitigation (build-time dependency, not just a test).

No fabricated thresholds. Hard sourced values: **4.5:1 / 3:1** (NFR23), **2px outline + 2px offset,
≥3:1** (NFR22), **12–24px** font (FR45), **≥24px** target (7.8 AC), **5s** conflict toast (7.4).

---

## Entry Criteria

- [ ] Epic 7 stories 7-1 … 7-8 drafted with finalized ACs (resolving 24px-vs-28px, layout-mode field
      semantics, "conflicts with [app]" obtainability)
- [ ] **`jest-axe` + `axe-core` added** to the Vitest toolchain (build-time gate for the a11y tier)
- [ ] **Computed token-contrast util** available (parse theme CSS hex → WCAG ratio) for `7.2-UNIT-002`
- [ ] Config service extended with the new sections (`[shortcuts]`, `[editor].font_family`, layout
      geometry field) with default-on-missing
- [ ] tauri-driver E2E able to drive keyboard-only flows + capture focus-ring screenshots (xvfb on Linux)
- [ ] Window-geometry integration driver (assert size/always-on-top/snap/maximize) for `7.5-INT-001`

## Exit Criteria

- [ ] All P0 scenarios passing (100%) — both MITIGATEs green
- [ ] All P1 scenarios passing (≥95%, or failures triaged)
- [ ] Both MITIGATEs green: hotkey lockout-safety (`7.4-UNIT-001`+`7.4-INT-001`) and keyboard
      reachability (`7.7-COMP-001`+`7.7-COMP-002`+`7.E2E-001`)
- [ ] Computed-contrast (`7.2-UNIT-002`) green for **both** themes + `jest-axe` (`7.8-COMP-001`) clean
- [ ] No open high-priority (≥6) items unmitigated
- [ ] Manual real-screen-reader + cross-platform window-geometry/focus-ring pass recorded (advisory)

---

## Test Coverage Plan

> **Priority ≠ execution timing.** P0/P1/P2/P3 denote priority/risk class only; scheduling is in
> Execution Strategy. Rows are 🆕 NEW (net-new) or ⚠️ HARDEN (built today, needs Epic 7 coverage).
> **All 4 P0s are tied to the two score-6 MITIGATEs.** **a11y level strategy:** contrast/focus
> visuals are not jsdom-verifiable → computed token-contrast unit (`7.2-UNIT-002`) + jest-axe
> component (`7.8-COMP-001`) + E2E/manual (`7.E2E-001/002`).

### P0 (Critical)

**Criteria:** Blocks core journey + High risk (≥6) + No workaround.

| Test ID | Requirement | Test Level | Risk Link | Test Count |
| ------- | ----------- | ---------- | --------- | ---------- |
| 7.4-UNIT-001 | (Rust) parse/validate combo; **conflict result distinguishable from success** | Unit | RISK-E7-001 | 1 |
| 7.4-INT-001 | (Rust) valid → re-register; **on conflict/failure the OLD stays registered (no lockout)** | Integration | RISK-E7-001 | 1 |
| 7.7-COMP-001 | **Every interactive element reachable via Tab/Shift+Tab; focus order tab bar→editor→status bar** | Component | RISK-E7-002 | 1 |
| 7.7-COMP-002 | Overlay open (incl. settings) → **focus trapped, never escapes to editor behind** | Component | RISK-E7-002 | 1 |

**Total NEW P0: 4 tests (~10–18 hours).** Both score-6 MITIGATEs live here.

### P1 (High)

**Criteria:** Important features + Medium risk (3-4) + Common workflows.

| Test ID | Requirement | Test Level | Risk Link | Test Count |
| ------- | ----------- | ---------- | --------- | ---------- |
| 7.1-COMP-001 | Open via Ctrl/Cmd+, + palette; General/Editor/Hotkey sections; Esc dismisses | Component | — | 1 |
| 7.1-COMP-002 | Setting change → `updateConfig()` + applies immediately (theme/font) | Component | — | 1 |
| 7.1-COMP-003 | Settings panel: jest-axe clean + focus-trapped + all controls Tab-reachable | Component | RISK-E7-002/003 | 1 |
| 7.2-UNIT-001 | First-run → `prefers-color-scheme`; manual pref overrides system | Unit | — | 1 |
| 7.2-UNIT-002 | **Computed contrast: text ≥4.5:1, UI/focus ≥3:1 in BOTH dark AND light** | Unit | RISK-E7-003 | 1 |
| 7.3-COMP-001 | Font size **12–24px** clamp; CodeMirror+UI live update; type scale scales | Component | — | 1 |
| 7.3-UNIT-001 | (Rust) `[editor]` font fields round-trip + default-on-missing | Unit | RISK-E7-004 | 1 |
| 7.4-COMP-001 | Capture UI; conflict → toast "conflicts with [app]" (5s), old remains; reset → default | Component | RISK-E7-001 | 1 |
| 7.4-INT-002 | Restart round-trip: saved custom shortcut loads + registers on startup | Integration | RISK-E7-001 | 1 |
| 7.5-INT-001 | Cycle Floating→Half→Full geometry; saved `[general] layout_mode`; **persists across restart** | Integration | RISK-E7-005 | 1 |
| 7.5-UNIT-001 | Layout-geometry field does NOT collide with the Epic-4 density toggle | Unit | RISK-E7-005 | 1 |
| 7.6-UNIT-001 | (Rust) `[shortcuts]` round-trips UX-DR27; defaults match; missing→default; loads on startup | Unit | RISK-E7-004/006 | 1 |
| 7.6-COMP-001 | List shortcuts+bindings; rebind capture; **collision warning**; confirm/cancel | Component | RISK-E7-006 | 1 |
| 7.8-COMP-001 | **jest-axe: no violations** across key components | Component | RISK-E7-003 | 1 |
| 7.8-COMP-002 | `aria-live="polite"` "Saved"; StatusBar `role="status"`; every control labelled | Component | RISK-E7-009 | 1 |
| 7.E2E-001 | **Keyboard-only walkthrough** (no mouse): summon→palette→settings→theme/font→tabs→search→dismiss | E2E | RISK-E7-002 | 1 |

**Total NEW P1: 16 tests (~24–40 hours).** Mostly component (a11y + settings); the keyboard E2E is
the end-to-end NFR21 proof.

### P2 (Medium)

**Criteria:** Secondary flows + Low risk (1-2) + Edge cases.

| Test ID | Requirement | Test Level | Risk Link | Test Count |
| ------- | ----------- | ---------- | --------- | ---------- |
| 7.2-COMP-001 | Theme toggle → `data-theme` swap via CSS-var change, **no full re-render**; persisted | Component | RISK-E7-007 | 1 |
| 7.3-COMP-002 | Font family mono↔sans → editor re-renders with new font | Component | — | 1 |
| 7.6-UNIT-002 | Reset-to-defaults restores the UX-DR27 set | Unit | — | 1 |
| 7.7-COMP-003 | Focus indicator **2px `--focus-ring` + 2px offset present** on interactive elements | Component | RISK-E7-003 | 1 |
| 7.7-COMP-004 | `prefers-reduced-motion` → focus transitions **instant** (no animation) | Component | RISK-E7-010 | 1 |
| 7.8-COMP-003 | State indicators **text+colour not colour-alone**; **min target ≥24px** | Component | — | 1 |
| 7.E2E-002 | Real-WebView: theme swap (focus ring renders/contrast) + window-geometry cycle | E2E | RISK-E7-003/005/008 | 1 |

**Total NEW P2: 7 tests (~8–16 hours).**

### P3 (Low)

**None.** No exploratory/benchmark scope this epic (no fabricated perf budget).

---

### Per-Story Coverage Matrices (🆕 NEW / ⚠️ HARDEN · all 0 existing Epic-7 tests)

**Story 7-1 (Settings panel) · NEW**

| ID | Scenario | Level | Pri | AC/Risk | Status |
|----|----------|-------|-----|---------|--------|
| 7.1-COMP-001 | Ctrl/Cmd+, + palette open; General/Editor/Hotkey sections; Esc dismisses | Component | P1 | AC1,5 | 🆕 |
| 7.1-COMP-002 | Setting change → `updateConfig()` + immediate apply (theme/font) | Component | P1 | AC5 | 🆕 |
| 7.1-COMP-003 | jest-axe clean + focus-trapped + all controls Tab-reachable | Component | P1 | RISK-E7-002/003 | 🆕 |

**Story 7-2 (Theme dark/light) · HARDEN/NEW**

| ID | Scenario | Level | Pri | AC/Risk | Status |
|----|----------|-------|-----|---------|--------|
| 7.2-UNIT-001 | First-run `prefers-color-scheme`; manual pref overrides system | Unit | P1 | AC2,3 | 🆕 |
| 7.2-UNIT-002 | **Computed contrast both themes (4.5:1 text / 3:1 UI+focus)** | Unit | P1 | RISK-E7-003, NFR23 | 🆕 |
| 7.2-COMP-001 | Toggle → `data-theme` var-swap, no full re-render; persisted | Component | P2 | AC1, RISK-E7-007 | ⚠️ HARDEN |

**Story 7-3 (Font config) · NEW**

| ID | Scenario | Level | Pri | AC/Risk | Status |
|----|----------|-------|-----|---------|--------|
| 7.3-COMP-001 | Size **12–24px** clamp; live CodeMirror+UI; type scale scales | Component | P1 | AC1, FR45 | 🆕 |
| 7.3-UNIT-001 | (Rust) `[editor]` font fields round-trip + default-on-missing | Unit | P1 | AC3, RISK-E7-004 | 🆕 |
| 7.3-COMP-002 | Family mono↔sans → editor re-renders | Component | P2 | AC2 | 🆕 |

**Story 7-4 (Hotkey reconfig + conflict) · NEW · MITIGATE-001**

| ID | Scenario | Level | Pri | AC/Risk | Status |
|----|----------|-------|-----|---------|--------|
| 7.4-UNIT-001 | (Rust) parse/validate; **conflict distinguishable from success** | Unit | P0 | RISK-E7-001, FR18 | 🆕 |
| 7.4-INT-001 | (Rust) re-register; **conflict/failure → OLD stays (no lockout)** | Integration | P0 | RISK-E7-001, FR17/18 | 🆕 |
| 7.4-COMP-001 | Capture UI; conflict toast (5s) old remains; reset → default | Component | P1 | AC, FR18 | 🆕 |
| 7.4-INT-002 | Restart: saved shortcut loads + registers on startup | Integration | P1 | AC | 🆕 |

**Story 7-5 (Layout mode — window geometry) · NEW**

| ID | Scenario | Level | Pri | AC/Risk | Status |
|----|----------|-------|-----|---------|--------|
| 7.5-INT-001 | Floating→Half→Full geometry; saved `[general] layout_mode`; **persists across restart** | Integration | P1 | FR22, RISK-E7-005 | 🆕 |
| 7.5-UNIT-001 | Geometry field disambiguated from Epic-4 density toggle | Unit | P1 | RISK-E7-005 | 🆕 |

**Story 7-6 (Keyboard shortcut config) · NEW**

| ID | Scenario | Level | Pri | AC/Risk | Status |
|----|----------|-------|-----|---------|--------|
| 7.6-UNIT-001 | (Rust) `[shortcuts]` round-trip; UX-DR27 defaults; missing→default; startup load | Unit | P1 | FR44, RISK-E7-004/006 | 🆕 |
| 7.6-COMP-001 | List+rebind capture; **collision warning**; confirm/cancel | Component | P1 | FR44, RISK-E7-006 | 🆕 |
| 7.6-UNIT-002 | Reset-to-defaults restores UX-DR27 set | Unit | P2 | AC | 🆕 |

**Story 7-7 (Comprehensive keyboard nav) · HARDEN/NEW · MITIGATE-002**

| ID | Scenario | Level | Pri | AC/Risk | Status |
|----|----------|-------|-----|---------|--------|
| 7.7-COMP-001 | **Every element Tab-reachable; focus order tab bar→editor→status bar** | Component | P0 | NFR21/FR48, RISK-E7-002 | 🆕 |
| 7.7-COMP-002 | Overlay (incl. settings) → **focus trapped, no escape to editor** | Component | P0 | NFR21, RISK-E7-002 | ⚠️ HARDEN |
| 7.7-COMP-003 | Focus ring **2px + 2px offset present** on interactive elements | Component | P2 | NFR22 | 🆕 |
| 7.7-COMP-004 | `prefers-reduced-motion` → instant focus, no animation | Component | P2 | AC, RISK-E7-010 | 🆕 |

**Story 7-8 (WCAG 2.1 AA audit) · NEW**

| ID | Scenario | Level | Pri | AC/Risk | Status |
|----|----------|-------|-----|---------|--------|
| 7.8-COMP-001 | **jest-axe: no violations** across key components | Component | P1 | NFR23/7.8, RISK-E7-003 | 🆕 |
| 7.8-COMP-002 | `aria-live="polite"` "Saved"; `role="status"`; every control labelled | Component | P1 | AC, RISK-E7-009 | 🆕 |
| 7.8-COMP-003 | text+colour not colour-alone; **min target ≥24px** | Component | P2 | AC | 🆕 |

> Contrast-both-themes (NFR23) is covered by `7.2-UNIT-002` (computed) — not duplicated in 7.8.

**Cross-Story · feature E2E (real WebView, xvfb) · 0 existing**

| ID | Scenario | Level | Pri | AC/Risk | Status |
|----|----------|-------|-----|---------|--------|
| 7.E2E-001 | **Keyboard-only walkthrough** (no mouse): summon→palette→settings→theme/font→tabs→search→dismiss, focus visible | E2E | P1 | NFR21/FR48, RISK-E7-002 | 🆕 |
| 7.E2E-002 | Real-WebView: theme swap (focus ring/contrast) + window-geometry cycle | E2E | P2 | RISK-E7-003/005/008 | 🆕 |

---

## NFR Coverage and Evidence Plan

- **Accessibility — keyboard nav (RISK-E7-002, MITIGATE / gates Epic 8):** `7.7-COMP-001` +
  `7.7-COMP-002` + `7.1-COMP-003` + `7.E2E-001`. Evidence: vitest component + E2E log.
- **Accessibility — contrast/focus (RISK-E7-003):** `7.2-UNIT-002` (computed, both themes) +
  `7.8-COMP-001` (jest-axe) + `7.7-COMP-003`/`7.E2E-002` (render). Evidence: vitest + CI focus-ring
  screenshot. **Requires adding `jest-axe`/`axe-core`.**
- **Usability/Reliability — hotkey safety (RISK-E7-001, MITIGATE / gates Epic 8):** `7.4-UNIT-001` +
  `7.4-INT-001` + `7.4-COMP-001` + `7.4-INT-002`. Evidence: cargo unit/integration + vitest.
- **Maintainability — config round-trip (RISK-E7-004):** `7.3-UNIT-001` + `7.6-UNIT-001`. Evidence:
  cargo report.
- **No new thresholds invented:** all sourced (NFR22/23, FR45, 7.8 24px, 7.4 5s).

Final PASS/CONCERNS/FAIL is deferred to `nfr-assess` once these tests/implementation exist.

---

## Execution Strategy

Simple **PR / Nightly / Weekly** model. Philosophy: run everything in PRs unless it is expensive or
long-running; defer only the real-WebView E2E and the manual a11y passes. Tests not re-listed —
see the Coverage Plan.

| Trigger | Suite | Target |
| ------- | ----- | ------ |
| **PR** | All `vitest` component/unit (incl. computed-contrast `7.2-UNIT-002` + jest-axe `7.8-COMP-001`) + Rust unit/integration (`7.3-UNIT-001`, `7.4-*`, `7.5-*`, `7.6-UNIT-*`) | < 15 min |
| **Nightly** | `7.E2E-001` (keyboard-only walkthrough) + `7.E2E-002` (real-WebView theme/geometry, focus-ring screenshot artifact) on Linux/xvfb | < 30 min |
| **Weekly / pre-Epic-8** | Confirm both MITIGATEs green; manual real-screen-reader pass (RISK-E7-009) + manual cross-platform window-geometry/focus-ring (RISK-E7-008) | — |

---

## Resource Estimates

Interval ranges (no false precision). Mixed NEW + HARDEN, plus a one-time tooling/harness build.

| Bucket | Count | Effort | Notes |
| ------ | ----- | ------ | ----- |
| Tooling/harness (one-time) | — | ~8–16 h | Add `jest-axe`/`axe-core` + **computed token-contrast util** (theme CSS → WCAG ratio) + window-geometry integration driver; reuse config round-trip patterns |
| P0 | 4 | ~10–18 h | Hotkey lockout-safety (Rust unit+integration) + keyboard reachability/focus-trap (the 2 MITIGATEs) |
| P1 | 16 | ~24–40 h | Settings/font/theme/config/conflict-UI/layout-geometry/axe/aria-live + keyboard E2E |
| P2 | 7 | ~8–16 h | theme-swap harden, font family, reset, focus-ring style, reduced-motion, text+colour, geometry E2E |
| P3 | 0 | — | none |
| **Total** | **27** | **~50–90 h (~1.5–2.5 weeks)** | Component-heavy; the contrast-util + jest-axe setup unlock the bulk of a11y coverage |

### Prerequisites

**Test Data / Tooling:**

- **`jest-axe` + `axe-core`** added to Vitest (build-time prerequisite for the a11y tier)
- **Computed token-contrast util** (parse theme CSS hex → WCAG ratio) for `7.2-UNIT-002`
- Config builder fixtures for the new `[shortcuts]`/`[editor]`/layout sections (default-on-missing)
- Window-geometry integration driver (size / always-on-top / snap / maximize assertions)

**Tooling:**

- `vitest` + React Testing Library (component/unit) · `cargo test` (Rust config/hotkey/geometry) ·
  `tauri-driver`/WebDriver (`e2e/run.mjs`) with xvfb for keyboard-only + focus-ring screenshots

**Environment:**

- Linux CI (xvfb) for E2E; manual Windows/macOS for cross-platform geometry/focus-ring (RISK-E7-008)
- Manual real-screen-reader environment for the RISK-E7-009 announcement pass

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate:** 100% (no exceptions)
- **P1 pass rate:** ≥95% (waivers required for failures)
- **P2/P3 pass rate:** ≥90% (informational)
- **High-risk mitigations:** both score-6 risks (RISK-E7-001 hotkey lockout-safety, RISK-E7-002
  keyboard reachability) complete and green

### Coverage Targets (inherited from system-level)

- Rust ≥ 80%; TS stores/components ≥ 75%
- Accessibility: computed contrast green for **both** themes; jest-axe clean on key components;
  every interactive element keyboard-reachable
- Security/personalization-safety: the hotkey path cannot leave the user without a working summon

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No high-risk (≥6) item unmitigated — both MITIGATEs green
- [ ] **`jest-axe`/`axe-core` added** + computed-contrast (`7.2-UNIT-002`) green for both themes
      (build-time a11y gate)
- [ ] Keyboard-only walkthrough (`7.E2E-001`) green — end-to-end NFR21 proof
- [ ] Hotkey lockout-safety (`7.4-INT-001`) green — no path strands the summon shortcut
- [ ] Planned NFR evidence exists or `nfr-assess` records CONCERNS/waivers

---

## Mitigation Plans

### RISK-E7-001: Global-hotkey reconfiguration lockout (Score: 6)

**Mitigation Strategy:**
1. Rust unit-test (`7.4-UNIT-001`) that combo parse/validate returns a **distinguishable** outcome
   for "registered OK" vs "conflict/already-registered" vs "invalid" — the registration path must
   surface conflict as a typed result, not a generic failure (observability ASR).
2. Rust integration-test (`7.4-INT-001`) the full reconfig sequence: a **valid** new shortcut
   unregisters the old and registers the new and persists `[hotkey].global_shortcut`; a **conflicting
   or failing** new shortcut leaves the **OLD shortcut still registered and working** (no lockout) —
   the core safety invariant.
3. Component-test (`7.4-COMP-001`) the capture UI: "Press new shortcut…", conflict → "Shortcut
   conflicts with [app]" toast (5s) with the old retained, and "Reset to default" → Ctrl/Cmd+Shift+N.
4. Restart round-trip (`7.4-INT-002`): a saved custom shortcut loads and registers on startup.

**Owner:** Dev/QA · **Timeline:** Epic 7 gate (before Epic 8) · **Status:** Planned
**Verification:** cargo unit/integration + vitest component green; manually confirm the summon hotkey
always works after a conflicting reconfig attempt.

### RISK-E7-002: Keyboard-only reachability (Score: 6)

**Mitigation Strategy:**
1. Per-surface component tests (`7.7-COMP-001`, `7.1-COMP-003`) that **every interactive element** is
   reachable via Tab/Shift+Tab and the focus order follows the visual layout (tab bar→editor→status
   bar; within settings: section order).
2. Focus-trap tests (`7.7-COMP-002`) that every overlay (search, palette, note-list, **settings**)
   traps focus and never lets it escape to the editor behind.
3. An end-to-end **keyboard-only walkthrough** (`7.E2E-001`) on a real WebView: summon → palette →
   open settings → change theme/font → navigate tabs → search → dismiss, entirely without a mouse,
   with the focus indicator visible throughout.
4. Add `jest-axe` (`7.8-COMP-001`) to catch missing names/roles that would make elements unreachable
   or unlabelled for AT.

**Owner:** Dev/QA · **Timeline:** Epic 7 gate (before Epic 8) · **Status:** Planned
**Verification:** vitest component + E2E run log green; manual keyboard-only smoke on each platform.

---

## Assumptions and Dependencies

### Assumptions

1. **`jest-axe`/`axe-core` will be added** to the toolchain — without it the a11y tier (RISK-E7-003)
   degrades to manual-only. This is the load-bearing tooling assumption (Entry Criterion + build gate).
2. Theme/density/config baselines pass on `main` and are the retained regression baseline.
3. The computed-contrast util can read the canonical theme token definitions (CSS custom properties)
   for both themes to assert WCAG ratios without a WebView.
4. tauri-driver can drive keyboard-only flows and capture focus-ring screenshots under xvfb on Linux.
5. The `--json`-style story-level UNKNOWNs (24px-vs-28px, layout-mode field, conflict-app-name) are
   resolved at Epic 7 story drafting before the affected tests are written.

### Dependencies

1. **a11y tooling (`jest-axe`/`axe-core`) + computed-contrast util** — before the a11y tier.
2. **Config service extension** (`[shortcuts]`, `[editor].font_family`, layout geometry field, with
   default-on-missing) — before 7.3/7.5/7.6 config tests.
3. **Window-geometry integration driver** — before `7.5-INT-001`.
4. **Finalized story ACs** resolving the four UNKNOWNs — before scheduling the affected tests.

### Risks to Plan

- **Risk:** `jest-axe` is not adopted.
  - **Impact:** a11y coverage (RISK-E7-003) becomes manual-only; light-theme contrast stays unverified.
  - **Contingency:** the computed token-contrast util (`7.2-UNIT-002`) is framework-agnostic and still
    covers the contrast NFR even without jest-axe; prioritize it.
- **Risk:** Story 7.5 overloads the existing `layoutMode` field.
  - **Impact:** density toggle and geometry mode collide; restart persistence ambiguous.
  - **Contingency:** `7.5-UNIT-001` pins the disambiguation; raise the field-semantics decision before
    implementation.
- **Risk:** the cumulative E2E budget (max 3, RISK-007) is enforced.
  - **Impact:** `7.E2E-002` (visual a11y/geometry) may not fit.
  - **Contingency:** fold `7.E2E-002` into manual QA; keep `7.E2E-001` (keyboard walkthrough) as the
    one essential new E2E.

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| ----------------- | ------ | ---------------- |
| **`command-palette/actions.ts` (theme/layout toggles)** | Settings UI + new geometry modes wrap existing toggles | Existing `toggleTheme`/`toggleLayoutMode` + `applyStartupConfig` tests must pass; `isTogglingTheme`/`isTogglingLayoutMode` guards intact |
| **`models/config.rs` + `services/config.rs` + `commands/config.rs`** | New `[shortcuts]`/`font_family`/layout-geometry fields + defaults | Existing config round-trip + `[trash]`/`[editor]`/`[general]`/`[hotkey]` default tests must pass |
| **`index.css` design tokens** | Light-theme contrast validated; focus-ring asserted | Token values unchanged unless a contrast fix is required; both themes must pass computed contrast |
| **Global shortcut (`lib.rs` `parse_shortcut`, plugin)** | Reconfiguration + conflict path added | Existing Story 1.11 global-hotkey registration must keep working (no lockout) |
| **Overlays (search/palette/note-list/trash)** | Focus-trap audit extended to settings | Existing overlay focus-trap + mutual-exclusion tests (Epics 3–5) must pass |
| **StatusBar / SaveIndicator** | `role="status"` + `aria-live` added | Existing StatusBar/save-indicator tests must pass |
| **`e2e/run.mjs`** | Keyboard-only walkthrough + visual a11y journeys added | Existing Epic 1 capture-loop + window-mgmt E2E must pass; reconcile cumulative max-3-E2E budget |

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — Risk classification framework
- `probability-impact.md` — Risk scoring methodology (P × I)
- `test-levels-framework.md` — Test level selection
- `test-priorities-matrix.md` — P0–P3 prioritization
- `nfr-criteria.md` — NFR planning categories (accessibility/usability/maintainability)

### Related Documents

- Epic + story ACs: `_bmad-output/planning-artifacts/epics.md` (Epic 7, Stories 7.1–7.8)
- PRD: `_bmad-output/planning-artifacts/prd.md` (FR17/18/22/44/45/46/47/48; NFR21/22/23)
- UX spec: `_bmad-output/planning-artifacts/ux-design-specification.md` (UX-DR27 shortcuts,
  `--focus-ring`, reduced-motion, touch targets, token contrast)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- System-level test design: `_bmad-output/test-artifacts/test-design/{test-design-architecture.md,
  test-design-qa.md}` (a11y/personalization scenario refs + RISK-001 WebView divergence)
- Sibling designs: `test-design-epic-3.md`, `-4.md`, `-5.md` (backfill), `test-design-epic-6.md`
  (forward-looking)
- Project context: `_bmad-output/project-context.md`

### Follow-on Workflows (Manual)

- Run `*atdd` to scaffold the red-phase P0 tests (hotkey lockout-safety + keyboard reachability) and
  the computed-contrast/jest-axe a11y harness (separate workflow; not auto-run).
- Run `*framework` if the a11y tooling (`jest-axe`) / E2E focus-ring capture needs initialization.
- Run `*automate` for broader coverage once tooling + implementation exist.
- Run `*nfr-assess` after evidence exists to assign final PASS/CONCERNS/FAIL.

---

**Generated by:** BMad TEA Agent — Test Architect Module
**Workflow:** `bmad-testarch-test-design`
**Version:** 4.0 (BMad v6)
