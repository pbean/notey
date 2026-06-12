---
title: 'Guard the startup-vs-toggle race for theme/layout DOM application'
type: 'bugfix'
created: '2026-06-12'
status: 'done'
context: ['{project-root}/_bmad-output/project-context.md']
baseline_commit: '1240c90045b1281925b4731c50c40e5b4df55726'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `applyStartupConfig` and the `toggleTheme` / `toggleLayoutMode` in-flight guards are independent state. `applyStartupConfig` kicks off its `getConfig` at module load (`main.tsx`), before React mounts. A user toggle fired during the brief boot window reads, persists, and applies the *new* value via `applyThemeClass` / `applyLayoutModeClass`; then `applyStartupConfig`'s stale `getConfig` resolves and re-applies the *old* class. The DOM ends up disagreeing with the persisted config until the next restart. The existing in-flight booleans do not cover this — they are already cleared by the time the stale startup write lands.

**Approach:** Give `applyStartupConfig` and the toggles shared state. Track, per display dimension (theme, layout), whether the user has explicitly toggled it this session via one module-level record both paths consult. A toggle marks its dimension when it applies a class; `applyStartupConfig` skips applying any dimension already marked. Startup never clobbers a value the user has explicitly chosen, regardless of how the two async flows interleave.

## Boundaries & Constraints

