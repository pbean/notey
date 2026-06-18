import { useEffect } from 'react';
import { CaptureWindow } from './features/editor/components/CaptureWindow';
import { Toaster } from './features/toast/components/Toaster';
import { useWorkspaceStore } from './features/workspace/store';
import { restoreSession, startSessionAutoSave } from './features/session/persistence';
import { startNoteCreatedSync } from './features/note-list/realtimeSync';
import { initOnboarding } from './features/onboarding/bootstrap';
import { startHotkeyUnavailableNotice } from './features/hotkey/unavailableNotice';
import { checkForUpdates } from './features/updates/checkForUpdates';
import { UpdateBanner } from './features/updates/components/UpdateBanner';

/** Application root — renders the main CaptureWindow and the toast overlay. */
function App() {
  useEffect(() => {
    let disposed = false;
    let stopAutoSave: (() => void) | null = null;
    let stopNoteSync: (() => void) | null = null;
    const noteSyncReady = startNoteCreatedSync();

    // First-run onboarding: load persisted state (shows the overlay on first run)
    // and record this session for the progressive command hint. Independent of
    // the workspace/session chain below — failures must not block startup.
    void initOnboarding();

    // If no global-shortcut backend is available on this session, warn the user
    // (via a persistent toast) that the hotkey will not work (FR57, DW-99).
    // Best-effort and independent of the chain below.
    void startHotkeyUnavailableNotice();

    // Probe for a newer release in the background. No-op outside Tauri and fully
    // best-effort — surfaces the UpdateBanner only when an install is available.
    void checkForUpdates();

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
      <UpdateBanner />
      <CaptureWindow />
      <Toaster />
    </>
  );
}

export default App;
