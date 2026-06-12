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
/**
 * Note ids with a permanent-delete request currently in flight. Guards against a
 * double-click on "Delete Forever" issuing two backend deletes (and two toasts)
 * for the same note. Module-level, mirroring {@link restoringIds}.
 */
const deletingIds = new Set<number>();
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
  /**
   * The trashed note awaiting permanent-delete confirmation, or null when the
   * confirmation dialog is closed. Drives the irreversible-delete alertdialog.
   */
  pendingDeleteNote: Note | null;
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
  /** Open the permanent-delete confirmation dialog for the given note. */
  requestPermanentDelete: (note: Note) => void;
  /** Dismiss the permanent-delete confirmation dialog without deleting. */
  cancelPermanentDelete: () => void;
  /**
   * Permanently delete a trashed note (irreversible). On success, removes it from
   * `trashedNotes`, clamps `selectedIndex`, and closes the confirmation dialog.
   * Returns `true` on success, `false` on failure. Concurrent calls for the same
   * id are ignored.
   */
  permanentlyDeleteNote: (noteId: number) => Promise<boolean>;
  /** Whether a permanent-delete request is currently in flight for the note id. */
  isPermanentlyDeleting: (noteId: number) => boolean;
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
  pendingDeleteNote: null,

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

  requestPermanentDelete: (note) => set({ pendingDeleteNote: note }),

  cancelPermanentDelete: () => set({ pendingDeleteNote: null }),

  permanentlyDeleteNote: async (noteId) => {
    if (deletingIds.has(noteId)) return false;
    deletingIds.add(noteId);
    try {
      const result = await commands.deleteNotePermanently(noteId);
      if (result.status === 'ok') {
        set((state) => {
          const trashedNotes = state.trashedNotes.filter((n) => n.id !== noteId);
          return {
            trashedNotes,
            selectedIndex: Math.min(state.selectedIndex, Math.max(0, trashedNotes.length - 1)),
            pendingDeleteNote:
              state.pendingDeleteNote?.id === noteId ? null : state.pendingDeleteNote,
          };
        });
        return true;
      } else {
        console.error('deleteNotePermanently failed:', result.error);
        return false;
      }
    } catch (error) {
      console.error('deleteNotePermanently failed:', error);
      return false;
    } finally {
      deletingIds.delete(noteId);
    }
  },

  isPermanentlyDeleting: (noteId) => deletingIds.has(noteId),

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
    deletingIds.clear();
    latestTrashLoadRequestId += 1;
    set({
      isOpen: false,
      trashedNotes: [],
      restoringNoteIds: [],
      isLoading: false,
      error: null,
      selectedIndex: 0,
      pendingDeleteNote: null,
    });
  },
}));

registerOverlay('trash', () => useTrashStore.getState().close());
