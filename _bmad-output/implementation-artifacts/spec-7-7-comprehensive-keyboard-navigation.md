---
title: "Comprehensive Keyboard Navigation"
type: "feature"
created: "2026-06-14"
status: "done"
baseline_commit: "bc2a9c44b07bcd603ca9c47e199fae704b9df91b"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-7-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Notey is a keyboard-first capture tool, but core surfaces are not fully keyboard-operable and lack a consistent focus story (FR48, NFR21/22). The tab bar tabs (`role="tab"`) have no `tabIndex`, so Tab cannot reach them and their close buttons are hover-only. There is no global token-based focus indicator — focus styling is ad-hoc (inline `outline` toggles in some overlays, `ring-ring/50` in shadcn primitives, `outline:none` on panels), so it neither uniformly matches the required 2px `var(--focus-ring)` outline nor reliably clears 3:1 contrast. Only a single animation is gated for `prefers-reduced-motion`; button/input/dialog transitions still animate. Focus-trap logic is duplicated across four overlays in two divergent styles (two hand-rolled cyclers, two crude Tab-suppressors).

**Approach:** Make the whole main window keyboard-navigable in visual order (tab bar → editor → status bar) and give it one consistent, accessible focus story. Convert the tab bar to the ARIA tablist roving-tabindex pattern with arrow-key navigation and keyboard-operable close. Add a single global `:focus-visible` outline driven by `var(--focus-ring)` (2px, 2px offset) and retire the ad-hoc per-component focus styling. Add an app-wide `prefers-reduced-motion` reset so all transitions/animations (including focus) are instant. Consolidate overlay focus-trapping into one shared, tested `useFocusTrap` hook adopted by the custom overlays; keep the command palette on Base UI's built-in modal trap and lock it with a regression test.

## Boundaries & Constraints

**Always:**
- Every interactive element in the main window is reachable via Tab/Shift+Tab in visual order: tab bar → editor → status bar. The editor (`.cm-content`) and status-bar buttons remain natively focusable.
- The single focus indicator is a 2px solid outline in `var(--focus-ring)` at 2px offset, shown on `:focus-visible` (keyboard), defined once globally. The `--focus-ring` token already exists per theme and is documented ≥3:1; do not change its values.
- While any overlay is open (search, command palette, note list, trash, settings), Tab/Shift+Tab keeps focus inside that overlay and never reaches the editor behind it; Esc remains the documented way out and returns focus to the editor.
- With `prefers-reduced-motion: reduce`, focus transitions and all UI animations/transitions are effectively instant.
- Preserve all existing behavior: Ctrl/Cmd+Tab tab cycling and Ctrl/Cmd+1–9 jumps (`useTabKeyboardNav`), overlay open/close + arrow/Enter list navigation, drag-to-reorder, auto-focus-on-open, and editor refocus-on-close.

**Ask First:**
- Adding any third-party focus-trap/keyboard dependency (implement in-repo instead).
- Changing the `--focus-ring` token values or introducing new design tokens.

**Never:**
- Do not add ARIA `aria-label`/`aria-live`/`role=status` semantics, color-vs-text affordances, 24px target sizing, or the cross-theme contrast audit — those are Story 7.8, out of scope here.
- Do not alter the in-app shortcut bindings, the command/action registry, or the global capture hotkey.
- Do not introduce a mouse-only or `:focus` (non-`:focus-visible`) ring that flashes on click.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| -------- | ------------- | -------------------------- | -------------- |
| Tab into window from start | focus before tab bar, press Tab | focus lands on the active tab (roving `tabIndex=0`); next Tab → editor; next Tab → first status-bar control | N/A |
| Arrow within tablist | a tab focused, press →/← (Home/End) | focus moves to next/prev (first/last) tab; Enter/Space activates the focused tab | wrap or clamp at ends consistently |
| Close focused tab via keyboard | a tab focused, press Delete/Backspace | that tab closes (same path as the close button / Ctrl+W); focus moves to an adjacent tab | no-op if only-tab rules already forbid close |
| Keyboard focus indicator | any focusable element receives `:focus-visible` | 2px solid `var(--focus-ring)` outline at 2px offset is shown | N/A |
| Pointer click focus | element focused by mouse click | no `:focus-visible` outline flash (pointer focus only) | N/A |
| Tab trap in overlay | search/command-palette/note-list/trash/settings open, press Tab/Shift+Tab repeatedly | focus cycles among the overlay's focusable elements (or stays on the container if none); never reaches the editor | N/A |
| Reduced motion | `prefers-reduced-motion: reduce`, focus moves / dialog opens | outline appears instantly; dialog/button transitions do not animate | N/A |

