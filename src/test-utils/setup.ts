import { vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { useEditorStore } from '../features/editor/store';
import { useWorkspaceStore } from '../features/workspace/store';
import { useSearchStore } from '../features/search/store';
import { useTabStore } from '../features/tabs/store';
import { useCommandPaletteStore } from '../features/command-palette/store';
import { useNoteListStore } from '../features/note-list/store';
import { useToastStore } from '../features/toast/store';
import { useTrashStore } from '../features/trash/store';
import { resetActionGuards, resetToggleTracking } from '../features/command-palette/actions';

/**
 * Per-test mock handler for Tauri IPC invoke calls.
 * Override in individual tests via `mockInvoke.mockImplementation(...)`.
 */
export const mockInvoke = vi.fn().mockRejectedValue(new Error('unmocked invoke call'));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

/** Reset the invoke mock between tests to prevent bleed. */
beforeEach(() => {
  mockInvoke.mockReset();
  mockInvoke.mockRejectedValue(new Error('unmocked invoke call'));
});

/**
 * Global cleanup after every test: reset all Zustand stores and remove leaked DOM nodes.
 * When adding a new store, add its reset call here.
 */
afterEach(() => {
  // Reset all Zustand stores to initial values
  useEditorStore.getState().resetNote();
  useWorkspaceStore.getState().resetWorkspace();
  useSearchStore.getState().resetSearch();
  useTabStore.getState().reset();
  useCommandPaletteStore.getState().resetCommandPalette();
  useNoteListStore.getState().resetNoteList();
  useToastStore.getState().reset();
  useTrashStore.getState().resetTrash();

  // Clear the sticky per-session theme/layout toggle markers (module-level, not a store)
  resetActionGuards();
  resetToggleTracking();

  // Remove CodeMirror DOM nodes that leak between tests
  document.querySelectorAll('.cm-editor, .cm-content').forEach((el) => el.remove());
});
