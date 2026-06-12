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

let isTogglingTheme = false;
let isTogglingLayoutMode = false;

/**
 * Apply the theme classes to `<html>`. Single source of truth for the theme
 * class rule, shared by startup application and the toggle.
 *
 * `.dark` and `.light` are toggled as a mutually-exclusive pair: shadcn tokens
 * are light-first in `:root` (overridden by `.dark`), while Notey's custom
 * tokens are dark-first in `:root` (overridden by `.light`). Applying only one
 * class leaves the other token system on its `:root` default, producing a mixed
 * palette — so dark needs `.dark` + no `.light`, and any non-dark value (light,
 * system) needs `.light` + no `.dark`.
 */
function applyThemeClass(theme: string): void {
  const isDark = theme === 'dark';
  const root = document.documentElement;
  root.classList.toggle('dark', isDark);
  root.classList.toggle('light', !isDark);
}

/**
 * Apply the compact layout class to `<html>`. Single source of truth for the
 * layout class rule, shared by startup application and the toggle.
 * Compact is applied iff `layoutMode === 'compact'`; any other value
 * (comfortable, floating) clears it.
 */
function applyLayoutModeClass(layoutMode: string): void {
  document.documentElement.classList.toggle('compact', layoutMode === 'compact');
}

/**
 * Read the persisted config once at startup and apply the saved theme and
 * layout mode to the DOM. Called from `main.tsx` after the synchronous dark
 * default, so the persisted preferences are honored across restarts.
 * On config-read failure, the synchronous defaults are left in place.
 */
export async function applyStartupConfig(): Promise<void> {
  const configResult = await commands.getConfig();
  if (configResult.status === 'error') {
    console.error('getConfig failed at startup:', configResult.error);
    return;
  }

  const general = configResult.data.general;
  applyThemeClass(general?.theme ?? 'dark');
  applyLayoutModeClass(general?.layoutMode ?? 'comfortable');
}

/**
 * Toggle theme between dark and light. Reads current config,
 * persists the change via updateConfig, and toggles the DOM class.
 * Guarded against concurrent calls (e.g. key repeat) to avoid a
 * lost-update race on the read-modify-write.
 */
export async function toggleTheme(): Promise<void> {
  if (isTogglingTheme) return;
  isTogglingTheme = true;

  try {
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

    applyThemeClass(next);
  } finally {
    isTogglingTheme = false;
  }
}

/** Toggle editor format between markdown and plaintext. */
export function toggleFormat(): void {
  const { format, setFormat } = useEditorStore.getState();
  setFormat(format === 'markdown' ? 'plaintext' : 'markdown');
}

/**
 * Toggle layout mode between compact and comfortable.
 * Reads current config and persists via updateConfig.
 * Guarded against concurrent calls (e.g. key repeat) to avoid a
 * lost-update race on the read-modify-write.
 */
export async function toggleLayoutMode(): Promise<void> {
  if (isTogglingLayoutMode) return;
  isTogglingLayoutMode = true;

  try {
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

    applyLayoutModeClass(next);
  } finally {
    isTogglingLayoutMode = false;
  }
}

/** Open the search overlay. */
export function openSearch(): void {
  useSearchStore.getState().openSearch();
}

/** Log a warning for commands whose target feature is not yet built. */
export function stubAction(label: string): void {
  console.warn(`Not yet implemented: ${label}`);
}
