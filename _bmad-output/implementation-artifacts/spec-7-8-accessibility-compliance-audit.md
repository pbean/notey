---
title: "Accessibility Compliance Audit"
type: "feature"
created: "2026-06-14"
status: done
baseline_commit: "c8116120e32723408b1f6d3a9a7a186025b5dd63"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 7.8 is Epic 7's accessibility close-out (FR, NFR23). Prior stories delivered keyboard nav + focus indicators (7.7) and a both-theme contrast test for the Notey hex tokens (7.2), but the remaining WCAG 2.1 AA commitments are unverified or incomplete: the save indicator unmounts when idle, so it is not a stable screen-reader live region and "Saved" is never announced; the tab-overflow trigger has no accessible name; several custom controls (status-bar workspace selector, format toggle, tab close button) render click targets under 24px tall; and the contrast audit explicitly excluded the shadcn `oklch(...)` tokens that render real dialog/menu/command-palette text.

**Approach:** Audit and remediate the four remaining AA dimensions across all surfaces. (1) Make save status a *persistent* `aria-live="polite"` region and confirm every interactive element has an accessible name. (2) Lock the no-color-alone guarantee with regression assertions (save word, active-tab border+weight, search-match bold already exist — verify, don't redesign). (3) Bring sub-24px interactive targets up to ≥24px height by filling their container, not enlarging glyphs. (4) Extend the existing contrast audit to the shadcn `oklch` tokens in both themes, documenting the decorative exemptions (translucent dividers are not meaningful UI components under WCAG 1.4.11).

## Boundaries & Constraints

**Always:**
- Save status is announced through a persistent `aria-live="polite"` region that stays mounted across all save states (idle renders it empty); the StatusBar keeps `role="status"` for state queries.
- Every interactive element exposes an accessible name — visible text or `aria-label`.
- No state is conveyed by color alone: every status indicator (save state, active tab, search match) pairs color with a text label, weight, or border.
- Every interactive element's rendered click/touch target is ≥24px tall.
- The contrast audit covers BOTH themes: informational text ≥4.5:1; interactive UI-component boundaries and the *rendered* focus indicator ≥3:1. The rendered keyboard focus indicator is the app-wide `:focus-visible { outline: 2px solid var(--focus-ring) }` rule, so the focus-indicator ≥3:1 check is on `--focus-ring` (already asserted, passes in both themes). It keeps reading token values from `src/index.css` (single source of truth) so it cannot drift.

**Ask First:**
- Changing any design-token *value* (hex or `oklch`) to resolve a contrast failure — tokens are app-wide, so surface the failing pair and proposed value before editing.
- Adding any third-party accessibility or color-conversion dependency (implement `oklch`→sRGB in-repo instead).

**Never:**
- Do not change focus-indicator behavior, keyboard navigation, or in-app shortcut bindings (Stories 7.6/7.7 — frozen and already done).
- Do not redesign layout or restyle components beyond the minimal sizing/semantics changes the audit requires.
- Do not assert 3:1 on purely decorative separators (`--border-subtle`, translucent `--border`/`--input` at <100% alpha) — WCAG 1.4.11 governs meaningful UI components, not decoration; document the exemption instead.
- Do not assert any contrast floor on the shadcn `--ring` (`--color-ring`) token: it is NOT a rendered focus indicator in Notey — it appears only as a no-width 50%-alpha default `outline-color` (`* { outline-ring/50 }`) that the `:focus-visible` rule overrides for every keyboard focus. The real, visible focus indicator is `--focus-ring`. Document `--ring` as exempt (not rendered) rather than asserting it; do NOT change its value to satisfy a contrast floor it does not visibly contribute to.
- Do not add a noisy always-announcing live region that reads non-save chrome.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| -------- | ------------- | -------------------------- | -------------- |
| Save succeeds | `saveStatus`: idle→saving→saved | persistent live region text goes `""` → `"Saving..."` (only after the existing 200ms delay) → `"Saved"`; region stays mounted so a screen reader announces politely | N/A |
| Save fails | `saveStatus` → failed | live region shows the word `"Save failed"` (not color alone); persists until the next successful save | N/A |
| At rest | `saveStatus`: idle | live region is mounted but empty — no announcement, no visible text | N/A |
| Tab overflow shown | tab count overflows, overflow trigger renders | trigger exposes accessible name (e.g. `aria-label="More tabs"`) | N/A |
| Status-bar control sizing | workspace selector / format toggle rendered in 24px bar | each button's click target is ≥24px tall (fills bar height) | N/A |
| Tab close target | close button visible on active/hovered tab | target ≥24px tall; keeps `aria-label="Close {title}"` and `tabIndex={-1}` | N/A |
| Active-tab affordance | a tab is active | distinguished by bottom border + text weight/color (not color alone); `aria-selected` set | N/A |
| Contrast audit both themes | tokens parsed from `index.css` | shadcn `oklch` text pairs ≥4.5:1 and the rendered focus indicator `--focus-ring` ≥3:1, in dark AND light; the shadcn `--ring` token is documented as exempt (not a rendered focus indicator), NOT asserted | test fails loudly, naming the token pair, theme, and computed ratio |

</frozen-after-approval>

## Code Map

- `src/features/editor/components/SaveIndicator.tsx` -- wrap output in ONE persistent region (`aria-live="polite"`, `aria-atomic="true"`) that is always mounted; render the per-state inner span (`Saving...`/`Saved`/`Save failed`) inside it, empty string when idle. Keep the 200ms `Saving...` delay, the `.save-indicator-saved` fade class, and per-state colors. Do NOT add a second `role="status"` here (StatusBar owns that).
- `src/features/editor/components/StatusBar.tsx` -- keep `role="status"` (line 32). Give the format-toggle `<button>` a ≥24px target by filling the 24px bar height (`height: '100%'`, flex-centered) instead of `padding: 0` collapsing to ~15px.
- `src/features/workspace/components/WorkspaceSelector.tsx` -- the trigger already has `aria-label="Workspace selector"`; give it a ≥24px target (`height: '100%'`/`'24px'`, flex-centered) — currently `padding: 0` + 11px font collapses the click target below 24px.
- `src/features/tabs/components/TabBar.tsx` -- add an accessible name to the overflow `DropdownMenuTrigger` (`data-testid="tab-overflow"`, ~line 325) e.g. `aria-label="More tabs"`. Give the per-tab close `<button>` (~line 271) a ≥24px-tall target (set `height: '24px'`, flex-centered, keep the 14px `×` glyph, padding, visibility, and `aria-label`). Overflow trigger must also be ≥24px tall.
- `src/features/theme/contrast.test.ts` -- extend the existing audit: add an in-repo `oklch(...)`→sRGB converter (handle chroma; pure-gray `oklch(L 0 0)` reduces to luminance `L³`), parse the `:root`/`.dark` shadcn `oklch` tokens for both themes, and assert the real-rendered foreground-on-surface TEXT pairs at ≥4.5:1 in BOTH themes. The focus-indicator ≥3:1 check is on the RENDERED indicator `--focus-ring` (Part 1 `AA_NON_TEXT` already covers this in both themes — verify it stays). Do NOT assert on the shadcn `--ring` (`--color-ring`): it is not a rendered focus indicator (only a no-width 50%-alpha default `outline-color` the `:focus-visible` rule overrides), so add it to the commented exemption block alongside the decorative separators rather than asserting a 3:1 floor — and do NOT change its value. Pair each `X-foreground` with the surface it actually renders on: `foreground`→`background`, `card-foreground`→`card`, `popover-foreground`→`popover`, `primary-foreground`→`primary`, `secondary-foreground`→`secondary`, `accent-foreground`→`accent`. IMPORTANT: `muted-foreground` is secondary text rendered on `popover`/`card`/`background` (menu shortcuts, group headings, descriptions, empty states) — audit it against those surfaces, NOT against the `--muted` fill (`muted-foreground` on `--muted` in light theme is ~4.34:1 and `--muted` is a non-text fill, not a text surface). Add an explicit, commented exemption block stating that `--border-subtle` and the translucent `--border`/`--input` are decorative separators exempt from 1.4.11 — do not assert 3:1 on them. Keep the existing hex-token assertions intact.
- `src/features/editor/components/SaveIndicator.test.tsx` -- NEW: persistent live region present in every state incl. idle (empty); `aria-live="polite"`/`aria-atomic` set; each state renders its WORD (color-independent assertion).
- `src/features/editor/components/StatusBar.test.tsx` -- extend: `role="status"` present; format-toggle target height ≥24px.
- `src/features/tabs/components/TabBar.test.tsx` -- extend: overflow trigger has an accessible name; close button target height ≥24px; active tab carries a non-color affordance (border/weight) + `aria-selected`.
- `src/features/workspace/components/WorkspaceSelector.test.tsx` -- extend: trigger has accessible name (already) and target height ≥24px.
- `src/components/ui/button.tsx` -- NO change: verified all size variants are ≥24px (`xs`/`icon-xs` = 24px floor, others larger). Note only.

## Tasks & Acceptance

**Execution:**

- [x] `src/features/editor/components/SaveIndicator.tsx` -- converted to a persistent `aria-live="polite"` `aria-atomic="true"` region, always mounted, empty when idle; delay/fade/colors preserved; failure state now remains visible through retries until a save succeeds; inner `save-indicator` testids retained.
- [x] `src/features/editor/components/StatusBar.tsx` -- kept `role="status"`; removed the permanent right-side gap introduced by the always-mounted live region; format-toggle now uses an explicit 24px target.
- [x] `src/features/workspace/components/WorkspaceSelector.tsx` -- trigger now uses an explicit 24px target; existing `aria-label` retained.
- [x] `src/features/tabs/components/TabBar.tsx` -- added `aria-label="More tabs"` to the overflow trigger (`minHeight:24px`); close button is a 24px-tall centered target (14px glyph preserved).
- [x] `src/features/theme/contrast.test.ts` -- added an in-repo `oklch`→sRGB converter and both-theme assertions on the shadcn foreground-on-surface text tokens, including `foreground` on `muted` for selected command-palette items; fixed dark-token shadowing to layer `.dark`/`.light` overrides on `:root`; documented the decorative-separator (`border-subtle`, translucent border/input), `--ring` (not-rendered), and `destructive` exemptions. Audit passes.
- [x] Tests -- NEW `SaveIndicator.test.tsx` (persistent live region, word-based states, 200ms delay, failed→saving→saved persistence); extended `StatusBar.test.tsx`, `TabBar.test.tsx`, `WorkspaceSelector.test.tsx` (accessible names, ≥24px targets). Color-independent active-tab affordance + `aria-selected` already covered by existing TabBar tests; search-match no-color-alone coverage already existed in `HighlightedSnippet.test.tsx`.

**Acceptance Criteria:**

- Given a save cycle, when status moves idle→saving→saved→failed, then a persistent `aria-live="polite"` region (mounted even at idle) updates its text and a screen reader announces "Saved" / "Save failed" by word, while the StatusBar retains `role="status"`.
- Given every interactive control in the app, when inspected, then each exposes an accessible name — including the previously-unnamed tab-overflow trigger.
- Given any status indicator (save state, active tab, search match), when displayed, then its state is distinguishable without color (word / weight / border), asserted by regression tests.
- Given any interactive control, when its target is measured, then its rendered click target height is ≥24px.
- Given both themes, when the extended contrast audit runs against tokens read from `index.css`, then informational text meets ≥4.5:1 and focus/identifiable-component indicators meet ≥3:1, with purely decorative separators documented as exempt rather than asserted.

### Review Findings

- [x] [Review][Patch] Contrast audit must read the FINAL rendered token values (apply `.light`/`.dark` overrides on top of `:root`, not the shadowed `:root` values) so it cannot pass on stale values [src/features/theme/contrast.test.ts:114]. (The companion "omits `--ring`" concern is resolved separately: `--ring` is intentionally NOT asserted — see Review Ledger — because it is not a rendered focus indicator; the rendered indicator `--focus-ring` is asserted in Part 1.)
- [x] [Review][Patch] SaveIndicator regression coverage does not exercise one mounted live region through status transitions [src/features/editor/components/SaveIndicator.test.tsx:15]
- [x] [Review][Resolved 2026-06-14] The light-theme shadcn `--ring` 2.59:1 "failure" was a false positive: `--ring` is not a rendered focus indicator in Notey (no-width 50%-alpha default `outline-color`, overridden by the `:focus-visible` `--focus-ring` outline). Human decision: audit the rendered `--focus-ring` (already ≥3:1 both themes) and document `--ring` as exempt; no token-value change to `src/index.css:140`. Remove the `['ring','background',3]` assertion.
- [x] [Review][Patch] Persistent `SaveIndicator` text left an idle spacer in the status-bar controls row because the new live region kept the old permanent flex gap [src/features/editor/components/StatusBar.tsx:45]
- [x] [Review][Patch] Status-bar control sizing still relied on percentage heights, so the 24px target guarantee was not explicit [src/features/editor/components/StatusBar.tsx:45]
- [x] [Review][Patch] `Save failed` disappeared on retry instead of persisting until the next successful save [src/features/editor/components/SaveIndicator.tsx:46]
- [x] [Review][Patch] OKLCH contrast coverage missed `foreground` on `muted`, leaving selected command-palette items outside the new audit [src/features/theme/contrast.test.ts:186]

#### Review Ledger (2026-06-14)

- patch: Contrast audit reads shadowed token values and omits `--ring`, so Story 7.8 can pass while real contrast failures remain undetected [src/features/theme/contrast.test.ts:114] — the app applies `.light` / `.dark` theme-class overrides on top of `:root`, and the suite never asserted `--ring`, so the real 2.59:1 light-theme ring failure still passed.
- patch: SaveIndicator regression coverage does not exercise one mounted live region through status transitions [src/features/editor/components/SaveIndicator.test.tsx:15] — current tests only snapshot initial states, missing persisted-region and fast-save transition coverage.
- resolved (2026-06-14, bmad-auto-resolve): The light-theme shadcn `--ring` 2.59:1 result is not a real failure — `--ring` (`--color-ring`) is never rendered as a focus indicator in Notey (only a no-width 50%-alpha default `outline-color` that `:focus-visible` overrides with the `--focus-ring` outline). The rendered focus indicator is `--focus-ring`, which already passes ≥3:1 in both themes (Part 1 `AA_NON_TEXT`). Human decision: do NOT change the `--ring` value; remove the `['ring','background',3]` assertion and document `--ring` as exempt (not rendered) alongside the decorative-separator exemption. Frozen spec amended accordingly.
- dismiss: Destructive-button contrast is untested [src/features/theme/contrast.test.ts:232] — Story 7.8's frozen audit scope names the concrete text pairs plus `--ring`; destructive contrast is not a required surface here.
- dismiss: Close button target remains too narrow [src/features/tabs/components/TabBar.tsx:271] — the story and code map require a ≥24px-tall target, not a 24x24 square.
- dismiss: Overflow trigger remains too narrow [src/features/tabs/components/TabBar.tsx:331] — the story and code map require a ≥24px-tall target, not a 24x24 square.
- dismiss: Nested live regions will double-announce [src/features/editor/components/SaveIndicator.tsx:65] — the frozen intent explicitly requires a persistent inner `aria-live` while preserving StatusBar `role="status"`.
- dismiss: Spec artifact claims 56 contrast tests without evidence [/home/pinkyd/dev/notey/_bmad-output/implementation-artifacts/spec-7-8-accessibility-compliance-audit.md:74] — `npx vitest run src/features/theme/contrast.test.ts` confirms `56 passed`; the real issue is incomplete coverage, captured above.
- dismiss: `contrastRgba()` mishandles translucent backgrounds [src/features/theme/contrast.test.ts:100] — current audited surfaces are opaque or explicitly exempt, so this is hypothetical rather than a defect in the changed scope.
- patch: Persistent `SaveIndicator` text left an idle spacer in the status-bar controls row [src/features/editor/components/StatusBar.tsx:45] — the controls row still used a permanent flex gap even when the live region was empty; spacing now lives on the visible indicator text only.
- patch: Status-bar control sizing still relied on percentage heights [src/features/editor/components/StatusBar.tsx:45; src/features/workspace/components/WorkspaceSelector.tsx:47] — the 24px target guarantee was implicit and wrapper-dependent; both status-bar controls now use explicit 24px targets.
- patch: `Save failed` disappeared on retry instead of persisting until success [src/features/editor/components/SaveIndicator.tsx:46] — the indicator switched away from the failure word as soon as state moved back to `saving`; the failure word is now latched until `saved`/`idle`.
- patch: OKLCH audit missed `foreground` on `muted` [src/features/theme/contrast.test.ts:186] — selected command-palette items render `text-foreground` on `bg-muted`, so the new contrast coverage was incomplete.
- dismiss: Close/overflow/workspace trigger width complaints require 24x24 targets [src/features/tabs/components/TabBar.tsx:271; src/features/tabs/components/TabBar.tsx:331; src/features/workspace/components/WorkspaceSelector.tsx:47] — this story requires ≥24px height, not 24x24 squares; the tab-width concerns were previously dismissed.
- dismiss: Empty polite live region may announce “blank” [src/features/editor/components/SaveIndicator.tsx:49] — speculative AT/browser-specific behavior; manual screen-reader verification remains the appropriate check.
- dismiss: Style-string assertions cannot prove rendered target size [src/features/editor/components/StatusBar.test.tsx:90; src/features/workspace/components/WorkspaceSelector.test.tsx:61; src/features/tabs/components/TabBar.test.tsx:419] — overbroad; the changed controls are inline-style driven and the targeted suite now locks the explicit 24px contracts.
- dismiss: Destructive-button contrast is untested [src/features/theme/contrast.test.ts:202] — previously dismissed — see ledger.
- dismiss: `extractBlock()` only reads the first matching theme block [src/features/theme/contrast.test.ts:40] — hypothetical; the current stylesheet has one relevant block per selector.
- dismiss: OKLCH parser rejects broader CSS token syntaxes [src/features/theme/contrast.test.ts:55] — hypothetical; the audited tokens in `src/index.css` are plain numeric OKLCH declarations.
- dismiss: `wcagRatio()` ignores translucent audited backgrounds [src/features/theme/contrast.test.ts:101] — hypothetical; audited text surfaces are opaque and translucent border/input tokens are explicitly exempt.
- dismiss: 24px target comments overstate WCAG 2.1 AA [src/features/editor/components/StatusBar.tsx:55; src/features/workspace/components/WorkspaceSelector.tsx:56; src/features/tabs/components/TabBar.tsx:285] — documentation phrasing only, not a behavior or acceptance regression.
- dismiss: SaveIndicator can remount with a terminal message already present [src/features/editor/components/SaveIndicator.tsx:49] — speculative lifecycle edge case outside normal save flows.
- dismiss: Search-match no-color-alone verification is missing [src/features/search/components/HighlightedSnippet.test.tsx:12] — contradicted by existing bold/background regression coverage.
- dismiss: Contrast exemption block is too vague [src/features/theme/contrast.test.ts:202] — contradicted by the current explicit separator and `--ring` rationale in the file.

## Design Notes

- **Persistent live region (golden shape).** A polite live region only announces mutations that occur *after* it is in the DOM. The current `SaveIndicator` returns `null` at idle and mounts a span on save, so the change is the insertion of the region itself — frequently not announced. Fix:
  ```tsx
  return (
    <span data-testid="save-indicator-live" aria-live="polite" aria-atomic="true" style={{ fontSize: '11px' }}>
      {status === 'saving' ? (showSaving ? <span style={{ color: 'var(--text-muted)' }}>Saving...</span> : null)
       : status === 'saved' ? <span className="save-indicator-saved" style={{ color: 'var(--success)' }}>Saved</span>
       : status === 'failed' ? <span style={{ color: 'var(--warning)' }}>Save failed</span>
       : null}
    </span>
  );
  ```
  Keep `data-testid="save-indicator"` on the inner spans so existing tests still resolve. Use `aria-live` here (not `role="status"`) — the StatusBar already supplies `role="status"`; the inner polite region is the nearest live ancestor for the save text, so one announcement results.
- **24px targets — fill, don't grow.** The controls sit in a 24px status bar / 32px tab; setting `height: '100%'` (status bar) or `height: '24px'` (tab close) with flex-centering yields a 24px target while keeping the small glyph/text. The tab close button also has keyboard equivalents (Delete, Ctrl+W) but we still meet 24px for pointer users.
- **Contrast — oklch + exemptions.** For a pure-gray `oklch(L 0 0)` the sRGB relative luminance is exactly `L³` (chroma 0 ⇒ equal linear RGB ⇒ `Y = L³`); implement the general converter for chromatic tokens (e.g. `--destructive`). The shadcn foreground-on-surface text pairs resolve to large L gaps and pass ≥4.5:1 in both themes; assert them to lock coverage. Translucent `--border`/`--input` (10–15% alpha) and `--border-subtle` are decorative dividers — controls are identified by fill + label + focus ring, so under WCAG 1.4.11 these are exempt; document this in the test rather than asserting (and never lower a token to force a pass without **Ask First**).

## Verification

**Commands:**

- `npx vitest run src/features/theme/contrast.test.ts` -- expected: extended audit green; shadcn oklch text/focus pairs pass in dark AND light; existing hex assertions still pass.
- `npx vitest run` -- expected: new `SaveIndicator.test.tsx` and extended StatusBar/TabBar/WorkspaceSelector tests pass; all prior tests stay green.
- `npx tsc --noEmit` -- expected: no type errors.
- `npx eslint src` -- expected: clean (scoped to `src`; `eslint .` also sweeps unrelated pre-existing failures in build artifacts/skill templates).

**Manual checks:**

- With a screen reader active, save a note and confirm "Saved" is announced once, politely; trigger a failure and confirm "Save failed" is announced.
- Tab through the app and confirm each stop is a ≥24px target; toggle OS dark/light and confirm chrome remains legible.
