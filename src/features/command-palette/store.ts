import { create } from 'zustand';
import { closeOtherOverlays, registerOverlay } from '../overlays/manager';

/** Command palette overlay state. */
interface CommandPaletteState {
  /** Whether the command palette is visible. */
  isOpen: boolean;
}

/** Actions for managing command palette state. */
interface CommandPaletteActions {
  /** Open the command palette. Closes other overlays via the manager. */
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
    closeOtherOverlays('commandPalette');
    set({ isOpen: true });
  },
  close: () => set({ isOpen: false }),
  toggle: () => {
    const { isOpen } = get();
    if (isOpen) {
      set({ isOpen: false });
    } else {
      closeOtherOverlays('commandPalette');
      set({ isOpen: true });
    }
  },
  resetCommandPalette: () => set({ isOpen: false }),
}));

registerOverlay('commandPalette', () => useCommandPaletteStore.getState().close());
