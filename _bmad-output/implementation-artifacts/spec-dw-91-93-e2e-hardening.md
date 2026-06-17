---
title: 'Harden the new feature-E2E suites (DW-91/92/93)'
type: 'chore'
created: '2026-06-16'
status: 'done'
context: ['{project-root}/_bmad-output/project-context.md']
baseline_commit: '0d3392a37440f2694da61461c7cb1c2f74b7ec37'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The two new feature-E2E suites carry latent robustness gaps logged from their own review. **DW-92:** the trash-lifecycle suite trusts a single `ESCAPE` to close the trash overlay before re-trashing instead of asserting it is gone — if the overlay-coordination contract changes, the suite acts on a stacked overlay and fails opaquely. **DW-93:** the CLI live-sync assertion silently depends on the desktop's active workspace matching the CLI's cwd-resolved workspace; a stale persisted `activeWorkspaceId` would time the assertion out and misreport a workspace mismatch as an event-pipeline failure. (DW-91 — orphaned marker cleanup — is already fixed in `f660f42`; only its ledger status is stale.)

**Approach:** Add an explicit overlay-gone assertion at the restore→re-trash transition (DW-92). For DW-93, drive the desktop into **All Workspaces** mode at the start of the live-sync suite so the note-list filter is `null` and the CLI note surfaces regardless of its workspace — a human-approved renegotiation of the frozen cwd-only boundary in `spec-cli-live-sync-e2e.md`. Reconcile the DW-91/92/93 ledger statuses.

## Boundaries & Constraints

**Always:**
- Test-harness + a single UI `data-testid` only — zero product/runtime behavior change.
- New assertions must fail visibly (timeout with an actionable message), never silently pass.
- `waitForCssGone` polls to a deadline in the same style as the existing `waitFor*` helpers (150ms poll, `isFatalSession` re-throw).
- Preserve the existing `try/finally` marker-note teardown in both suites.

**Ask First:**
- Any change to the runtime behavior of the workspace filter or the `note-created` refresh path (this work stays test + testid only).
- Renegotiating any frozen-spec section beyond the DW-93 All-Workspaces change already approved.

**Never:**
- No localStorage-reset approach for DW-93 (explicitly rejected in favor of All-Workspaces).
- No new Tauri command, palette command, or keyboard shortcut for All Workspaces — drive the existing dropdown.
- Do not touch the CLI cwd resolution or `runCli`.
- Do not modify other sections of `spec-cli-live-sync-e2e.md` or weaken its frozen intent.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Restore step done, ESCAPE sent | trash panel open | `waitForCssGone` confirms panel removed before re-trash | timeout → fail "trash panel still visible" |
| Overlay coordination regresses | panel stays in DOM | assertion times out, suite fails loudly | actionable message names DW-92 invariant |
| CLI note in workspace ≠ desktop default | All-Workspaces mode (filter `null`) | note appears via the `note-created` seam regardless of workspace | assertion timeout, not a silent pass |
| Select All Workspaces | click selector trigger → All Workspaces item | `isAllWorkspaces` true; list unfiltered | item missing → `clickCss` timeout |

</frozen-after-approval>

## Code Map

- `e2e/run.mjs` -- E2E harness. Add `waitForCssGone()`; add the overlay-gone assertion in `trashLifecycleTests` restore step (DW-92); switch `cliLiveSyncTests` to All-Workspaces at suite start (DW-93). Helper to mirror: `waitForCss` (`e2e/run.mjs:103`).
- `src/features/workspace/components/WorkspaceSelector.tsx:92` -- add `data-testid="workspace-all"` to the All Workspaces `DropdownMenuItem` for robust WebDriver selection.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- reconcile DW-91 (already fixed, `f660f42`), DW-92, DW-93 → resolved by this spec.
- `_bmad-output/implementation-artifacts/spec-cli-live-sync-e2e.md` -- append a Spec Change Log entry recording the human-approved All-Workspaces renegotiation (do not edit its frozen block).

## Tasks & Acceptance

**Execution:**
- [x] `e2e/run.mjs` -- add `async function waitForCssGone(selector, timeoutMs = 5000)` mirroring `waitForCss`: poll every 150ms until `findElement` reports no match; re-throw on `isFatalSession`; throw an actionable error if the element is still present at the deadline.
- [x] `e2e/run.mjs` -- in `trashLifecycleTests` "Restore" step, after the existing `ESCAPE`, `await waitForCssGone('[data-testid="trash-panel"]')` before re-trashing (DW-92).
- [x] `src/features/workspace/components/WorkspaceSelector.tsx` -- add `data-testid="workspace-all"` to the All Workspaces item (line 92).
- [x] `e2e/run.mjs` -- in `cliLiveSyncTests`, after the `realInstancePresent` skip and before the pre-existing-marker check, drive the desktop to All Workspaces so the note-list filter is `null` for the suite (DW-93). Keep the panel-open-before-add ordering that makes the assertion exercise the live `note-created` seam. **Impl note:** added a `selectAllWorkspaces()` helper — focus the trigger → `Enter` to open the Base UI menu → `clickCss` the item to fire its `onClick` (`setAllWorkspaces`) → poll the trigger label to confirm the switch took effect. Two earlier attempts were caught by live E2E runs: a synthetic `PointerEvent` never opened the menu, and `Enter`-to-activate never selected (Base UI focuses the popup container, not item 0) — which silently left the list workspace-scoped and would have been a false pass without the label assertion. Final form verified 20/20 green.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- set DW-91 status resolved (already fixed `f660f42`); DW-92 + DW-93 resolved (this spec).
- [x] `_bmad-output/implementation-artifacts/spec-cli-live-sync-e2e.md` -- append Spec Change Log: "All-Workspaces renegotiation approved by Pinkyd 2026-06-16 (DW-93)".

