import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
  applyStartupConfig,
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
  afterEach(() => {
    document.documentElement.classList.remove('dark', 'light');
  });

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
    // `.light` and `.dark` are a mutually-exclusive pair — light must be applied.
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('toggles from light to dark', async () => {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    const config = buildConfig({ general: { theme: 'light', layoutMode: 'comfortable' } });
    const updatedConfig = buildConfig({ general: { theme: 'dark', layoutMode: 'comfortable' } });

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(config);
      if (cmd === 'update_config') return Promise.resolve(updatedConfig);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await toggleTheme();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
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

  it('drops a concurrent call while a toggle is in flight', async () => {
    document.documentElement.classList.add('dark');
    let resolveGetConfig!: (value: unknown) => void;
    const pendingGetConfig = new Promise((resolve) => {
      resolveGetConfig = resolve;
    });
    const config = buildConfig({ general: { theme: 'dark', layoutMode: 'comfortable' } });
    const updatedConfig = buildConfig({ general: { theme: 'light', layoutMode: 'comfortable' } });

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return pendingGetConfig;
      if (cmd === 'update_config') return Promise.resolve(updatedConfig);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    const first = toggleTheme(); // enters, awaits the pending get_config
    await toggleTheme(); // guard set → returns immediately, no IPC

    resolveGetConfig(config);
    await first;

    const getConfigCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'get_config');
    const updateCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'update_config');
    expect(getConfigCalls).toHaveLength(1);
    expect(updateCalls).toHaveLength(1);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('light')).toBe(true);
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
  beforeEach(() => {
    document.documentElement.classList.remove('compact');
  });

  afterEach(() => {
    document.documentElement.classList.remove('compact');
  });

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
    expect(document.documentElement.classList.contains('compact')).toBe(true);
  });

  it('toggles from compact to comfortable', async () => {
    document.documentElement.classList.add('compact');
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
    expect(document.documentElement.classList.contains('compact')).toBe(false);
  });

  it('does not mutate DOM when updateConfig fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const config = buildConfig({ general: { theme: 'dark', layoutMode: 'comfortable' } });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(config);
      if (cmd === 'update_config') return Promise.reject({ type: 'Database', message: 'boom' });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await toggleLayoutMode();

    expect(document.documentElement.classList.contains('compact')).toBe(false);
    consoleSpy.mockRestore();
  });

  it('drops a concurrent call while a toggle is in flight', async () => {
    let resolveGetConfig!: (value: unknown) => void;
    const pendingGetConfig = new Promise((resolve) => {
      resolveGetConfig = resolve;
    });
    const config = buildConfig({ general: { theme: 'dark', layoutMode: 'comfortable' } });
    const updatedConfig = buildConfig({ general: { theme: 'dark', layoutMode: 'compact' } });

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return pendingGetConfig;
      if (cmd === 'update_config') return Promise.resolve(updatedConfig);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    const first = toggleLayoutMode(); // enters, awaits the pending get_config
    await toggleLayoutMode(); // guard set → returns immediately, no IPC

    resolveGetConfig(config);
    await first;

    const getConfigCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'get_config');
    const updateCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'update_config');
    expect(getConfigCalls).toHaveLength(1);
    expect(updateCalls).toHaveLength(1);
    expect(document.documentElement.classList.contains('compact')).toBe(true);
  });
});

