import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { mockInvoke } from '../../../test-utils/setup';
import { buildConfig } from '../../../test-utils/factories';
import type { AppConfig } from '../../../generated/bindings';
import { useSettingsStore } from '../store';
import { SettingsPanel } from './SettingsPanel';

/** Open the store with a given config, then render the panel. */
async function openWith(config: AppConfig) {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'get_config') return Promise.resolve(config);
    if (cmd === 'update_config') return Promise.resolve(config);
    return Promise.reject(new Error(`unmocked: ${cmd}`));
  });
  await useSettingsStore.getState().open();
  return render(<SettingsPanel />);
}

describe('SettingsPanel', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetSettings();
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark', 'light', 'compact');
    document.documentElement.style.removeProperty('--editor-font-size');
    document.documentElement.style.removeProperty('--font-primary');
  });

  it('renders the dialog with General, Editor, and Hotkey sections', async () => {
    await openWith(
      buildConfig({ editor: { fontSize: 16, fontFamily: 'mono' }, hotkey: { globalShortcut: 'Ctrl+Shift+N' } }),
    );

    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Editor' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hotkey' })).toBeInTheDocument();
    expect(screen.getByTestId('global-shortcut-value')).toHaveTextContent('Ctrl+Shift+N');
    expect(screen.getByTestId('font-size-value')).toHaveTextContent('16px');
    expect(screen.getByText(/config\.toml/)).toBeInTheDocument();
  });

  it('persists a theme change and applies it live', async () => {
    document.documentElement.classList.add('dark');
    await openWith(buildConfig({ general: { theme: 'dark', layoutMode: 'comfortable' } }));

    fireEvent.click(screen.getByTestId('theme-light'));

    expect(document.documentElement.classList.contains('light')).toBe(true);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('update_config', {
        partial: { general: { theme: 'light', layoutMode: null }, editor: null, hotkey: null },
      });
    });
  });

  it('offers a system theme option that persists (Story 7.2)', async () => {
    await openWith(buildConfig({ general: { theme: 'system', layoutMode: 'comfortable' } }));

    const systemBtn = screen.getByTestId('theme-system');
    expect(systemBtn).toBeInTheDocument();
    expect(systemBtn).toHaveAttribute('aria-pressed', 'true');

    // Switch to light, then back to system, to exercise the persist path.
    fireEvent.click(screen.getByTestId('theme-light'));
    fireEvent.click(systemBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('update_config', {
        partial: { general: { theme: 'system', layoutMode: null }, editor: null, hotkey: null },
      });
    });
  });

  it('persists a font family change', async () => {
    await openWith(buildConfig({ editor: { fontSize: 14, fontFamily: 'mono' } }));

    fireEvent.change(screen.getByTestId('font-family-select'), { target: { value: 'sans' } });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('update_config', {
        partial: { general: null, editor: { fontSize: null, fontFamily: 'sans' }, hotkey: null },
      });
    });
  });

  it('persists a font size change from the slider', async () => {
    await openWith(buildConfig({ editor: { fontSize: 14, fontFamily: 'mono' } }));

    fireEvent.change(screen.getByTestId('font-size-input'), { target: { value: '20' } });

    expect(screen.getByTestId('font-size-value')).toHaveTextContent('20px');
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('update_config', {
        partial: { general: null, editor: { fontSize: 20, fontFamily: null }, hotkey: null },
      });
    });
  });

  it('shows floating in the layout selector for a legacy density value', async () => {
    await openWith(buildConfig({ general: { theme: 'dark', layoutMode: 'comfortable' } }));

    expect(screen.getByTestId('layout-mode-select')).toHaveValue('floating');
  });

  it('routes the Hotkey "Change" button to the deferred stub (Story 7.4)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await openWith(buildConfig());

    fireEvent.click(screen.getByTestId('change-shortcut'));

    expect(warnSpy).toHaveBeenCalledWith('Not yet implemented: Change global shortcut');
    warnSpy.mockRestore();
  });

  it('does not close when the passive backdrop is clicked', async () => {
    await openWith(buildConfig());

    fireEvent.click(screen.getByTestId('settings-backdrop'));

    expect(useSettingsStore.getState().isOpen).toBe(true);
  });

  it('prevents Ctrl/Cmd shortcuts from escaping the modal', async () => {
    await openWith(buildConfig());

    const event = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('closes on Escape', async () => {
    await openWith(buildConfig());

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(useSettingsStore.getState().isOpen).toBe(false);
  });

  it('closes when the Done button is clicked', async () => {
    await openWith(buildConfig());

    fireEvent.click(screen.getByTestId('settings-done'));

    expect(useSettingsStore.getState().isOpen).toBe(false);
  });
});
