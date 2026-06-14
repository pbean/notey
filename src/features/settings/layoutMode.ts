/**
 * Window layout modes (Story 7.5). `general.layoutMode` selects how the main
 * window is sized and decorated:
 * - `floating` — always-on-top 600×400 borderless drop-shadow capture overlay
 * - `half-screen` — standard-chrome window filling half the monitor work area
 * - `full-screen` — standard-chrome maximized window
 *
 * Pure helpers shared by the settings store, the command-palette actions, and the
 * Settings panel so normalization and cycle order are defined in exactly one place.
 */

/** The canonical window layout modes, in cycle order. */
export const WINDOW_LAYOUT_MODES = ['floating', 'half-screen', 'full-screen'] as const;

/** A canonical window layout mode. */
export type WindowLayoutMode = (typeof WINDOW_LAYOUT_MODES)[number];

/**
 * Coerce a persisted/raw `layoutMode` string to a canonical window mode. Legacy
 * density values (`compact`/`comfortable`) and any unknown string normalize to
 * `floating`, the default overlay form factor.
 */
export function normalizeLayoutMode(raw: string | null | undefined): WindowLayoutMode {
  return (WINDOW_LAYOUT_MODES as readonly string[]).includes(raw ?? '')
    ? (raw as WindowLayoutMode)
    : 'floating';
}

/**
 * The next mode in the Floating → Half-screen → Full-screen → Floating cycle.
 * The current value is normalized first, so a legacy/unknown value cycles from
 * `floating` (its next step is `half-screen`).
 */
export function nextLayoutMode(current: string | null | undefined): WindowLayoutMode {
  const index = WINDOW_LAYOUT_MODES.indexOf(normalizeLayoutMode(current));
  return WINDOW_LAYOUT_MODES[(index + 1) % WINDOW_LAYOUT_MODES.length];
}
