import { describe, it, expect, afterEach } from 'vitest';
import { formatShortcutFromEvent, platformDefaultShortcut } from './shortcut';

/** Build a keydown event with the given code and modifier flags. */
function key(code: string, mods: Partial<Pick<KeyboardEventInit, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>> = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { code, ...mods });
}

describe('formatShortcutFromEvent', () => {
  it('formats a modifier + letter combination', () => {
    expect(formatShortcutFromEvent(key('KeyN', { ctrlKey: true, shiftKey: true }))).toBe('Ctrl+Shift+N');
  });

  it('maps the meta key to Cmd', () => {
    expect(formatShortcutFromEvent(key('KeyN', { metaKey: true }))).toBe('Cmd+N');
  });

  it('formats a digit main key', () => {
    expect(formatShortcutFromEvent(key('Digit1', { ctrlKey: true }))).toBe('Ctrl+1');
  });

  it('emits modifiers in canonical [Ctrl|Cmd] + Shift + Alt order', () => {
    expect(formatShortcutFromEvent(key('KeyJ', { ctrlKey: true, shiftKey: true, altKey: true }))).toBe('Ctrl+Shift+Alt+J');
    expect(formatShortcutFromEvent(key('KeyJ', { ctrlKey: true, metaKey: true }))).toBe('Ctrl+J');
  });

  it('returns null for a bare modifier press', () => {
    expect(formatShortcutFromEvent(key('ShiftLeft', { shiftKey: true }))).toBeNull();
    expect(formatShortcutFromEvent(key('ControlLeft', { ctrlKey: true }))).toBeNull();
  });

  it('returns null when no modifier is held', () => {
    expect(formatShortcutFromEvent(key('KeyN'))).toBeNull();
  });

  it('returns null for an unsupported main key', () => {
    expect(formatShortcutFromEvent(key('F1', { ctrlKey: true }))).toBeNull();
    expect(formatShortcutFromEvent(key('Tab', { ctrlKey: true }))).toBeNull();
    expect(formatShortcutFromEvent(key('Escape', { ctrlKey: true }))).toBeNull();
  });
});

describe('platformDefaultShortcut', () => {
  const originalUA = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', { value: originalUA, configurable: true });
  });

  it('returns Ctrl+Shift+N on non-macOS', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (X11; Linux x86_64)',
      configurable: true,
    });
    expect(platformDefaultShortcut()).toBe('Ctrl+Shift+N');
  });

  it('returns Cmd+Shift+N on macOS', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      configurable: true,
    });
    expect(platformDefaultShortcut()).toBe('Cmd+Shift+N');
  });

  it('prefers Cmd over Ctrl on macOS when both are held', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      configurable: true,
    });
    expect(formatShortcutFromEvent(key('KeyJ', { ctrlKey: true, metaKey: true }))).toBe('Cmd+J');
  });
});
