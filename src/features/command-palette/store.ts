import { create } from 'zustand';
import { useSearchStore } from '../search/store';

/** Command palette overlay state. */
interface CommandPaletteState {
  /** Whether the command palette is visible. */
  isOpen: boolean;
}

/** Actions for managing command palette state. */
interface CommandPaletteActions {
  /** Open the command palette. Closes search overlay to enforce Layer 1 mutual exclusion. */
  open: () => void;
  /** Close the command palette. */
  close: () => void;
  /** Toggle the command palette open/closed. */
  toggle: () => void;
  /** Reset all state (test cleanup only). */
  resetCommandPalette: () => void;
}

/** Per-feature Zustand store for command palette state. */
export const useCommandPaletteStore = create<CommandPaletteState & CommandPaletteActions>((set, get) => ({
  isOpen: false,
  open: () => {
    useSearchStore.getState().closeSearch();
    set({ isOpen: true });
  },
  close: () => set({ isOpen: false }),
  toggle: () => {
    const { isOpen } = get();
    if (isOpen) {
      set({ isOpen: false });
    } else {
      useSearchStore.getState().closeSearch();
      set({ isOpen: true });
    }
  },
  resetCommandPalette: () => set({ isOpen: false }),
}));
