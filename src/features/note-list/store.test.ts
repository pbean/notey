import { describe, it, expect, beforeEach } from 'vitest';
import { useNoteListStore } from './store';
import { useSearchStore } from '../search/store';
import { useCommandPaletteStore } from '../command-palette/store';

describe('useNoteListStore', () => {
  beforeEach(() => {
    useNoteListStore.getState().resetNoteList();
    useSearchStore.getState().resetSearch();
    useCommandPaletteStore.getState().resetCommandPalette();
  });

  it('starts with default state', () => {
    const state = useNoteListStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.selectedIndex).toBe(0);
  });

  it('open sets isOpen true and resets selectedIndex', () => {
    useNoteListStore.setState({ selectedIndex: 3 });
    useNoteListStore.getState().open();
    const state = useNoteListStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.selectedIndex).toBe(0);
  });

  it('close sets isOpen false', () => {
    useNoteListStore.getState().open();
    useNoteListStore.getState().close();
    expect(useNoteListStore.getState().isOpen).toBe(false);
  });

  it('open closes search overlay (mutual exclusion)', () => {
    useSearchStore.getState().openSearch();
    expect(useSearchStore.getState().isOpen).toBe(true);

    useNoteListStore.getState().open();
    expect(useSearchStore.getState().isOpen).toBe(false);
    expect(useNoteListStore.getState().isOpen).toBe(true);
  });

  it('open closes command palette (mutual exclusion)', () => {
    useCommandPaletteStore.getState().open();
    expect(useCommandPaletteStore.getState().isOpen).toBe(true);

    useNoteListStore.getState().open();
    expect(useCommandPaletteStore.getState().isOpen).toBe(false);
    expect(useNoteListStore.getState().isOpen).toBe(true);
  });

  it('selectNext wraps around to first item', () => {
    useNoteListStore.getState().selectNext(3);
    expect(useNoteListStore.getState().selectedIndex).toBe(1);

    useNoteListStore.getState().selectNext(3);
    expect(useNoteListStore.getState().selectedIndex).toBe(2);

    useNoteListStore.getState().selectNext(3);
    expect(useNoteListStore.getState().selectedIndex).toBe(0);
  });

  it('selectPrev wraps around to last item', () => {
    useNoteListStore.getState().selectPrev(3);
    expect(useNoteListStore.getState().selectedIndex).toBe(2);
  });

  it('selectNext is a no-op when noteCount is 0', () => {
    useNoteListStore.getState().selectNext(0);
    expect(useNoteListStore.getState().selectedIndex).toBe(0);
  });

  it('selectPrev is a no-op when noteCount is 0', () => {
    useNoteListStore.getState().selectPrev(0);
    expect(useNoteListStore.getState().selectedIndex).toBe(0);
  });

  it('resetNoteList resets all state', () => {
    useNoteListStore.getState().open();
    useNoteListStore.getState().selectNext(5);
    useNoteListStore.getState().resetNoteList();

    const state = useNoteListStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.selectedIndex).toBe(0);
  });
});
