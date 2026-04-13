/**
 * Overlay coordination registry. Each overlay store registers its own close
 * function at module load; cross-overlay mutual exclusion goes through this
 * module instead of cross-store imports, which would form an import cycle.
 *
 * The manager imports nothing from the stores, so there is no cycle.
 */

export type OverlayId = 'search' | 'commandPalette' | 'noteList';

const closers = new Map<OverlayId, () => void>();

/** Register a close function for an overlay. Called by each store at module scope. */
export function registerOverlay(id: OverlayId, close: () => void): void {
  closers.set(id, close);
}

/** Close every registered overlay except the one identified by `except`. */
export function closeOtherOverlays(except: OverlayId): void {
  for (const [id, close] of closers) {
    if (id !== except) close();
  }
}

/** Test-only: clear all registered overlays. */
export function _resetOverlayRegistry(): void {
  closers.clear();
}
