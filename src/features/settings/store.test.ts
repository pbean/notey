import { describe, it, expect, beforeEach, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { mockInvoke } from '../../test-utils/setup';
import { buildConfig } from '../../test-utils/factories';
import { useSettingsStore } from './store';
import { useSearchStore } from '../search/store';
import { useToastStore } from '../toast/store';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetSettings();
  });

  it('loads the config snapshot and opens on open()', async () => {
    const config = buildConfig({ editor: { fontSize: 18, fontFamily: 'sans' } });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(config);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await useSettingsStore.getState().open();

    const state = useSettingsStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.config?.editor?.fontSize).toBe(18);
    expect(state.config?.editor?.fontFamily).toBe('sans');
  });

  it('stays closed and logs when getConfig fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.reject({ type: 'Database' });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await useSettingsStore.getState().open();

    expect(useSettingsStore.getState().isOpen).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('stays closed and logs when getConfig throws an Error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.reject(new Error('boom'));
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await expect(useSettingsStore.getState().open()).resolves.toBe(false);

    expect(useSettingsStore.getState().isOpen).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('keeps the current overlay open when loading settings fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.reject({ type: 'Database' });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useSearchStore.getState().openSearch();

    await useSettingsStore.getState().open();

    expect(useSearchStore.getState().isOpen).toBe(true);
    expect(useSettingsStore.getState().isOpen).toBe(false);
    consoleSpy.mockRestore();
  });

  it('closes other overlays when opened (mutual exclusion)', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(buildConfig());
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useSearchStore.getState().openSearch();
    expect(useSearchStore.getState().isOpen).toBe(true);

    await useSettingsStore.getState().open();

    expect(useSearchStore.getState().isOpen).toBe(false);
    expect(useSettingsStore.getState().isOpen).toBe(true);
  });

  it('close() hides the overlay', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(buildConfig());
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    await useSettingsStore.getState().open();

    useSettingsStore.getState().close();

    expect(useSettingsStore.getState().isOpen).toBe(false);
  });

  it('setFontSize clamps the snapshot value and persists', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(buildConfig({ editor: { fontSize: 14, fontFamily: 'mono' } }));
      if (cmd === 'update_config') return Promise.resolve(buildConfig());
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    await useSettingsStore.getState().open();

    useSettingsStore.getState().setFontSize(99);

    expect(useSettingsStore.getState().config?.editor?.fontSize).toBe(24);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('update_config', {
        partial: { general: null, editor: { fontSize: 24, fontFamily: null }, hotkey: null, shortcuts: null },
      });
    });
  });

  it('setGlobalShortcut adopts the backend config and toasts on success', async () => {
    const updated = buildConfig({ hotkey: { globalShortcut: 'Ctrl+Alt+J' } });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(buildConfig({ hotkey: { globalShortcut: 'Ctrl+Shift+N' } }));
      if (cmd === 'update_config') return Promise.resolve(updated);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    await useSettingsStore.getState().open();

    const ok = await useSettingsStore.getState().setGlobalShortcut('Ctrl+Alt+J');

    expect(ok).toBe(true);
    expect(useSettingsStore.getState().config?.hotkey?.globalShortcut).toBe('Ctrl+Alt+J');
    expect(mockInvoke).toHaveBeenCalledWith('update_config', {
      partial: { general: null, editor: null, hotkey: { globalShortcut: 'Ctrl+Alt+J' }, shortcuts: null },
    });
    expect(useToastStore.getState().toasts.map((t) => t.message)).toContain('Global shortcut updated');
  });

  it('setGlobalShortcut keeps the previous shortcut and toasts on conflict', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(buildConfig({ hotkey: { globalShortcut: 'Ctrl+Shift+N' } }));
      if (cmd === 'update_config') return Promise.reject({ type: 'Config', message: 'Failed to register new shortcut' });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    await useSettingsStore.getState().open();

    const ok = await useSettingsStore.getState().setGlobalShortcut('Ctrl+Alt+J');

    expect(ok).toBe(false);
    // Snapshot is untouched — the previously-active shortcut is still shown.
    expect(useSettingsStore.getState().config?.hotkey?.globalShortcut).toBe('Ctrl+Shift+N');
    expect(useToastStore.getState().toasts.some((t) => t.message.includes('in use by another app'))).toBe(true);
    consoleSpy.mockRestore();
  });

  it('setGlobalShortcut shows a generic toast for non-conflict backend errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(buildConfig({ hotkey: { globalShortcut: 'Ctrl+Shift+N' } }));
      if (cmd === 'update_config') return Promise.reject({ type: 'Io' });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    await useSettingsStore.getState().open();

    const ok = await useSettingsStore.getState().setGlobalShortcut('Ctrl+Alt+J');

    expect(ok).toBe(false);
    expect(useToastStore.getState().toasts.map((t) => t.message)).toContain(
      'Couldn’t change the shortcut — keeping the previous one.',
    );
    consoleSpy.mockRestore();
  });

  it('hydrateShortcuts layers persisted bindings over defaults', () => {
    useSettingsStore.getState().hydrateShortcuts(buildConfig({ shortcuts: { search: 'Ctrl+G' } }));

    const { bindings } = useSettingsStore.getState();
    expect(bindings.search).toBe('Ctrl+G'); // persisted override
    expect(bindings.commandPalette).toBe('Ctrl+P'); // default fills the rest
  });

  it('hydrateShortcuts canonicalizes a persisted Cmd binding to Ctrl', () => {
    useSettingsStore.getState().hydrateShortcuts(buildConfig({ shortcuts: { newNote: 'Cmd+G' } }));
    expect(useSettingsStore.getState().bindings.newNote).toBe('Ctrl+G');
  });

  it('setShortcut persists the rebind and updates the live binding', async () => {
    const updated = buildConfig({ shortcuts: { search: 'Ctrl+G' } });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(buildConfig());
      if (cmd === 'update_config') return Promise.resolve(updated);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    await useSettingsStore.getState().open();

    const ok = await useSettingsStore.getState().setShortcut('search', 'Ctrl+G');

    expect(ok).toBe(true);
    expect(useSettingsStore.getState().bindings.search).toBe('Ctrl+G');
    expect(mockInvoke).toHaveBeenCalledWith('update_config', {
      partial: {
        general: null,
        editor: null,
        hotkey: null,
        shortcuts: {
          commandPalette: null,
          search: 'Ctrl+G',
          newNote: null,
          toggleNoteList: null,
          toggleTheme: null,
          closeTab: null,
        },
      },
    });
    expect(useToastStore.getState().toasts.map((t) => t.message)).toContain('Shortcut updated');
  });

  it('setShortcut rejects a combo already bound to another action without persisting', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'update_config') return Promise.resolve(buildConfig());
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    // newNote default Ctrl+N; binding search to Ctrl+N must be rejected.
    const ok = await useSettingsStore.getState().setShortcut('search', 'Ctrl+N');

    expect(ok).toBe(false);
    expect(useSettingsStore.getState().bindings.search).toBe('Ctrl+F'); // unchanged
    expect(mockInvoke).not.toHaveBeenCalledWith('update_config', expect.anything());
    expect(useToastStore.getState().toasts.some((t) => t.message.includes('already used'))).toBe(true);
  });

  it('setShortcut rejects a reserved combo (tab-jump range)', async () => {
    const ok = await useSettingsStore.getState().setShortcut('search', 'Ctrl+5');
    expect(ok).toBe(false);
    expect(useSettingsStore.getState().bindings.search).toBe('Ctrl+F');
  });

  it('setShortcut rejects a combo without the primary modifier', async () => {
    const ok = await useSettingsStore.getState().setShortcut('search', 'Shift+G');
    expect(ok).toBe(false);
    expect(useSettingsStore.getState().bindings.search).toBe('Ctrl+F');
    expect(mockInvoke).not.toHaveBeenCalledWith('update_config', expect.anything());
  });

  it('resetShortcut restores the shipped default', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(buildConfig({ shortcuts: { search: 'Ctrl+G' } }));
      if (cmd === 'update_config') return Promise.resolve(buildConfig());
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    await useSettingsStore.getState().open();
    expect(useSettingsStore.getState().bindings.search).toBe('Ctrl+G');

    const ok = await useSettingsStore.getState().resetShortcut('search');

    expect(ok).toBe(true);
    expect(useSettingsStore.getState().bindings.search).toBe('Ctrl+F');
  });

  it('setAutostart enables, persists via set_autostart, and adopts the returned config', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config')
        return Promise.resolve(buildConfig({ general: { theme: 'system', layoutMode: 'floating', autoStart: false } }));
      if (cmd === 'get_autostart') return Promise.resolve(false);
      if (cmd === 'set_autostart')
        return Promise.resolve(buildConfig({ general: { theme: 'system', layoutMode: 'floating', autoStart: true } }));
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    await useSettingsStore.getState().open();

    const ok = await useSettingsStore.getState().setAutostart(true);

    expect(ok).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith('set_autostart', { enabled: true });
    expect(useSettingsStore.getState().config?.general?.autoStart).toBe(true);
    expect(useToastStore.getState().toasts.some((t) => t.message.includes('enabled'))).toBe(true);
  });

  it('setAutostart keeps the prior state and toasts on failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config')
        return Promise.resolve(buildConfig({ general: { theme: 'system', layoutMode: 'floating', autoStart: false } }));
      if (cmd === 'get_autostart') return Promise.resolve(false);
      if (cmd === 'set_autostart') return Promise.reject({ type: 'Config', message: 'boom' });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    await useSettingsStore.getState().open();

    const ok = await useSettingsStore.getState().setAutostart(true);

    expect(ok).toBe(false);
    expect(useSettingsStore.getState().config?.general?.autoStart ?? false).toBe(false);
    expect(useToastStore.getState().toasts.some((t) => t.message.includes('Couldn’t change auto-start'))).toBe(true);
    consoleSpy.mockRestore();
  });

  it('open() reconciles the toggle to the live OS auto-start state', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config')
        return Promise.resolve(buildConfig({ general: { theme: 'system', layoutMode: 'floating', autoStart: false } }));
      if (cmd === 'get_autostart') return Promise.resolve(true); // OS reports enabled
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await useSettingsStore.getState().open();

    expect(useSettingsStore.getState().config?.general?.autoStart).toBe(true);
  });

  it('ignores stale open() auto-start reconciliation after a completed toggle', async () => {
    const liveState = deferred<boolean>();
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config')
        return Promise.resolve(buildConfig({ general: { theme: 'system', layoutMode: 'floating', autoStart: false } }));
      if (cmd === 'get_autostart') return liveState.promise;
      if (cmd === 'set_autostart')
        return Promise.resolve(buildConfig({ general: { theme: 'system', layoutMode: 'floating', autoStart: true } }));
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    const openPromise = useSettingsStore.getState().open();
    await waitFor(() => {
      expect(useSettingsStore.getState().isOpen).toBe(true);
    });

    await useSettingsStore.getState().setAutostart(true);
    liveState.resolve(false);
    await openPromise;

    expect(useSettingsStore.getState().config?.general?.autoStart).toBe(true);
  });
});
