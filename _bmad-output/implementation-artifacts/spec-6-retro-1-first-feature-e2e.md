---
title: 'First feature E2E — trash lifecycle via tauri-driver'
type: 'feature'
created: '2026-06-14'
status: 'done'
context: []
baseline_commit: '86f2ff42fc3ac8d27197efa6aefc82d9af9c8680'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Six epics in, the only E2E coverage is the 8 Epic-1 capture-loop tests (`e2e/run.mjs`). Every real feature — trash, export, CLI sync — is verified by hand, on a project driven unattended by bmad-auto. Epic 6 retro AI-1 (HIGH, Pinkyd-owned) calls for the first *feature* E2E to retire that gap.

**Approach:** Add a self-contained **trash-lifecycle** E2E suite to the existing tauri-driver/WebDriver harness, driving the real UI through one full cycle — create → move-to-trash (toast) → view trash → restore → re-trash → permanent-delete (confirm dialog) — asserting on real `data-testid` selectors. Trash is chosen over export (native OS dialog, not WebDriver-drivable) and CLI live-sync (needs subprocess + socket-injection harness work — deferred as the next E2E).

## Boundaries & Constraints

**Always:**
- Extend the existing harness (`e2e/run.mjs`, `e2e/driver.mjs`) — same raw-W3C-WebDriver style, no new test framework/deps. The new suite runs in its own fresh WebDriver session.
- Drive via app `data-testid` selectors (`command-palette`, `toaster`, `trash-panel`, `trash-item-*`, `trash-restore-*`, `trash-delete-*`, `confirm-delete-dialog`, `confirm-delete-confirm`), not CodeMirror CSS classes.
- The suite must **self-clean**: the app DB uses the real Tauri `app_data_dir()` (no test-isolation seam), so the note it creates must end permanently deleted. Tag it with a per-run-unique marker (`E2E-TRASH-${Date.now()}`) to identify it unambiguously.
- Trash/View-Trash are command-palette-only: open palette (`Ctrl+P`), type the exact label, press Enter. Create the note with `Ctrl+N` first so an active tab with a real `noteId` exists to trash.
- Add a modifier-chord helper to `driver.mjs` — `sendKeys`/`sendSpecialKey` cannot express `Ctrl+P`/`Ctrl+N`.
- Linux-CI-compatible: the existing `xvfb-run node e2e/run.mjs` job auto-runs the new suite — no workflow changes.

**Ask First:**
- Adding a code seam to the app to make E2E hermetic (e.g. a `NOTEY_DATA_DIR` env override on the DB path) — out of scope here; flag if self-clean proves insufficient.
- Driving the CLI live-sync path (subprocess spawn + `NOTEY_SOCKET_PATH`) — keep deferred.

**Never:**
- No native-dialog export E2E (un-drivable via WebDriver).
- No changes to app/runtime source under `src/` or `src-tauri/` to make the test pass — if a missing `data-testid` blocks it, HALT and report rather than restructuring the feature.
- No new npm dependencies; no nightly-only workflow (extend the existing on-PR E2E job).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Move to trash | Active note tab with marker content | Toast text contains "Note moved to trash"; note leaves active editor | Fail test if toast/selector absent within timeout |
| View trash | Trash command run after trashing | `trash-panel` displayed; a `trash-item-*` row contains the marker | Fail if panel or item missing |
| Restore | Click `trash-restore-*` on the trashed note | Row leaves the trash list; restore toast shown | Fail if row persists |
| Permanent delete | Re-trash, click `trash-delete-*`, confirm via `confirm-delete-confirm` | `confirm-delete-dialog` appears, then row gone after confirm | Fail if dialog absent or row remains |

</frozen-after-approval>

## Code Map

- `e2e/driver.mjs` -- raw W3C WebDriver client; add `sendChord` + `elementId(el)` unwrap helper.
- `e2e/run.mjs` -- harness entry; add the new suite, key constants, palette helper, and a fresh-session call in `main()`.
- `src/features/command-palette/hooks/usePaletteCommands.ts` -- exact command labels `"Move to Trash"` / `"View Trash"` (reference only).
- `src/features/trash/components/TrashPanel.tsx` + `ConfirmDeleteDialog.tsx` -- `trash-panel`, `trash-item/restore/delete-{id}`, `confirm-delete-dialog`, `confirm-delete-confirm` selectors (reference only).
- `src/features/toast/components/Toaster.tsx` -- `toaster` selector + exact toast strings (reference only).

## Tasks & Acceptance

