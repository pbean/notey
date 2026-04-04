import { useEffect, useRef } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap } from '@codemirror/commands';
import { useEditorStore } from '../store';
import { useAutoSave, flushSave } from '../hooks/useAutoSave';
import { useNoteHydration } from '../hooks/useNoteHydration';
import { useWindowFocus } from '../hooks/useWindowFocus';
import { commands } from '../../../generated/bindings';

/** Module-scoped compartment enables dynamic language reconfiguration (Story 1.10). */
export const langCompartment = new Compartment();

/** Props for the CodeMirror editor pane component. */
interface EditorPaneProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * CodeMirror 6 editor pane. Syncs document changes to useEditorStore.content
 * via an update listener. Reconfigures the language compartment when store
 * format changes. Esc dismisses the window after flushing any pending save.
 * Focuses editor when the window gains focus (hotkey summon, tray click).
 */
export function EditorPane({ className, style }: EditorPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const setContent = useEditorStore((s) => s.setContent);
  const format = useEditorStore((s) => s.format);

  useAutoSave();
  useNoteHydration(viewRef);
  useWindowFocus(viewRef);

  useEffect(() => {
    if (!containerRef.current) return;

    const initialFormat = useEditorStore.getState().format;

    const view = new EditorView({
      state: EditorState.create({
        doc: '',
        extensions: [
          EditorView.lineWrapping,
          langCompartment.of(initialFormat === 'markdown' ? markdown() : []),
          keymap.of([
            {
              key: 'Escape',
              run: () => {
                flushSave()
                  .catch((e) => console.error('Esc save flush failed:', e))
                  .then(() => commands.dismissWindow());
                return true;
              },
            },
          ]),
          keymap.of(defaultKeymap),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              setContent(update.state.doc.toString());
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
        ],
      }),
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [setContent]);

  // Reconfigure language compartment when format changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: langCompartment.reconfigure(format === 'markdown' ? markdown() : []),
    });
  }, [format]);

  return <div ref={containerRef} className={className} style={{ height: '100%', ...style }} />;
}
