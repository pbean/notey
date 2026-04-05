import { create } from 'zustand';
import { commands } from '../../generated/bindings';

/** Workspace state for tracking the active workspace context. */
interface WorkspaceState {
  activeWorkspaceId: number | null;
  activeWorkspaceName: string | null;
}

/** Actions for managing workspace state. */
interface WorkspaceActions {
  setActiveWorkspace: (id: number, name: string) => void;
  clearActiveWorkspace: () => void;
  initWorkspace: () => Promise<void>;
}

/**
 * Per-feature Zustand store for workspace context.
 * Resolves the workspace from the process cwd at app startup and caches the result.
 * Note creation reads activeWorkspaceId from this store — no re-detection on each save.
 */
export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>((set) => ({
  activeWorkspaceId: null,
  activeWorkspaceName: null,

  setActiveWorkspace: (id, name) => set({ activeWorkspaceId: id, activeWorkspaceName: name }),

  clearActiveWorkspace: () => set({ activeWorkspaceId: null, activeWorkspaceName: null }),

  initWorkspace: async () => {
    const cwdResult = await commands.getCurrentDir();
    if (cwdResult.status === 'error') {
      console.error('getCurrentDir failed:', cwdResult.error);
      return;
    }
    const resolveResult = await commands.resolveWorkspace(cwdResult.data);
    if (resolveResult.status === 'error') {
      console.error('resolveWorkspace failed:', resolveResult.error);
      return;
    }
    const ws = resolveResult.data;
    set({ activeWorkspaceId: ws.id, activeWorkspaceName: ws.name });
  },
}));
