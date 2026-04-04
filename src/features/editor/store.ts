import { create } from 'zustand';

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
}

/** Per-editor Zustand store for note content, format, and save state. */
export const useEditorStore = create<EditorState & EditorActions>((set) => ({
  activeNoteId: null,
  content: '',
  format: 'markdown',
  saveStatus: 'idle',
  lastSavedAt: null,
  setActiveNote: (id) => set({ activeNoteId: id }),
  setContent: (content) => set({ content }),
  setFormat: (format) => set({ format }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  markSaved: (lastSavedAt) => set({ saveStatus: 'saved', lastSavedAt }),
}));
