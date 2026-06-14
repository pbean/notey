---
title: "Duplicate hand-edited shortcut binding recovery (first-binding-wins)"
type: "bugfix"
created: "2026-06-14"
status: "done"
baseline_commit: "02996e99d66ae494c28127f97794f14ee2881afe"
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Settings UI prevents duplicate configurable bindings, but a hand-edited `[shortcuts]` config can still give multiple actions the same key combo (or a reserved combo such as `Ctrl+1…9`). At load there is no recovery policy, so two handlers fire on one keypress.

**Approach:** Make `bindingsFromConfig` dedupe at load time using a **first-binding-wins** policy (the human's chosen recovery): walking the configurable actions in registry order, the first action to claim a canonical combo keeps it; any later action whose resolved combo duplicates an already-claimed combo (or a reserved combo) is ignored and falls back to its shipped default, with a `console.warn` per dropped binding. This guarantees at most one handler per combo without touching the individual keydown handlers.

## Boundaries & Constraints

**Always:**
- First-binding-wins, in `CONFIGURABLE_ACTIONS` registry order: the earlier action keeps a contested combo.
- After dedupe, no two configurable actions share a canonical combo, and no configurable action shares a combo with a reserved combo (`RESERVED_COMBOS`, the `Ctrl+1…9` tab-jump range owned by hard-coded handlers).
- A later duplicate's config value is ignored and the action falls back to its shipped default; emit exactly one `console.warn` naming the action and the dropped combo.
- The fix lives in `bindingsFromConfig` so both load paths (`open` and `hydrateShortcuts`) inherit it without changes.
- Preserve all existing behavior: missing/empty/invalid values still fall back to default; `Cmd`/`Meta` still canonicalize to `Ctrl`.

**Ask First:**
- Changing the recovery policy away from first-binding-wins (already decided — do not revisit).

**Never:**
- Do not modify the individual keydown handlers in `CaptureWindow.tsx` or `useTabKeyboardNav.ts`.
- Do not change the Settings-UI conflict prevention (`findShortcutConflict`, `setShortcut`).
- Do not persist a "repaired" config back to disk — recovery is in-memory at load only.
- Do not surface a toast or modal; a console warning is the only user-visible signal (matches the unattended load path).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| -------- | ------------- | -------------------------- | -------------- |
| No duplicates | `shortcuts` with all-distinct valid combos | Each action keeps its config value (canonicalized) | N/A |
| Two actions, same combo | e.g. `commandPalette: "Ctrl+J"`, `search: "Ctrl+J"` | `commandPalette` (earlier in registry) keeps `Ctrl+J`; `search` falls back to its default `Ctrl+F`; one warning | console.warn naming `search` + `Ctrl+J` |
| Later duplicate's default also taken | `commandPalette: "Ctrl+F"`, `search: "Ctrl+F"` (search's own default) | `commandPalette` keeps `Ctrl+F`; `search` cannot take its default (claimed) → dropped to empty string; one warning | console.warn; binding is `''` (never matches, recoverable via Settings) |
| Config value lands on reserved combo | `search: "Ctrl+5"` | `search` falls back to default `Ctrl+F` (reserved range pre-claimed); one warning | console.warn naming `search` + `Ctrl+5` |
| Invalid / empty / missing value | `search: "Shift+G"` or `""` or absent | Falls back to default `Ctrl+F` (existing behavior, no dedupe warning) | N/A |
| `Cmd`/`Meta` duplicate after canonicalization | `commandPalette: "Ctrl+J"`, `search: "Cmd+J"` | Canonicalized both to `Ctrl+J`; `search` deduped to default | console.warn |

</frozen-after-approval>

## Code Map

- `src/features/settings/shortcuts.ts` -- `bindingsFromConfig` (line ~205) is the single load-time resolver; add first-binding-wins dedupe here. `RESERVED_COMBOS`, `CONFIGURABLE_ACTIONS`, `DEFAULT_SHORTCUTS`, `canonicalizeShortcut`, `isConfigurableShortcut` are the existing primitives to reuse.
- `src/features/settings/store.ts` -- `open` (line 119) and `hydrateShortcuts` (line 210) both call `bindingsFromConfig`; no change needed, they inherit the fix.
- `src/features/editor/components/CaptureWindow.tsx` -- consumes `bindings.{search,commandPalette,newNote,…}` in always-on handlers; relies on the dedupe so only one fires. Do not edit.
- `src/features/tabs/hooks/useTabKeyboardNav.ts` -- consumes `bindings.closeTab` alongside the reserved `Ctrl+1…9` handler; reserved pre-claiming prevents a configurable action shadowing tab-jump. Do not edit.
- `src/features/settings/shortcuts.test.ts` -- existing `bindingsFromConfig` describe block (line ~124); add dedupe cases here.

## Tasks & Acceptance

**Execution:**

