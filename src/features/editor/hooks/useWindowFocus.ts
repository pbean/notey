import { useEffect, useRef } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { EditorView } from '@codemirror/view';

/**
 * Listens for the window gaining focus (via hotkey summon, tray click, etc.)
 * and focuses the CodeMirror editor. Addresses the deferred work item:
 * `view.focus()` should be called after the window becomes visible,
 * not unconditionally at construction time.
 */
export function useWindowFocus(viewRef: React.RefObject<EditorView | null>): void {
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    const appWindow = getCurrentWebviewWindow();
    let unlisten: (() => void) | undefined;

    appWindow.listen('tauri://focus', () => {
      viewRef.current?.focus();
    }).then((fn) => {
      if (cancelledRef.current) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      cancelledRef.current = true;
      unlisten?.();
    };
  }, [viewRef]);
}
