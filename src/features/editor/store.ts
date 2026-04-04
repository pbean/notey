import { create } from 'zustand';

/** Format of a note's content. */
export type NoteFormat = 'markdown' | 'plaintext';

interface EditorState {
  /** ID of the note currently open in the editor, or null before first create. */
  noteId: number | null;
  /** Current raw text content of the editor. */
  content: string;
  /** Content format for syntax highlighting and export. */
  format: NoteFormat;
}

interface EditorActions {
  /** Set the active note ID after createNote resolves. */
  setNoteId: (id: number) => void;
  /** Update content from CodeMirror update listener. */
  setContent: (content: string) => void;
  /** Switch between markdown and plaintext modes. */
  setFormat: (format: NoteFormat) => void;
}

/** Per-editor Zustand store for note content, format, and save state. */
export const useEditorStore = create<EditorState & EditorActions>((set) => ({
  noteId: null,
  content: '',
  format: 'markdown',
  setNoteId: (id) => set({ noteId: id }),
  setContent: (content) => set({ content }),
  setFormat: (format) => set({ format }),
}));
