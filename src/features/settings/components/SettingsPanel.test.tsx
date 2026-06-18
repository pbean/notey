import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { mockInvoke } from '../../../test-utils/setup';
import { buildConfig } from '../../../test-utils/factories';
import type { AppConfig } from '../../../generated/bindings';
import { useSettingsStore } from '../store';
import { useToastStore } from '../../toast/store';
import { platformDefaultShortcut } from '../shortcut';
import { SettingsPanel } from './SettingsPanel';

/** Open the store with a given config, then render the panel. */
async function openWith(config: AppConfig) {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'get_config') return Promise.resolve(config);
    if (cmd === 'update_config') return Promise.resolve(config);
    if (cmd === 'apply_layout_mode') return Promise.resolve(null);
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
        partial: { general: { theme: 'light', layoutMode: null }, editor: null, hotkey: null, shortcuts: null },
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
        partial: { general: { theme: 'system', layoutMode: null }, editor: null, hotkey: null, shortcuts: null },
      });
    });
  });

  it('persists a font family change', async () => {
    await openWith(buildConfig({ editor: { fontSize: 14, fontFamily: 'mono' } }));

    fireEvent.change(screen.getByTestId('font-family-select'), { target: { value: 'sans' } });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('update_config', {
        partial: { general: null, editor: { fontSize: null, fontFamily: 'sans' }, hotkey: null, shortcuts: null },
      });
    });
  });

  it('persists a font size change from the slider', async () => {
    await openWith(buildConfig({ editor: { fontSize: 14, fontFamily: 'mono' } }));

    fireEvent.change(screen.getByTestId('font-size-input'), { target: { value: '20' } });

    expect(screen.getByTestId('font-size-value')).toHaveTextContent('20px');
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('update_config', {
        partial: { general: null, editor: { fontSize: 20, fontFamily: null }, hotkey: null, shortcuts: null },
      });
    });
  });

  it('shows floating in the layout selector for a legacy density value', async () => {
    await openWith(buildConfig({ general: { theme: 'dark', layoutMode: 'comfortable' } }));

    expect(screen.getByTestId('layout-mode-select')).toHaveValue('floating');
  });

  it('applies and persists a window-mode selection (Story 7.5)', async () => {
    await openWith(buildConfig({ general: { theme: 'dark', layoutMode: 'floating' } }));

    fireEvent.change(screen.getByTestId('layout-mode-select'), { target: { value: 'half-screen' } });

    await waitFor(() => {
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
  });

  it('captures a new shortcut and persists it on Save (Story 7.4)', async () => {
    const updated = buildConfig({ hotkey: { globalShortcut: 'Ctrl+Alt+J' } });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(buildConfig({ hotkey: { globalShortcut: 'Ctrl+Shift+N' } }));
      if (cmd === 'update_config') return Promise.resolve(updated);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    await useSettingsStore.getState().open();
    render(<SettingsPanel />);

    fireEvent.click(screen.getByTestId('change-shortcut'));
    expect(screen.getByTestId('shortcut-capture')).toHaveTextContent('Press new shortcut');

    // The combo targets the focused capture region; the window capture-phase
    // listener picks it up before it could trigger any app shortcut.
    fireEvent.keyDown(screen.getByTestId('shortcut-capture'), { key: 'J', code: 'KeyJ', ctrlKey: true, altKey: true });
    expect(screen.getByTestId('shortcut-capture')).toHaveTextContent('Ctrl+Alt+J');

    fireEvent.click(screen.getByTestId('save-shortcut'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('update_config', {
        partial: { general: null, editor: null, hotkey: { globalShortcut: 'Ctrl+Alt+J' }, shortcuts: null },
      });
    });
    // Back in display mode, showing the backend-confirmed binding.
    await waitFor(() => {
      expect(screen.getByTestId('global-shortcut-value')).toHaveTextContent('Ctrl+Alt+J');
    });
  });

  it('keeps the previous shortcut and warns on a conflict (Story 7.4)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(buildConfig({ hotkey: { globalShortcut: 'Ctrl+Shift+N' } }));
      if (cmd === 'update_config') return Promise.reject({ type: 'Config', message: 'Failed to register new shortcut' });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    await useSettingsStore.getState().open();
    render(<SettingsPanel />);

    fireEvent.click(screen.getByTestId('change-shortcut'));
    fireEvent.keyDown(screen.getByTestId('shortcut-capture'), { key: 'J', code: 'KeyJ', ctrlKey: true, altKey: true });
    fireEvent.click(screen.getByTestId('save-shortcut'));

    await waitFor(() => {
      expect(screen.getByTestId('shortcut-warning')).toBeInTheDocument();
    });
    expect(screen.getByTestId('global-shortcut-value')).toHaveTextContent('Ctrl+Shift+N');
    expect(useToastStore.getState().toasts.some((t) => t.message.includes('in use by another app'))).toBe(true);
    consoleSpy.mockRestore();
  });

  it('rejects a combination without a modifier in capture mode (Story 7.4)', async () => {
    await openWith(buildConfig());

    fireEvent.click(screen.getByTestId('change-shortcut'));
    fireEvent.keyDown(screen.getByTestId('shortcut-capture'), { key: 'J', code: 'KeyJ' });

    expect(screen.getByTestId('shortcut-capture')).toHaveTextContent('Press new shortcut');
    expect(screen.getByTestId('shortcut-warning')).toBeInTheDocument();
  });

  it('cancels capture on Escape without closing the overlay (Story 7.4)', async () => {
    await openWith(buildConfig());

    fireEvent.click(screen.getByTestId('change-shortcut'));
    const captureEl = screen.getByTestId('shortcut-capture');
    expect(captureEl).toBeInTheDocument();

    // Esc targets the in-modal capture region; the capture-phase listener
    // cancels capture and stops propagation before the panel's Esc-to-close.
    fireEvent.keyDown(captureEl, { key: 'Escape', code: 'Escape' });

    // Back in display mode and the overlay is still open.
    await waitFor(() => {
      expect(screen.getByTestId('change-shortcut')).toHaveFocus();
      expect(useSettingsStore.getState().isOpen).toBe(true);
    });
  });

  it('resets the shortcut to the platform default (Story 7.4)', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(buildConfig({ hotkey: { globalShortcut: 'Ctrl+Alt+J' } }));
      if (cmd === 'update_config') return Promise.resolve(buildConfig({ hotkey: { globalShortcut: platformDefaultShortcut() } }));
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    await useSettingsStore.getState().open();
    render(<SettingsPanel />);

    fireEvent.click(screen.getByTestId('reset-shortcut'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('update_config', {
        partial: { general: null, editor: null, hotkey: { globalShortcut: platformDefaultShortcut() }, shortcuts: null },
      });
    });
  });

  it('keeps the previous shortcut visible and warns when reset conflicts (Story 7.4)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(buildConfig({ hotkey: { globalShortcut: 'Ctrl+Alt+J' } }));
      if (cmd === 'update_config') return Promise.reject({ type: 'Config', message: 'Failed to register new shortcut' });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    await useSettingsStore.getState().open();
    render(<SettingsPanel />);

    fireEvent.click(screen.getByTestId('reset-shortcut'));

    await waitFor(() => {
      expect(screen.getByTestId('shortcut-warning')).toBeInTheDocument();
    });
    expect(screen.getByTestId('global-shortcut-value')).toHaveTextContent('Ctrl+Alt+J');
    consoleSpy.mockRestore();
  });

  it('renders the Shortcuts section with configurable and reserved rows (Story 7.6)', async () => {
    await openWith(buildConfig());

    expect(screen.getByRole('heading', { name: 'Shortcuts' })).toBeInTheDocument();
    // Configurable action: editable, showing its current binding.
    expect(screen.getByTestId('shortcut-value-search')).toHaveTextContent('Ctrl+F');
    expect(screen.getByTestId('change-shortcut-search')).toBeInTheDocument();
    // Reserved action: listed read-only.
    expect(screen.getByTestId('reserved-shortcut-openSettings')).toHaveTextContent('Ctrl+,');
    expect(screen.getByTestId('reserved-shortcut-backHide')).toHaveTextContent('Esc');
  });

  it('captures and persists an in-app shortcut rebind (Story 7.6)', async () => {
    const updated = buildConfig({ shortcuts: { search: 'Ctrl+G' } });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config') return Promise.resolve(buildConfig());
      if (cmd === 'update_config') return Promise.resolve(updated);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    await useSettingsStore.getState().open();
    render(<SettingsPanel />);

    fireEvent.click(screen.getByTestId('change-shortcut-search'));
    fireEvent.keyDown(screen.getByTestId('shortcut-capture-search'), { key: 'G', code: 'KeyG', ctrlKey: true });
    expect(screen.getByTestId('shortcut-capture-search')).toHaveTextContent('Ctrl+G');

    fireEvent.click(screen.getByTestId('save-shortcut-search'));

    await waitFor(() => {
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
    });
    await waitFor(() => {
      expect(screen.getByTestId('shortcut-value-search')).toHaveTextContent('Ctrl+G');
    });
  });

  it('blocks Save and warns when a captured combo conflicts (Story 7.6)', async () => {
    await openWith(buildConfig());

    fireEvent.click(screen.getByTestId('change-shortcut-search'));
    // Ctrl+N is newNote's binding — capturing it for search is a conflict.
    fireEvent.keyDown(screen.getByTestId('shortcut-capture-search'), { key: 'N', code: 'KeyN', ctrlKey: true });

    expect(screen.getByTestId('shortcut-warning-search')).toHaveTextContent(/already used by New note/i);
    expect(screen.getByTestId('save-shortcut-search')).toBeDisabled();
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

  it('traps Tab within the dialog — wrapping the last control back to the first (Story 7.7)', async () => {
    await openWith(buildConfig());

    const done = screen.getByTestId('settings-done');
    done.focus();
    const notPrevented = fireEvent.keyDown(done, { key: 'Tab' });
    expect(notPrevented).toBe(false); // preventDefault — focus wraps, never escapes
    expect(document.activeElement).toBe(screen.getByTestId('theme-system'));
  });

  it('wraps Shift+Tab from the first control back to the last (Story 7.7)', async () => {
    await openWith(buildConfig());

    const first = screen.getByTestId('theme-system');
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByTestId('settings-done'));
  });

  it('toggles auto-start on and persists via set_autostart (Story 8.4)', async () => {
    const cfgOn = buildConfig({ general: { theme: 'system', layoutMode: 'floating', autoStart: true } });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_config')
        return Promise.resolve(
          buildConfig({ general: { theme: 'system', layoutMode: 'floating', autoStart: false } }),
        );
      if (cmd === 'get_autostart') return Promise.resolve(false);
      if (cmd === 'set_autostart') return Promise.resolve(cfgOn);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    await useSettingsStore.getState().open();
    render(<SettingsPanel />);

    const toggle = screen.getByTestId('autostart-toggle');
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('set_autostart', { enabled: true });
    });
    await waitFor(() => {
      expect(screen.getByTestId('autostart-toggle')).toHaveAttribute('aria-checked', 'true');
    });
  });
});
