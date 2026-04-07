import { describe, it, expect, beforeEach } from 'vitest';
import { useSearchStore } from './store';

// COMP-3.3-01: Store initializes with correct defaults and actions work
describe('useSearchStore', () => {
  beforeEach(() => {
    useSearchStore.getState().closeSearch();
  });

  it('starts with default state', () => {
    const state = useSearchStore.getState();
    expect(state.query).toBe('');
    expect(state.results).toEqual([]);
    expect(state.isOpen).toBe(false);
    expect(state.selectedIndex).toBe(0);
  });

  it('setQuery updates query and resets selectedIndex', () => {
    useSearchStore.getState().setResults([
      { id: 1, title: 'A', snippet: '', workspaceName: null, updatedAt: '', format: 'markdown' },
      { id: 2, title: 'B', snippet: '', workspaceName: null, updatedAt: '', format: 'markdown' },
    ]);
    useSearchStore.getState().selectNext();
    expect(useSearchStore.getState().selectedIndex).toBe(1);

    useSearchStore.getState().setQuery('test');
    const state = useSearchStore.getState();
    expect(state.query).toBe('test');
    expect(state.selectedIndex).toBe(0);
  });

  it('openSearch resets all state and sets isOpen true', () => {
    useSearchStore.getState().setQuery('old');
    useSearchStore.getState().setResults([
      { id: 1, title: 'A', snippet: '', workspaceName: null, updatedAt: '', format: 'markdown' },
    ]);

    useSearchStore.getState().openSearch();
    const state = useSearchStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.query).toBe('');
    expect(state.results).toEqual([]);
    expect(state.selectedIndex).toBe(0);
  });

  it('closeSearch resets all state and sets isOpen false', () => {
    useSearchStore.getState().openSearch();
    useSearchStore.getState().setQuery('test');

    useSearchStore.getState().closeSearch();
    const state = useSearchStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.query).toBe('');
    expect(state.results).toEqual([]);
    expect(state.selectedIndex).toBe(0);
  });

  it('selectNext increments selectedIndex clamped to last result', () => {
    useSearchStore.getState().setResults([
      { id: 1, title: 'A', snippet: '', workspaceName: null, updatedAt: '', format: 'markdown' },
      { id: 2, title: 'B', snippet: '', workspaceName: null, updatedAt: '', format: 'markdown' },
      { id: 3, title: 'C', snippet: '', workspaceName: null, updatedAt: '', format: 'markdown' },
    ]);

    useSearchStore.getState().selectNext();
    expect(useSearchStore.getState().selectedIndex).toBe(1);

    useSearchStore.getState().selectNext();
    expect(useSearchStore.getState().selectedIndex).toBe(2);

    // Clamped at last index
    useSearchStore.getState().selectNext();
    expect(useSearchStore.getState().selectedIndex).toBe(2);
  });

  it('selectPrev decrements selectedIndex clamped to 0', () => {
    useSearchStore.getState().setResults([
      { id: 1, title: 'A', snippet: '', workspaceName: null, updatedAt: '', format: 'markdown' },
      { id: 2, title: 'B', snippet: '', workspaceName: null, updatedAt: '', format: 'markdown' },
    ]);
    useSearchStore.getState().selectNext();
    expect(useSearchStore.getState().selectedIndex).toBe(1);

    useSearchStore.getState().selectPrev();
    expect(useSearchStore.getState().selectedIndex).toBe(0);

    // Clamped at 0
    useSearchStore.getState().selectPrev();
    expect(useSearchStore.getState().selectedIndex).toBe(0);
  });

  it('setResults replaces the results array', () => {
    const results = [
      { id: 10, title: 'Note 10', snippet: 'match', workspaceName: 'ws', updatedAt: '2026-01-01T00:00:00+00:00', format: 'markdown' },
    ];
    useSearchStore.getState().setResults(results);
    expect(useSearchStore.getState().results).toEqual(results);
  });

  it('selectNext is a no-op when results are empty', () => {
    useSearchStore.getState().selectNext();
    expect(useSearchStore.getState().selectedIndex).toBe(0);
  });

  it('setResults resets selectedIndex to 0', () => {
    useSearchStore.getState().setResults([
      { id: 1, title: 'A', snippet: '', workspaceName: null, updatedAt: '', format: 'markdown' },
      { id: 2, title: 'B', snippet: '', workspaceName: null, updatedAt: '', format: 'markdown' },
    ]);
    useSearchStore.getState().selectNext();
    expect(useSearchStore.getState().selectedIndex).toBe(1);

    useSearchStore.getState().setResults([
      { id: 3, title: 'C', snippet: '', workspaceName: null, updatedAt: '', format: 'markdown' },
    ]);
    expect(useSearchStore.getState().selectedIndex).toBe(0);
  });
});