**Always:** The shared marker is sticky for the session (a user's explicit toggle wins over the boot-time snapshot for the rest of the run). A toggle sets its dimension's marker only when it actually applies the class (i.e. after `updateConfig` succeeds, alongside the existing `applyThemeClass` / `applyLayoutModeClass` call) — never on an early error return, so a failed toggle does not suppress startup application. `applyStartupConfig` evaluates each dimension independently: a theme toggle must not suppress layout startup application, or vice versa. Preserve the existing per-toggle in-flight guards (`isTogglingTheme` / `isTogglingLayoutMode`) — they protect the key-repeat lost-update race and are orthogonal to this fix. Keep the synchronous `classList.add('dark')` pre-paint default and the immediate (non-blocking) React mount in `main.tsx`. Use tauri-specta `commands.*` bindings — never raw `invoke`.

**Ask First:** Changing `main.tsx` boot ordering (e.g. awaiting `applyStartupConfig` before mounting) — rejected here because it would block first paint on `getConfig` and risk the hotkey-to-visible / cold-start budgets; only revisit if the shared-marker approach proves insufficient.

**Never:** Do not change the Rust config model, defaults, or `update_config` semantics. Do not add a settings store/feature. Do not alter toggle UX beyond the shared marker. Do not couple the two dimensions into a single shared flag (theme and layout must stay independent). Do not block or delay the React mount.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| No boot-window toggle | `applyStartupConfig` runs, no toggle fired | Persisted theme + layout applied from config | N/A |
| Theme toggled before startup `getConfig` resolves | toggle applies + marks theme; `applyStartupConfig` then resolves with stale snapshot | Startup skips theme (toggle's value stands), still applies persisted layout | N/A |
| Layout toggled in boot window | layout toggle applies + marks layout; startup resolves stale | Startup skips layout, still applies persisted theme | N/A |
| Toggle after startup completes | `applyStartupConfig` already applied persisted values | Marker irrelevant; toggle flips from the persisted value normally | N/A |
| Toggle fails before applying | toggle's `getConfig`/`updateConfig` errors, returns early | Dimension NOT marked; `applyStartupConfig` still applies persisted value | toggle `console.error`, return |
| Startup `getConfig` fails | IPC error | DOM untouched (synchronous dark default kept); no dimension marked | `console.error`, return |

</frozen-after-approval>

## Code Map

- `src/features/command-palette/actions.ts` -- owns `applyStartupConfig`, `toggleTheme`, `toggleLayoutMode`, and the `applyThemeClass` / `applyLayoutModeClass` helpers. Add the shared per-dimension marker + a test-only reset export; consult/set it in startup and toggles. **All production logic lives here.**
- `src/main.tsx` -- boot entry; calls `void applyStartupConfig()` then mounts. Reference only — no change required (the fix is self-contained in `actions.ts`; the original DW noted `main.tsx` only because it hosts the boot kickoff).
- `src/features/command-palette/actions.test.ts` -- existing startup + toggle tests; extend with interleaving coverage for the shared marker.
- `src/test-utils/setup.ts` -- global `afterEach` store/DOM reset; add the toggle-tracking reset so the sticky marker does not bleed across tests.

## Tasks & Acceptance

**Execution:**

- [x] `src/features/command-palette/actions.ts` -- Add a module-level `userToggled = { theme: false, layoutMode: false }` record (JSDoc its purpose: dimensions the user explicitly toggled this session, consulted by startup so a boot-window toggle is never clobbered). In `applyStartupConfig`, apply theme only when `!userToggled.theme` and layout only when `!userToggled.layoutMode` (each independent). In `toggleTheme`, set `userToggled.theme = true` where it calls `applyThemeClass(next)` (success path only). In `toggleLayoutMode`, set `userToggled.layoutMode = true` where it calls `applyLayoutModeClass(next)`. Export a `resetToggleTracking()` test helper (JSDoc as test-only) that clears both flags. Do not remove the existing in-flight guards.
- [x] `src/test-utils/setup.ts` -- Import and call `resetToggleTracking()` in the global `afterEach`, alongside the existing store resets, so the sticky marker is cleared between tests.
- [x] `src/features/command-palette/actions.test.ts` -- Add a describe block for the startup-vs-toggle race: (a) theme toggled while a deferred startup `get_config` is in flight → after both resolve, the toggled theme stands and startup does NOT overwrite it; (b) same for layout; (c) a theme toggle does not suppress layout startup application (independence); (d) a toggle whose `update_config` fails leaves its dimension unmarked so a subsequent `applyStartupConfig` still applies the persisted value. Reuse the existing deferred-promise pattern (`pendingGetConfig` + `resolveGetConfig`). Rely on the new global `afterEach` reset for isolation.

**Acceptance Criteria:**

- Given the user toggles theme during the boot window (before `applyStartupConfig`'s `getConfig` resolves), when `applyStartupConfig` later resolves with the pre-toggle snapshot, then the DOM theme class reflects the user's toggle and is not reverted to the persisted snapshot.
- Given the user toggled theme in the boot window, when `applyStartupConfig` runs, then it still applies the persisted `layoutMode` (dimensions are guarded independently).
- Given a toggle errors before applying its class, when `applyStartupConfig` subsequently runs, then it applies the persisted value for that dimension (a failed toggle does not suppress startup).
- Given no toggle fires during boot, when `applyStartupConfig` runs, then it applies both persisted theme and layout exactly as before this change (no regression).
- Given the existing key-repeat scenario, when a toggle is invoked twice in rapid succession, then exactly one `update_config` is issued (in-flight guard behavior preserved).

### Review Findings

- [x] [Review][Patch] Layout boot-window race coverage is incomplete [src/features/command-palette/actions.test.ts:350]
- [x] [Review][Patch] `console.error` spy cleanup is not failure-safe [src/features/command-palette/actions.test.ts:413]

#### Review Ledger (2026-06-12)

- patch: Layout boot-window race coverage is incomplete [src/features/command-palette/actions.test.ts:350] — The layout-race test never proves startup still applies the persisted theme after skipping the user-toggled layout dimension.
- patch: `console.error` spy cleanup is not failure-safe [src/features/command-palette/actions.test.ts:413] — The test restores the spy only on the happy path, so a failed assertion can leak the spy into later cases.
- dismiss: Absolute spec diff path is a diff-generation artifact [spec diff header] — The review diff used `git diff --no-index` against an absolute path; the repo file itself is correctly located under `_bmad-output/implementation-artifacts/`.
- dismiss: Sticky marker makes later `applyStartupConfig()` calls non-idempotent [src/features/command-palette/actions.ts:55] — The spec explicitly requires the marker to stay sticky for the session, and `applyStartupConfig()` is a startup-only path.
- dismiss: Marker persistence can hide later same-session config writes [src/features/command-palette/actions.ts:64] — This restates the intentionally sticky session behavior required by the approved spec.
- dismiss: Marker is set before the DOM class helper [src/features/command-palette/actions.ts:155] — The approved design note shows the same ordering, and there is no asynchronous gap between marking and applying.
- dismiss: `resetToggleTracking()` is exported as a normal runtime API [src/features/command-palette/actions.ts:71] — The export is intentional so the test harness can reset module state; no production caller was introduced.
- dismiss: Global test setup now imports `actions.ts` [src/test-utils/setup.ts:9] — The spec explicitly requires the global `afterEach` reset to clear the sticky marker between tests.
- dismiss: The race tests rely on the global harness reset [src/features/command-palette/actions.test.ts:309] — That reliance is by design and called out in the execution task for this spec.
- dismiss: Missing second-call coverage for `applyStartupConfig()` after a toggle [src/features/command-palette/actions.test.ts:308] — Repeated startup application after a successful toggle is outside the approved startup-only contract.
- dismiss: Spec status conflicts with deferred-work status [artifacts] — This is transient during review; the workflow updates the spec status after patch findings are applied.
- dismiss: DW-82 resolution note says the fix is self-contained in `actions.ts` [deferred-work.md:642] — The note already distinguishes production logic from the test reset wiring and is sufficiently accurate for the ledger.

## Design Notes

The only resource shared between `applyStartupConfig` and the toggles is the `<html>` class for a given dimension. The sticky marker fully serializes ownership of that class per dimension: once a toggle has applied a value, startup must not re-assert the boot-time snapshot. Because there is no `await` between marking a dimension and applying its class, the two are atomic with respect to the other async flow (JS is single-threaded; the other flow can only run at an `await` point).

```ts
// Dimensions the user explicitly toggled this session. applyStartupConfig
// consults this so a toggle fired during the boot window (before getConfig
// resolves) is never clobbered by the stale startup snapshot.
const userToggled = { theme: false, layoutMode: false };

// in applyStartupConfig, after getConfig resolves:
if (!userToggled.theme) applyThemeClass(general?.theme ?? 'dark');
if (!userToggled.layoutMode) applyLayoutModeClass(general?.layoutMode ?? 'comfortable');

// in toggleTheme success path (replacing the bare applyThemeClass(next)):
userToggled.theme = true;
applyThemeClass(next);
```

Why not block the mount in `main.tsx` instead? Awaiting `getConfig` before `createRoot().render()` would eliminate the race by construction but regress the deliberate immediate-render design (synchronous dark default + async reconcile) and add `getConfig` latency to first paint, pressuring the hotkey-to-visible (<150ms) and cold-start (<1s) budgets. The shared marker fixes the race with zero paint-path cost.

## Verification

**Commands:**

- `npx vitest run src/features/command-palette/actions.test.ts` -- expected: all tests pass, including the new race-interleaving cases.
- `npx tsc --noEmit` -- expected: no type errors.
- `npx eslint src/features/command-palette/actions.ts src/test-utils/setup.ts` -- expected: clean.
