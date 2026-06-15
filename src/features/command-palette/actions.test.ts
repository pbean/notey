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
  applyBootTheme,
  setTheme,
  setLayoutMode,
  setFontSize,
  setFontFamily,
  clampFontSize,
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
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    document.documentElement.classList.remove('dark', 'light');
  });

  function mockMatchMedia(matches: boolean) {
    const mql = {
      matches,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
  }

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

  it('toggles from system to light when the OS currently resolves dark', async () => {
    document.documentElement.classList.add('dark');
    mockMatchMedia(true);
    const config = buildConfig({ general: { theme: 'system', layoutMode: 'comfortable' } });
    const updatedConfig = buildConfig({ general: { theme: 'light', layoutMode: 'comfortable' } });

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(config);
      if (cmd === 'update_config') return Promise.resolve(updatedConfig);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await toggleTheme();

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('light')).toBe(true);
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

  it('coalesces a concurrent call onto the in-flight toggle', async () => {
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
    const second = toggleTheme(); // coalesces onto the in-flight call — no extra IPC

    resolveGetConfig(config);
    await Promise.all([first, second]);

    // Both callers shared one run: a single read-modify-write, one toggle applied.
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
  /** Mock get_config (current mode), update_config (echo), and apply_layout_mode (ok). */
  function mockCycle(current: string) {
    const config = buildConfig({ general: { theme: 'dark', layoutMode: current } });
    mockInvoke.mockImplementation((cmd: string, args?: { partial?: { general?: { layoutMode?: string } } }) => {
      if (cmd === 'get_config') return Promise.resolve(config);
      if (cmd === 'update_config') {
        const next = args?.partial?.general?.layoutMode ?? current;
        return Promise.resolve(buildConfig({ general: { theme: 'dark', layoutMode: next } }));
      }
      if (cmd === 'apply_layout_mode') return Promise.resolve(null);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
  }

  it('cycles floating to half-screen', async () => {
    mockCycle('floating');

    await toggleLayoutMode();

    expect(mockInvoke).toHaveBeenCalledWith('update_config', {
      partial: { general: { theme: null, layoutMode: 'half-screen' }, editor: null, hotkey: null, shortcuts: null },
    });
    expect(mockInvoke).toHaveBeenCalledWith('apply_layout_mode', { mode: 'half-screen' });
  });

  it('cycles half-screen to full-screen', async () => {
    mockCycle('half-screen');

    await toggleLayoutMode();

    expect(mockInvoke).toHaveBeenCalledWith('update_config', {
      partial: { general: { theme: null, layoutMode: 'full-screen' }, editor: null, hotkey: null, shortcuts: null },
    });
    expect(mockInvoke).toHaveBeenCalledWith('apply_layout_mode', { mode: 'full-screen' });
  });

  it('cycles full-screen back to floating', async () => {
    mockCycle('full-screen');

    await toggleLayoutMode();

    expect(mockInvoke).toHaveBeenCalledWith('update_config', {
      partial: { general: { theme: null, layoutMode: 'floating' }, editor: null, hotkey: null, shortcuts: null },
    });
    expect(mockInvoke).toHaveBeenCalledWith('apply_layout_mode', { mode: 'floating' });
  });

  it('treats a legacy density value as floating when cycling', async () => {
    mockCycle('comfortable');

    await toggleLayoutMode();

    // normalize('comfortable') === 'floating', so the next step is 'half-screen'.
    expect(mockInvoke).toHaveBeenCalledWith('apply_layout_mode', { mode: 'half-screen' });
  });

  it('does not apply the window mode when updateConfig fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const config = buildConfig({ general: { theme: 'dark', layoutMode: 'floating' } });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(config);
      if (cmd === 'update_config') return Promise.reject({ type: 'Database', message: 'boom' });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await toggleLayoutMode();

    const applyCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'apply_layout_mode');
    expect(applyCalls).toHaveLength(0);
    consoleSpy.mockRestore();
  });

  it('coalesces a concurrent call onto the in-flight toggle', async () => {
    let resolveGetConfig!: (value: unknown) => void;
    const pendingGetConfig = new Promise((resolve) => {
      resolveGetConfig = resolve;
    });
    const config = buildConfig({ general: { theme: 'dark', layoutMode: 'floating' } });

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return pendingGetConfig;
      if (cmd === 'update_config') return Promise.resolve(config);
      if (cmd === 'apply_layout_mode') return Promise.resolve(null);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    const first = toggleLayoutMode(); // enters, awaits the pending get_config
    const second = toggleLayoutMode(); // coalesces onto the in-flight call — no extra IPC

    resolveGetConfig(config);
    await Promise.all([first, second]);

    // Both callers shared one run: a single read-modify-write.
    const getConfigCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'get_config');
    const updateCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'update_config');
    expect(getConfigCalls).toHaveLength(1);
    expect(updateCalls).toHaveLength(1);
  });
});

