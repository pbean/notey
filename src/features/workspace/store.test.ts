import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockInvoke } from '../../test-utils/setup';
import { useWorkspaceStore } from './store';

describe('useWorkspaceStore', () => {
  beforeEach(() => {
    // Reset store to defaults between tests
    useWorkspaceStore.setState({
      activeWorkspaceId: null,
      activeWorkspaceName: null,
    });
  });

  it('starts with null workspace state', () => {
    const state = useWorkspaceStore.getState();
    expect(state.activeWorkspaceId).toBeNull();
    expect(state.activeWorkspaceName).toBeNull();
  });

  it('setActiveWorkspace sets id and name', () => {
    useWorkspaceStore.getState().setActiveWorkspace(42, 'my-project');
    const state = useWorkspaceStore.getState();
    expect(state.activeWorkspaceId).toBe(42);
    expect(state.activeWorkspaceName).toBe('my-project');
  });

  it('clearActiveWorkspace resets to null', () => {
    useWorkspaceStore.getState().setActiveWorkspace(1, 'ws');
    useWorkspaceStore.getState().clearActiveWorkspace();
    const state = useWorkspaceStore.getState();
    expect(state.activeWorkspaceId).toBeNull();
    expect(state.activeWorkspaceName).toBeNull();
  });

  it('initWorkspace resolves cwd and sets workspace', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_current_dir') return Promise.resolve('/home/user/project');
      if (cmd === 'resolve_workspace')
        return Promise.resolve({ id: 7, name: 'project', path: '/home/user/project', createdAt: '2026-01-01T00:00:00+00:00' });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await useWorkspaceStore.getState().initWorkspace();

    const state = useWorkspaceStore.getState();
    expect(state.activeWorkspaceId).toBe(7);
    expect(state.activeWorkspaceName).toBe('project');
    expect(mockInvoke).toHaveBeenCalledWith('get_current_dir');
    expect(mockInvoke).toHaveBeenCalledWith('resolve_workspace', { path: '/home/user/project' });
  });

  it('initWorkspace handles getCurrentDir error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Simulate typed error response for getCurrentDir failure
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