- [x] `src/features/settings/shortcuts.ts` -- Rewrite `bindingsFromConfig` to resolve each action's candidate combo as today (valid config value else default), then apply first-binding-wins dedupe: seed a `claimed` set with the canonical `RESERVED_COMBOS` keys; iterate `CONFIGURABLE_ACTIONS` in order; if a candidate is already claimed, `console.warn` and fall back to the action's default — if the default is also claimed, set the binding to `''` and warn. Claim each assigned combo. Update the JSDoc to document the first-binding-wins recovery policy.
- [x] `src/features/settings/shortcuts.test.ts` -- Add unit tests under the `bindingsFromConfig` describe covering the I/O matrix: two-action duplicate (first wins, later → default), default-also-taken drop-to-empty, reserved-combo collision → default, `Cmd`/`Meta` canonicalized duplicate, and a `console.warn` spy assertion. Keep existing passing tests intact.

**Acceptance Criteria:**

- Given a config where two configurable actions resolve to the same canonical combo, when `bindingsFromConfig` runs, then the action earlier in `CONFIGURABLE_ACTIONS` keeps the combo and the later one falls back to its default (or `''` if its default is also claimed).
- Given a config where a configurable action's value equals a reserved combo (`Ctrl+1…9`), when `bindingsFromConfig` runs, then that action falls back to its default so the reserved tab-jump handler remains the sole owner.
- Given any dedupe fallback occurs, when `bindingsFromConfig` runs, then exactly one `console.warn` is emitted per dropped binding, naming the action and the contested combo.
- Given a config with no duplicates, when `bindingsFromConfig` runs, then output is byte-identical to the pre-change behavior (no warnings, values canonicalized).
- Given the change, when the full frontend test suite runs, then all existing shortcut/store tests still pass.

## Design Notes

Dedupe sketch (reuse existing primitives; do not re-implement canonicalization or validation):

```ts
export function bindingsFromConfig(config) {
  const stored = config?.shortcuts;
  const result = { ...DEFAULT_SHORTCUTS };
  if (!stored) return result;
  const claimed = new Set(Object.keys(RESERVED_COMBOS)); // reserved owned by hard-coded handlers
  for (const action of CONFIGURABLE_ACTIONS) {
    const value = stored[action.id];
    const candidate =
      typeof value === 'string' && value.length > 0 && isConfigurableShortcut(value)
        ? canonicalizeShortcut(value)
        : DEFAULT_SHORTCUTS[action.id];
    let combo = candidate;
    if (claimed.has(combo)) {
      console.warn(`Ignoring duplicate shortcut "${combo}" for "${action.id}"; an earlier action or reserved combo owns it.`);
      const fallback = canonicalizeShortcut(DEFAULT_SHORTCUTS[action.id]);
      combo = claimed.has(fallback) ? '' : fallback;
    }
    if (combo) claimed.add(combo);
    result[action.id] = combo;
  }
  return result;
}
```

Note `DEFAULT_SHORTCUTS` values are already canonical, so the `claimed`-seed of reserved combos never blocks a legitimate default (defaults are `Ctrl+P/F/N/B/Shift+T/W`; reserved is `Ctrl+1…9`). The `''` drop is a recoverable degraded state for a doubly-pathological hand-edit — `matchesShortcut('')` returns false so no handler fires, and the user can rebind via Settings.

## Verification

**Commands:**

- `npx vitest run src/features/settings/shortcuts.test.ts` -- expected: all tests pass, including new dedupe cases
- `npx vitest run src/features/settings/` -- expected: store and component tests still pass
- `npx tsc --noEmit` -- expected: no type errors

### Review Findings

- [x] [Review][Patch] Normalize hand-edited modifier ordering so equivalent combos dedupe [src/features/settings/shortcuts.ts:104]

#### Review Ledger (2026-06-14)

dismiss: Persist repaired shortcut configs [src/features/settings/shortcuts.ts:236] — frozen intent requires in-memory recovery only.
dismiss: Empty-string fallback is unsafe or too silent [src/features/settings/shortcuts.ts:241] — `matchesShortcut('')` is a no-op and the frozen intent allows only `console.warn`.
dismiss: Implicit-default collisions should not warn [src/features/settings/shortcuts.ts:231] — the approved algorithm dedupes resolved combos, not only explicitly configured values.
dismiss: Repeated hydration warnings need once-only suppression [src/features/settings/shortcuts.ts:237] — the spec requires one warning per dropped binding, not once per app.
dismiss: Registry-order winner selection is unstable [src/features/settings/shortcuts.ts:229] — first-binding-wins in `CONFIGURABLE_ACTIONS` order is frozen intent.
dismiss: JSDoc promises defaults only [src/features/settings/shortcuts.ts:201] — the later dedupe clause already defines the empty-string fallback path.
dismiss: Load-time dedupe cannot fix runtime double-firing [_bmad-output/implementation-artifacts/deferred-work.md:700] — all affected handlers consume the hydrated bindings, so the load path is the intended fix point.
dismiss: Missing implicit-default collision test [src/features/settings/shortcuts.test.ts:206] — additional coverage would help, but no concrete defect was verified.
dismiss: Missing three-way collision test [src/features/settings/shortcuts.test.ts:168] — additional coverage would help, but no concrete defect was verified.
dismiss: Acceptance-auditor Meta-path residual risk [src/features/settings/shortcuts.test.ts:179] — `canonicalizeShortcut` already exercises `Meta` normalization directly.
patch: Normalize hand-edited modifier ordering so equivalent combos dedupe [src/features/settings/shortcuts.ts:104] — reordered or repeated modifiers remain valid, match at runtime, and currently evade string-based claimed-set dedupe.
