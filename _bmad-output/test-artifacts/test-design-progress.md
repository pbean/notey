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
  - resources/knowledge/risk-governance.md
  - resources/knowledge/probability-impact.md
  - resources/knowledge/test-levels-framework.md
  - resources/knowledge/test-priorities-matrix.md
  - resources/knowledge/nfr-criteria.md
---

# Test Design Progress — Epic 7 (Personalization & Accessibility)

> **Forward-looking (pre-implementation) test design with PARTIAL prior implementation.** Epic 7 is
> `backlog` in `sprint-status.yaml` — no story specs (`spec-7-*.md`) exist. BUT, unlike Epic 6
> (fully greenfield), several Epic 7 capabilities were **partially shipped earlier**: theme toggle
> (Ctrl+Shift+T) and layout-mode cycling exist via the Epic 4 command palette + `applyStartupConfig()`
> (epic-4-retro-item-1/2: `isTogglingTheme`/`isTogglingLayoutMode` guards), the TOML **config
> service** exists since Story 1.14, and the **design-token system** (CSS custom properties) since
> Story 1.6. So this run designs the test plan for: (a) the **net-new** surfaces — Settings panel
> (7.1), font config (7.3), hotkey reconfig + conflict detection (7.4), shortcut config (7.6),
> comprehensive keyboard nav (7.7), a11y audit (7.8); and (b) **hardening/regression** of the
> partially-existing theme/layout/config paths against the Epic 7 ACs.
>
> Derived from Epic 7 / Stories 7.1–7.8 ACs in `epics.md` + architecture context (`architecture.md`,
> `ux-design-specification.md`, `project-context.md`, System-Level test design). The Epics 3–5
> backfill range is complete; Epic 6 forward-looking design is complete (`test-design-epic-6.md`).

## Step 1: Mode Detection

- **Mode:** Epic-Level
- **Epic:** Epic 7 — Personalization & Accessibility (stories 7-1 … 7-8)
- **Reason:** `implementation-artifacts/sprint-status.yaml` exists → file-based detection selects
  Epic-Level Mode. User explicitly confirmed Epic 7 as the target.
- **Status:** All 8 Epic 7 stories are `backlog`; no specs/code for the net-new surfaces →
  **forward-looking** design. Some capabilities partially exist (theme/layout/config/tokens) →
  those rows are **hardening/regression** against Epic 7 ACs, the rest are **inherent-risk** design.
- **Prerequisites (Epic-Level requires epic/story requirements + ACs + architecture context):**
  - Epic + story ACs: `epics.md` → Epic 7 (Stories 7.1–7.8), each with full Given/When/Then ACs ✅
  - Epic-level TEA quality gate stated: P0 100%, P1 ≥95%, no open high-severity bugs ✅
  - Requirements: FR17/18 (hotkey reconfig/conflict), FR22 (layout modes), FR44/45/46 (shortcuts/
    font/theme), FR48 (keyboard-only nav); **NFR21** (full keyboard nav), **NFR22** (2px focus ring,
    3:1), **NFR23** (WCAG 2.1 AA 4.5:1 text / 3:1 components); UX-DR27 (default shortcut set) ✅
  - Architecture context: `architecture.md`, `ux-design-specification.md`, `project-context.md`
    (design tokens, config TOML, `tauri-plugin-global-shortcut`), System-Level test design ✅
- **Note — accessibility is the epic's defining surface.** NFR23 (WCAG AA contrast), NFR21/22
  (keyboard nav + focus) and the 7.8 audit make this a **measurable a11y-compliance** epic — the
  testability question (what jsdom can assert vs what needs a real WebView / axe / contrast tooling)
  is central and handled in Step 3.

## Step 2: Context Loading

- **Stack:** `fullstack` (React/TS `package.json` + Rust `src-tauri/Cargo.toml`, Tauri v2). Frontend-
  heavy epic (UI + a11y). E2E = `tauri-driver`/WebDriver (`e2e/run.mjs`).
- **TEA config flags:** none set → defaults (same as prior runs).
- **Browser exploration:** SKIPPED — `playwright-cli` not installed; Tauri desktop app (no live URL).
  **Important:** the a11y validation this epic needs (computed contrast, real focus-ring rendering,
  axe ARIA scan) **cannot be done in jsdom** (no layout/colour) — this is the epic's central
  testability constraint (Step 3), not a tooling convenience.
- **Knowledge fragments (epic-level required):** `risk-governance`, `probability-impact`,
  `test-levels-framework`, `test-priorities-matrix` + `nfr-criteria` (accessibility/usability/
  maintainability central) — applied directly.
- **Not loaded:** Pact/contract-testing/webhook/playwright-utils — no service-contract or HTTP
  surface in this epic.
- **Inputs:** Epic 7 ACs (`epics.md` 7.1–7.8), `prd.md` (FR17/18/22/44/45/46/47/48; NFR21/22/23),
  `architecture.md`, `ux-design-specification.md` (UX-DR27 shortcuts, `--focus-ring` 2px/3:1,
  reduced-motion, touch targets, token contrast), `project-context.md`, System-Level test design.

### Existing Coverage Snapshot (Epic 7) — EXISTING vs NEW (repo scan via Explore agent)

Epic 7 is **partially pre-built** (~26 FE test files / ~8 Rust test modules overall). Per story:

