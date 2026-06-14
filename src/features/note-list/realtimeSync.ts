import type { UnlistenFn } from '@tauri-apps/api/event';
import { events } from '../../generated/bindings';
import { useWorkspaceStore } from '../workspace/store';

/**
 * Debounce window for collapsing a burst of `note-created` events into a single
 * note-list refresh. A scripted `notey add` loop can fire many events in quick
 * succession; refreshing once per window (rather than per event) prevents
 * re-render storms and flicker (Story 6.6 AC3 / FR36).
 */
const REFRESH_DEBOUNCE_MS = 200;

let stopSync: UnlistenFn | null = null;
let syncPromise: Promise<UnlistenFn> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshInFlight = false;
let refreshQueued = false;

/** Cancel any pending debounced refresh. */
function clearPendingRefresh(): void {
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

/** Run one refresh at a time; if more events land mid-flight, queue one follow-up pass. */
async function runRefresh(): Promise<void> {
  if (refreshInFlight) {
    refreshQueued = true;
    return;
  }

  refreshInFlight = true;
  try {
    await useWorkspaceStore.getState().loadFilteredNotes();
  } catch (e) {
    console.error('note-created refresh failed:', e);
  } finally {
    refreshInFlight = false;
    if (refreshQueued) {
      refreshQueued = false;
      scheduleRefresh();
    }
  }
}

/**
 * Schedule a single debounced note-list refresh. Repeated calls within the
 * window coalesce into one `loadFilteredNotes()` invocation.
 */
function scheduleRefresh(): void {
  clearPendingRefresh();
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void runRefresh();
  }, REFRESH_DEBOUNCE_MS);
}

/**
 * Subscribe to backend `note-created` events (emitted when a note is created via
 * the CLI/IPC) and keep the desktop note list in sync in real time.
 *
 * Each event schedules a debounced {@link useWorkspaceStore} `loadFilteredNotes()`
 * re-query, so the active-workspace filter, ordering, and soft-delete rules stay
 * authoritative (a CLI note in the active workspace appears; one in another
 * workspace does not).
 *
 * Call once at app startup. The subscription is idempotent so duplicate startup
 * calls share the same listener. Returns an unlisten function that cancels any
 * pending refresh and detaches the event listener.
 */
export async function startNoteCreatedSync(): Promise<UnlistenFn> {
  if (stopSync !== null) {
    return stopSync;
  }
  if (syncPromise !== null) {
    return syncPromise;
  }

  syncPromise = events.noteCreated
    .listen(() => {
      scheduleRefresh();
    })
    .then((unlisten) => {
      const stop = () => {
        clearPendingRefresh();
        refreshQueued = false;
        if (stopSync === stop) {
          stopSync = null;
          syncPromise = null;
        }
        unlisten();
      };
      stopSync = stop;
      return stop;
    })
    .catch((error) => {
      syncPromise = null;
      throw error;
    });

  return syncPromise;
}
