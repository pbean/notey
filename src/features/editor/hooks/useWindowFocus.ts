import { useEffect } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { EditorView } from '@codemirror/view';

/**
 * Listens for the window gaining focus (via hotkey summon, tray click, etc.)
 * and focuses the CodeMirror editor. Addresses the deferred work item:
 * `view.focus()` should be called after the window becomes visible,
 * not unconditionally at construction time.
 */
export function useWindowFocus(viewRef: React.RefObject<EditorView | null>): void {
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    const appWindow = getCurrentWebviewWindow();

    appWindow.listen('tauri://focus', () => {
      viewRef.current?.focus();
    }).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [viewRef]);
}