| Story | Built today | Where | Net-new for Epic 7 | Verdict |
|-------|-------------|-------|--------------------|---------|
| 7.1 Settings panel | **0%** — no `features/settings/` | — | Whole panel (General/Editor/Hotkey sections, inputs, save→`updateConfig`, Esc-dismiss, Ctrl/Cmd+, open) | ❌ NEW |
| 7.2 Theme dark/light | **~80%** — toggle works (Ctrl+Shift+T), `data-theme` swap, `prefers-color-scheme` listener, persisted to config | `command-palette/actions.ts`, `index.css`, config `[general].theme` | Settings UI surface + **WCAG-AA contrast verification both themes** (NFR23) + system-vs-manual precedence test | ⚠️ HARDEN |
| 7.3 Font config | **~20%** — `EditorConfig.fontSize` stored (default 14) | `models/config.rs`, `services/config.rs`, `commands/config.rs` | Font-size **slider 12–24px**, `fontFamily` selector (add field), live CodeMirror+type-scale update, persist `[editor]` | ❌ mostly NEW |
| 7.4 Hotkey reconfig + conflict | **~60%** — register/unregister on config change works; **conflict detection ABSENT** | `commands/config.rs`, `lib.rs` `parse_shortcut`, `[hotkey].globalShortcut` | Capture-key UI, **conflict detection + "Shortcut conflicts with [app]" toast (FR18)**, old-stays-active, reset-to-default | ⚠️ partial; conflict-detect is NEW |
| 7.5 Layout mode (window geometry) | **~0% of the ACTUAL feature** — see discrepancy below | — | **Floating(600×400 always-on-top)/Half-screen(50% snapped)/Full-screen(maximized)** window geometry + persistence | ❌ NEW |
| 7.6 Keyboard shortcut config | **0%** — only the global hotkey is editable; action shortcuts hardcoded | — | `[shortcuts]` config section (all UX-DR27 actions), rebind UI, per-binding conflict warn, load-on-startup, reset | ❌ NEW |
| 7.7 Comprehensive keyboard nav | **~70%** — focus-traps + aria on overlays (search/note-list/trash), `useWindowFocus` | `SearchOverlay.tsx`, `NoteListPanel.tsx`, `useWindowFocus.ts`, `TabBar.tsx` | Full-app tab-order audit (tab bar→editor→status bar), **2px `--focus-ring` 3:1 (NFR22)**, reduced-motion instant focus, overlay focus-trap completeness | ⚠️ HARDEN + audit |
| 7.8 WCAG 2.1 AA audit | **~40%** — tokens defined to be AA in dark; light theme unverified; `--focus-ring` defined | `index.css`, `TabBar.tsx` (underline+weight active) | `aria-live="polite"` "Saved"; `role="status"` StatusBar; every control labelled; **text+colour not colour-alone**; **≥24px targets**; **AA contrast both themes**; **axe tooling** | ❌ mostly NEW |

**Key gaps / design targets (drive Step 3 + Step 4):**
1. **No a11y test tooling.** `package.json` lacks `axe-core`/`jest-axe`; jsdom renders no CSS →
   contrast & focus-ring **visuals are unverifiable in unit tests**. **Three-tier a11y strategy
   needed:** (a) **computed token-contrast unit test** — parse the defined `--token` hex pairs and
   assert WCAG ratios (4.5:1 text / 3:1 UI & focus) for **both themes** in pure math, no WebView;
   (b) **`jest-axe` component scans** for ARIA/role/label correctness on rendered components;
   (c) **E2E / manual** for real focus-ring rendering + real-WebView contrast (xvfb on Linux CI).
2. **Story 7.5 semantic discrepancy (DATA/contract risk).** The existing `config.general.layoutMode`
   is a **spacing-density** toggle (`comfortable`↔`compact`, CSS scale) — **NOT** the epic's
   **window-geometry** modes (Floating/Half-screen/Full-screen). Same name, different feature. 7.5 is
   effectively NEW window-management work and risks colliding with / overloading the existing field.
   **Flag for story drafting** (which field, migration, three-state vs two-state).
3. **Hotkey conflict detection (7.4/FR18) is unbuilt** — registration exists, conflict-detect does
   not; "conflicts with [app]" requires querying OS-registered shortcuts (platform-specific, the
   hardest-to-test surface). RISK source.
4. **Config schema must grow** — add `[shortcuts]` (7.6), `[editor].fontFamily` (7.3), possibly
   layout-geometry field (7.5). TOML round-trip + **forward-compat defaults** (missing-section →
   default, like the Epic 5 `[trash]` pattern) must be regression-tested.
5. **Keyboard-nav completeness (7.7/NFR21)** — overlays are trapped, but tab bar/editor/status bar/
   settings panel/command palette need a systematic reachability + focus-order + focus-trap audit;
   reduced-motion instant-focus path is untested.
6. **Live-apply correctness** — theme/font "apply immediately" (no reload) + persist; concurrency
   with the existing `isTogglingTheme`/`isTogglingLayoutMode` guards (Epic 4) must not regress.

### Acceptance Criteria captured (traceability source — `epics.md` Stories 7.1–7.8)

- **7-1 Settings panel:** Ctrl/Cmd+, or palette "Open Settings" → modal/overlay with **General**
  (theme toggle, layout-mode selector), **Editor** (font size 12–24px, font family mono/sans),
  **Hotkey** (current shortcut + change); change → `updateConfig()` persists to TOML, theme/font
  apply immediately, **Esc dismisses**; note that advanced users can edit `config.toml` directly.
- **7-2 Theme:** toggle (settings / palette "Toggle Theme" / Ctrl+Shift+T) → `data-theme` on `html`
  swaps dark↔light, **all CSS vars update instantly (no re-render)** (FR46), saved via `update_config`;
  first-run no pref → `prefers-color-scheme`; manual pref **overrides** system; **both themes meet
  WCAG 2.1 AA 4.5:1 text / 3:1 components** (NFR23).
- **7-3 Font:** size constrained **12–24px** (FR45), CodeMirror+UI update immediately, **type scale
  scales proportionally** (`--text-*` relative to base); family switch mono↔sans re-renders editor;
  saved to `[editor] font_size`/`font_family`.