**Execution:**
- [x] `e2e/driver.mjs` -- add `sendChord(sessionId, modifier, key)` (keyDown modifier → keyDown key → keyUp key → keyUp modifier via the actions API) and exported `elementId(el)` unwrap helper (plus `findElements`/`getElementAttribute` used to target the marker's own row in a non-isolated DB) -- needed to press `Ctrl+P`/`Ctrl+N` and to stop repeating the element-id unwrap.
- [x] `e2e/run.mjs` -- add `CONTROL`/`ENTER` key constants, a `runPaletteCommand(label)` helper (open palette via `Ctrl+P`, `sendKeys(label)`, press Enter), and `waitForCss`/`waitForCssGone`/`textOf`/`testIdContaining`/`reopenNoteByMarker` helpers -- shared mechanics for the suite.
- [x] `e2e/run.mjs` -- add `trashLifecycleTests()` exercising create→trash→toast→view→restore→re-trash→permanent-delete, then call it from `main()` in a fresh session (mirroring the existing two-session pattern) -- the feature E2E itself, self-cleaning via the final permanent delete.

**Acceptance Criteria:**
- Given a freshly launched app, when the suite creates a marker note and runs "Move to Trash", then a toast containing "Note moved to trash" is observed and the note is gone from the active editor.
- Given the note is trashed, when "View Trash" runs, then `trash-panel` is displayed and exactly the marker note's `trash-item-*` row is present.
- Given the trashed note, when restored then re-trashed and permanently deleted through the confirm dialog, then no `trash-item-*` row for the marker remains and the run leaves no residual marker note in the DB.
- Given `npx tauri build --debug --no-bundle` has produced the binary, when `node e2e/run.mjs` runs, then all prior 8 capture-loop tests still pass and the new trash-lifecycle assertions pass (`Results: N passed, 0 failed`).

## Spec Change Log

- **Build-unblock (user-authorized, outside `src/`/`src-tauri/` source):** implementation surfaced a pre-existing version mismatch — Rust `tauri` 2.10.3 vs npm `@tauri-apps/api` 2.11.0 — that made `npx tauri build --debug --no-bundle` (the CI E2E build step) fail its major/minor check, so the E2E binary could not build at all. Per Pinkyd's decision, aligned the whole stack **up to 2.11**: `cargo update` → `tauri 2.11.2` (+ runtime/build/macros/plugins/wry/tao), and pinned `@tauri-apps/api ^2.11.0` / `@tauri-apps/cli ^2.11.2`. Regression-checked: vitest 572 pass, cargo test 265 pass, clippy clean. This does not touch the frozen "Never modify app source to make the test pass" — no `src/`/`src-tauri/` source changed; only dependency manifests, and only to unblock the build the suite requires.

## Design Notes

**Local verification limit (honest status):** the suite is syntax-valid (`node --check`), lint-clean, and its logic is grounded in source-verified behavior (selectors, `Ctrl+P`/`Ctrl+N` triggers, `firstLine.slice(0,100)` title, "Note restored" toast, note-list reopen). It was **not** runnable to green on this dev machine: WebKitWebDriver crashes the automated page ("page crash or hang") under xvfb — and it crashes the **pre-existing 8 tests identically**, while the app runs fine standalone under xvfb (exit 124/timeout, no crash). So the crash is local WebKitGTK-automation fragility, not app or test defect; CI's pinned Ubuntu `webkit2gtk-driver` is the real execution gate. The `npx tauri build` step now succeeds, so CI is unblocked to run the suite.

**DB-isolation pragmatics:** there is no app-data/DB override seam (Linux `data_dir()` is still a `todo!()`), so the suite (a) tags its note with `E2E-TRASH-${Date.now()}`, (b) acts only on the row whose text contains that marker (`testIdContaining` → exact `trash-restore-{id}`/`trash-delete-{id}`), never "the first row", and (c) ends by permanently deleting it, leaving no residue even in a polluted dev DB.

## Verification

**Commands:**
- `npx tauri build --debug --no-bundle` -- expected: debug binary at `src-tauri/target/debug/tauri-app`.
- `node e2e/run.mjs` (locally; `xvfb-run node e2e/run.mjs` headless) -- expected: existing capture-loop + window-management tests pass AND the new trash-lifecycle tests pass; process exits 0.
- `npx eslint e2e/` (if covered by flat config) / `node --check e2e/run.mjs e2e/driver.mjs` -- expected: no syntax/lint errors.

**Manual checks (if no CLI):**
- After a run, confirm no leftover `E2E-TRASH-*` note exists (open the app, check note list and trash are clean) — proves the self-clean permanent-delete worked.

## Suggested Review Order

**Design intent (start here)**

- The whole feature: one self-cleaning create→trash→view→restore→re-trash→permanent-delete cycle.
  [`run.mjs:263`](../../e2e/run.mjs#L263)

**Driver primitives (new WebDriver capabilities)**

- Chorded shortcut support (`Ctrl+P/N/B`) the harness previously couldn't express.
  [`driver.mjs:112`](../../e2e/driver.mjs#L112)
- Plural element query + W3C element-id unwrap, used to target the marker's own row.
  [`driver.mjs:43`](../../e2e/driver.mjs#L43)

**Robustness helpers (the review-hardened seams)**

- Types into the cmdk input element directly so keystrokes can't leak into the editor.
  [`run.mjs:103`](../../e2e/run.mjs#L103)
- Polls toasts within the 3s auto-dismiss window instead of a single racy container read.
  [`run.mjs:86`](../../e2e/run.mjs#L86)
- Acts only on the row whose text contains the unique marker — never "the first row".
  [`run.mjs:119`](../../e2e/run.mjs#L119)
- Re-opens a restored (tab-less) note from the note list so it can be re-trashed.
  [`run.mjs:161`](../../e2e/run.mjs#L161)
- Fails fast on a dead session instead of masking a crash as a 5s timeout.
  [`run.mjs:63`](../../e2e/run.mjs#L63)

**Harness wiring & build unblock**

- New suite runs in its own fresh session, mirroring the existing two-session pattern.
  [`run.mjs:345`](../../e2e/run.mjs#L345)
- Dependency bump that unblocks `tauri build` (and thus the CI E2E job) — user-authorized.
  [`package.json:23`](../../package.json#L23)
