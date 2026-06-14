/**
 * Pure helpers and registry for in-app (webview) keyboard shortcut
 * configuration. Kept free of React and Zustand so the matching grammar,
 * canonicalization, and conflict rules can be unit-tested in isolation.
 *
 * In-app shortcuts are matched against `keydown` in the renderer and are never
 * handed to the OS global-shortcut plugin, so — unlike the Story 7.4 global
 * capture shortcut — they need no Rust `parse_shortcut` round-trip. They reuse
 * the same capture grammar (`[Ctrl|Cmd]+[Shift]+[Alt]+KEY`, `KEY ∈ A–Z / 0–9`)
 * via {@link formatShortcutFromEvent}. Strings are stored canonically with a
 * `Ctrl` primary-modifier token cross-platform; the matcher treats `Ctrl`/`Cmd`
 * interchangeably and {@link displayShortcut} localizes to `⌘` on macOS.
 */

import type { AppConfig } from '../../generated/bindings';

/** The set of in-app actions whose shortcut can be reconfigured. */
export type ConfigurableShortcutId =
  | 'commandPalette'
  | 'search'
  | 'newNote'
  | 'toggleNoteList'
  | 'toggleTheme'
  | 'closeTab';

/** A reconfigurable in-app action with its human label and shipped binding. */
export interface ConfigurableAction {
  /** Stable id; matches the `[shortcuts]` config key (camelCase). */
  id: ConfigurableShortcutId;
  /** Human-readable label shown in the Settings list. */
  label: string;
  /** The shipped default binding (canonical `Ctrl+…` form). */
  default: string;
}

/** A read-only ("reserved") shortcut: listed for reference, not rebindable. */
export interface ReservedAction {
  id: string;
  label: string;
  /** Display binding (may contain non-grammar keys like `,`, `Tab`, `Esc`). */
  binding: string;
}

/** Shared hint shown when a capture cannot become a valid configurable shortcut. */
export const INVALID_SHORTCUT_MESSAGE =
  'Use Ctrl/Cmd with optional Shift/Alt and a letter or number.';

/** The shipped default binding for each configurable action. */
export const DEFAULT_SHORTCUTS: Record<ConfigurableShortcutId, string> = {
  commandPalette: 'Ctrl+P',
  search: 'Ctrl+F',
  newNote: 'Ctrl+N',
  toggleNoteList: 'Ctrl+B',
  toggleTheme: 'Ctrl+Shift+T',
  closeTab: 'Ctrl+W',
};

/** Registry of reconfigurable in-app actions, in display order. */
export const CONFIGURABLE_ACTIONS: ConfigurableAction[] = [
  { id: 'commandPalette', label: 'Command palette', default: DEFAULT_SHORTCUTS.commandPalette },
  { id: 'search', label: 'Search notes', default: DEFAULT_SHORTCUTS.search },
  { id: 'newNote', label: 'New note', default: DEFAULT_SHORTCUTS.newNote },
  { id: 'toggleNoteList', label: 'Toggle note list', default: DEFAULT_SHORTCUTS.toggleNoteList },
  { id: 'toggleTheme', label: 'Toggle theme', default: DEFAULT_SHORTCUTS.toggleTheme },
  { id: 'closeTab', label: 'Close tab', default: DEFAULT_SHORTCUTS.closeTab },
];

/**
 * Shortcuts listed for reference but not rebindable, because their keys fall
 * outside the capture grammar (comma, Tab, Esc) or are a structural range
 * (Ctrl+1…9). Their handlers stay hard-coded.
 */
export const RESERVED_ACTIONS: ReservedAction[] = [
  { id: 'openSettings', label: 'Open settings', binding: 'Ctrl+,' },
  { id: 'nextTab', label: 'Next tab', binding: 'Ctrl+Tab' },
  { id: 'prevTab', label: 'Previous tab', binding: 'Ctrl+Shift+Tab' },
  { id: 'jumpToTab', label: 'Jump to tab', binding: 'Ctrl+1…9' },
  { id: 'backHide', label: 'Back / hide window', binding: 'Esc' },
];

/** Label for the tab-jump range used in conflict messages. */
const TAB_JUMP_LABEL = 'Jump to tab';

/**
 * Canonical (capturable) reserved combos a rebind must not shadow. Only the
 * Ctrl+1…9 tab-jump range is expressible in the capture grammar; `Ctrl+,`,
 * `Ctrl+Tab`, and `Esc` are inherently safe (the formatter rejects them).
 */
export const RESERVED_COMBOS: Record<string, string> = Object.fromEntries(
  ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => [`Ctrl+${d}`, TAB_JUMP_LABEL]),
);

/** Best-effort macOS detection (webview-safe), matching `shortcut.ts`. */
function isMacOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac/i.test(navigator.userAgent ?? '');
}

