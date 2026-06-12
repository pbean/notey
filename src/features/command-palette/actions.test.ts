import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockInvoke } from '../../test-utils/setup';
import { buildNote, buildConfig } from '../../test-utils/factories';
import { useEditorStore } from '../editor/store';
import { useTabStore } from '../tabs/store';
import * as autoSave from '../editor/hooks/useAutoSave';
import { useToastStore } from '../toast/store';
import { useWorkspaceStore } from '../workspace/store';
import { useSearchStore } from '../search/store';
import {
  createNewNote,
  trashActiveNote,
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

describe('trashActiveNote', () => {
  beforeEach(() => {
    useEditorStore.getState().resetNote();
    useTabStore.getState().reset();
    useToastStore.getState().reset();
    useWorkspaceStore.getState().resetWorkspace();
  });

  it('no-ops when no tab is active', async () => {
    const flushSaveSpy = vi.spyOn(autoSave, 'flushSave');

    await trashActiveNote();

    expect(flushSaveSpy).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalledWith('trash_note', expect.anything());
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('flushes pending saves before trashing and shows a success toast', async () => {
    const flushSaveSpy = vi.spyOn(autoSave, 'flushSave').mockImplementation(async () => {
      useEditorStore.getState().setSaveStatus('saved');
    });
    const trashed = buildNote({ id: 5, isTrashed: true, deletedAt: '2026-06-12T00:00:00+00:00' });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'trash_note') return Promise.resolve(trashed);
      if (cmd === 'list_notes') return Promise.resolve([]);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useTabStore.getState().openTab(5, 'Doomed');

    await trashActiveNote();

    const trashCallOrder = mockInvoke.mock.invocationCallOrder.find(
      (_callOrder, index) => mockInvoke.mock.calls[index]?.[0] === 'trash_note',
    );
    expect(flushSaveSpy).toHaveBeenCalledTimes(1);
    expect(flushSaveSpy.mock.invocationCallOrder[0]).toBeLessThan(trashCallOrder ?? Number.MAX_SAFE_INTEGER);
    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toEqual(['Note moved to trash']);
    expect(useTabStore.getState().tabs).toEqual([]);
  });

  it('aborts the trash when save flushing fails and shows an error toast', async () => {
    vi.spyOn(autoSave, 'flushSave').mockImplementation(async () => {
      useEditorStore.getState().setSaveStatus('failed');
    });
    useTabStore.getState().openTab(5, 'Stays open');

    await trashActiveNote();

    expect(mockInvoke).not.toHaveBeenCalledWith('trash_note', expect.anything());
    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toEqual(["Couldn't move note to trash"]);
    expect(useTabStore.getState().tabs).toHaveLength(1);
  });

  it('drops a concurrent trash request while one is in flight', async () => {
    vi.spyOn(autoSave, 'flushSave').mockResolvedValue(undefined);
    let resolveTrash!: (value: unknown) => void;
    const pendingTrash = new Promise((resolve) => {
      resolveTrash = resolve;
    });
    const trashed = buildNote({ id: 5, isTrashed: true, deletedAt: '2026-06-12T00:00:00+00:00' });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'trash_note') return pendingTrash;
      if (cmd === 'list_notes') return Promise.resolve([]);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useTabStore.getState().openTab(5, 'Doomed');

    const first = trashActiveNote();
    const second = trashActiveNote();
    resolveTrash(trashed);
    await Promise.all([first, second]);

    const trashCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'trash_note');
    expect(trashCalls).toHaveLength(1);
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

  it('treats a legacy "floating" value like comfortable when toggling', async () => {
    const config = buildConfig({ general: { theme: 'dark', layoutMode: 'floating' } });
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

  // Backward-compat: 'floating' was the old backend default before it was
  // aligned to 'comfortable'. Configs persisted by older builds still hold it,
  // and any non-'compact' value must render as non-compact.
  it('treats a legacy "floating" layout value as non-compact', async () => {
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

describe('system theme resolution', () => {
  const originalMatchMedia = window.matchMedia;
  type MockMediaQueryList = {
    addEventListener?: (type: string, cb: (e: MediaQueryListEvent) => void) => void;
    addListener?: (cb: (e: MediaQueryListEvent) => void) => void;
    dispatchChange: (next: boolean) => void;
    matches: boolean;
    media: string;
    onchange: null;
    removeEventListener?: (type: string, cb: (e: MediaQueryListEvent) => void) => void;
    removeListener?: (cb: (e: MediaQueryListEvent) => void) => void;
  };

  /**
   * Install a capturable `prefers-color-scheme: dark` media query mock.
   * `dispatchChange` simulates a live OS appearance change.
   */
  function mockMatchMedia(
    matches: boolean,
    options?: { legacyListenerApi?: boolean; nextMatchOnSubscribe?: boolean },
  ) {
    const listeners = new Set<(e: MediaQueryListEvent) => void>();
    const mql: MockMediaQueryList = {
      matches,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      dispatchChange: (next: boolean) => {
        mql.matches = next;
        listeners.forEach((cb) => cb({ matches: next } as MediaQueryListEvent));
      },
    };
    if (options?.legacyListenerApi) {
      mql.addListener = (cb: (e: MediaQueryListEvent) => void) => {
        if (typeof options.nextMatchOnSubscribe === 'boolean') mql.matches = options.nextMatchOnSubscribe;
        listeners.add(cb);
      };
      mql.removeListener = (cb: (e: MediaQueryListEvent) => void) => {
        listeners.delete(cb);
      };
    } else {
      mql.addEventListener = (_type: string, cb: (e: MediaQueryListEvent) => void) => {
        if (typeof options?.nextMatchOnSubscribe === 'boolean') {
          mql.matches = options.nextMatchOnSubscribe;
        }
        listeners.add(cb);
      };
      mql.removeEventListener = (_type: string, cb: (e: MediaQueryListEvent) => void) => {
        listeners.delete(cb);
      };
    }
    window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
    return mql;
  }

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    document.documentElement.classList.remove('dark', 'light', 'compact');
  });

  function mockSystemConfig() {
    const config = buildConfig({ general: { theme: 'system', layoutMode: 'comfortable' } });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(config);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
  }

  it('resolves system to dark when the OS prefers dark', async () => {
    document.documentElement.classList.add('light');
    mockMatchMedia(true);
    mockSystemConfig();

    await applyStartupConfig();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('resolves system to light when the OS prefers light', async () => {
    document.documentElement.classList.add('dark');
    mockMatchMedia(false);
    mockSystemConfig();

    await applyStartupConfig();

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('tracks a live OS appearance change while system is active', async () => {
    document.documentElement.classList.add('light');
    const mql = mockMatchMedia(true);
    mockSystemConfig();

    await applyStartupConfig();
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    mql.dispatchChange(false); // OS flips dark → light

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('re-applies the current OS theme after binding the startup listener', async () => {
    document.documentElement.classList.add('light');
    mockMatchMedia(true, { nextMatchOnSubscribe: false });
    mockSystemConfig();

    await applyStartupConfig();

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('tracks system changes with legacy addListener-only media queries', async () => {
    document.documentElement.classList.add('light');
    const mql = mockMatchMedia(true, { legacyListenerApi: true });
    mockSystemConfig();

    await applyStartupConfig();
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    mql.dispatchChange(false);

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('ignores OS changes after an explicit toggle opts the session out', async () => {
    document.documentElement.classList.add('light');
    const mql = mockMatchMedia(true);
    const systemConfig = buildConfig({ general: { theme: 'system', layoutMode: 'comfortable' } });
    const toggledConfig = buildConfig({ general: { theme: 'dark', layoutMode: 'comfortable' } });

    let getCallCount = 0;
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') {
        getCallCount += 1;
        // 1st get_config is startup (system); 2nd is the toggle's read.
        return Promise.resolve(getCallCount === 1 ? systemConfig : systemConfig);
      }
      if (cmd === 'update_config') return Promise.resolve(toggledConfig);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await applyStartupConfig(); // system + OS dark → .dark, listener bound
    await toggleTheme(); // system → dark, opts out of system tracking
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    mql.dispatchChange(false); // OS flips to light — must be ignored

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('falls back to light and does not throw when matchMedia is unavailable', async () => {
    document.documentElement.classList.add('dark');
    window.matchMedia = undefined as unknown as typeof window.matchMedia;
    mockSystemConfig();

    await expect(applyStartupConfig()).resolves.toBeUndefined();

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('falls back to light and does not throw when matchMedia throws', async () => {
    document.documentElement.classList.add('dark');
    window.matchMedia = vi.fn(() => {
      throw new Error('matchMedia unavailable');
    }) as unknown as typeof window.matchMedia;
    mockSystemConfig();

    await expect(applyStartupConfig()).resolves.toBeUndefined();

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
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
