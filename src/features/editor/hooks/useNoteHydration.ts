import { useEffect, type RefObject } from 'react';
import type { EditorView } from '@codemirror/view';
import { useEditorStore } from '../store';

/**
 * Pushes store content into CodeMirror when `isHydrating` is true (set by `loadNote`).
 * Replaces the full document via `view.dispatch`, then clears the hydrating flag
 * so the update listener doesn't echo the change back into auto-save.
 */
export function useNoteHydration(viewRef: RefObject<EditorView | null>): void {
  const isHydrating = useEditorStore((s) => s.isHydrating);
  const content = useEditorStore((s) => s.content);
  const clearHydrating = useEditorStore((s) => s.clearHydrating);

  useEffect(() => {
    if (!isHydrating) return;

    const view = viewRef.current;
    if (!view) {
      clearHydrating();
      return;
    }

    view.dispatch(
      view.state.update({
        changes: { from: 0, to: view.state.doc.length, insert: content },
      })
    );

    clearHydrating();
  }, [isHydrating, content, clearHydrating, viewRef]);
}