describe('applyStartupConfig', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark', 'light');
  });

  it('applies the dark theme and persisted window mode', async () => {
    document.documentElement.classList.remove('dark', 'light');
    const config = buildConfig({ general: { theme: 'dark', layoutMode: 'half-screen' } });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(config);
      if (cmd === 'apply_layout_mode') return Promise.resolve(null);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await applyStartupConfig();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(mockInvoke).toHaveBeenCalledWith('apply_layout_mode', { mode: 'half-screen' });
  });

  it('applies light theme and a legacy density value as the floating window mode', async () => {
    document.documentElement.classList.add('dark');
    const config = buildConfig({ general: { theme: 'light', layoutMode: 'comfortable' } });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(config);
      if (cmd === 'apply_layout_mode') return Promise.resolve(null);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await applyStartupConfig();

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('light')).toBe(true);
    // Legacy 'comfortable' normalizes to the 'floating' window mode.
    expect(mockInvoke).toHaveBeenCalledWith('apply_layout_mode', { mode: 'floating' });
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
      if (cmd === 'apply_layout_mode') return Promise.resolve(null);
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
    const startupConfig = buildConfig({ general: { theme: 'dark', layoutMode: 'full-screen' } });
    const toggleConfig = buildConfig({ general: { theme: 'dark', layoutMode: 'floating' } });
    const updatedConfig = buildConfig({ general: { theme: 'dark', layoutMode: 'half-screen' } });

    let getCallCount = 0;
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') {
        getCallCount += 1;
        return getCallCount === 1 ? pendingStartupGet : Promise.resolve(toggleConfig);
      }
      if (cmd === 'update_config') return Promise.resolve(updatedConfig);
      if (cmd === 'apply_layout_mode') return Promise.resolve(null);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    const startup = applyStartupConfig();
    await toggleLayoutMode(); // cycles floating → half-screen, marks layout user-toggled

    resolveStartupGet(startupConfig); // stale full-screen snapshot resolves now
    await startup;

    // Startup must skip the toggled layout dimension: only the toggle's
    // half-screen was applied, never the stale full-screen snapshot.
    const applyCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'apply_layout_mode');
    expect(applyCalls).toHaveLength(1);
    expect(mockInvoke).toHaveBeenCalledWith('apply_layout_mode', { mode: 'half-screen' });
    expect(mockInvoke).not.toHaveBeenCalledWith('apply_layout_mode', { mode: 'full-screen' });
  });

  it('still applies persisted layout when only theme was toggled (dimensions independent)', async () => {
    document.documentElement.classList.add('dark');
    let resolveStartupGet!: (value: unknown) => void;
    const pendingStartupGet = new Promise((resolve) => {
      resolveStartupGet = resolve;
    });
    // Startup snapshot has a legacy density layout; user only toggles theme.
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
      if (cmd === 'apply_layout_mode') return Promise.resolve(null);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    const startup = applyStartupConfig();
    await toggleTheme(); // marks theme only

    resolveStartupGet(startupConfig);
    await startup;

    // Theme stays as toggled (light), but layout was NOT toggled, so startup
    // applies the persisted layout, normalized from 'compact' to 'floating'.
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith('apply_layout_mode', { mode: 'floating' });
  });

  it('does not revert a font size changed during the boot window', async () => {
    let resolveStartupGet!: (value: unknown) => void;
    const pendingStartupGet = new Promise((resolve) => {
      resolveStartupGet = resolve;
    });
    const startupConfig = buildConfig({ editor: { fontSize: 14, fontFamily: 'mono' } });
    const updatedConfig = buildConfig({ editor: { fontSize: 20, fontFamily: 'mono' } });

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return pendingStartupGet;
      if (cmd === 'update_config') return Promise.resolve(updatedConfig);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    const startup = applyStartupConfig();
    await setFontSize(20);

    expect(document.documentElement.style.getPropertyValue('--editor-font-size')).toBe('20px');

    resolveStartupGet(startupConfig);
    await startup;

    expect(document.documentElement.style.getPropertyValue('--editor-font-size')).toBe('20px');
  });

  it('does not revert a font family changed during the boot window', async () => {
    let resolveStartupGet!: (value: unknown) => void;
    const pendingStartupGet = new Promise((resolve) => {
      resolveStartupGet = resolve;
    });
    const startupConfig = buildConfig({ editor: { fontSize: 14, fontFamily: 'mono' } });
    const updatedConfig = buildConfig({ editor: { fontSize: 14, fontFamily: 'sans' } });

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return pendingStartupGet;
      if (cmd === 'update_config') return Promise.resolve(updatedConfig);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    const startup = applyStartupConfig();
    await setFontFamily('sans');

    expect(document.documentElement.style.getPropertyValue('--font-primary')).toBe('var(--font-sans)');

    resolveStartupGet(startupConfig);
    await startup;

    expect(document.documentElement.style.getPropertyValue('--font-primary')).toBe('var(--font-sans)');
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
    const toggledConfig = buildConfig({ general: { theme: 'light', layoutMode: 'comfortable' } });

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
    await toggleTheme(); // system(dark) → light, opts out of system tracking
    expect(document.documentElement.classList.contains('light')).toBe(true);

    mql.dispatchChange(false); // OS flips to light — must be ignored

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
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

describe('settings setters', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark', 'light', 'compact');
    document.documentElement.style.removeProperty('--editor-font-size');
    document.documentElement.style.removeProperty('--font-primary');
  });

  function mockUpdateOk() {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'update_config') return Promise.resolve(buildConfig());
      if (cmd === 'apply_layout_mode') return Promise.resolve(null);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
  }

  describe('setTheme', () => {
    it('applies the theme live and persists only the theme field', async () => {
      document.documentElement.classList.add('dark');
      mockUpdateOk();

      await setTheme('light');

      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(mockInvoke).toHaveBeenCalledWith('update_config', {
        partial: { general: { theme: 'light', layoutMode: null }, editor: null, hotkey: null, shortcuts: null },
      });
    });

    it('keeps the applied theme even when persistence fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      document.documentElement.classList.add('dark');
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'update_config') return Promise.reject({ type: 'Database', message: 'boom' });
        return Promise.reject(new Error(`unmocked: ${cmd}`));
      });

      await setTheme('light');

      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('setLayoutMode', () => {
    it('persists the chosen window mode before applying it to the window', async () => {
      mockUpdateOk();

      await setLayoutMode('half-screen');

      const updateOrder = mockInvoke.mock.invocationCallOrder.find(
        (_callOrder, index) => mockInvoke.mock.calls[index]?.[0] === 'update_config',
      );
      const applyOrder = mockInvoke.mock.invocationCallOrder.find(
        (_callOrder, index) => mockInvoke.mock.calls[index]?.[0] === 'apply_layout_mode',
      );

      expect(mockInvoke).toHaveBeenCalledWith('apply_layout_mode', { mode: 'half-screen' });
      expect(mockInvoke).toHaveBeenCalledWith('update_config', {
        partial: { general: { theme: null, layoutMode: 'half-screen' }, editor: null, hotkey: null, shortcuts: null },
      });
      expect(updateOrder).toBeLessThan(applyOrder ?? Number.MAX_SAFE_INTEGER);
    });

    it('normalizes a legacy density value to floating before persisting', async () => {
      mockUpdateOk();

      await setLayoutMode('comfortable');

      expect(mockInvoke).toHaveBeenCalledWith('apply_layout_mode', { mode: 'floating' });
      expect(mockInvoke).toHaveBeenCalledWith('update_config', {
        partial: { general: { theme: null, layoutMode: 'floating' }, editor: null, hotkey: null, shortcuts: null },
      });
    });

    it('does not apply the window mode when persistence fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'update_config') return Promise.reject({ type: 'Database', message: 'boom' });
        if (cmd === 'apply_layout_mode') return Promise.resolve(null);
        return Promise.reject(new Error(`unmocked: ${cmd}`));
      });

      await setLayoutMode('half-screen');

      const applyCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'apply_layout_mode');
      expect(applyCalls).toHaveLength(0);
      consoleSpy.mockRestore();
    });

    it('serializes rapid layout selections in issue order', async () => {
      let resolveFirstUpdate!: (value: unknown) => void;
      const pendingFirstUpdate = new Promise((resolve) => {
        resolveFirstUpdate = resolve;
      });
      let updateCount = 0;

      mockInvoke.mockImplementation((cmd: string, args?: { partial?: { general?: { layoutMode?: string } } }) => {
        if (cmd === 'update_config') {
          updateCount += 1;
          if (updateCount === 1) return pendingFirstUpdate;
          const next = args?.partial?.general?.layoutMode ?? 'floating';
          return Promise.resolve(buildConfig({ general: { theme: 'dark', layoutMode: next } }));
        }
        if (cmd === 'apply_layout_mode') return Promise.resolve(null);
        return Promise.reject(new Error(`unmocked: ${cmd}`));
      });

      const first = setLayoutMode('half-screen');
      const second = setLayoutMode('full-screen');
      await Promise.resolve();
      await Promise.resolve();

      const updateCallsBeforeResolve = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'update_config');
      const applyCallsBeforeResolve = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'apply_layout_mode');
      expect(updateCallsBeforeResolve).toHaveLength(1);
      expect(applyCallsBeforeResolve).toHaveLength(0);

      resolveFirstUpdate(buildConfig({ general: { theme: 'dark', layoutMode: 'half-screen' } }));
      await Promise.all([first, second]);

      const updateModes = mockInvoke.mock.calls
        .filter(([cmd]) => cmd === 'update_config')
        .map(([, args]) => (args as { partial: { general?: { layoutMode?: string } } }).partial.general?.layoutMode);
      const applyModes = mockInvoke.mock.calls
        .filter(([cmd]) => cmd === 'apply_layout_mode')
        .map(([, args]) => (args as { mode: string }).mode);

      expect(updateModes).toEqual(['half-screen', 'full-screen']);
      expect(applyModes).toEqual(['half-screen', 'full-screen']);
    });
  });

  describe('setFontSize', () => {
    it('clamps above the max, applies the size var, and persists', async () => {
      mockUpdateOk();

      await setFontSize(40);

      expect(document.documentElement.style.getPropertyValue('--editor-font-size')).toBe('24px');
      expect(mockInvoke).toHaveBeenCalledWith('update_config', {
        partial: { general: null, editor: { fontSize: 24, fontFamily: null }, hotkey: null, shortcuts: null },
      });
    });

    it('clamps below the min', async () => {
      mockUpdateOk();

      await setFontSize(2);

      expect(document.documentElement.style.getPropertyValue('--editor-font-size')).toBe('12px');
      expect(mockInvoke).toHaveBeenCalledWith('update_config', {
        partial: { general: null, editor: { fontSize: 12, fontFamily: null }, hotkey: null, shortcuts: null },
      });
    });

    it('serializes rapid saves so later font sizes persist last', async () => {
      const updateCalls: unknown[] = [];
      let resolveFirst!: (value: unknown) => void;
      let resolveSecond!: (value: unknown) => void;

      mockInvoke.mockImplementation((cmd: string, payload?: unknown) => {
        if (cmd === 'update_config') {
          updateCalls.push(payload);
          if (updateCalls.length === 1) {
            return new Promise((resolve) => {
              resolveFirst = resolve;
            });
          }
          return new Promise((resolve) => {
            resolveSecond = resolve;
          });
        }
        return Promise.reject(new Error(`unmocked: ${cmd}`));
      });

      const first = setFontSize(18);
      const second = setFontSize(20);
      await Promise.resolve();

      expect(updateCalls).toHaveLength(1);

      resolveFirst(buildConfig({ editor: { fontSize: 18, fontFamily: 'mono' } }));
      await first;
      await Promise.resolve();

      expect(updateCalls).toHaveLength(2);

      resolveSecond(buildConfig({ editor: { fontSize: 20, fontFamily: 'mono' } }));
      await second;

      expect(updateCalls).toEqual([
        { partial: { general: null, editor: { fontSize: 18, fontFamily: null }, hotkey: null, shortcuts: null } },
        { partial: { general: null, editor: { fontSize: 20, fontFamily: null }, hotkey: null, shortcuts: null } },
      ]);
    });
  });

  describe('setFontFamily', () => {
    it('swaps the primary font var to sans and persists', async () => {
      mockUpdateOk();

      await setFontFamily('sans');

      expect(document.documentElement.style.getPropertyValue('--font-primary')).toBe('var(--font-sans)');
      expect(mockInvoke).toHaveBeenCalledWith('update_config', {
        partial: { general: null, editor: { fontSize: null, fontFamily: 'sans' }, hotkey: null, shortcuts: null },
      });
    });

    it('falls back to mono for any non-sans value', async () => {
      mockUpdateOk();

      await setFontFamily('mono');

      expect(document.documentElement.style.getPropertyValue('--font-primary')).toBe('var(--font-mono)');
    });

    it('logs and resolves when updateConfig throws an Error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'update_config') return Promise.reject(new Error('boom'));
        return Promise.reject(new Error(`unmocked: ${cmd}`));
      });

      await expect(setFontFamily('sans')).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('clampFontSize', () => {
    it('rounds and clamps into the 12–24 range', () => {
      expect(clampFontSize(13.6)).toBe(14);
      expect(clampFontSize(100)).toBe(24);
      expect(clampFontSize(0)).toBe(12);
    });
  });
});