**Acceptance Criteria:**
- Given the restore step has run and `ESCAPE` was sent, when the suite proceeds to re-trash, then it first asserts the trash panel is gone and fails with an actionable message if it is not.
- Given the live-sync suite starts, when it drives the desktop to All Workspaces, then `listNotes(null)` backs the list and the CLI-added note appears regardless of which workspace the CLI resolved.
- Given the `WorkspaceSelector` renders, when E2E targets the All Workspaces item, then it is selectable via `data-testid="workspace-all"` and existing `WorkspaceSelector.test.tsx` cases still pass.
- Given a full E2E run on Linux/xvfb, when it executes, then all suites stay green (no regression in trash-lifecycle, CLI live-sync, export, or capture-loop).

### Review Findings

- [x] [Review][Patch] All-Workspaces verification can false-pass on matching workspace labels [e2e/run.mjs:188]
- [x] [Review][Patch] Trash-panel timeout message is not the actionable invariant the spec requires [e2e/run.mjs:142]

## Design Notes

The window is hidden (`visible:false`), so `clickCss` uses a programmatic DOM `.click()` (see `e2e/run.mjs:124`). The Base UI dropdown menu does **not** open on a programmatic `.click()`/`PointerEvent`, and `Enter` after opening does **not** select (focus lands on the popup container, not item 0) — both surfaced as live E2E failures. `selectAllWorkspaces()` therefore: focuses the trigger, presses `Enter` to open (portal mounts the items), `clickCss` the item to fire its React `onClick` (`setAllWorkspaces`), then polls the trigger label until it reads "All Workspaces · …". That final poll is essential: without it the prior step silently failed yet the suite still passed because the CLI's cwd workspace happened to match the desktop's — the exact false pass DW-93 must prevent. The `note-created` refresh respects the filter (`store.ts:108-110`: `workspaceId = isAllWorkspaces ? null : activeWorkspaceId`), so All-Workspaces makes the assertion strictly more inclusive without bypassing the cross-process seam under test.

## Verification

**Commands:**
- `node --check e2e/run.mjs` -- expected: no syntax errors.
- `npx tsc --noEmit` -- expected: clean (the testid addition typechecks).
- `npx vitest run src/features/workspace/components/WorkspaceSelector.test.tsx` -- expected: pass.
- `xvfb-run -a npm run test:e2e` -- expected: all suites green, including trash-lifecycle (P1-E2E-002) and CLI live-sync (P1-E2E-003).

**Manual checks:**
- Inspect the rendered StatusBar dropdown DOM and confirm the All Workspaces item carries `data-testid="workspace-all"`.

## Suggested Review Order

**DW-93 — workspace-agnostic live-sync (highest-risk; start here)**

- Entry point: the suite now switches to All Workspaces before asserting, decoupling from cwd alignment.
  [`run.mjs:645`](../../e2e/run.mjs#L645)
- The helper: keyboard-open + item `onClick` + a label poll that turns a silent miss into a loud failure.
  [`run.mjs:163`](../../e2e/run.mjs#L163)
- The self-verification assert — this is what caught the false pass; without it the switch silently no-op'd.
  [`run.mjs:186`](../../e2e/run.mjs#L186)
- The one product-side change: a testid so the menu item is selectable; additive, no behavior change.
  [`WorkspaceSelector.tsx:92`](../../src/features/workspace/components/WorkspaceSelector.tsx#L92)

**DW-92 — explicit overlay-gone assertion**

- The assertion replacing a bare `pause(300)` at the trash restore→re-trash transition.
  [`run.mjs:560`](../../e2e/run.mjs#L560)
- The helper: only a genuine "no such element" counts as gone; transient driver errors keep polling.
  [`run.mjs:123`](../../e2e/run.mjs#L123)

**Bookkeeping**

- DW-91/92/93 ledger reconcile (DW-91 was already fixed in `f660f42`).
  [`deferred-work.md:711`](deferred-work.md#L711)
- Frozen-spec renegotiation recorded in the change log (frozen block untouched).
  [`spec-cli-live-sync-e2e.md:79`](spec-cli-live-sync-e2e.md#L79)