- **7-4 Hotkey reconfig + conflict:** show current combo; "change" → "Press new shortcut…" capture
  (FR17); **conflict with a registered system shortcut → toast "Shortcut conflicts with [app]" (5s),
  old stays active** (FR18); valid → old unregistered, new registered via
  `tauri-plugin-global-shortcut`, saved `[hotkey] global_shortcut`; **Reset to default** → Ctrl/Cmd+Shift+N.
- **7-5 Layout mode (window geometry):** palette "Toggle Layout Mode" cycles **Floating → Half-screen
  → Full-screen → Floating** (FR22); Floating = 600×400 resizable, always-on-top, drop shadow;
  Half-screen = 50% width, full height, edge-snapped, not always-on-top; Full-screen = maximized,
  standard chrome, not always-on-top; saved `[general] layout_mode`, **persists across restarts**.
- **7-6 Shortcut config:** list all app shortcuts + current bindings (FR44); defaults match **UX-DR27**
  (Esc, Ctrl+P, Ctrl+F, Ctrl+N, Ctrl+W, Ctrl+Tab, Ctrl+Shift+T, Ctrl+Shift+W, Ctrl+,); rebind →
  "Press new shortcut…" capture + **conflict warning** + confirm/cancel; stored in `[shortcuts]`,
  **loaded on startup**.
- **7-7 Keyboard nav:** **every interactive element reachable via Tab/Shift+Tab** (FR48/NFR21),
  focus order tab bar→editor→status bar; focus indicator **2px `var(--focus-ring)` + 2px offset,
  ≥3:1** (NFR22); **`prefers-reduced-motion` → instant focus, no animation**; overlay open →
  **focus trapped** (never escapes to editor behind).
- **7-8 WCAG audit:** save complete → **`aria-live="polite"` "Saved"** (non-interrupting); every
  control has `aria-label`/visible label; **StatusBar `role="status"`**; state indicators use
  **text+colour, not colour alone** ("Saved" by word; active tab by underline+weight); **min target
  height 24px**; **both themes AA 4.5:1 text / 3:1 components / 3:1 focus** (NFR23).

> **Reconciliation note (system-level vs epic ACs):** the System-Level test design names a11y/
> personalization scenarios (e.g. `P2-A11Y-001/002/003` reachability/focus/ARIA; `P2-UNIT-003`
> config round-trip; `P2-UNIT-004` hotkey-conflict; `P2-COMP-001` theme swap; `P2-INT-005` config
> persistence) — several are **inferred/loosely-named** in that doc. They are carried as **TEA refs**
> in Step 4 where they map cleanly, not treated as verbatim authority. `RISK-001` (WebView
> cross-platform divergence, Score 6) from the system-level design is directly relevant to the
> visual a11y validation here.

## Step 3: Risk Assessment & NFR Planning

> Epic-Level mode → system-level testability review (step §1) skipped. **Forward-looking with partial
> prior implementation:** risks combine **inherent risk of the net-new surfaces** (settings, font,
> hotkey-conflict, shortcut-config, window-geometry, a11y audit) with **regression risk on the
> partially-built paths** (theme/layout/config/tokens). Scoring per `risk-governance.md` +
> `probability-impact.md` (P,I ∈ {1,2,3}; Score = P×I). The epic's defining surface is
> **accessibility + personalization safety** — two product-promise failures score 6.

### Testability notes (epic-level — feeds the a11y verification strategy)

Accessibility is **mostly not jsdom-verifiable** (jsdom renders no CSS/layout/colour). The workable
strategy has three tiers and should be built into the stories:

- **Computed token-contrast unit test (no WebView):** parse the defined `--token` hex pairs from the
  theme CSS and assert WCAG ratios (4.5:1 text, 3:1 UI & focus) for **both** dark and light — pure
  math, runs in CI, catches the unverified light-theme pairs. The highest-leverage a11y test.
- **`jest-axe` component scans (add tooling):** render each component under RTL and assert no axe
  violations (roles, labels, `aria-live`, name-from-content) — catches ARIA/label regressions.
- **E2E / manual (real WebView, xvfb on Linux):** real focus-ring rendering, real-WebView contrast,
  window-geometry (7.5) — the part no unit test can prove. Capture focus-ring screenshots as CI
  artifacts. **ASR:** injectable/queryable config + deterministic theme application so tests drive
  theme/font/shortcut state without the OS.

For hotkey-conflict (7.4/FR18): **observability ASR** — the registration path must surface a
*distinguishable* "already-registered / conflict" result (not a generic failure) so the
"old-stays-active + toast" contract is assertable; and the OS-app-name in "conflicts with [app]" may
not be obtainable from `tauri-plugin-global-shortcut` (UNKNOWN — see NFR planning).

### Risk Register (P×I, 1–9)

