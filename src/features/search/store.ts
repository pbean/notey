import { create } from 'zustand';
import type { SearchResult } from '../../generated/bindings';

/** Search overlay state. */
interface SearchState {
  /** Current search query string. */
  query: string;
  /** Array of search results from the backend. */
  results: SearchResult[];
  /** Whether the search overlay is visible. */
  isOpen: boolean;
  /** Index of the currently highlighted result in the list. */
  selectedIndex: number;
}

/** Actions for managing search state. */
interface SearchActions {
  /** Update the search query and reset selection to first result. */
  setQuery: (q: string) => void;
  /** Open the search overlay, resetting all state. */
  openSearch: () => void;
  /** Close the search overlay and reset all state. */
  closeSearch: () => void;
  /** Move selection to the next result (clamped to last). */
  selectNext: () => void;
  /** Move selection to the previous result (clamped to first). */
  selectPrev: () => void;
  /** Replace the results array (called after searchNotes resolves). */
  setResults: (results: SearchResult[]) => void;
}

/** Per-feature Zustand store for search overlay state and actions. */
export const useSearchStore = create<SearchState & SearchActions>((set, get) => ({
  query: '',
  results: [],
  isOpen: false,
  selectedIndex: 0,
  setQuery: (query) => set({ query, selectedIndex: 0 }),
  openSearch: () => set({ isOpen: true, query: '', results: [], selectedIndex: 0 }),
  closeSearch: () => set({ isOpen: false, query: '', results: [], selectedIndex: 0 }),
  selectNext: () => {
    const { selectedIndex, results } = get();
    set({ selectedIndex: Math.min(selectedIndex + 1, results.length - 1) });
  },
  selectPrev: () => {
    const { selectedIndex } = get();
    set({ selectedIndex: Math.max(selectedIndex - 1, 0) });
  },
  setResults: (results) => set({ results }),
}));
