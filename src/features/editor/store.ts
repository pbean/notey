import { create } from 'zustand';
import { commands } from '../../generated/bindings';

/** Format of a note's content. */
export type NoteFormat = 'markdown' | 'plaintext';

/** Visual state of the auto-save indicator. */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

interface EditorState {
  /** ID of the note currently open in the editor, or null before first create. */
  activeNoteId: number | null;
  /** Current raw text content of the editor. */
  content: string;
  /** Content format for syntax highlighting and export. */
  format: NoteFormat;
  /** Current save operation status for the indicator. */
  saveStatus: SaveStatus;
  /** ISO 8601 timestamp of the last successful save, or null. */
  lastSavedAt: string | null;
  /** True when content was set by loadNote (not by user typing). Resets after hydration. */
  isHydrating: boolean;
}

interface EditorActions {
  /** Set the active note ID after createNote resolves. */
  setActiveNote: (id: number) => void;
  /** Update content from CodeMirror update listener. */
  setContent: (content: string) => void;
  /** Switch between markdown and plaintext modes. */
  setFormat: (format: NoteFormat) => void;
  /** Update the save indicator state. */
  setSaveStatus: (status: SaveStatus) => void;
  /** Atomically mark a successful save with its timestamp. */
  markSaved: (lastSavedAt: string) => void;
  /** Reset all editor state to initial values (for "new note" or "close note" flows). */
  resetNote: () => void;
  /** Fetch a note by ID from the backend and hydrate the editor with its content. */
  loadNote: (id: number) => Promise<void>;
  /** Clear the hydrating flag after CodeMirror has consumed the content. */
  clearHydrating: () => void;
}

/** Per-editor Zustand store for note content, format, and save state. */
export const useEditorStore = create<EditorState & EditorActions>((set) => ({
  activeNoteId: null,
  content: '',
  format: 'markdown',
  saveStatus: 'idle',
  lastSavedAt: null,
  isHydrating: false,
  setActiveNote: (id) => set({ activeNoteId: id }),
  setContent: (content) => set({ content }),
  setFormat: (format) => set({ format }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  markSaved: (lastSavedAt) => set({ saveStatus: 'saved', lastSavedAt }),
  resetNote: () =>
    set({
      activeNoteId: null,
      content: '',
      format: 'markdown',
      saveStatus: 'idle',
      lastSavedAt: null,
      isHydrating: false,
    }),
  loadNote: async (id) => {
    const result = await commands.getNote(id);
    if (result.status === 'error') {
      console.error('loadNote failed:', result.error);
      set({ saveStatus: 'failed', isHydrating: false });
      return;
    }
    const note = result.data;
    set({
      activeNoteId: note.id,
      content: note.content,
      format: note.format as NoteFormat,
      saveStatus: 'idle',
      lastSavedAt: note.updatedAt,
      isHydrating: true,
    });
  },
  clearHydrating: () => set({ isHydrating: false }),
}));
