import { create } from 'zustand';
import { useSearchStore } from '../search/store';
import { useCommandPaletteStore } from '../command-palette/store';

/** Note list panel state. */
interface NoteListState {
  /** Whether the note list panel is visible. */
  isOpen: boolean;
  /** Index of the currently selected note in the list. */
  selectedIndex: number;
}

/** Actions for managing note list panel state. */
interface NoteListActions {
  /** Open the note list panel. Closes search and command palette (Layer 1 mutual exclusion). */
  open: () => void;
  /** Close the note list panel. */
  close: () => void;
  /** Move selection to the next note (wrapping). */
  selectNext: (noteCount: number) => void;
  /** Move selection to the previous note (wrapping). */
  selectPrev: (noteCount: number) => void;
  /** Reset all state (test cleanup only). */
  resetNoteList: () => void;
}

/** Per-feature Zustand store for note list panel state. */
export const useNoteListStore = create<NoteListState & NoteListActions>((set) => ({
  isOpen: false,
  selectedIndex: 0,
  open: () => {
    useSearchStore.getState().closeSearch();
    useCommandPaletteStore.getState().close();
    set({ isOpen: true, selectedIndex: 0 });
  },
  close: () => set({ isOpen: false }),
  selectNext: (noteCount) => {
    if (noteCount === 0) return;
    set((state) => ({ selectedIndex: (state.selectedIndex + 1) % noteCount }));
  },
  selectPrev: (noteCount) => {
    if (noteCount === 0) return;
    set((state) => ({ selectedIndex: (state.selectedIndex - 1 + noteCount) % noteCount }));
  },
  resetNoteList: () => set({ isOpen: false, selectedIndex: 0 }),
}));
