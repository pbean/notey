import { describe, it, expect } from 'vitest';
import {
  bindingsFromConfig,
  canonicalizeShortcut,
  CONFIGURABLE_ACTIONS,
  DEFAULT_SHORTCUTS,
  displayShortcut,
  findShortcutConflict,
  isConfigurableShortcut,
  matchesShortcut,
  RESERVED_COMBOS,
} from './shortcuts';
import { buildConfig } from '../../test-utils/factories';

/** Build a keydown-like event for matching tests. */
function keyEvent(
  code: string,
  opts: { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean } = {},
): KeyboardEvent {
  return {
    code,
    ctrlKey: opts.ctrl ?? false,
    metaKey: opts.meta ?? false,
    shiftKey: opts.shift ?? false,
    altKey: opts.alt ?? false,
  } as KeyboardEvent;
}

describe('canonicalizeShortcut', () => {
  it('rewrites the primary Cmd/Meta token to Ctrl', () => {
    expect(canonicalizeShortcut('Cmd+Shift+B')).toBe('Ctrl+Shift+B');
    expect(canonicalizeShortcut('Meta+P')).toBe('Ctrl+P');
  });

  it('leaves a canonical Ctrl shortcut unchanged (idempotent)', () => {
    expect(canonicalizeShortcut('Ctrl+P')).toBe('Ctrl+P');
    expect(canonicalizeShortcut(canonicalizeShortcut('Cmd+F'))).toBe('Ctrl+F');
  });
});

describe('displayShortcut', () => {
  it('returns the canonical form on non-macOS (jsdom default)', () => {
    expect(displayShortcut('Ctrl+P')).toBe('Ctrl+P');
    expect(displayShortcut('Cmd+P')).toBe('Ctrl+P');
  });
});

describe('matchesShortcut', () => {
  it('matches a modifier+letter combo via event.code', () => {
    expect(matchesShortcut(keyEvent('KeyP', { ctrl: true }), 'Ctrl+P')).toBe(true);
  });

  it('treats Cmd/meta as the primary modifier (macOS parity)', () => {
    expect(matchesShortcut(keyEvent('KeyF', { meta: true }), 'Ctrl+F')).toBe(true);
  });

  it('requires exact Shift/Alt — Ctrl+P never fires under Ctrl+Shift+P', () => {
    expect(matchesShortcut(keyEvent('KeyP', { ctrl: true, shift: true }), 'Ctrl+P')).toBe(false);
    expect(matchesShortcut(keyEvent('KeyT', { ctrl: true, shift: true }), 'Ctrl+Shift+T')).toBe(true);
    expect(matchesShortcut(keyEvent('KeyT', { ctrl: true }), 'Ctrl+Shift+T')).toBe(false);
  });

  it('fails without the primary modifier or with the wrong key', () => {
    expect(matchesShortcut(keyEvent('KeyP'), 'Ctrl+P')).toBe(false);
    expect(matchesShortcut(keyEvent('KeyQ', { ctrl: true }), 'Ctrl+P')).toBe(false);
  });

  it('matches a digit combo via event.code', () => {
    expect(matchesShortcut(keyEvent('Digit5', { ctrl: true }), 'Ctrl+5')).toBe(true);
  });

  it('never matches a malformed shortcut', () => {
    expect(matchesShortcut(keyEvent('KeyP', { ctrl: true }), 'P')).toBe(false);
    expect(matchesShortcut(keyEvent('KeyP', { ctrl: true }), '')).toBe(false);
  });
});

describe('isConfigurableShortcut', () => {
  it('requires the primary modifier', () => {
    expect(isConfigurableShortcut('Ctrl+G')).toBe(true);
    expect(isConfigurableShortcut('Ctrl+Shift+G')).toBe(true);
    expect(isConfigurableShortcut('Shift+G')).toBe(false);
    expect(isConfigurableShortcut('Alt+G')).toBe(false);
  });

  it('rejects unsupported main keys', () => {
    expect(isConfigurableShortcut('Ctrl+Tab')).toBe(false);
    expect(isConfigurableShortcut('Ctrl+,')).toBe(false);
  });
});

describe('findShortcutConflict', () => {
  const bindings = { ...DEFAULT_SHORTCUTS };

  it('flags a combo already owned by another action', () => {
    // Ctrl+N is newNote's default; binding it to search is a conflict.
    const conflict = findShortcutConflict('Ctrl+N', bindings, 'search');
    expect(conflict?.label).toBe('New note');
  });

  it('flags a reserved combo from the tab-jump range', () => {
    expect(findShortcutConflict('Ctrl+5', bindings, 'search')?.label).toBe('Jump to tab');
  });

  it('ignores the action being rebound (its own previous value is free)', () => {
    expect(findShortcutConflict('Ctrl+F', bindings, 'search')).toBeNull();
  });

  it('returns null for a free combo and canonicalizes Cmd input', () => {
    expect(findShortcutConflict('Ctrl+G', bindings, 'search')).toBeNull();
    // Cmd+N (macOS capture) still collides with newNote's Ctrl+N.
    expect(findShortcutConflict('Cmd+N', bindings, 'search')?.label).toBe('New note');
  });
});

describe('RESERVED_COMBOS', () => {
  it('covers the full Ctrl+1…9 tab-jump range', () => {
    for (let n = 1; n <= 9; n++) {
      expect(RESERVED_COMBOS[`Ctrl+${n}`]).toBe('Jump to tab');
    }
  });
});

describe('bindingsFromConfig', () => {
  it('returns all defaults for a config without a [shortcuts] section', () => {
    expect(bindingsFromConfig({ ...buildConfig(), shortcuts: undefined })).toEqual(DEFAULT_SHORTCUTS);
    expect(bindingsFromConfig(null)).toEqual(DEFAULT_SHORTCUTS);
  });

  it('layers persisted values over defaults and canonicalizes them', () => {
    const result = bindingsFromConfig(buildConfig({ shortcuts: { search: 'Cmd+G' } }));
    expect(result.search).toBe('Ctrl+G');
    expect(result.commandPalette).toBe('Ctrl+P');
  });

  it('falls back to defaults for an invalid persisted shortcut', () => {
    const result = bindingsFromConfig(buildConfig({ shortcuts: { search: 'Shift+G' } }));
    expect(result.search).toBe('Ctrl+F');
  });

  it('exposes one binding per configurable action', () => {
    const result = bindingsFromConfig(null);
    for (const action of CONFIGURABLE_ACTIONS) {
      expect(typeof result[action.id]).toBe('string');
    }
  });
});
