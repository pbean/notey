import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockInvoke } from '../../test-utils/setup';
import { useWorkspaceStore } from './store';

const MOCK_WORKSPACES = [
  { id: 7, name: 'project', path: '/home/user/project', createdAt: '2026-01-01T00:00:00+00:00', noteCount: 5 },
  { id: 8, name: 'other', path: '/home/user/other', createdAt: '2026-01-02T00:00:00+00:00', noteCount: 3 },
];

describe('useWorkspaceStore', () => {
  beforeEach(() => {
    // Reset store to defaults between tests
    useWorkspaceStore.setState({
      activeWorkspaceId: null,
      activeWorkspaceName: null,
      workspaces: [],
      isAllWorkspaces: false,
    });
  });

  it('starts with null workspace state and empty workspaces', () => {
    const state = useWorkspaceStore.getState();
    expect(state.activeWorkspaceId).toBeNull();
    expect(state.activeWorkspaceName).toBeNull();
    expect(state.workspaces).toEqual([]);
    expect(state.isAllWorkspaces).toBe(false);
  });

  it('setActiveWorkspace sets id, looks up name from workspaces, and clears isAllWorkspaces', () => {
    useWorkspaceStore.setState({ workspaces: MOCK_WORKSPACES, isAllWorkspaces: true });
    useWorkspaceStore.getState().setActiveWorkspace(7);
    const state = useWorkspaceStore.getState();
    expect(state.activeWorkspaceId).toBe(7);
    expect(state.activeWorkspaceName).toBe('project');
    expect(state.isAllWorkspaces).toBe(false);
  });

  it('setActiveWorkspace sets name to null when id not found in workspaces', () => {
    useWorkspaceStore.setState({ workspaces: MOCK_WORKSPACES });
    useWorkspaceStore.getState().setActiveWorkspace(999);
    const state = useWorkspaceStore.getState();
    expect(state.activeWorkspaceId).toBe(999);
    expect(state.activeWorkspaceName).toBeNull();
  });

  it('setAllWorkspaces sets flag and clears active workspace', () => {
    useWorkspaceStore.setState({ activeWorkspaceId: 7, activeWorkspaceName: 'project' });
    useWorkspaceStore.getState().setAllWorkspaces();
    const state = useWorkspaceStore.getState();
    expect(state.isAllWorkspaces).toBe(true);
    expect(state.activeWorkspaceId).toBeNull();
    expect(state.activeWorkspaceName).toBeNull();
  });

  it('clearActiveWorkspace resets to null and clears isAllWorkspaces', () => {
    useWorkspaceStore.setState({ activeWorkspaceId: 1, activeWorkspaceName: 'ws', isAllWorkspaces: true });
    useWorkspaceStore.getState().clearActiveWorkspace();
    const state = useWorkspaceStore.getState();
    expect(state.activeWorkspaceId).toBeNull();
    expect(state.activeWorkspaceName).toBeNull();
    expect(state.isAllWorkspaces).toBe(false);
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

  it('initWorkspace resolves cwd, loads workspaces, and sets active workspace', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_current_dir') return Promise.resolve('/home/user/project');
      if (cmd === 'resolve_workspace')
        return Promise.resolve({ id: 7, name: 'project', path: '/home/user/project', createdAt: '2026-01-01T00:00:00+00:00' });
      if (cmd === 'list_workspaces') return Promise.resolve(MOCK_WORKSPACES);
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
});