| ID | Risk | Cat | P | I | Score | Action |
|----|------|-----|---|---|-------|--------|
| RISK-E7-001 | **Global-hotkey reconfiguration can strand the user with no working summon shortcut.** Conflict detection (FR18) is **unbuilt** and platform-specific; the "unregister old → register new" sequence, if it fails or accepts an OS-conflicting combo, removes the app's **primary entry point** (the global hotkey, NFR1) with no obvious in-app recovery. Story 7.4 promises "on conflict the old stays active" — but that guarantee is exactly the untested new code. Losing the summon hotkey cripples the core instant-capture loop. | TECH/UX | 2 | 3 | **6** | MITIGATE |
| RISK-E7-002 | **Keyboard-only reachability gaps block AT / mouse-free users (NFR21/FR48).** "Every interactive element reachable via Tab/Shift+Tab" is a hard product promise, but Epic 7 adds many new controls (settings panel, font slider, shortcut-rebind rows, hotkey capture) and 7.7 requires app-wide focus order (tab bar→editor→status bar) + overlay focus-trap (no escape to editor behind). A single unreachable control or a leaking trap **blocks a keyboard-only user from that feature entirely**. Overlays are trapped today, but the new surfaces + full-app order are unaudited. | TECH/UX | 2 | 3 | **6** | MITIGATE |
| RISK-E7-003 | **WCAG 2.1 AA contrast + focus-ring compliance is unverifiable with current tooling.** No `axe-core`/`jest-axe` in `package.json`; jsdom renders no CSS, so contrast (NFR23 4.5:1/3:1) and the 2px/≥3:1 focus ring (NFR22) **cannot be asserted in unit tests today**. The **light theme is defined but never validated**. Without the three-tier strategy the epic's defining a11y claim ships unproven; a failing pair (esp. light theme) reaches users undetected. | TECH | 2 | 2 | **4** | MONITOR |
| RISK-E7-004 | **Config schema growth & forward-compatibility.** Epic 7 adds `[shortcuts]` (7.6), `[editor].font_family` (7.3), and a layout-geometry field (7.5) to `config.toml`. A missing section/key on an older config must **default cleanly** (the Epic 5 `[trash]` pattern), and the round-trip must preserve human-readable TOML (FR47). A regression here resets user personalization or blocks startup. | DATA/OPS | 2 | 2 | **4** | MONITOR |
| RISK-E7-005 | **Story 7.5 layout-mode field overload (semantic collision).** The existing `config.general.layoutMode` is a **spacing-density** toggle (`comfortable`↔`compact`, CSS scale, shipped via Epic 4) — NOT the epic's **window-geometry** modes (Floating/Half-screen/Full-screen, FR22). Same name, different feature. Overloading one field risks restart-persistence collisions, a broken Epic-4 density toggle, or a three-state/two-state mismatch. Design decision needed before implementation. | TECH/DATA | 2 | 2 | **4** | MONITOR |
| RISK-E7-006 | **Shortcut rebinding collisions & startup load (7.6).** Rebinding all app actions (UX-DR27 set) introduces the risk of two actions bound to the same combo, a binding shadowing a system/global shortcut, or custom bindings failing to load on startup → broken or ambiguous navigation. Conflict-warn + confirm/cancel + reset-to-defaults are all new. | TECH/UX | 2 | 2 | **4** | MONITOR |
| RISK-E7-007 | **Theme/font live-apply regression (FR46 instant swap, no re-render).** Theme must swap via CSS-variable change only (no React re-render); font must apply immediately to CodeMirror + type scale. A regression to a full re-render (or a clash with the existing Epic-4 `isTogglingTheme`/`isTogglingLayoutMode` concurrency guards) degrades the "instant" promise. | PERF/UX | 2 | 1 | **2** | DOCUMENT |
| RISK-E7-008 | **Window-geometry (7.5) + focus-ring render diverge across platforms (Win/mac/Linux/Wayland).** Always-on-top, edge-snap-50%, maximize, and the focus-ring outline render differently per OS/compositor; CI is Linux. Ties to system-level RISK-001 (WebView divergence). Cross-platform window behaviour is largely Epic 8's 8.6 scope. | TECH | 1 | 2 | **2** | DOCUMENT |
| RISK-E7-009 | **Screen-reader announcements (7.8) only presence-assertable, not behaviour-verifiable.** `aria-live="polite"` "Saved", `role="status"` StatusBar, and "text+colour not colour-alone" can be asserted as **present** in jsdom/axe, but real assistive-tech announcement timing/non-interruption needs a real screen reader (manual QA). | TECH/UX | 1 | 2 | **2** | DOCUMENT |
| RISK-E7-010 | **`prefers-reduced-motion` instant-focus path untested app-wide (7.7).** The reduced-motion → instant (no-animation) focus transition is respected in some code today but not systematically tested across the new surfaces. Low impact (motion preference, not a blocker). | TECH | 1 | 1 | **1** | DOCUMENT |

### Risk Summary

- **2 MITIGATE (score 6):** RISK-E7-001 (hotkey-reconfig lockout — loses the primary entry point) and
  RISK-E7-002 (keyboard-only reachability — blocks AT users). Both are **product-promise** failures
  (instant-capture + mouse-optional), the epic's gating items.
- **4 MONITOR (score 4):** RISK-E7-003 (WCAG verification tooling gap — the defining a11y coverage
  investment), 004 (config forward-compat), 005 (layout-mode field overload), 006 (shortcut-rebind
  collisions).
- **4 DOCUMENT (score ≤2):** RISK-E7-007 (live-apply regression), 008 (cross-platform geometry/focus
  render), 009 (real-AT announcements), 010 (reduced-motion).
- **No score-9 blockers.** Gate posture: **CONCERNS** — proceed with the two MITIGATEs (hotkey-safety
  + keyboard reachability) as acceptance-criteria-level gates and RISK-E7-003's three-tier a11y
  verification as the core coverage investment. Clears to PASS once 001/002 + the contrast/axe
  tooling land.

### NFR Planning (plan only — `nfr-assess` runs post-implementation)

