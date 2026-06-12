import { create } from 'zustand';
import { commands } from '../../generated/bindings';
import type { Note } from '../../generated/bindings';
import { closeOtherOverlays, registerOverlay } from '../overlays/manager';
import { useWorkspaceStore } from '../workspace/store';

/**
 * Note ids with a restore request currently in flight. Guards against a
 * double-click restoring (and re-toasting) the same note twice while the first
 * request is still pending. Module-level (not store state) since it is purely
 * an internal concurrency latch, never rendered. Keyed per-note so restoring two
 * different notes in quick succession still works.
 */
const restoringIds = new Set<number>();
let latestTrashLoadRequestId = 0;

/** Trash view overlay state. */
interface TrashState {
  /** Whether the trash overlay is visible. */
  isOpen: boolean;
  /** Soft-deleted notes, ordered by deletion time (newest first). */
  trashedNotes: Note[];
  /** Note ids currently being restored. */
  restoringNoteIds: number[];
  /** True while the trashed-notes list is loading. */
  isLoading: boolean;
  /** Error message from the last failed trash load, or null. */
  error: string | null;
  /** Index of the currently selected note in the list. */
  selectedIndex: number;
}

/** Actions for managing trash view state. */
interface TrashActions {
  /** Open the trash overlay (closing other overlays) and load the trashed notes. */
  open: () => void;
  /** Close the trash overlay. */
  close: () => void;
  /** Load all soft-deleted notes from the backend into `trashedNotes`. */
  loadTrashedNotes: () => Promise<void>;
  /**
   * Restore a soft-deleted note. On success, removes it from `trashedNotes` and
   * refreshes the active note list so it reappears in its original workspace.
   * Returns the restored note, or null on failure. Concurrent calls for the same
   * id are ignored.
   */
  restoreNote: (noteId: number) => Promise<Note | null>;
  /** Move selection to the next note (wrapping). */
  selectNext: (noteCount: number) => void;
  /** Move selection to the previous note (wrapping). */
  selectPrev: (noteCount: number) => void;
  /** Reset all state (test cleanup only). */
  resetTrash: () => void;
}

/** Per-feature Zustand store for the trash view. */
export const useTrashStore = create<TrashState & TrashActions>((set, get) => ({
  isOpen: false,
  trashedNotes: [],
  restoringNoteIds: [],
  isLoading: false,
  error: null,
  selectedIndex: 0,

  open: () => {
    closeOtherOverlays('trash');
    set({ isOpen: true, trashedNotes: [], selectedIndex: 0 });
    void get().loadTrashedNotes();
  },

  close: () => set({ isOpen: false }),

  loadTrashedNotes: async () => {
    const requestId = ++latestTrashLoadRequestId;
    set({ isLoading: true, error: null });
    try {
      const result = await commands.listTrashedNotes();
      if (requestId !== latestTrashLoadRequestId) return;

      if (result.status === 'ok') {
        set({ trashedNotes: result.data, isLoading: false, error: null });
      } else {
        console.error('listTrashedNotes failed:', result.error);
        set({ isLoading: false, error: 'Failed to load trash - reopen to retry' });
      }
    } catch (error) {
      if (requestId !== latestTrashLoadRequestId) return;
      console.error('listTrashedNotes failed:', error);
      set({ isLoading: false, error: 'Failed to load trash - reopen to retry' });
    }
  },

  restoreNote: async (noteId) => {
    if (restoringIds.has(noteId)) return null;
    restoringIds.add(noteId);
    set((state) => ({ restoringNoteIds: [...state.restoringNoteIds, noteId] }));
    try {
      const result = await commands.restoreNote(noteId);
      if (result.status === 'ok') {
        set((state) => {
          const trashedNotes = state.trashedNotes.filter((n) => n.id !== noteId);

          return {
            trashedNotes,
            selectedIndex: Math.min(state.selectedIndex, Math.max(0, trashedNotes.length - 1)),
          };
        });
        void useWorkspaceStore.getState().loadFilteredNotes();
        return result.data;
      } else {
        console.error('restoreNote failed:', result.error);
        return null;
      }
    } catch (error) {
      console.error('restoreNote failed:', error);
      return null;
    } finally {
      restoringIds.delete(noteId);
      set((state) => ({
        restoringNoteIds: state.restoringNoteIds.filter((id) => id !== noteId),
      }));
    }
  },

  selectNext: (noteCount) => {
    if (noteCount === 0) return;
    set((state) => ({ selectedIndex: (state.selectedIndex + 1) % noteCount }));
  },

  selectPrev: (noteCount) => {
    if (noteCount === 0) return;
    set((state) => ({ selectedIndex: (state.selectedIndex - 1 + noteCount) % noteCount }));
  },

  resetTrash: () => {
    restoringIds.clear();
    latestTrashLoadRequestId += 1;
    set({
      isOpen: false,
      trashedNotes: [],
      restoringNoteIds: [],
      isLoading: false,
      error: null,
      selectedIndex: 0,
    });
  },
}));

registerOverlay('trash', () => useTrashStore.getState().close());
