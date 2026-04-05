import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockInvoke } from '../../test-utils/setup';
import { useWorkspaceStore } from './store';

const MOCK_WORKSPACES = [
  { id: 7, name: 'project', path: '/home/user/project', createdAt: '2026-01-01T00:00:00+00:00', noteCount: 5 },
  { id: 8, name: 'other', path: '/home/user/other', createdAt: '2026-01-02T00:00:00+00:00', noteCount: 3 },
];

const MOCK_NOTES = [
  { id: 1, title: 'Note A', content: '', format: 'markdown', workspaceId: 7, createdAt: '2026-01-01T00:00:00+00:00', updatedAt: '2026-01-02T00:00:00+00:00', deletedAt: null, isTrashed: false },
  { id: 2, title: 'Note B', content: '', format: 'markdown', workspaceId: 7, createdAt: '2026-01-01T00:00:00+00:00', updatedAt: '2026-01-01T00:00:00+00:00', deletedAt: null, isTrashed: false },
];

describe('useWorkspaceStore', () => {
  beforeEach(() => {
    // Reset store to defaults between tests
    useWorkspaceStore.setState({
      activeWorkspaceId: null,
      activeWorkspaceName: null,
      workspaces: [],
      isAllWorkspaces: false,
      filteredNotes: [],
      isLoadingNotes: false,
    });
  });

  it('starts with null workspace state, empty workspaces, and empty filteredNotes', () => {
    const state = useWorkspaceStore.getState();
    expect(state.activeWorkspaceId).toBeNull();
    expect(state.activeWorkspaceName).toBeNull();
    expect(state.workspaces).toEqual([]);
    expect(state.isAllWorkspaces).toBe(false);
    expect(state.filteredNotes).toEqual([]);
    expect(state.isLoadingNotes).toBe(false);
  });

  it('setActiveWorkspace sets id, looks up name from workspaces, and clears isAllWorkspaces', () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'list_notes') return Promise.resolve(MOCK_NOTES);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useWorkspaceStore.setState({ workspaces: MOCK_WORKSPACES, isAllWorkspaces: true });
    useWorkspaceStore.getState().setActiveWorkspace(7);
    const state = useWorkspaceStore.getState();
    expect(state.activeWorkspaceId).toBe(7);
    expect(state.activeWorkspaceName).toBe('project');
    expect(state.isAllWorkspaces).toBe(false);
  });

  it('setActiveWorkspace sets name to null when id not found in workspaces', () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'list_notes') return Promise.resolve([]);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useWorkspaceStore.setState({ workspaces: MOCK_WORKSPACES });
    useWorkspaceStore.getState().setActiveWorkspace(999);
    const state = useWorkspaceStore.getState();
    expect(state.activeWorkspaceId).toBe(999);
    expect(state.activeWorkspaceName).toBeNull();
  });

  it('setAllWorkspaces sets flag and clears active workspace', () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'list_notes') return Promise.resolve([]);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useWorkspaceStore.setState({ activeWorkspaceId: 7, activeWorkspaceName: 'project' });
    useWorkspaceStore.getState().setAllWorkspaces();
    const state = useWorkspaceStore.getState();
    expect(state.isAllWorkspaces).toBe(true);
    expect(state.activeWorkspaceId).toBeNull();
    expect(state.activeWorkspaceName).toBeNull();
  });

  it('clearActiveWorkspace resets to null, clears isAllWorkspaces, and clears filteredNotes', () => {
    useWorkspaceStore.setState({ activeWorkspaceId: 1, activeWorkspaceName: 'ws', isAllWorkspaces: true, filteredNotes: [MOCK_NOTES[0]] });
    useWorkspaceStore.getState().clearActiveWorkspace();
    const state = useWorkspaceStore.getState();
    expect(state.activeWorkspaceId).toBeNull();
    expect(state.activeWorkspaceName).toBeNull();
    expect(state.isAllWorkspaces).toBe(false);
    expect(state.filteredNotes).toEqual([]);
  });

  it('loadWorkspaces calls listWorkspaces and populates state', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'list_workspaces') return Promise.resolve(MOCK_WORKSPACES);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await useWorkspaceStore.getState().loadWorkspaces();

    const state = useWorkspaceStore.getState();
    expect(state.workspaces).toEqual(MOCK_WORKSPACES);
    expect(mockInvoke).toHaveBeenCalledWith('list_workspaces');
  });

  it('loadWorkspaces handles error gracefully', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'list_workspaces') return Promise.reject({ type: 'Database' });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await useWorkspaceStore.getState().loadWorkspaces();

    const state = useWorkspaceStore.getState();
    expect(state.workspaces).toEqual([]);
  });

  it('initWorkspace resolves cwd, loads workspaces, sets active workspace, and loads filtered notes', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_current_dir') return Promise.resolve('/home/user/project');
      if (cmd === 'resolve_workspace')
        return Promise.resolve({ id: 7, name: 'project', path: '/home/user/project', createdAt: '2026-01-01T00:00:00+00:00' });
      if (cmd === 'list_workspaces') return Promise.resolve(MOCK_WORKSPACES);
      if (cmd === 'list_notes') return Promise.resolve(MOCK_NOTES);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await useWorkspaceStore.getState().initWorkspace();

    const state = useWorkspaceStore.getState();
    expect(state.activeWorkspaceId).toBe(7);
    expect(state.activeWorkspaceName).toBe('project');
    expect(state.workspaces).toEqual(MOCK_WORKSPACES);
    expect(mockInvoke).toHaveBeenCalledWith('get_current_dir');
    expect(mockInvoke).toHaveBeenCalledWith('resolve_workspace', { path: '/home/user/project' });
    expect(mockInvoke).toHaveBeenCalledWith('list_workspaces');
    // loadFilteredNotes is fire-and-forget, wait for the async state update
    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('list_notes', { workspaceId: 7 });
      expect(useWorkspaceStore.getState().filteredNotes).toEqual(MOCK_NOTES);
    });
  });

  it('initWorkspace handles getCurrentDir error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_current_dir') return Promise.reject({ type: 'Io' });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await useWorkspaceStore.getState().initWorkspace();

    const state = useWorkspaceStore.getState();
    expect(state.activeWorkspaceId).toBeNull();
    expect(state.activeWorkspaceName).toBeNull();

    consoleSpy.mockRestore();
  });

  it('initWorkspace falls back to resolve name when workspace not in list', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_current_dir') return Promise.resolve('/home/user/unlisted');
      if (cmd === 'resolve_workspace')
        return Promise.resolve({ id: 99, name: 'unlisted-ws', path: '/home/user/unlisted', createdAt: '2026-01-01T00:00:00+00:00' });
      if (cmd === 'list_workspaces') return Promise.resolve(MOCK_WORKSPACES); // id 99 not in list
      if (cmd === 'list_notes') return Promise.resolve([]);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await useWorkspaceStore.getState().initWorkspace();

    const state = useWorkspaceStore.getState();
    expect(state.activeWorkspaceId).toBe(99);
    // Falls back to ws.name from resolveWorkspace since id 99 isn't in MOCK_WORKSPACES
    expect(state.activeWorkspaceName).toBe('unlisted-ws');
    expect(state.workspaces).toEqual(MOCK_WORKSPACES);
  });

  it('initWorkspace handles resolveWorkspace error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_current_dir') return Promise.resolve('/some/path');
      if (cmd === 'resolve_workspace') return Promise.reject({ type: 'Validation', message: 'bad path' });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await useWorkspaceStore.getState().initWorkspace();

    const state = useWorkspaceStore.getState();
    expect(state.activeWorkspaceId).toBeNull();
    expect(state.activeWorkspaceName).toBeNull();

    consoleSpy.mockRestore();
  });

  // UNIT-2.5-006: loadFilteredNotes calls listNotes with active workspace id
  it('loadFilteredNotes calls listNotes with activeWorkspaceId when workspace active', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'list_notes') return Promise.resolve(MOCK_NOTES);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useWorkspaceStore.setState({ activeWorkspaceId: 7, isAllWorkspaces: false });

    await useWorkspaceStore.getState().loadFilteredNotes();

    expect(mockInvoke).toHaveBeenCalledWith('list_notes', { workspaceId: 7 });
    const state = useWorkspaceStore.getState();
    expect(state.filteredNotes).toEqual(MOCK_NOTES);
    expect(state.isLoadingNotes).toBe(false);
  });

  // UNIT-2.5-007: loadFilteredNotes calls listNotes(null) when isAllWorkspaces
  it('loadFilteredNotes calls listNotes with null when isAllWorkspaces', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'list_notes') return Promise.resolve(MOCK_NOTES);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useWorkspaceStore.setState({ isAllWorkspaces: true, activeWorkspaceId: null });

    await useWorkspaceStore.getState().loadFilteredNotes();

    expect(mockInvoke).toHaveBeenCalledWith('list_notes', { workspaceId: null });
    const state = useWorkspaceStore.getState();
    expect(state.filteredNotes).toEqual(MOCK_NOTES);
    expect(state.isLoadingNotes).toBe(false);
  });

  // UNIT-2.5-008: filteredNotes state updates after workspace switch
  it('setActiveWorkspace triggers loadFilteredNotes', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'list_notes') return Promise.resolve(MOCK_NOTES);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useWorkspaceStore.setState({ workspaces: MOCK_WORKSPACES });

    useWorkspaceStore.getState().setActiveWorkspace(7);

    // Wait for the fire-and-forget loadFilteredNotes to complete
    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('list_notes', { workspaceId: 7 });
      expect(useWorkspaceStore.getState().filteredNotes).toEqual(MOCK_NOTES);
    });
  });

  it('setAllWorkspaces triggers loadFilteredNotes', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'list_notes') return Promise.resolve(MOCK_NOTES);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    useWorkspaceStore.getState().setAllWorkspaces();

    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('list_notes', { workspaceId: null });
      expect(useWorkspaceStore.getState().filteredNotes).toEqual(MOCK_NOTES);
    });
  });

  // Gap: loadFilteredNotes with no workspace active and isAllWorkspaces=false (initial state)
  it('loadFilteredNotes sends null workspaceId when no workspace active and not all-workspaces', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'list_notes') return Promise.resolve([]);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    // Default state: activeWorkspaceId=null, isAllWorkspaces=false
    useWorkspaceStore.setState({ activeWorkspaceId: null, isAllWorkspaces: false });

    await useWorkspaceStore.getState().loadFilteredNotes();

    expect(mockInvoke).toHaveBeenCalledWith('list_notes', { workspaceId: null });
    const state = useWorkspaceStore.getState();
    expect(state.filteredNotes).toEqual([]);
    expect(state.isLoadingNotes).toBe(false);
  });

  // Gap: loadFilteredNotes replaces previous notes on workspace switch
  it('loadFilteredNotes replaces previous filteredNotes with new results', async () => {
    const oldNotes = [{ ...MOCK_NOTES[0], id: 99, title: 'Old Note' }];
    useWorkspaceStore.setState({ filteredNotes: oldNotes, activeWorkspaceId: 8, isAllWorkspaces: false });

    const newNotes = [{ ...MOCK_NOTES[0], id: 50, title: 'New Note', workspaceId: 8 }];
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'list_notes') return Promise.resolve(newNotes);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await useWorkspaceStore.getState().loadFilteredNotes();

    const state = useWorkspaceStore.getState();
    expect(state.filteredNotes).toEqual(newNotes);
    expect(state.filteredNotes).not.toContainEqual(expect.objectContaining({ id: 99 }));
  });

  it('loadFilteredNotes handles error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'list_notes') return Promise.reject({ type: 'Database' });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useWorkspaceStore.setState({ activeWorkspaceId: 7 });

    await useWorkspaceStore.getState().loadFilteredNotes();

    const state = useWorkspaceStore.getState();
    expect(state.filteredNotes).toEqual([]);
    expect(state.isLoadingNotes).toBe(false);
    consoleSpy.mockRestore();
  });
});
