import { useEffect } from 'react';
import { CaptureWindow } from './features/editor/components/CaptureWindow';
import { Toaster } from './features/toast/components/Toaster';
import { useWorkspaceStore } from './features/workspace/store';
import { restoreSession, startSessionAutoSave } from './features/session/persistence';
import { startNoteCreatedSync } from './features/note-list/realtimeSync';

/** Application root — renders the main CaptureWindow and the toast overlay. */
function App() {
  useEffect(() => {
    let disposed = false;
    let stopAutoSave: (() => void) | null = null;
    let stopNoteSync: (() => void) | null = null;
    const noteSyncReady = startNoteCreatedSync();

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

      try {
        const unlisten = await noteSyncReady;
        if (disposed) {
          unlisten();
        } else {
          stopNoteSync = unlisten;
        }
      } catch (e) {
        console.error('startNoteCreatedSync failed:', e);
      }

      if (disposed) return;

      // Backfill once startup settles so any CLI-created note emitted during the
      // init/restore window is visible even if it landed before the event
      // listener finished registering.
      try {
        await useWorkspaceStore.getState().loadFilteredNotes();
      } catch (e) {
        console.error('startup note refresh failed:', e);
      }

      if (disposed) return;
      stopAutoSave = startSessionAutoSave();
    })();

    return () => {
      disposed = true;
      stopAutoSave?.();
      stopNoteSync?.();
    };
  }, []);

  return (
    <>
      <CaptureWindow />
      <Toaster />
    </>
  );
}

export default App;
