import { create } from 'zustand';
import { commands } from '../../generated/bindings';
import type { WorkspaceInfo, Note } from '../../generated/bindings';

/** Workspace state for tracking the active workspace context. */
interface WorkspaceState {
  activeWorkspaceId: number | null;
  activeWorkspaceName: string | null;
  workspaces: WorkspaceInfo[];
  isAllWorkspaces: boolean;
  filteredNotes: Note[];
  isLoadingNotes: boolean;
}

/** Actions for managing workspace state. */
interface WorkspaceActions {
  setActiveWorkspace: (id: number) => void;
  setAllWorkspaces: () => void;
  clearActiveWorkspace: () => void;
  loadWorkspaces: () => Promise<void>;
  loadFilteredNotes: () => Promise<void>;
  reassignNoteWorkspace: (noteId: number, workspaceId: number | null) => Promise<Note | null>;
  initWorkspace: () => Promise<void>;
}

/**
 * Per-feature Zustand store for workspace context.
 * Resolves the workspace from the process cwd at app startup and caches the result.
 * Note creation reads activeWorkspaceId from this store — no re-detection on each save.
 */
export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>((set, get) => ({
  activeWorkspaceId: null,
  activeWorkspaceName: null,
  workspaces: [],
  isAllWorkspaces: false,
  filteredNotes: [],
  isLoadingNotes: false,

  setActiveWorkspace: (id) => {
    const found = get().workspaces.find((w) => w.id === id);
    set({
      activeWorkspaceId: id,
      activeWorkspaceName: found?.name ?? null,
      isAllWorkspaces: false,
    });
    get().loadFilteredNotes();
  },

  setAllWorkspaces: () => {
    set({ isAllWorkspaces: true, activeWorkspaceId: null, activeWorkspaceName: null });
    get().loadFilteredNotes();
  },

  clearActiveWorkspace: () =>
    set({ activeWorkspaceId: null, activeWorkspaceName: null, isAllWorkspaces: false, filteredNotes: [] }),

  reassignNoteWorkspace: async (noteId, workspaceId) => {
    const result = await commands.reassignNoteWorkspace(noteId, workspaceId);
    if (result.status === 'ok') {
      get().loadFilteredNotes();
      get().loadWorkspaces();
      return result.data;
    } else {
      console.error('reassignNoteWorkspace failed:', result.error);
      return null;
    }
  },

  loadFilteredNotes: async () => {
    set({ isLoadingNotes: true });
    const { activeWorkspaceId, isAllWorkspaces } = get();
    const workspaceId = isAllWorkspaces ? null : activeWorkspaceId;
    const result = await commands.listNotes(workspaceId);
    if (result.status === 'ok') {
      set({ filteredNotes: result.data, isLoadingNotes: false });
    } else {
      console.error('listNotes failed:', result.error);
      set({ filteredNotes: [], isLoadingNotes: false });
    }
  },

  loadWorkspaces: async () => {
    const result = await commands.listWorkspaces();
    if (result.status === 'ok') {
      set({ workspaces: result.data });
    } else {
      console.error('listWorkspaces failed:', result.error);
    }
  },

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
    // Load all workspaces first so setActiveWorkspace can look up the name
    const listResult = await commands.listWorkspaces();
    if (listResult.status === 'ok') {
      set({ workspaces: listResult.data });
    } else {
      console.error('listWorkspaces failed:', listResult.error);
    }
    // Set active ��� lookup name from workspaces array
    const found = get().workspaces.find((w) => w.id === ws.id);
    set({
      activeWorkspaceId: ws.id,
      activeWorkspaceName: found?.name ?? ws.name,
    });
    get().loadFilteredNotes();
  },
}));
