import { describe, it, expect, beforeEach } from 'vitest';
import { mockInvoke } from '../../test-utils/setup';
import { useTrashStore } from './store';
import { useWorkspaceStore } from '../workspace/store';
import { useNoteListStore } from '../note-list/store';
import { buildNote } from '../../test-utils/factories';

const TRASHED = [
  buildNote({ id: 1, title: 'Trashed A', isTrashed: true, deletedAt: '2026-06-10T12:00:00+00:00' }),
  buildNote({ id: 2, title: 'Trashed B', isTrashed: true, deletedAt: '2026-06-09T12:00:00+00:00' }),
];

describe('useTrashStore', () => {
  beforeEach(() => {
    useTrashStore.getState().resetTrash();
  });

  it('starts closed with an empty trash list', () => {
    const state = useTrashStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.trashedNotes).toEqual([]);
    expect(state.error).toBeNull();
  });

  it('loadTrashedNotes populates the list from listTrashedNotes', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'list_trashed_notes') return Promise.resolve(TRASHED);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await useTrashStore.getState().loadTrashedNotes();

    const state = useTrashStore.getState();
    expect(state.trashedNotes).toEqual(TRASHED);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('loadTrashedNotes sets an error message on backend failure', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'list_trashed_notes') return Promise.reject({ type: 'Database' });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await useTrashStore.getState().loadTrashedNotes();

    const state = useTrashStore.getState();
    expect(state.trashedNotes).toEqual([]);
    expect(state.error).toMatch(/failed to load trash/i);
  });

  it('loadTrashedNotes sets an error message when invoke throws an Error object', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'list_trashed_notes') return Promise.reject(new Error('boom'));
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await useTrashStore.getState().loadTrashedNotes();

    const state = useTrashStore.getState();
    expect(state.trashedNotes).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.error).toMatch(/failed to load trash/i);
  });

  it('open closes other overlays and loads the trashed notes', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'list_trashed_notes') return Promise.resolve(TRASHED);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useNoteListStore.getState().open();
    expect(useNoteListStore.getState().isOpen).toBe(true);

    useTrashStore.getState().open();
    // The trash open() closes the note-list overlay via the manager.
    expect(useNoteListStore.getState().isOpen).toBe(false);
    expect(useTrashStore.getState().isOpen).toBe(true);

    // loadTrashedNotes is fired-and-forgotten by open(); let it settle.
    await Promise.resolve();
    await Promise.resolve();
    expect(useTrashStore.getState().trashedNotes).toEqual(TRASHED);
  });

  it('ignores an older trash load that resolves after a newer request', async () => {
    let resolveFirst!: (value: typeof TRASHED) => void;
    let resolveSecond!: (value: typeof TRASHED) => void;
    const first = new Promise<typeof TRASHED>((resolve) => {
      resolveFirst = resolve;
    });
    const second = new Promise<typeof TRASHED>((resolve) => {
      resolveSecond = resolve;
    });
    let loadCount = 0;

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'list_trashed_notes') {
        loadCount += 1;
        return loadCount === 1 ? first : second;
      }
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    void useTrashStore.getState().loadTrashedNotes();
    void useTrashStore.getState().loadTrashedNotes();

    resolveSecond([TRASHED[1]]);
    await Promise.resolve();
    await Promise.resolve();
    expect(useTrashStore.getState().trashedNotes.map((n) => n.id)).toEqual([2]);

    resolveFirst([TRASHED[0]]);
    await Promise.resolve();
    await Promise.resolve();
    expect(useTrashStore.getState().trashedNotes.map((n) => n.id)).toEqual([2]);
  });

  it('restoreNote removes the note, refreshes active notes, and returns it', async () => {
    let listNotesCalls = 0;
    mockInvoke.mockImplementation((cmd: string, args?: { id?: number }) => {
      if (cmd === 'restore_note') {
        const restored = buildNote({ id: args?.id ?? 1, isTrashed: false, deletedAt: null });
        return Promise.resolve(restored);
      }
      if (cmd === 'list_notes') {
        listNotesCalls += 1;
        return Promise.resolve([]);
      }
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useTrashStore.setState({ trashedNotes: [...TRASHED] });

    const result = await useTrashStore.getState().restoreNote(1);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(1);
    expect(result?.isTrashed).toBe(false);
    expect(useTrashStore.getState().trashedNotes.map((n) => n.id)).toEqual([2]);
    // Active note list refreshed (loadFilteredNotes calls list_notes).
    await Promise.resolve();
    expect(listNotesCalls).toBeGreaterThan(0);
  });

  it('restoreNote returns null and keeps the list on backend error', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'restore_note') return Promise.reject({ type: 'NotFound' });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useTrashStore.setState({ trashedNotes: [...TRASHED] });

    const result = await useTrashStore.getState().restoreNote(1);

    expect(result).toBeNull();
    expect(useTrashStore.getState().trashedNotes.map((n) => n.id)).toEqual([1, 2]);
  });

  it('restoreNote returns null when invoke throws and clears the in-flight latch', async () => {
    let restoreCalls = 0;
    mockInvoke.mockImplementation((cmd: string, args?: { id?: number }) => {
      if (cmd === 'restore_note') {
        restoreCalls += 1;
        if (restoreCalls === 1) return Promise.reject(new Error('boom'));
        return Promise.resolve(buildNote({ id: args?.id ?? 1, isTrashed: false, deletedAt: null }));
      }
      if (cmd === 'list_notes') return Promise.resolve([]);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useTrashStore.setState({ trashedNotes: [...TRASHED] });

    const first = await useTrashStore.getState().restoreNote(1);
    expect(first).toBeNull();
    expect(useTrashStore.getState().restoringNoteIds).toEqual([]);

    const second = await useTrashStore.getState().restoreNote(1);
    expect(second?.id).toBe(1);
    expect(restoreCalls).toBe(2);
  });

  it('ignores a concurrent restore of the same note (single backend call)', async () => {
    let restoreCalls = 0;
    mockInvoke.mockImplementation((cmd: string, args?: { id?: number }) => {
      if (cmd === 'restore_note') {
        restoreCalls += 1;
        return Promise.resolve(buildNote({ id: args?.id ?? 1, isTrashed: false, deletedAt: null }));
      }
      if (cmd === 'list_notes') return Promise.resolve([]);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useTrashStore.setState({ trashedNotes: [...TRASHED] });

    const [first, second] = await Promise.all([
      useTrashStore.getState().restoreNote(1),
      useTrashStore.getState().restoreNote(1),
    ]);

    expect(restoreCalls).toBe(1);
    // Exactly one call resolves to the note; the deduped one resolves to null.
    expect([first, second].filter((r) => r !== null)).toHaveLength(1);
  });

  it('selectNext and selectPrev wrap around the list', () => {
    useTrashStore.setState({ selectedIndex: 0 });
    useTrashStore.getState().selectNext(2);
    expect(useTrashStore.getState().selectedIndex).toBe(1);
    useTrashStore.getState().selectNext(2);
    expect(useTrashStore.getState().selectedIndex).toBe(0);
    useTrashStore.getState().selectPrev(2);
    expect(useTrashStore.getState().selectedIndex).toBe(1);
  });

  it('requestPermanentDelete and cancelPermanentDelete toggle pendingDeleteNote', () => {
    expect(useTrashStore.getState().pendingDeleteNote).toBeNull();
    useTrashStore.getState().requestPermanentDelete(TRASHED[0]);
    expect(useTrashStore.getState().pendingDeleteNote?.id).toBe(1);
    useTrashStore.getState().cancelPermanentDelete();
    expect(useTrashStore.getState().pendingDeleteNote).toBeNull();
  });

  it('permanentlyDeleteNote removes the note, clamps selection, clears pending, returns true', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'delete_note_permanently') return Promise.resolve(null);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useTrashStore.setState({
      trashedNotes: [...TRASHED],
      selectedIndex: 1,
      pendingDeleteNote: TRASHED[1],
    });

    const ok = await useTrashStore.getState().permanentlyDeleteNote(2);

    expect(ok).toBe(true);
    expect(useTrashStore.getState().trashedNotes.map((n) => n.id)).toEqual([1]);
    expect(useTrashStore.getState().selectedIndex).toBe(0);
    expect(useTrashStore.getState().pendingDeleteNote).toBeNull();
  });

  it('permanentlyDeleteNote returns false and keeps the list on backend error', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'delete_note_permanently') return Promise.reject({ type: 'NotFound' });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useTrashStore.setState({ trashedNotes: [...TRASHED] });

    const ok = await useTrashStore.getState().permanentlyDeleteNote(1);

    expect(ok).toBe(false);
    expect(useTrashStore.getState().trashedNotes.map((n) => n.id)).toEqual([1, 2]);
  });

  it('ignores a concurrent permanent delete of the same note (single backend call)', async () => {
    let deleteCalls = 0;
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'delete_note_permanently') {
        deleteCalls += 1;
        return Promise.resolve(null);
      }
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useTrashStore.setState({ trashedNotes: [...TRASHED] });

    const [first, second] = await Promise.all([
      useTrashStore.getState().permanentlyDeleteNote(1),
      useTrashStore.getState().permanentlyDeleteNote(1),
    ]);

    expect(deleteCalls).toBe(1);
    expect([first, second].filter(Boolean)).toHaveLength(1);
  });

  it('resetTrash clears a pending permanent-delete', () => {
    useTrashStore.setState({ pendingDeleteNote: TRASHED[0] });
    useTrashStore.getState().resetTrash();
    expect(useTrashStore.getState().pendingDeleteNote).toBeNull();
  });

  it('uses the note original workspace implicitly — restore never sends a workspace id', async () => {
    let capturedArgs: unknown;
    mockInvoke.mockImplementation((cmd: string, args?: unknown) => {
      if (cmd === 'restore_note') {
        capturedArgs = args;
        return Promise.resolve(buildNote({ id: 1, isTrashed: false, deletedAt: null }));
      }
      if (cmd === 'list_notes') return Promise.resolve([]);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useWorkspaceStore.setState({ filteredNotes: [] });

    await useTrashStore.getState().restoreNote(1);
    expect(capturedArgs).toEqual({ id: 1 });
  });
});
