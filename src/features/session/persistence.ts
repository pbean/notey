import { useTabStore, type Tab } from '../tabs/store';
import { useWorkspaceStore } from '../workspace/store';
import { useEditorStore } from '../editor/store';
import { editorViewRef } from '../editor/editorViewRef';
import { commands } from '../../generated/bindings';

/** localStorage key holding the serialized session. Versioned for forward migration. */
const STORAGE_KEY = 'notey-session-v1';
/** Debounce window (ms) between a state change and a session write. */
const DEBOUNCE_MS = 1000;

/** A single persisted tab — metadata only, never note content. */
export interface SerializedTab {
  noteId: number;
  title: string;
  format?: 'markdown' | 'plaintext';
  scrollTop?: number;
  cursorPos?: number;
}

/** The full persisted session snapshot stored in localStorage. */
export interface SerializedSession {
  version: 1;
  tabs: SerializedTab[];
  activeTabIndex: number | null;
  activeWorkspaceId: number | null;
}

function isFiniteInteger(value: unknown): value is number {
  return Number.isInteger(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isSerializedFormat(value: unknown): value is SerializedTab['format'] {
  return value === 'markdown' || value === 'plaintext';
}

function sanitizeSerializedTab(value: unknown): SerializedTab | null {
  if (value === null || typeof value !== 'object') return null;

  const candidate = value as Record<string, unknown>;
  if (!isFiniteInteger(candidate.noteId) || candidate.noteId < 0) return null;
  if (typeof candidate.title !== 'string') return null;

  return {
    noteId: candidate.noteId,
    title: candidate.title,
    format: isSerializedFormat(candidate.format) ? candidate.format : undefined,
    scrollTop: isNonNegativeNumber(candidate.scrollTop) ? candidate.scrollTop : undefined,
    cursorPos:
      isFiniteInteger(candidate.cursorPos) && candidate.cursorPos >= 0
        ? candidate.cursorPos
        : undefined,
  };
}

function parseSerializedSession(raw: string): SerializedSession | null {
  const candidate = JSON.parse(raw) as Record<string, unknown>;
  if (candidate === null || typeof candidate !== 'object') return null;
  if (candidate.version !== 1 || !Array.isArray(candidate.tabs)) return null;

  const tabs = candidate.tabs
    .map((tab) => sanitizeSerializedTab(tab))
    .filter((tab): tab is SerializedTab => tab !== null);
  if (tabs.length !== candidate.tabs.length) return null;

  const activeTabIndex =
    candidate.activeTabIndex === null
      ? null
      : isFiniteInteger(candidate.activeTabIndex) && candidate.activeTabIndex >= 0
        ? candidate.activeTabIndex
        : null;
  const activeWorkspaceId =
    candidate.activeWorkspaceId === null
      ? null
      : isFiniteInteger(candidate.activeWorkspaceId) && candidate.activeWorkspaceId >= 0
        ? candidate.activeWorkspaceId
        : null;

  return {
    version: 1,
    tabs,
    activeTabIndex,
    activeWorkspaceId,
  };
}

function normalizeRestoredFormat(value: string, fallback?: SerializedTab['format']): SerializedTab['format'] {
  return value === 'plaintext' ? 'plaintext' : value === 'markdown' ? 'markdown' : (fallback ?? 'markdown');
}

/**
 * Serialize current tab + workspace state to localStorage. Reads the active
 * tab's live cursor/scroll from {@link editorViewRef} (its stored `editorState`
 * is only refreshed on tab switch); every other tab uses its last switch
 * snapshot, falling back to a `cursorPos` carried over from a prior restore.
 */
export function saveSession(): void {
  const { tabs, activeTabIndex } = useTabStore.getState();
  const { activeWorkspaceId } = useWorkspaceStore.getState();
  const { activeNoteId } = useEditorStore.getState();
  const view = editorViewRef.current;

  const serializedTabs: SerializedTab[] = tabs.map((tab: Tab, i) => {
    const isActive = i === activeTabIndex;
    const useLiveEditor = isActive && view !== null && activeNoteId === tab.noteId;
    const cursorPos =
      useLiveEditor
        ? view.state.selection.main.head
        : (tab.editorState?.selection.main.head ?? tab.cursorPos);
    const scrollTop = useLiveEditor ? view.scrollDOM.scrollTop : tab.scrollTop;
    return { noteId: tab.noteId, title: tab.title, format: tab.format, scrollTop, cursorPos };
  });

  const session: SerializedSession = {
    version: 1,
    tabs: serializedTabs,
    activeTabIndex,
    activeWorkspaceId,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    console.warn('Failed to persist session:', e);
  }
}

/**
 * Restore a previously persisted session. Restores the workspace first, then
 * validates each tab's note via `getNote`, silently dropping tabs whose notes
 * were deleted. Corrupt or version-mismatched data is discarded. No-op when no
 * session exists or every tab references a deleted note. Never throws.
 */
export async function restoreSession(): Promise<void> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return;

  let session: SerializedSession;
  try {
    const parsed = parseSerializedSession(raw);
    if (parsed === null) {
      throw new Error('unsupported session shape');
    }
    session = parsed;
  } catch (e) {
    console.warn('Discarding corrupt session state:', e);
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  // Restore workspace first so the correct notes are visible when tabs load.
  if (session.activeWorkspaceId != null) {
    await useWorkspaceStore.getState().restoreWorkspaceId(session.activeWorkspaceId);
  }

  // Validate each tab's note still exists; silently drop deleted ones.
  const restoredTabs = await Promise.all(
    session.tabs.map(async (tab, originalIndex) => {
      try {
        const result = await commands.getNote(tab.noteId);
        if (result.status === 'ok') {
          return {
            originalIndex,
            tab: {
              ...tab,
              title: result.data.title,
              format: normalizeRestoredFormat(result.data.format, tab.format),
            },
          };
        }

        if (result.error.type === 'NotFound') {
          return null;
        }

        console.warn('restoreSession: preserving tab after validation failed:', result.error);
        return { originalIndex, tab };
      } catch (e) {
        console.warn('restoreSession: preserving tab after getNote threw:', e);
        return { originalIndex, tab };
      }
    }),
  );

  const validTabs = restoredTabs.filter(
    (restored): restored is { originalIndex: number; tab: SerializedTab } => restored !== null,
  );

  let newActiveIndex: number | null = null;
  for (let i = 0; i < validTabs.length; i++) {
    if (validTabs[i].originalIndex === session.activeTabIndex) {
      newActiveIndex = i;
      break;
    }
  }

  if (validTabs.length === 0) {
    useTabStore.getState().restoreTabs([], null);
    return;
  }

  // Saved active tab was dropped → fall back to the first surviving tab.
  useTabStore.getState().restoreTabs(
    validTabs.map((restored) => restored.tab),
    newActiveIndex,
  );
}

let unsubscribe: (() => void) | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let scheduleSessionSave: (() => void) | null = null;

/** Queue a debounced session write when editor-only activity occurs. */
export function queueSessionSave(): void {
  scheduleSessionSave?.();
}

/**
 * Begin auto-saving the session whenever tab or workspace state changes,
 * debounced by {@link DEBOUNCE_MS}. Idempotent (guards against React StrictMode
 * double-invoke). Returns an unsubscribe function that also clears any pending
 * write.
 */
export function startSessionAutoSave(): () => void {
  if (unsubscribe) return unsubscribe;

  const schedule = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      saveSession();
    }, DEBOUNCE_MS);
  };
  scheduleSessionSave = schedule;

  const unsubTabs = useTabStore.subscribe(schedule);
  const unsubWorkspace = useWorkspaceStore.subscribe(schedule);
  const unsubEditor = useEditorStore.subscribe((state, prevState) => {
    if (
      state.content !== prevState.content ||
      state.activeNoteId !== prevState.activeNoteId ||
      state.format !== prevState.format
    ) {
      schedule();
    }
  });

  unsubscribe = () => {
    unsubTabs();
    unsubWorkspace();
    unsubEditor();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    scheduleSessionSave = null;
    unsubscribe = null;
  };
  return unsubscribe;
}