</frozen-after-approval>

## Code Map

- `src/index.css` -- add, in `@layer base`, one `:focus-visible` rule (`outline: 2px solid var(--focus-ring); outline-offset: 2px;`) and a global `@media (prefers-reduced-motion: reduce)` reset zeroing `animation-duration`/`transition-duration`/`scroll-behavior` on `*, *::before, *::after`. The existing `.save-indicator-saved` gate stays (harmless/subsumed). The token values (`--focus-ring` at lines 186/282) are unchanged.
- `src/lib/useFocusTrap.ts` -- NEW shared hook `useFocusTrap(ref, active)`: while active, a `keydown` listener on the container handles Tab/Shift+Tab — it cycles focus among focusable descendants (`a[href]/button/input/select/textarea/[tabindex]:not([tabindex="-1"])`, excluding disabled), wrapping last→first and first→last and pulling focus back in if it has strayed outside; if none are focusable it `preventDefault`s so focus parks on the container. Tab-trap only: it does NOT manage initial focus or return-focus — each overlay keeps its existing auto-focus-on-open and editor-refocus-on-close (boundary requirement).
- `src/lib/useFocusTrap.test.ts` -- NEW unit tests for the hook: initial focus, forward/backward cycling, container fallback when no focusable children, inactive = no-op.
- `src/features/tabs/components/TabBar.tsx` -- apply the ARIA tablist roving-tabindex pattern: container `role="tablist"`; each tab roving `tabIndex` (active `0`, others `-1`); ←/→/Home/End move focus among tabs; Enter/Space activates the focused tab (`switchTab`); Delete/Backspace closes the focused tab; close `<button>` becomes keyboard-visible on tab focus (not hover-only) and stays `tabIndex={-1}` (operated via Delete/pointer). Preserve click, drag-reorder, `aria-selected`, and the overflow dropdown.
- `src/features/search/components/SearchOverlay.tsx` -- replace the hand-rolled `handleOverlayKeyDown` trap with `useFocusTrap`; drop the inline `onFocus/onBlur` outline toggle on the input (now global). Keep arrow/Enter result nav and Esc-close.
- `src/features/note-list/components/NoteListPanel.tsx` -- replace the bare `Tab → preventDefault` with `useFocusTrap`; remove inline `outline: 'none'`. Keep arrow/Enter selection, Esc/backdrop close, and self-focus on open.
- `src/features/trash/components/TrashPanel.tsx` -- same change as NoteListPanel (shared hook, remove `outline:'none'`), preserving the confirm-delete guard and restore/delete actions.
- `src/features/settings/components/SettingsPanel.tsx` -- replace the hand-rolled trap with `useFocusTrap`; drop the `withFocusRing()` inline outline helper in favor of the global `:focus-visible`. Keep Esc-close, first-control auto-focus, and the Ctrl/Cmd+Z/X/C/V guards.
- `src/components/ui/button.tsx`, `input.tsx`, `textarea.tsx`, `input-group.tsx` -- align Tab-focusable form controls to the token outline: remove the base `outline-none` suppression and the ad-hoc `focus-visible:ring-3 ring-ring/50 border-ring` (and InputGroup's `has-[…focus-visible]` ring) so the single global `:focus-visible` outline is the indicator (a Tailwind utility in the `utilities` layer otherwise overrides the base rule). Leave `aria-invalid` error rings intact. Arrow-navigated menu/listbox items (`command.tsx`, `dropdown-menu.tsx` items) keep their conventional `focus:bg-accent`/`data-selected:bg-muted` highlight — outlines inside popups are non-standard for roving-focus lists.
- `src/features/settings/components/HotkeyCaptureField.tsx` + `ShortcutCaptureRow.tsx` -- remove the inline `onFocus/onBlur` focus-outline helper in favor of the global rule; keep the always-on capture-mode outline (it signals active capture, not focus).
- `src/features/command-palette/components/CommandPalette.test.tsx` -- NEW/extended: regression test that Base UI's modal dialog traps focus (Tab from the last focusable element stays within the palette, not the editor).
- Co-located tests: extend `TabBar.test.tsx` (roving tabindex, arrow/Home/End nav, Enter/Space activate, Delete close), and `SearchOverlay.test.tsx` / `NoteListPanel.test.tsx` / `TrashPanel.test.tsx` / `SettingsPanel.test.tsx` to assert focus stays trapped via the shared hook.

## Tasks & Acceptance

**Execution:**

- [x] `src/lib/useFocusTrap.ts` (NEW) -- implemented the shared Tab-trap hook (Tab/Shift+Tab cycling, stray-focus reclaim, container fallback, inactive no-op). Initial focus stays with each overlay (boundary: preserve auto-focus-on-open).
- [x] `src/lib/useFocusTrap.test.ts` (NEW) -- unit tests: wrap forward/backward, mid-sequence pass-through, no-focusable fallback, inactive no-op, non-Tab ignore.
- [x] `src/index.css` -- added the global `:focus-visible` outline rule (base layer) and the app-wide `prefers-reduced-motion` reset.
- [x] `src/features/tabs/components/TabBar.tsx` -- roving-tabindex ARIA tablist with arrow/Home/End nav, Enter/Space activate, Delete/Backspace close (+post-close refocus), close button `tabIndex=-1` and visible on active/hover.
- [x] `src/features/search/components/SearchOverlay.tsx` + `src/features/note-list/components/NoteListPanel.tsx` + `src/features/trash/components/TrashPanel.tsx` + `src/features/settings/components/SettingsPanel.tsx` -- adopted `useFocusTrap`, removed the duplicated/crude trap code, inline focus-outline styling, and `outline:none`. Trash gates the trap on `!pendingDeleteNote` so the confirm dialog owns focus.
- [x] `src/components/ui/{button,input,textarea,input-group}.tsx` + `HotkeyCaptureField.tsx`/`ShortcutCaptureRow.tsx` -- retired `outline-none`/`ring-ring/50`/inline focus handlers so the global token outline is the single indicator (kept `aria-invalid` rings, capture-mode outline, and menu/listbox highlights).
- [x] Tests -- added the CommandPalette trap regression test; extended `TabBar.test.tsx` for tablist keyboard nav; added trap tests to Trash/Settings (Search/NoteList trap tests already existed and pass against the shared hook).

**Acceptance Criteria:**

- Given the app at rest, when the user presses Tab from the top, then focus visits the active tab, then the editor, then the status-bar controls in that order, and Shift+Tab reverses it — every interactive element is reachable without a mouse.
- Given a focused tab, when the user presses ←/→/Home/End then Enter/Space then Delete, then focus moves between tabs, the focused tab activates, and the focused tab closes — matching the click/Ctrl+W behavior.
- Given any element receives keyboard focus, when its focus indicator renders, then it is a 2px solid `var(--focus-ring)` outline at 2px offset defined by one global rule; a pointer click does not produce that outline.
- Given an overlay (search, command palette, note list, trash, or settings) is open, when the user presses Tab/Shift+Tab repeatedly, then focus stays within that overlay and never reaches the editor behind it.
- Given `prefers-reduced-motion: reduce`, when focus moves or a dialog/menu opens, then the focus outline and all transitions/animations are instant.

### Review Findings

- [x] [Review][Patch] Keep tab-bar arrow navigation as roving focus only [src/features/tabs/components/TabBar.tsx:47]
- [x] [Review][Patch] Reclaim focus from non-tabbable and escaped states in the shared trap [src/lib/useFocusTrap.ts:27]
- [x] [Review][Patch] Self-focus the note-list panel when it opens [src/features/note-list/components/NoteListPanel.tsx:49]
- [x] [Review][Patch] Clear reduced-motion animation and transition delays [src/index.css:294]
- [x] [Review][Patch] Exercise Tab trapping in the command-palette regression test [src/features/command-palette/components/CommandPalette.test.tsx:88]

#### Review Ledger (2026-06-14T03:40:27-07:00)

- patch: Keep tab-bar arrow navigation as roving focus only [src/features/tabs/components/TabBar.tsx:47] — separated roving focus from activation and kept keyboard-focused tabs scrolled into view
- patch: Reclaim focus from non-tabbable and escaped states in the shared trap [src/lib/useFocusTrap.ts:27] — moved the trap listener to document capture and redirected container/non-tabbable focus states
- patch: Self-focus the note-list panel when it opens [src/features/note-list/components/NoteListPanel.tsx:49] — aligned the no-tabbable overlay with the container-focus behavior in the approved code map
- patch: Clear reduced-motion animation and transition delays [src/index.css:294] — zeroed delay properties so reduced-motion transitions are effectively instant
- patch: Exercise Tab trapping in the command-palette regression test [src/features/command-palette/components/CommandPalette.test.tsx:88] — the regression now sends Tab and verifies focus stays inside the modal
- dismiss: Preserve InputGroup outer-shell focus ring [src/components/ui/input-group.tsx:17] — approved spec explicitly replaces this with the single global `:focus-visible` outline
- dismiss: Autofocus the first trash action button on open [src/features/trash/components/TrashPanel.tsx:49] — the shared trap fix now closes the Shift+Tab leak without changing the row-focused restore flow

## Design Notes

- **Tablist + close-button reachability:** the ARIA tablist pattern is a single tab stop (roving tabindex) with arrow-key navigation inside it. To keep that clean while making close keyboard-operable, the per-tab close `<button>` stays `tabIndex={-1}` and is operated by Delete/Backspace on the focused tab (and still by pointer) rather than becoming its own tab stop; it must become visible on tab focus, not only on hover. Ctrl/Cmd+W continues to close the active tab.
- **Why one global `:focus-visible` rule:** centralizing the indicator guarantees the exact 2px/`var(--focus-ring)`/2px-offset spec everywhere and removes four divergent ad-hoc styles. Caveat to honor: Tailwind utilities live in the `utilities` layer, which overrides `@layer base`; any element still carrying `outline-none`/`outline-hidden` will suppress the base outline, so those utilities must be removed from the shared primitives for the rule to take effect.
- **Focus trap is consolidation, not just a bug fix:** verification showed all five overlays already prevent Tab escape (Search/Settings via hand-rolled cyclers, command palette via Base UI `modal=true` → `FloatingFocusManager`, note-list/trash via Tab-suppress + self-focus). The shared `useFocusTrap` replaces the four custom implementations with one tested one; the command palette keeps Base UI's trap and gains a regression test. Do not add a trap to the command palette.
- **`useFocusTrap` golden shape:** `const focusables = ref.current.querySelectorAll('input,button,select,textarea,[href],[tabindex]:not([tabindex="-1"])')` filtered for `!disabled`; on Tab at `last` → `first.focus()`, on Shift+Tab at `first` → `last.focus()`, both `preventDefault`; empty list → `preventDefault` only (focus stays on the `tabIndex=-1` container).

## Verification

**Commands:**

- `npx tsc --noEmit` -- expected: no type errors (new hook + edited components type-check).
- `npx vitest run` -- expected: new `useFocusTrap.test.ts`, the CommandPalette trap test, and the extended TabBar/overlay tests pass; existing tab-nav, overlay, and settings tests stay green.
- `npx eslint src` -- expected: clean (no `no-misused-promises`/hook-deps regressions). Scoped to `src` because `eslint .` also sweeps pre-existing failures in `src-tauri/target/` build artifacts and skill templates, unrelated to this story.

**Manual checks:**

- With the dev app, tab from a cold focus state and confirm the order tab bar → editor → status bar, the visible 2px focus outline on each stop, and that opening each overlay traps Tab; toggle OS "reduce motion" and confirm the outline/dialog transitions are instant.
