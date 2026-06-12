import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState as CMEditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { mockInvoke } from '../../test-utils/setup';
import { useTabStore } from '../tabs/store';
import { useWorkspaceStore } from '../workspace/store';
import { useEditorStore } from '../editor/store';
import { editorViewRef } from '../editor/editorViewRef';
import {
  saveSession,
  queueSessionSave,
  restoreSession,
  startSessionAutoSave,
  type SerializedSession,
} from './persistence';

const STORAGE_KEY = 'notey-session-v1';

const MOCK_WORKSPACES = [
  { id: 7, name: 'project', path: '/home/user/project', createdAt: '2026-01-01T00:00:00+00:00', noteCount: 5 },
];

/** Build a fake EditorView exposing just the cursor/scroll fields saveSession reads. */
function fakeView(head: number, scrollTop: number): EditorView {
  return {
    state: { selection: { main: { head } } },
    scrollDOM: { scrollTop },
  } as unknown as EditorView;
}

function writeSession(session: SerializedSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

describe('session persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    editorViewRef.current = null;
  });

  afterEach(() => {
    editorViewRef.current = null;
  });

  describe('saveSession', () => {
    it('serializes the correct shape with the active-tab cursor from editorViewRef', () => {
      useTabStore.setState({
        tabs: [{ noteId: 1, title: 'A', format: 'markdown' }],
        activeTabIndex: 0,
      });
      useEditorStore.setState({ activeNoteId: 1 });
      useWorkspaceStore.setState({ activeWorkspaceId: 7 });
      editorViewRef.current = fakeView(42, 100);

      saveSession();

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as SerializedSession;
      expect(stored.version).toBe(1);
      expect(stored.activeTabIndex).toBe(0);
      expect(stored.activeWorkspaceId).toBe(7);
      expect(stored.tabs).toEqual([
        { noteId: 1, title: 'A', format: 'markdown', scrollTop: 100, cursorPos: 42 },
      ]);
    });

    it('takes a non-active tab cursor from its editorState snapshot', () => {
      const snapshot = CMEditorState.create({ doc: 'hello world', selection: { anchor: 5 } });
      useTabStore.setState({
        tabs: [
          { noteId: 1, title: 'A' },
          { noteId: 2, title: 'B', editorState: snapshot, scrollTop: 30 },
        ],
        activeTabIndex: 0,
      });
      useEditorStore.setState({ activeNoteId: 1 });
      editorViewRef.current = fakeView(42, 100);

      saveSession();

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as SerializedSession;
      expect(stored.tabs[0]).toMatchObject({ noteId: 1, cursorPos: 42, scrollTop: 100 });
      expect(stored.tabs[1]).toMatchObject({ noteId: 2, cursorPos: 5, scrollTop: 30 });
    });

    it('falls back to the stored snapshot when the live editor still shows the previous note', () => {
      useTabStore.setState({
        tabs: [
          { noteId: 1, title: 'A' },
          { noteId: 2, title: 'B', cursorPos: 7, scrollTop: 30 },
        ],
        activeTabIndex: 1,
      });
      useEditorStore.setState({ activeNoteId: 1 });
      editorViewRef.current = fakeView(42, 100);

      saveSession();

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as SerializedSession;
      expect(stored.tabs[1]).toMatchObject({ noteId: 2, cursorPos: 7, scrollTop: 30 });
    });
  });

  describe('restoreSession', () => {
    it('restores valid tabs and skips ones whose note was deleted', async () => {
      mockInvoke.mockImplementation((cmd: string, args: { id: number }) => {
        if (cmd === 'get_note') {
          return args.id === 1
            ? Promise.resolve({ id: 1, title: 'Fresh A', content: 'hi', format: 'plaintext' })
            : Promise.reject({ type: 'NotFound' });
        }
        return Promise.reject(new Error(`unmocked: ${cmd}`));
      });
      writeSession({
        version: 1,
        tabs: [
          { noteId: 1, title: 'A' },
          { noteId: 2, title: 'Deleted' },
        ],
        activeTabIndex: 1,
        activeWorkspaceId: null,
      });

      await restoreSession();

      const { tabs, activeTabIndex } = useTabStore.getState();
      expect(tabs).toHaveLength(1);
      expect(tabs[0].noteId).toBe(1);
      expect(tabs[0]).toMatchObject({ title: 'Fresh A', format: 'plaintext' });
      // Saved active tab (index 1) was dropped → fall back to the first survivor.
      expect(activeTabIndex).toBe(0);
    });

    it('keeps tabs when note validation fails with a transient backend error', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockInvoke.mockImplementation((cmd: string) =>
        cmd === 'get_note' ? Promise.reject({ type: 'Database' }) : Promise.reject(new Error(cmd)),
      );
      writeSession({
        version: 1,
        tabs: [{ noteId: 1, title: 'Keep me', cursorPos: 9 }],
        activeTabIndex: 0,
        activeWorkspaceId: null,
      });

      await restoreSession();

      expect(useTabStore.getState().tabs).toMatchObject([{ noteId: 1, title: 'Keep me', cursorPos: 9 }]);
      expect(useTabStore.getState().activeTabIndex).toBe(0);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('leaves the tab store empty when every saved note was deleted', async () => {
      mockInvoke.mockImplementation((cmd: string) =>
        cmd === 'get_note' ? Promise.reject({ type: 'NotFound' }) : Promise.reject(new Error(cmd)),
      );
      writeSession({
        version: 1,
        tabs: [{ noteId: 1, title: 'Gone' }],
        activeTabIndex: 0,
        activeWorkspaceId: null,
      });

      await restoreSession();

      expect(useTabStore.getState().tabs).toEqual([]);
      expect(useTabStore.getState().activeTabIndex).toBeNull();
    });

    it('is a no-op when no session exists', async () => {
      await restoreSession();
      expect(useTabStore.getState().tabs).toEqual([]);
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('discards corrupt JSON and clears the key without changing the store', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      localStorage.setItem(STORAGE_KEY, '{ not valid json');

      await restoreSession();

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(useTabStore.getState().tabs).toEqual([]);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('discards parseable invalid session shapes and clears the key', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          tabs: [{ noteId: 'bad', title: 'oops', editorState: { invalid: true } }],
          activeTabIndex: 0,
          activeWorkspaceId: null,
        }),
      );

      await restoreSession();

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(useTabStore.getState().tabs).toEqual([]);
      expect(mockInvoke).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('keeps the default workspace when the saved id no longer exists', async () => {
      useWorkspaceStore.setState({ activeWorkspaceId: 7, workspaces: MOCK_WORKSPACES });
      writeSession({
        version: 1,
        tabs: [],
        activeTabIndex: null,
        activeWorkspaceId: 999, // not in the workspace list
      });

      await restoreSession();

      // restoreWorkspaceId no-ops for an unknown id → default workspace untouched.
      expect(useWorkspaceStore.getState().activeWorkspaceId).toBe(7);
    });

    it('re-activates a saved workspace that still exists', async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'list_workspaces') return Promise.resolve(MOCK_WORKSPACES);
        if (cmd === 'list_notes') return Promise.resolve([]);
        return Promise.reject(new Error(cmd));
      });
      useWorkspaceStore.setState({ activeWorkspaceId: null, workspaces: [] });
      writeSession({
        version: 1,
        tabs: [],
        activeTabIndex: null,
        activeWorkspaceId: 7,
      });

      await restoreSession();

      const state = useWorkspaceStore.getState();
      expect(state.activeWorkspaceId).toBe(7);
      expect(state.activeWorkspaceName).toBe('project');
    });
  });

  describe('startSessionAutoSave', () => {
    it('writes once after a burst of state changes, debounced by ~1s', () => {
      vi.useFakeTimers();
      const setItem = vi.spyOn(Storage.prototype, 'setItem');
      const stop = startSessionAutoSave();

      useTabStore.getState().openTab(1, 'A');
      useTabStore.getState().openTab(2, 'B');
      expect(setItem).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(setItem).toHaveBeenCalledTimes(1);
      expect(setItem).toHaveBeenCalledWith(STORAGE_KEY, expect.any(String));

      stop();
      setItem.mockRestore();
      vi.useRealTimers();
    });

    it('writes after editor-only activity and explicit session-activity pings', () => {
      vi.useFakeTimers();
      const setItem = vi.spyOn(Storage.prototype, 'setItem');
      const stop = startSessionAutoSave();

      useTabStore.setState({
        tabs: [{ noteId: 1, title: 'A', cursorPos: 4, scrollTop: 8 }],
        activeTabIndex: 0,
      });
      useEditorStore.setState({ activeNoteId: 1, content: 'typed', format: 'markdown' });
      editorViewRef.current = fakeView(10, 12);
      queueSessionSave();

      vi.advanceTimersByTime(1000);
      expect(setItem).toHaveBeenCalledTimes(1);

      stop();
      setItem.mockRestore();
      vi.useRealTimers();
    });

    it('is idempotent — repeated calls return the same unsubscribe', () => {
      const stop1 = startSessionAutoSave();
      const stop2 = startSessionAutoSave();
      expect(stop1).toBe(stop2);
      stop1();
    });
  });
});
