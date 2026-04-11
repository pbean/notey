import { describe, it, expect, beforeEach } from 'vitest';
import { useCommandPaletteStore } from './store';
import { useSearchStore } from '../search/store';

describe('useCommandPaletteStore', () => {
  beforeEach(() => {
    useCommandPaletteStore.getState().resetCommandPalette();
    useSearchStore.getState().resetSearch();
  });

  it('starts closed', () => {
    expect(useCommandPaletteStore.getState().isOpen).toBe(false);
  });

  it('open() sets isOpen true', () => {
    useCommandPaletteStore.getState().open();
    expect(useCommandPaletteStore.getState().isOpen).toBe(true);
  });

  it('close() sets isOpen false', () => {
    useCommandPaletteStore.getState().open();
    useCommandPaletteStore.getState().close();
    expect(useCommandPaletteStore.getState().isOpen).toBe(false);
  });

  it('toggle() opens when closed', () => {
    useCommandPaletteStore.getState().toggle();
    expect(useCommandPaletteStore.getState().isOpen).toBe(true);
  });

  it('toggle() closes when open', () => {
    useCommandPaletteStore.getState().open();
    useCommandPaletteStore.getState().toggle();
    expect(useCommandPaletteStore.getState().isOpen).toBe(false);
  });

  it('open() closes search overlay (Layer 1 mutual exclusion)', () => {
    useSearchStore.getState().openSearch();
    expect(useSearchStore.getState().isOpen).toBe(true);

    useCommandPaletteStore.getState().open();
    expect(useCommandPaletteStore.getState().isOpen).toBe(true);
    expect(useSearchStore.getState().isOpen).toBe(false);
  });

  it('toggle() closes search overlay when opening', () => {
    useSearchStore.getState().openSearch();
    useCommandPaletteStore.getState().toggle();
    expect(useCommandPaletteStore.getState().isOpen).toBe(true);
    expect(useSearchStore.getState().isOpen).toBe(false);
  });

  it('toggle() does not affect search overlay when closing', () => {
    useCommandPaletteStore.getState().open();
    // Set search open directly (bypassing openSearch which would close palette via symmetric exclusion)
    useSearchStore.setState({ isOpen: true });
    // Now toggle closes palette — should NOT close search
    useCommandPaletteStore.getState().toggle();
    expect(useCommandPaletteStore.getState().isOpen).toBe(false);
    expect(useSearchStore.getState().isOpen).toBe(true);
  });

  it('resetCommandPalette() resets to initial state', () => {
    useCommandPaletteStore.getState().open();
    useCommandPaletteStore.getState().resetCommandPalette();
    expect(useCommandPaletteStore.getState().isOpen).toBe(false);
  });
});
