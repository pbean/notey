import { describe, it, expect, beforeEach, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { mockInvoke } from '../../test-utils/setup';
import { buildConfig } from '../../test-utils/factories';
import { useSettingsStore } from './store';
import { useSearchStore } from '../search/store';
import { useToastStore } from '../toast/store';

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
        partial: { general: null, editor: { fontSize: 24, fontFamily: null }, hotkey: null },
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
      partial: { general: null, editor: null, hotkey: { globalShortcut: 'Ctrl+Alt+J' } },
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
});
