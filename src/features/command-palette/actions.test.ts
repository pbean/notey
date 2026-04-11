import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockInvoke } from '../../test-utils/setup';
import { buildNote, buildConfig } from '../../test-utils/factories';
import { useEditorStore } from '../editor/store';
import { useTabStore } from '../tabs/store';
import { useWorkspaceStore } from '../workspace/store';
import { useSearchStore } from '../search/store';
import {
  createNewNote,
  toggleTheme,
  toggleFormat,
  toggleLayoutMode,
  openSearch,
  stubAction,
} from './actions';

describe('createNewNote', () => {
  beforeEach(() => {
    useEditorStore.getState().resetNote();
    useTabStore.getState().reset();
    useWorkspaceStore.getState().resetWorkspace();
  });

  it('creates a note and opens it in a tab', async () => {
    const note = buildNote({ id: 42, title: '' });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'create_note') return Promise.resolve(note);
      if (cmd === 'get_note') return Promise.resolve(note);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await createNewNote();

    const tabs = useTabStore.getState().tabs;
    expect(tabs).toHaveLength(1);
    expect(tabs[0].noteId).toBe(42);
    expect(tabs[0].title).toBe('New note');
    expect(useEditorStore.getState().activeNoteId).toBe(42);
  });

  it('does not open tab when createNote fails', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'create_note') return Promise.reject({ type: 'Database' });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await createNewNote();

    expect(useTabStore.getState().tabs).toHaveLength(0);
  });
});

describe('toggleTheme', () => {
  it('toggles from dark to light', async () => {
    document.documentElement.classList.add('dark');
    const config = buildConfig({ general: { theme: 'dark', layoutMode: 'comfortable' } });
    const updatedConfig = buildConfig({ general: { theme: 'light', layoutMode: 'comfortable' } });

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(config);
      if (cmd === 'update_config') return Promise.resolve(updatedConfig);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await toggleTheme();

    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('toggles from light to dark', async () => {
    document.documentElement.classList.remove('dark');
    const config = buildConfig({ general: { theme: 'light', layoutMode: 'comfortable' } });
    const updatedConfig = buildConfig({ general: { theme: 'dark', layoutMode: 'comfortable' } });

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(config);
      if (cmd === 'update_config') return Promise.resolve(updatedConfig);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await toggleTheme();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('does not change DOM when getConfig fails', async () => {
    document.documentElement.classList.add('dark');
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.reject({ type: 'Database' });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await toggleTheme();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});

describe('toggleFormat', () => {
  beforeEach(() => {
    useEditorStore.getState().resetNote();
  });

  it('toggles from markdown to plaintext', () => {
    useEditorStore.getState().setFormat('markdown');
    toggleFormat();
    expect(useEditorStore.getState().format).toBe('plaintext');
  });

  it('toggles from plaintext to markdown', () => {
    useEditorStore.getState().setFormat('plaintext');
    toggleFormat();
    expect(useEditorStore.getState().format).toBe('markdown');
  });
});

describe('toggleLayoutMode', () => {
  it('toggles from comfortable to compact', async () => {
    const config = buildConfig({ general: { theme: 'dark', layoutMode: 'comfortable' } });
    const updatedConfig = buildConfig({ general: { theme: 'dark', layoutMode: 'compact' } });

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(config);
      if (cmd === 'update_config') return Promise.resolve(updatedConfig);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await toggleLayoutMode();

    expect(mockInvoke).toHaveBeenCalledWith('update_config', {
      partial: { general: { theme: null, layoutMode: 'compact' }, editor: null, hotkey: null },
    });
  });

  it('toggles from compact to comfortable', async () => {
    const config = buildConfig({ general: { theme: 'dark', layoutMode: 'compact' } });
    const updatedConfig = buildConfig({ general: { theme: 'dark', layoutMode: 'comfortable' } });

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(config);
      if (cmd === 'update_config') return Promise.resolve(updatedConfig);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await toggleLayoutMode();

    expect(mockInvoke).toHaveBeenCalledWith('update_config', {
      partial: { general: { theme: null, layoutMode: 'comfortable' }, editor: null, hotkey: null },
    });
  });
});

describe('openSearch', () => {
  beforeEach(() => {
    useSearchStore.getState().resetSearch();
  });

  it('opens the search overlay', () => {
    openSearch();
    expect(useSearchStore.getState().isOpen).toBe(true);
  });
});

describe('stubAction', () => {
  it('logs a console.warn with the command label', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubAction('View Trash');
    expect(warnSpy).toHaveBeenCalledWith('Not yet implemented: View Trash');
    warnSpy.mockRestore();
  });
});
