import { useEffect } from 'react';
import { CaptureWindow } from './features/editor/components/CaptureWindow';
import { useWorkspaceStore } from './features/workspace/store';
import { restoreSession, startSessionAutoSave } from './features/session/persistence';

/** Application root — renders the main CaptureWindow. */
function App() {
  useEffect(() => {
    let disposed = false;
    let stopAutoSave: (() => void) | null = null;

    // Attempt workspace init first, then restore the saved session. Auto-save
    // still starts if either step fails so session persistence keeps working.
    void (async () => {
      try {
        await useWorkspaceStore.getState().initWorkspace();
      } catch (e) {
        console.error('initWorkspace failed:', e);
      }

      try {
        await restoreSession();
      } catch (e) {
        console.error('restoreSession failed:', e);
      }

      if (disposed) return;
      stopAutoSave = startSessionAutoSave();
    })();

    return () => {
      disposed = true;
      stopAutoSave?.();
    };
  }, []);

  return <CaptureWindow />;
}

export default App;
