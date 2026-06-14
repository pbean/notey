/**
 * Pure helpers for the global-hotkey capture UI. Kept free of React so the
 * capture grammar and platform default can be unit-tested in isolation. The
 * emitted strings must match exactly what the Rust `parse_shortcut` accepts
 * (`Ctrl`/`Cmd`/`Shift`/`Alt` + a main key) so a captured combination
 * round-trips through `update_config` without a validation error.
 */

/** Whether the current platform is macOS (best-effort, webview-safe). */
function isMacOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac/i.test(navigator.userAgent ?? '');
}

/** Pick the canonical primary modifier label for this platform. */
function primaryModifier(event: KeyboardEvent): string | null {
  if (isMacOS()) {
    if (event.metaKey) return 'Cmd';
    if (event.ctrlKey) return 'Ctrl';
    return null;
  }

  if (event.ctrlKey) return 'Ctrl';
  if (event.metaKey) return 'Cmd';
  return null;
}

/**
 * The platform default global capture shortcut — the single source of truth for
 * the settings "Reset to default" action. Mirrors the Rust
 * `default_global_shortcut()`: `Cmd+Shift+N` on macOS, `Ctrl+Shift+N` elsewhere.
 */
export function platformDefaultShortcut(): string {
  return isMacOS() ? 'Cmd+Shift+N' : 'Ctrl+Shift+N';
}

/**
 * Derive the canonical shortcut string from a keyboard event, or `null` when the
 * event is not a bindable global shortcut. A bindable combination needs at least
 * one modifier (Ctrl/Cmd/Shift/Alt) plus one supported main key (A–Z or 0–9);
 * pure-modifier presses and unsupported keys (function keys, Esc, Tab,
 * punctuation) return `null`.
 *
 * Modifiers are read from the event flags and the main key from `event.code`
 * (layout-independent), then assembled in the canonical order
 * `[Ctrl|Cmd] + Shift + Alt + KEY` to match the backend grammar.
 */
export function formatShortcutFromEvent(event: KeyboardEvent): string | null {
  const mainKey = mainKeyFromCode(event.code);
  if (mainKey === null) return null;

  const modifiers: string[] = [];
  const primary = primaryModifier(event);
  if (primary !== null) modifiers.push(primary);
  if (event.shiftKey) modifiers.push('Shift');
  if (event.altKey) modifiers.push('Alt');

  // A global hotkey without a modifier would hijack a bare key everywhere.
  if (modifiers.length === 0) return null;

  return [...modifiers, mainKey].join('+');
}

/**
 * Map a physical `KeyboardEvent.code` to a supported main-key token, or `null`
 * if it is not an A–Z letter or 0–9 digit. Modifier codes (`ShiftLeft`, etc.)
 * and everything else resolve to `null`.
 */
function mainKeyFromCode(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  return null;
}