| NFR | Category | Threshold (source) | Status | Planned Evidence |
|-----|----------|--------------------|--------|------------------|
| Keyboard navigation | ACCESSIBILITY | **Every** interactive element reachable via Tab/Shift+Tab; focus order tab bar→editor→status bar; overlay focus trapped (NFR21/FR48; 7.7) | PARTIAL (overlays trapped; new surfaces + full-app order unaudited) → RISK-E7-002 (MITIGATE) | Component tab-order/reachability tests per surface + focus-trap tests + an E2E keyboard-only walkthrough (no mouse) |
| Focus indicator | ACCESSIBILITY | **2px outline + 2px offset, ≥3:1** contrast vs adjacent (NFR22; 7.7) | PARTIAL (`--focus-ring` token defined; not asserted) → RISK-E7-003 | Token assertion (width/offset present) + computed `--focus-ring`-vs-adjacent contrast + E2E/manual focus-ring screenshot (CI artifact) |
| Colour contrast | ACCESSIBILITY | **4.5:1 text / 3:1 UI components**, BOTH themes (NFR23; 7.2/7.8) | PARTIAL (dark token-verified; **light unverified**) → RISK-E7-003 (MONITOR) | **Computed token-contrast unit test (both themes)** + `jest-axe` component scans; real-WebView spot-check manual |
| Hotkey reconfig safety | USABILITY/RELIABILITY | Conflict detected → toast "conflicts with [app]" (5s), **old stays active**; valid → re-register; reset → Ctrl/Cmd+Shift+N (FR17/18; 7.4) | PLANNED (conflict-detect unbuilt) → RISK-E7-001 (MITIGATE) | Rust unit (parse/validate + conflict result) + integration (unregister-old/register-new, failure → old retained) + component (capture UI + toast) |
| Config round-trip | MAINTAINABILITY | Human-readable TOML; new `[shortcuts]`/`font_family`/layout field; **missing section → default** (FR45/46/47; 7.1/7.3/7.6) | PARTIAL (config service exists; new sections unbuilt) → RISK-E7-004 | Rust config round-trip + default-on-missing-section unit tests (mirror the `[trash]` pattern) |
| Live apply | PERFORMANCE/UX | Theme = CSS-var swap, **no re-render** (FR46); font applies immediately 12–24px (FR45) | PARTIAL (theme toggle works) → RISK-E7-007 | Component test asserting var-swap (not full re-render) + font live-update; hotkey<150ms (NFR1) inherited, out of new scope |
| Touch/click target | ACCESSIBILITY | **≥24px** min height (7.8 AC) | PLANNED → RISK-E7-003 | Component/computed-style assertion of min target size on new controls |

