import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTabStore } from '../store';
import { useSearchStore } from '../../search/store';
import { useSettingsStore } from '../../settings/store';
import { useTabKeyboardNav } from './useTabKeyboardNav';

/** Derive a physical `code` from a logical key (letters/digits), like a real event. */
function codeForKey(key: string): string {
  if (/^[a-zA-Z]$/.test(key)) return `Key${key.toUpperCase()}`;
  if (/^[0-9]$/.test(key)) return `Digit${key}`;
  return key;
}

/** Fire a keydown event on window with the given properties. */
function pressKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  window.dispatchEvent(
    new KeyboardEvent('keydown', { key, code: codeForKey(key), bubbles: true, ...opts }),
  );
}

function ctrlKey(key: string, shift = false) {
  pressKey(key, { ctrlKey: true, shiftKey: shift });
}

function metaKey(key: string, shift = false) {
  pressKey(key, { metaKey: true, shiftKey: shift });
}

/** Set up N tabs with active at given index. */
function setupTabs(count: number, activeIndex: number) {
  useTabStore.setState({
    tabs: Array.from({ length: count }, (_, i) => ({ noteId: i + 1, title: `Tab ${i + 1}` })),
    activeTabIndex: activeIndex,
  });
}

describe('useTabKeyboardNav', () => {
  let unmount: () => void;

  beforeEach(() => {
    useTabStore.getState().reset();
    const result = renderHook(() => useTabKeyboardNav());
    unmount = result.unmount;
  });

  afterEach(() => {
    unmount();
  });

  // --- Ctrl+Tab: next tab ---

  it('Ctrl+Tab moves to next tab', () => {
    setupTabs(3, 0);
    ctrlKey('Tab');
    expect(useTabStore.getState().activeTabIndex).toBe(1);
  });

  it('Ctrl+Tab wraps from last to first', () => {
    setupTabs(3, 2);
    ctrlKey('Tab');
    expect(useTabStore.getState().activeTabIndex).toBe(0);
  });

  // --- Ctrl+Shift+Tab: previous tab ---

  it('Ctrl+Shift+Tab moves to previous tab', () => {
    setupTabs(3, 1);
    ctrlKey('Tab', true);
    expect(useTabStore.getState().activeTabIndex).toBe(0);
  });

  it('Ctrl+Shift+Tab wraps from first to last', () => {
    setupTabs(3, 0);
    ctrlKey('Tab', true);
    expect(useTabStore.getState().activeTabIndex).toBe(2);
  });

  // --- Ctrl+1-9: jump ---

  it('Ctrl+3 jumps to third tab', () => {
    setupTabs(5, 0);
    ctrlKey('3');
    expect(useTabStore.getState().activeTabIndex).toBe(2);
  });

  it('Ctrl+5 with only 3 tabs does nothing', () => {
    setupTabs(3, 0);
    ctrlKey('5');
    expect(useTabStore.getState().activeTabIndex).toBe(0);
  });

  it('Ctrl+9 always jumps to last tab', () => {
    setupTabs(5, 0);
    ctrlKey('9');
    expect(useTabStore.getState().activeTabIndex).toBe(4);
  });

  // --- Ctrl+W: close ---

  it('Ctrl+W closes the active tab', () => {
    setupTabs(3, 1);
    ctrlKey('w');
    expect(useTabStore.getState().tabs).toHaveLength(2);
    // closeTab neighbor selection: right neighbor (was index 2, now index 1)
    expect(useTabStore.getState().activeTabIndex).toBe(1);
  });

  it('honors a custom "close tab" binding', () => {
    useSettingsStore.setState({
      bindings: { ...useSettingsStore.getState().bindings, closeTab: 'Ctrl+G' },
    });
    setupTabs(3, 1);

    ctrlKey('w'); // default no longer closes
    expect(useTabStore.getState().tabs).toHaveLength(3);

    ctrlKey('g'); // custom binding closes
    expect(useTabStore.getState().tabs).toHaveLength(2);

    useSettingsStore.getState().resetSettings();
  });

  // --- Guards ---

  // --- macOS Cmd parity ---

  it('Cmd+W closes the active tab', () => {
    setupTabs(3, 1);
    metaKey('w');
    expect(useTabStore.getState().tabs).toHaveLength(2);
    expect(useTabStore.getState().activeTabIndex).toBe(1);
  });

  it('Cmd+2 jumps to second tab', () => {
    setupTabs(4, 0);
    metaKey('2');
    expect(useTabStore.getState().activeTabIndex).toBe(1);
  });

  it('Cmd+Tab cycles tabs', () => {
    setupTabs(3, 0);
    metaKey('Tab');
    expect(useTabStore.getState().activeTabIndex).toBe(1);
  });

  it('all shortcuts are no-ops when no tabs are open', () => {
    // Tabs empty by default from reset
    ctrlKey('Tab');
    ctrlKey('w');
    ctrlKey('1');
    expect(useTabStore.getState().tabs).toHaveLength(0);
    expect(useTabStore.getState().activeTabIndex).toBeNull();
  });

  it('all shortcuts are no-ops when search overlay is open', () => {
    setupTabs(3, 0);
    useSearchStore.setState({ isOpen: true });
    ctrlKey('Tab');
    expect(useTabStore.getState().activeTabIndex).toBe(0); // unchanged
    ctrlKey('w');
    expect(useTabStore.getState().tabs).toHaveLength(3); // not closed
    ctrlKey('3');
    expect(useTabStore.getState().activeTabIndex).toBe(0); // not jumped
    useSearchStore.setState({ isOpen: false });
  });

  it('all shortcuts are no-ops when settings overlay is open', () => {
    setupTabs(3, 0);
    useSettingsStore.setState({ isOpen: true, config: null });
    ctrlKey('Tab');
    expect(useTabStore.getState().activeTabIndex).toBe(0);
    ctrlKey('w');
    expect(useTabStore.getState().tabs).toHaveLength(3);
    ctrlKey('3');
    expect(useTabStore.getState().activeTabIndex).toBe(0);
    useSettingsStore.setState({ isOpen: false, config: null });
  });
});
