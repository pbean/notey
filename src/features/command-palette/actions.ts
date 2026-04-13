import { commands } from '../../generated/bindings';
import { useEditorStore } from '../editor/store';
import { useSearchStore } from '../search/store';
import { useTabStore } from '../tabs/store';
import { useWorkspaceStore } from '../workspace/store';
import { flushSave } from '../editor/hooks/useAutoSave';

let isCreatingNote = false;

/**
 * Create a new note, open it in a tab, and load it into the editor.
 * Flushes any pending auto-save first to avoid data loss.
 * Guarded against concurrent calls (e.g. key repeat).
 */
export async function createNewNote(): Promise<void> {
  if (isCreatingNote) return;
  isCreatingNote = true;

  try {
    try {
      await flushSave();
    } catch (err) {
      console.error('flushSave failed before new note:', err);
    }

    const format = useEditorStore.getState().format;
    const workspaceId = useWorkspaceStore.getState().activeWorkspaceId;

    const result = await commands.createNote(format, workspaceId);
    if (result.status === 'error') {
      console.error('createNote failed:', result.error);
      return;
    }

    const note = result.data;
    useTabStore.getState().openTab(note.id, 'New note');

    await useEditorStore.getState().loadNote(note.id);
    // loadNote sets saveStatus to 'failed' on error — close the orphaned tab
    if (useEditorStore.getState().saveStatus === 'failed') {
      const { tabs } = useTabStore.getState();
      const tabIndex = tabs.findIndex((t) => t.noteId === note.id);
      if (tabIndex !== -1) {
        useTabStore.getState().closeTab(tabIndex);
      }
    }
  } finally {
    isCreatingNote = false;
  }
}

/**
 * Toggle theme between dark and light. Reads current config,
 * persists the change via updateConfig, and toggles the DOM class.
 */
export async function toggleTheme(): Promise<void> {
  const configResult = await commands.getConfig();
  if (configResult.status === 'error') {
    console.error('getConfig failed:', configResult.error);
    return;
  }

  const current = configResult.data.general?.theme ?? 'dark';
  const next = current === 'dark' ? 'light' : 'dark';

  const updateResult = await commands.updateConfig({
    general: { theme: next, layoutMode: null },
    editor: null,
    hotkey: null,
  });
  if (updateResult.status === 'error') {
    console.error('updateConfig failed:', updateResult.error);
    return;
  }

  document.documentElement.classList.toggle('dark', next === 'dark');
}

/** Toggle editor format between markdown and plaintext. */
export function toggleFormat(): void {
  const { format, setFormat } = useEditorStore.getState();
  setFormat(format === 'markdown' ? 'plaintext' : 'markdown');
}

/**
 * Toggle layout mode between compact and comfortable.
 * Reads current config and persists via updateConfig.
 */
export async function toggleLayoutMode(): Promise<void> {
  const configResult = await commands.getConfig();
  if (configResult.status === 'error') {
    console.error('getConfig failed:', configResult.error);
    return;
  }

  const current = configResult.data.general?.layoutMode ?? 'comfortable';
  const next = current === 'comfortable' ? 'compact' : 'comfortable';

  const updateResult = await commands.updateConfig({
    general: { theme: null, layoutMode: next },
    editor: null,
    hotkey: null,
  });
  if (updateResult.status === 'error') {
    console.error('updateConfig failed:', updateResult.error);
    return;
  }

  document.documentElement.classList.toggle('compact', next === 'compact');
}

/** Open the search overlay. */
export function openSearch(): void {
  useSearchStore.getState().openSearch();
}

/** Log a warning for commands whose target feature is not yet built. */
export function stubAction(label: string): void {
  console.warn(`Not yet implemented: ${label}`);
}
