import { useEffect, useRef } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap } from '@codemirror/commands';
import { useEditorStore } from '../store';

/** Module-scoped compartment enables dynamic language reconfiguration (Story 1.10). */
export const langCompartment = new Compartment();

interface EditorPaneProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * CodeMirror 6 editor pane. Auto-focuses on mount. Syncs document
 * changes to useEditorStore.content via an update listener.
 */
export function EditorPane({ className, style }: EditorPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const setContent = useEditorStore((s) => s.setContent);

  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: '',
        extensions: [
          EditorView.lineWrapping,
          langCompartment.of(markdown()),
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

    view.focus();

    return () => view.destroy();
  }, [setContent]);

  return <div ref={containerRef} className={className} style={{ height: '100%', ...style }} />;
}