**Unknown thresholds / clarification items (raised, not guessed):**
1. **Min target-size discrepancy:** Story 7.8 AC says **24px**; the UX spec reportedly says **28px**.
   Confirm the authoritative value at story drafting (plan uses the AC's 24px, flagged).
2. **Story 7.5 layout-mode field semantics:** density (`comfortable/compact`) vs geometry
   (`floating/half/full`) — which field, migration, state count. Design decision (RISK-E7-005).
3. **"Conflicts with [app]" name source:** whether `tauri-plugin-global-shortcut` can report the
   *owning application* of a conflicting OS shortcut, or only a generic registration failure. If the
   app name is unobtainable, the toast copy must degrade gracefully (RISK-E7-001).
4. **a11y tooling decision:** add `jest-axe` (+ `axe-core`) to the toolchain — a **prerequisite** for
   the RISK-E7-003 mitigation (build-time dependency, not just a test).

No fabricated thresholds. Hard sourced values: **4.5:1 / 3:1** contrast (NFR23), **2px outline + 2px
offset, ≥3:1** focus (NFR22), **12–24px** font (FR45), **≥24px** target (7.8 AC), **5s** conflict
toast (7.4). The epic's defining non-functional surface is **accessibility** (NFR21/22/23) plus the
**personalization-safety** of the hotkey path — the basis for the two MITIGATEs.

## Step 4: Coverage Plan & Execution Strategy

> **Forward-looking, mixed-baseline.** Rows are 🆕 **NEW** (net-new surface) or ⚠️ **HARDEN**
> (partially built today, needs test coverage against the Epic 7 ACs). Priority ≠ execution timing.
> Test IDs `7.{STORY}-{LEVEL}-{SEQ}`; **TEA ref** maps to the System-Level a11y/personalization
> scenarios where they align. **All 4 P0s are tied to the two score-6 MITIGATEs** (hotkey-lockout
> safety + keyboard reachability) — the only blocks-core + ≥6 + no-workaround scenarios.

> **a11y level strategy (testability):** contrast/focus visuals are **not jsdom-verifiable** →
> three tiers: **computed token-contrast unit** (`7.2-UNIT-002`, pure math, both themes) +
> **`jest-axe` component scans** (`7.8-COMP-001`, ARIA/labels) + **E2E/manual** (`7.E2E-001/002`,
> real focus-ring + window geometry). Adding `jest-axe`/`axe-core` is a **build-time prerequisite**.

### Coverage Matrix — Story 7-1 (Settings panel) · component · NEW

| ID | Scenario | Level | Pri | AC/Risk | TEA ref | Status |
|----|----------|-------|-----|---------|---------|--------|
| 7.1-COMP-001 | Open via Ctrl/Cmd+, AND palette "Open Settings" → modal with General/Editor/Hotkey sections; **Esc dismisses** | Component | P1 | AC1,5 | — | 🆕 |
| 7.1-COMP-002 | Changing a setting calls `updateConfig()` + applies immediately (theme/font) | Component | P1 | AC5 | P2-INT-005 | 🆕 |
| 7.1-COMP-003 | Settings panel: `jest-axe` clean + focus-trapped + all controls Tab-reachable | Component | P1 | RISK-E7-002/003, NFR21 | P2-A11Y-001 | 🆕 |

### Coverage Matrix — Story 7-2 (Theme dark/light) · unit + component · HARDEN/NEW

| ID | Scenario | Level | Pri | AC/Risk | TEA ref | Status |
|----|----------|-------|-----|---------|---------|--------|
| 7.2-UNIT-001 | First-run no pref → `prefers-color-scheme` default; **manual pref overrides system** | Unit | P1 | AC2,3 | — | 🆕 |
| 7.2-UNIT-002 | **Computed contrast: every text/bg pair ≥4.5:1 and UI/focus ≥3:1 in BOTH dark AND light** (parse token hex) | Unit | P1 | RISK-E7-003, NFR23 | P2-A11Y-002 | 🆕 |
| 7.2-COMP-001 | Toggle (settings/palette/Ctrl+Shift+T) → `data-theme` swap via **CSS-var change, no full re-render**; persisted | Component | P2 | AC1, RISK-E7-007 | P2-COMP-001 | ⚠️ HARDEN |

### Coverage Matrix — Story 7-3 (Font config) · component + unit · NEW

| ID | Scenario | Level | Pri | AC/Risk | TEA ref | Status |
|----|----------|-------|-----|---------|---------|--------|
| 7.3-COMP-001 | Font size **constrained 12–24px** (11 clamped/rejected, 25 clamped); CodeMirror+UI update immediately; **type scale (`--text-*`) scales proportionally** | Component | P1 | AC1, FR45 | — | 🆕 |
| 7.3-UNIT-001 | (Rust) `[editor] font_size`/`font_family` persisted + round-trip + **default on missing** | Unit | P1 | AC3, RISK-E7-004 | P2-UNIT-003 | 🆕 |
| 7.3-COMP-002 | Font family switch mono↔sans → editor re-renders with new font | Component | P2 | AC2 | — | 🆕 |

### Coverage Matrix — Story 7-4 (Hotkey reconfig + conflict) · unit + integration + component · NEW (MITIGATE-001)

| ID | Scenario | Level | Pri | AC/Risk | TEA ref | Status |
|----|----------|-------|-----|---------|---------|--------|
| 7.4-UNIT-001 | (Rust) parse/validate combo; **conflict result is DISTINGUISHABLE from success** (conflict vs ok) | Unit | P0 | RISK-E7-001, FR18 | P2-UNIT-004 | 🆕 |
| 7.4-INT-001 | (Rust) valid → old unregistered + new registered + saved; **on conflict/failure the OLD stays registered (NO lockout)** | Integration | P0 | RISK-E7-001, FR17/18 | — | 🆕 |
| 7.4-COMP-001 | Capture UI "Press new shortcut…"; conflict → toast "Shortcut conflicts with [app]" (5s), old remains; **Reset → Ctrl/Cmd+Shift+N** | Component | P1 | AC, FR18 | — | 🆕 |
| 7.4-INT-002 | Restart round-trip: saved custom shortcut loads + registers on startup | Integration | P1 | AC | — | 🆕 |

### Coverage Matrix — Story 7-5 (Layout mode — window geometry) · integration + unit · NEW

| ID | Scenario | Level | Pri | AC/Risk | TEA ref | Status |
|----|----------|-------|-----|---------|---------|--------|
| 7.5-INT-001 | Cycle **Floating→Half→Full→Floating** sets correct geometry (600×400 always-on-top / 50% edge-snap / maximized); saved `[general] layout_mode`; **persists across restart** | Integration | P1 | FR22, RISK-E7-005 | P2-INT-006 | 🆕 |
| 7.5-UNIT-001 | **Field disambiguation:** geometry layout-mode does NOT collide with the Epic-4 density toggle (separate field / migrated state) | Unit | P1 | RISK-E7-005 | — | 🆕 |

### Coverage Matrix — Story 7-6 (Keyboard shortcut config) · unit + component · NEW

| ID | Scenario | Level | Pri | AC/Risk | TEA ref | Status |
|----|----------|-------|-----|---------|---------|--------|
| 7.6-UNIT-001 | (Rust) `[shortcuts]` round-trips all UX-DR27 actions; **defaults match UX-DR27**; missing section → defaults; loads on startup | Unit | P1 | FR44, RISK-E7-004/006 | — | 🆕 |
| 7.6-COMP-001 | List all shortcuts + bindings; rebind capture; **collision warning (combo already bound to another action OR system)**; confirm/cancel | Component | P1 | FR44, RISK-E7-006 | — | 🆕 |
| 7.6-UNIT-002 | Reset-to-defaults restores the UX-DR27 set | Unit | P2 | AC | — | 🆕 |

### Coverage Matrix — Story 7-7 (Comprehensive keyboard nav) · component · HARDEN/NEW (MITIGATE-002)

| ID | Scenario | Level | Pri | AC/Risk | TEA ref | Status |
|----|----------|-------|-----|---------|---------|--------|
| 7.7-COMP-001 | **Every interactive element reachable via Tab/Shift+Tab; focus order tab bar→editor→status bar** (per-surface) | Component | P0 | NFR21/FR48, RISK-E7-002 | P2-A11Y-001 | 🆕 |
| 7.7-COMP-002 | Overlay open (search/palette/note-list/**settings**) → **focus trapped, never escapes to editor behind** | Component | P0 | NFR21, RISK-E7-002 | — | ⚠️ HARDEN |
| 7.7-COMP-003 | Focus indicator **2px `--focus-ring` + 2px offset present** on interactive elements (style assertion) | Component | P2 | NFR22 | P2-A11Y-002 | 🆕 |
| 7.7-COMP-004 | `prefers-reduced-motion` → focus transitions **instant (no animation)** | Component | P2 | AC, RISK-E7-010 | — | 🆕 |

### Coverage Matrix — Story 7-8 (WCAG 2.1 AA audit) · component · NEW

| ID | Scenario | Level | Pri | AC/Risk | TEA ref | Status |
|----|----------|-------|-----|---------|---------|--------|
| 7.8-COMP-001 | **`jest-axe` scan: no violations** across key components (settings, tab bar, status bar, editor, overlays) | Component | P1 | NFR23/7.8, RISK-E7-003 | P2-A11Y-003 | 🆕 |
| 7.8-COMP-002 | Save complete → **`aria-live="polite"` "Saved"**; StatusBar **`role="status"`**; every control labelled | Component | P1 | AC, RISK-E7-009 | — | 🆕 |
| 7.8-COMP-003 | State indicators **text+colour, not colour-alone** ("Saved" by word; active tab underline+weight); **min target ≥24px** | Component | P2 | AC | — | 🆕 |

> Contrast-both-themes (NFR23) is covered by **7.2-UNIT-002** (computed) — not duplicated in 7.8.

### Coverage Matrix — Cross-Story · feature E2E (real WebView, xvfb) · NEW

| ID | Scenario | Level | Pri | AC/Risk | TEA ref | Status |
|----|----------|-------|-----|---------|---------|--------|
| 7.E2E-001 | **Keyboard-only walkthrough (no mouse):** summon → palette → open settings → change theme/font → tabs → search → dismiss, **entirely via keyboard, focus visible throughout** | E2E | P1 | NFR21/FR48, RISK-E7-002 | — | 🆕 |
| 7.E2E-002 | Real-WebView visual: theme swap (focus ring renders, contrast) + window-geometry cycle (floating/half/full) | E2E | P2 | RISK-E7-003/005/008 | P3-EDGE-003 | 🆕 |

### Coverage Summary

| Priority | Unit | Component | Integration | E2E | NEW total | Notes |
|----------|------|-----------|-------------|-----|-----------|-------|
| P0 | 1 | 2 | 1 | 0 | **4** | all tied to the 2 score-6 MITIGATEs (hotkey lockout-safety + keyboard reachability) |
| P1 | 5 | 8 | 2 | 1 | **16** | settings/font/theme/config/conflict-UI/layout-geometry/axe/aria-live + keyboard E2E |
| P2 | 1 | 5 | 0 | 1 | **7** | theme-swap harden, font family, reset-defaults, focus-ring style, reduced-motion, text+colour, geometry E2E |
| P3 | 0 | 0 | 0 | 0 | **0** | none |
| **NEW total** | **7** | **15** | **3** | **2** | **27** | mixed NEW + HARDEN; component-heavy (a11y) |

**27 scenarios** (4 P0 + 16 P1 + 7 P2). Component-dominant (15) — accessibility + settings UI. The
two MITIGATEs anchor the plan: **hotkey lockout-safety** (`7.4-UNIT-001` + `7.4-INT-001`, P0) and
**keyboard reachability** (`7.7-COMP-001` + `7.7-COMP-002`, P0 + the `7.E2E-001` keyboard walkthrough).
The highest-leverage a11y test is **`7.2-UNIT-002`** (computed contrast, both themes, no WebView).

> **E2E budget note:** the system-level guidance is **max 3 E2E journeys total** (RISK-007); Epic 5
> planned 4 and Epic 6 planned 1, so the cumulative budget is already a known tension. Epic 7 adds
> **2** (keyboard walkthrough P1 — the only end-to-end proof of NFR21; visual a11y/geometry P2 —
> **may fold into manual QA** if the budget is enforced). Flag for the team to reconcile the
> cumulative E2E budget vs. the per-epic value.

### NFR Coverage & Evidence Plan

- **ACCESSIBILITY — keyboard nav (RISK-E7-002, MITIGATE):** `7.7-COMP-001` (reachability/order) +
  `7.7-COMP-002` (focus-trap) + `7.1-COMP-003` (settings reachable) + `7.E2E-001` (keyboard-only
  walkthrough). Evidence: vitest component + E2E log. **Gates Epic 8.**
- **ACCESSIBILITY — contrast/focus (RISK-E7-003):** `7.2-UNIT-002` (computed, both themes) +
  `7.8-COMP-001` (jest-axe) + `7.7-COMP-003` (focus-ring style) + `7.E2E-002`/manual (real render).
  Evidence: vitest report + CI focus-ring screenshot. **Requires adding `jest-axe`/`axe-core`.**
- **USABILITY/RELIABILITY — hotkey safety (RISK-E7-001, MITIGATE):** `7.4-UNIT-001` (conflict
  distinguishable) + `7.4-INT-001` (no lockout on conflict) + `7.4-COMP-001` (toast/reset) +
  `7.4-INT-002` (restart load). Evidence: cargo unit/integration + vitest component. **Gates Epic 8.**
- **MAINTAINABILITY — config round-trip (RISK-E7-004):** `7.3-UNIT-001` + `7.6-UNIT-001` (default-on-
  missing, UX-DR27 defaults). Evidence: cargo report.
- **No new thresholds invented:** all sourced (NFR22/23, FR45, 7.8 24px, 7.4 5s).

### Execution Strategy (PR / Nightly / Weekly)

| Trigger | Suite | Target |
|---------|-------|--------|
| **PR** | All `vitest` component/unit (`7.1`–`7.8` incl. computed-contrast `7.2-UNIT-002` + jest-axe `7.8-COMP-001`) + Rust unit/integration (`7.3-UNIT-001`, `7.4-*`, `7.5-*`, `7.6-UNIT-*`) | < 15 min |
| **Nightly** | `7.E2E-001` (keyboard-only walkthrough) + `7.E2E-002` (real-WebView theme/geometry, focus-ring screenshot artifact) on Linux/xvfb | < 30 min |
| **Weekly / pre-Epic-8** | Confirm both MITIGATEs green (hotkey lockout-safety + keyboard reachability); manual real-screen-reader pass (RISK-E7-009) + manual cross-platform window-geometry/focus-ring (RISK-E7-008) | — |

### Resource Estimates (ranges)

| Bucket | Effort | Driver |
|--------|--------|--------|
| **Tooling/harness (one-time)** | ~8–16 h | Add `jest-axe`/`axe-core` to Vitest + a **computed token-contrast util** (parse theme CSS hex → WCAG ratio) + window-geometry integration driver + reuse config round-trip patterns |
| P0 (4) | ~10–18 h | Hotkey lockout-safety (Rust unit+integration) + keyboard reachability/focus-trap component (the 2 MITIGATEs) |
| P1 (16) | ~24–40 h | Settings panel + font + theme precedence + contrast-both-themes + config round-trips + conflict UI + layout-geometry integration + shortcut config + axe + aria-live + keyboard E2E |
| P2 (7) | ~8–16 h | theme-swap harden, font family, reset-defaults, focus-ring style, reduced-motion, text+colour, geometry E2E |
| **Total** | **~50–90 h (~1.5–2.5 weeks)** | Component-heavy; the contrast-util + jest-axe setup unlock the bulk of a11y coverage |

### Quality Gates

- **P0 100%** (PR blocker) · **P1 ≥95%** (PR blocker) · P2 ≥90% (nightly) · P3 none.
- **Both MITIGATEs green before Epic 8 / as acceptance-criteria gates:** RISK-E7-001 (hotkey
  lockout-safety — `7.4-UNIT-001`+`7.4-INT-001`) and RISK-E7-002 (keyboard reachability —
  `7.7-COMP-001`+`7.7-COMP-002`+`7.E2E-001`).
- **a11y build-time gate:** `jest-axe`/`axe-core` added + the computed-contrast util green for BOTH
  themes (`7.2-UNIT-002`) — the RISK-E7-003 mitigation prerequisite.
- Coverage targets (system-level): Rust ≥80%, TS stores/components ≥75%.
- **Gate posture: CONCERNS** (no score-9) → PASS once both MITIGATEs + the contrast/axe tooling land.
- **Open dependencies (resolve at story drafting):** 24px-vs-28px target size; layout-mode field
  semantics (RISK-E7-005); "conflicts with [app]" name obtainability; add `jest-axe`; reconcile the
  cumulative E2E budget.

## Step 5: Output Generation & Validation

- **Execution mode:** sequential (no `tea_execution_mode` set → auto; epic-level single-worker).
- **Output:** `_bmad-output/test-artifacts/test-design-epic-7.md` (epic-level template).
- **Handoff doc:** N/A (system-level only).
- **Browser/CLI sessions:** none opened (no playwright-cli) → nothing to clean up.
- **Temp artifacts:** all under `_bmad-output/test-artifacts/`.

### Checklist Validation Summary

- **Prerequisites (epic-level):** story ACs (`epics.md` 7.1–7.8) + PRD + architecture + UX spec +
  prior system-level test design present; requirements testable ✅
- **Context loading:** PRD/epics/architecture/UX-spec/project-context read; existing-vs-new analyzed
  (Explore agent — partial prior implementation mapped per story); knowledge fragments loaded ✅
- **Risk matrix:** 10 risks, unique IDs (RISK-E7-001…010), P,I ∈ {1,2,3}, Score = P×I, **2
  high-priority (≥6)** with mitigation/owner/timeline; residual (DOCUMENT) documented; categories
  correct ✅
- **NFR planning:** ACCESSIBILITY/USABILITY/MAINTAINABILITY/PERF in scope; no thresholds invented —
  only sourced budgets (4.5:1/3:1 NFR23, 2px/2px-offset/≥3:1 NFR22, 12–24px FR45, 24px 7.8, 5s 7.4);
  4 UNKNOWNs raised (24-vs-28px, layout-field semantics, conflict-app-name, jest-axe adoption);
  NFR-derived risks mapped into the register ✅
- **Coverage:** **27** scenarios (4 P0 + 16 P1 + 7 P2 + 0 P3) decomposed from ACs across 8 stories;
  levels assigned (Unit/Component/Integration/E2E); 🆕 NEW vs ⚠️ HARDEN marked; no duplicate
  cross-level coverage (contrast → `7.2-UNIT-002` only, not re-asserted in 7.8); every row AC/risk-
  linked; TEA refs mapped where aligned; counts reconciled (4+16+7=27; levels 7 unit/15 comp/3 int/
  2 e2e) ✅
- **P0 discipline:** 4/27 (~15%) — all four tied to the two score-6 MITIGATEs (blocks-core + ≥6 +
  no-workaround); strict criteria hold ✅
- **Priority ≠ timing** note at top of Coverage Plan; priority sections carry only Criteria ✅
- **Execution Strategy:** simple PR/Nightly/Weekly; philosophy stated; tests not re-listed; E2E
  deferred to nightly + manual a11y to weekly ✅
- **Resource estimates:** interval ranges (~10–18h P0 / ~24–40h P1 / ~8–16h P2 / ~8–16h tooling /
  total ~50–90h, ~1.5–2.5 wks); no false precision ✅
- **Quality gates:** P0 100%, P1 ≥95%, P2 ≥90%; both MITIGATEs + jest-axe/computed-contrast as
  build-time/acceptance gates before Epic 8; coverage targets (Rust ≥80%, FE ≥75%) ✅
- **Mitigation plans** for both score-6 risks (numbered strategy + owner + timeline + status +
  verification) ✅
- **Not-in-scope, Entry/Exit criteria, Assumptions/Dependencies, Interworking & Regression** all
  populated ✅
- **Testability ASRs** (a11y three-tier strategy incl. computed-contrast util; injectable/queryable
  config; conflict-result observability) flagged as build-time gates + Entry Criteria ✅
- **Key discrepancies surfaced (not silently resolved):** Story 7.5 layout-mode field collision
  (density vs geometry); 24px-vs-28px target; "conflicts with [app]" obtainability; cumulative
  E2E budget tension ✅
- **Gate posture: CONCERNS** (no score-9 blockers) → PASS once both MITIGATEs + the contrast/axe
  tooling land.

**Workflow complete.** Epic 7 (Personalization & Accessibility) test design generated at
`_bmad-output/test-artifacts/test-design-epic-7.md`. Forward-looking with partial prior
implementation (theme/density/config/tokens). Recommended next: `*atdd` to scaffold the red-phase
P0 tests (hotkey lockout-safety + keyboard reachability) and the computed-contrast/jest-axe a11y
harness (manual, not auto-run).