/**
 * Rewrite a shortcut to its canonical storage form: the primary-modifier token
 * is always `Ctrl` cross-platform (a captured macOS `Cmd`/`Meta` becomes
 * `Ctrl`). Idempotent.
 */
export function canonicalizeShortcut(shortcut: string): string {
  const parts = shortcut.split('+');
  if (parts[0] === 'Cmd' || parts[0] === 'Meta') parts[0] = 'Ctrl';
  return parts.join('+');
}

/** True when the main-key token is within the configurable shortcut grammar. */
function isSupportedMainKey(mainKey: string): boolean {
  return /^[A-Z]$/.test(mainKey) || /^[0-9]$/.test(mainKey);
}

/**
 * Validate a configurable in-app shortcut string. The primary command modifier
 * is mandatory; `Shift` and `Alt` are optional.
 */
export function isConfigurableShortcut(shortcut: string): boolean {
  const parts = canonicalizeShortcut(shortcut).split('+');
  if (parts.length < 2) return false;

  const mainKey = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1);

  if (!isSupportedMainKey(mainKey)) return false;
  if (!modifiers.includes('Ctrl')) return false;
  return modifiers.every((modifier) => modifier === 'Ctrl' || modifier === 'Shift' || modifier === 'Alt');
}

/**
 * Localize a canonical shortcut for display. On macOS the primary `Ctrl` token
 * renders as `⌘`; elsewhere the canonical form is returned unchanged.
 */
export function displayShortcut(shortcut: string): string {
  const canonical = canonicalizeShortcut(shortcut);
  if (!isMacOS()) return canonical;
  const parts = canonical.split('+');
  if (parts[0] === 'Ctrl') parts[0] = '⌘';
  return parts.join('+');
}

/** Whether the event's main key matches the shortcut's main-key token. */
function mainKeyMatches(code: string, mainKey: string): boolean {
  if (/^[A-Z]$/.test(mainKey)) return code === `Key${mainKey}`;
  if (/^[0-9]$/.test(mainKey)) return code === `Digit${mainKey}`;
  return false;
}

/**
 * The single matching primitive for in-app shortcuts. Returns true when the
 * keyboard event exactly realizes the (canonicalized) shortcut: the primary
 * command modifier is held (`ctrlKey || metaKey`), `Shift`/`Alt` match exactly
 * (present iff held — so `Ctrl+P` never fires under `Ctrl+Shift+P`), and the
 * main key matches `event.code` (layout-independent). A malformed shortcut with
 * no main key or no primary modifier never matches.
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parts = canonicalizeShortcut(shortcut).split('+');
  if (parts.length < 2) return false;
  const mainKey = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1);

  if (!modifiers.includes('Ctrl')) return false;
  if (!(event.ctrlKey || event.metaKey)) return false;
  if (event.shiftKey !== modifiers.includes('Shift')) return false;
  if (event.altKey !== modifiers.includes('Alt')) return false;
  return mainKeyMatches(event.code, mainKey);
}

/** A detected conflict: the label of whatever already owns the combo. */
export interface ShortcutConflict {
  label: string;
}

/**
 * Detect whether assigning `combo` would collide with a reserved combo or with
 * another configurable action's current binding. `excludeId` is the action
 * being rebound (so it never conflicts with its own previous value). Returns
 * the conflicting label, or `null` when the combo is free.
 */
export function findShortcutConflict(
  combo: string,
  bindings: Record<string, string>,
  excludeId: ConfigurableShortcutId,
): ShortcutConflict | null {
  const canonical = canonicalizeShortcut(combo);

  const reserved = RESERVED_COMBOS[canonical];
  if (reserved) return { label: reserved };

  for (const action of CONFIGURABLE_ACTIONS) {
    if (action.id === excludeId) continue;
    const current = canonicalizeShortcut(bindings[action.id] ?? action.default);
    if (current === canonical) return { label: action.label };
  }
  return null;
}

/**
 * Build the live binding map by layering the persisted `[shortcuts]` config
 * over the shipped defaults. Any missing or empty key keeps its default, so a
 * legacy config with no `[shortcuts]` section yields the full default set.
 */
export function bindingsFromConfig(
  config: AppConfig | null,
): Record<ConfigurableShortcutId, string> {
  const stored = config?.shortcuts;
  const result: Record<ConfigurableShortcutId, string> = { ...DEFAULT_SHORTCUTS };
  if (!stored) return result;
  for (const action of CONFIGURABLE_ACTIONS) {
    const value = stored[action.id];
    if (typeof value === 'string' && value.length > 0 && isConfigurableShortcut(value)) {
      result[action.id] = canonicalizeShortcut(value);
    }
  }
  return result;
}
