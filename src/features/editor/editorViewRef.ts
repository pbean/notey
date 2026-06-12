import type { EditorView } from '@codemirror/view';

/** Shared handle to the live CodeMirror view for session persistence helpers. */
export const editorViewRef: { current: EditorView | null } = { current: null };