describe('applyStartupConfig', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark', 'light', 'compact');
  });

  it('applies dark and compact from persisted config', async () => {
    document.documentElement.classList.remove('dark', 'light', 'compact');
    const config = buildConfig({ general: { theme: 'dark', layoutMode: 'compact' } });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(config);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await applyStartupConfig();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(document.documentElement.classList.contains('compact')).toBe(true);
  });

  it('applies light (and clears dark + compact) for a saved light + comfortable config', async () => {
    document.documentElement.classList.add('dark', 'compact');
    const config = buildConfig({ general: { theme: 'light', layoutMode: 'comfortable' } });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(config);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await applyStartupConfig();

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('compact')).toBe(false);
  });

  it('treats the default floating layout as non-compact', async () => {
    document.documentElement.classList.add('compact');
    const config = buildConfig({ general: { theme: 'dark', layoutMode: 'floating' } });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(config);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await applyStartupConfig();

    expect(document.documentElement.classList.contains('compact')).toBe(false);
  });

  it('leaves the DOM untouched when getConfig fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    document.documentElement.classList.add('dark');
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.reject({ type: 'Database' });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await applyStartupConfig();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('startup-vs-toggle race', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark', 'light', 'compact');
  });

  it('does not revert a theme toggled during the boot window', async () => {
    // Startup kicks off its get_config first (deferred), then a user toggle
    // fires and applies light before startup resolves with the stale dark snapshot.
    document.documentElement.classList.add('dark');
    let resolveStartupGet!: (value: unknown) => void;
    const pendingStartupGet = new Promise((resolve) => {
      resolveStartupGet = resolve;
    });
    const startupConfig = buildConfig({ general: { theme: 'dark', layoutMode: 'comfortable' } });
    const toggleConfig = buildConfig({ general: { theme: 'dark', layoutMode: 'comfortable' } });
    const updatedConfig = buildConfig({ general: { theme: 'light', layoutMode: 'comfortable' } });

    let getCallCount = 0;
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') {
        getCallCount += 1;
        // First get_config belongs to applyStartupConfig (deferred); the
        // toggle's get_config resolves immediately.
        return getCallCount === 1 ? pendingStartupGet : Promise.resolve(toggleConfig);
      }
      if (cmd === 'update_config') return Promise.resolve(updatedConfig);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    const startup = applyStartupConfig(); // awaits the deferred get_config
    await toggleTheme(); // applies light, marks theme as user-toggled

    expect(document.documentElement.classList.contains('light')).toBe(true);

    resolveStartupGet(startupConfig); // stale dark snapshot resolves now
    await startup;

    // Startup must skip the toggled theme dimension — light stands.
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('does not revert a layout toggled during the boot window', async () => {
    document.documentElement.classList.add('light');
    let resolveStartupGet!: (value: unknown) => void;
    const pendingStartupGet = new Promise((resolve) => {
      resolveStartupGet = resolve;
    });
    const startupConfig = buildConfig({ general: { theme: 'dark', layoutMode: 'comfortable' } });
    const toggleConfig = buildConfig({ general: { theme: 'dark', layoutMode: 'comfortable' } });
    const updatedConfig = buildConfig({ general: { theme: 'dark', layoutMode: 'compact' } });

    let getCallCount = 0;
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') {
        getCallCount += 1;
        return getCallCount === 1 ? pendingStartupGet : Promise.resolve(toggleConfig);
      }
      if (cmd === 'update_config') return Promise.resolve(updatedConfig);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    const startup = applyStartupConfig();
    await toggleLayoutMode(); // applies compact, marks layout as user-toggled

    expect(document.documentElement.classList.contains('compact')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(true);

    resolveStartupGet(startupConfig); // stale comfortable snapshot
    await startup;

    expect(document.documentElement.classList.contains('compact')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('still applies persisted layout when only theme was toggled (dimensions independent)', async () => {
    document.documentElement.classList.add('dark');
    let resolveStartupGet!: (value: unknown) => void;
    const pendingStartupGet = new Promise((resolve) => {
      resolveStartupGet = resolve;
    });
    // Startup snapshot has compact layout; user only toggles theme in the window.
    const startupConfig = buildConfig({ general: { theme: 'dark', layoutMode: 'compact' } });
    const toggleConfig = buildConfig({ general: { theme: 'dark', layoutMode: 'compact' } });
    const updatedConfig = buildConfig({ general: { theme: 'light', layoutMode: 'compact' } });

    let getCallCount = 0;
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') {
        getCallCount += 1;
        return getCallCount === 1 ? pendingStartupGet : Promise.resolve(toggleConfig);
      }
      if (cmd === 'update_config') return Promise.resolve(updatedConfig);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    const startup = applyStartupConfig();
    await toggleTheme(); // marks theme only

    resolveStartupGet(startupConfig);
    await startup;

    // Theme stays as toggled (light), but layout was NOT toggled, so startup
    // applies the persisted compact.
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('compact')).toBe(true);
  });

  it('lets startup apply the persisted value when a toggle failed before applying', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      document.documentElement.classList.add('dark');
      const toggleConfig = buildConfig({ general: { theme: 'dark', layoutMode: 'comfortable' } });
      const startupConfig = buildConfig({ general: { theme: 'light', layoutMode: 'comfortable' } });

      // A toggle whose update_config fails must NOT mark the dimension.
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'get_config') return Promise.resolve(toggleConfig);
        if (cmd === 'update_config') return Promise.reject({ type: 'Database', message: 'boom' });
        return Promise.reject(new Error(`unmocked: ${cmd}`));
      });
      await toggleTheme(); // fails at update_config, dimension stays unmarked

      // Now startup runs with the persisted light config and must apply it.
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'get_config') return Promise.resolve(startupConfig);
        return Promise.reject(new Error(`unmocked: ${cmd}`));
      });
      await applyStartupConfig();

      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    } finally {
      consoleSpy.mockRestore();
    }
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
