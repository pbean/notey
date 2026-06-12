import { keymap, EditorView } from '@codemirror/view';
import { Compartment, type Extension } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import type { NoteFormat } from './store';

/** Callbacks wired into the extension set. */
interface ExtensionCallbacks {
  /** Called when Escape is pressed. */
  onEscape: () => void;
  /** Called on every document change with the new content. */
  onDocChanged: (content: string) => void;
  /** Called when editor activity should refresh persisted session state. */
  onSessionActivity: () => void;
}

/** Result of buildExtensions: the extensions array and the language compartment. */
export interface BuiltExtensions {
  extensions: Extension[];
  langCompartment: Compartment;
}

/**
 * Build a CodeMirror extensions array with a fresh Compartment per call.
 * Each tab should call this once to get its own language compartment.
 */
export function buildExtensions(
  format: NoteFormat,
  callbacks: ExtensionCallbacks,
): BuiltExtensions {
  const langCompartment = new Compartment();

  const extensions = [
    EditorView.lineWrapping,
    langCompartment.of(format === 'markdown' ? markdown() : []),
    keymap.of([
      {
        key: 'Escape',
        run: () => {
          callbacks.onEscape();
          return true;
        },
      },
    ]),
    history(),
    keymap.of(historyKeymap),
    keymap.of(defaultKeymap),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        callbacks.onDocChanged(update.state.doc.toString());
      }
      if (update.docChanged || update.selectionSet) {
        callbacks.onSessionActivity();
      }
    }),
    EditorView.theme({
      '&': {
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-primary)',
        background: 'var(--bg-primary)',
        height: '100%',
      },
      '.cm-content': {
        caretColor: 'var(--text-primary)',
        padding: 'var(--space-4)',
      },
      '.cm-focused': { outline: 'none' },
      '.cm-scroller': { overflow: 'auto' },
    }),
  ];

  return { extensions, langCompartment };
}