describe('applyStartupConfig font', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--editor-font-size');
    document.documentElement.style.removeProperty('--font-primary');
    document.documentElement.classList.remove('dark', 'light', 'compact');
  });

  it('applies persisted font size and family at startup', async () => {
    const config = buildConfig({ editor: { fontSize: 20, fontFamily: 'sans' } });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(config);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await applyStartupConfig();

    expect(document.documentElement.style.getPropertyValue('--editor-font-size')).toBe('20px');
    expect(document.documentElement.style.getPropertyValue('--font-primary')).toBe('var(--font-sans)');
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

describe('data-theme attribute (Story 7.2 switch contract)', () => {
  const originalMatchMedia = window.matchMedia;

  function mockMatchMedia(matches: boolean) {
    const mql = {
      matches,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
  }

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    document.documentElement.classList.remove('dark', 'light', 'compact');
    document.documentElement.removeAttribute('data-theme');
  });

  it('sets data-theme="light" when toggling to light', async () => {
    document.documentElement.classList.add('dark');
    const config = buildConfig({ general: { theme: 'dark', layoutMode: 'comfortable' } });
    const updated = buildConfig({ general: { theme: 'light', layoutMode: 'comfortable' } });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(config);
      if (cmd === 'update_config') return Promise.resolve(updated);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await toggleTheme();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('mirrors the persisted dark/light theme on startup', async () => {
    const config = buildConfig({ general: { theme: 'light', layoutMode: 'comfortable' } });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(config);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await applyStartupConfig();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('resolves system to the OS scheme (dark) in data-theme', async () => {
    mockMatchMedia(true);
    const config = buildConfig({ general: { theme: 'system', layoutMode: 'comfortable' } });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(config);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await applyStartupConfig();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('resolves system to the OS scheme (light) in data-theme', async () => {
    mockMatchMedia(false);
    const config = buildConfig({ general: { theme: 'system', layoutMode: 'comfortable' } });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(config);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await applyStartupConfig();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('falls back to data-theme="light" when matchMedia is unavailable', async () => {
    window.matchMedia = undefined as unknown as typeof window.matchMedia;
    const config = buildConfig({ general: { theme: 'system', layoutMode: 'comfortable' } });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(config);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await applyStartupConfig();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});

describe('applyBootTheme', () => {
  const originalMatchMedia = window.matchMedia;

  function mockMatchMedia(matches: boolean) {
    const mql = {
      matches,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
  }

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.removeAttribute('data-theme');
  });

  it('applies dark (class + data-theme) when the OS prefers dark', () => {
    document.documentElement.classList.add('light');
    mockMatchMedia(true);

    applyBootTheme();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('applies light (class + data-theme) when the OS prefers light', () => {
    document.documentElement.classList.add('dark');
    mockMatchMedia(false);

    applyBootTheme();

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('falls back to light when matchMedia is unavailable', () => {
    window.matchMedia = undefined as unknown as typeof window.matchMedia;

    applyBootTheme();

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
