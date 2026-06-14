import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { mockInvoke } from '../../../test-utils/setup';
import { buildConfig } from '../../../test-utils/factories';
import { useSettingsStore } from '../store';
import { CONFIGURABLE_ACTIONS, INVALID_SHORTCUT_MESSAGE } from '../shortcuts';
import { ShortcutCaptureRow } from './ShortcutCaptureRow';

const searchAction = CONFIGURABLE_ACTIONS.find((a) => a.id === 'search')!;

describe('ShortcutCaptureRow', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetSettings();
    mockInvoke.mockReset();
  });

  it('renders the current binding with Change and Reset controls', () => {
    render(<ShortcutCaptureRow action={searchAction} />);
    expect(screen.getByTestId('shortcut-value-search')).toHaveTextContent('Ctrl+F');
    expect(screen.getByTestId('change-shortcut-search')).toBeInTheDocument();
    expect(screen.getByTestId('reset-shortcut-search')).toBeInTheDocument();
  });

  it('enters capture mode and rejects a combo without a modifier', () => {
    render(<ShortcutCaptureRow action={searchAction} />);
    fireEvent.click(screen.getByTestId('change-shortcut-search'));

    fireEvent.keyDown(screen.getByTestId('shortcut-capture-search'), { key: 'g', code: 'KeyG' });

    expect(screen.getByTestId('shortcut-capture-search')).toHaveTextContent('Press new shortcut');
    expect(screen.getByTestId('shortcut-warning-search')).toHaveTextContent(INVALID_SHORTCUT_MESSAGE);
    expect(screen.getByTestId('save-shortcut-search')).toBeDisabled();
  });

  it('rejects a combo without the primary modifier', () => {
    render(<ShortcutCaptureRow action={searchAction} />);
    fireEvent.click(screen.getByTestId('change-shortcut-search'));

    fireEvent.keyDown(screen.getByTestId('shortcut-capture-search'), {
      key: 'G',
      code: 'KeyG',
      shiftKey: true,
    });

    expect(screen.getByTestId('shortcut-capture-search')).toHaveTextContent('Press new shortcut');
    expect(screen.getByTestId('shortcut-warning-search')).toHaveTextContent(INVALID_SHORTCUT_MESSAGE);
    expect(screen.getByTestId('save-shortcut-search')).toBeDisabled();
  });

  it('keeps capture open and shows the hint for Escape and Tab', () => {
    render(<ShortcutCaptureRow action={searchAction} />);
    fireEvent.click(screen.getByTestId('change-shortcut-search'));

    fireEvent.keyDown(screen.getByTestId('shortcut-capture-search'), { key: 'Escape', code: 'Escape' });
    expect(screen.getByTestId('shortcut-capture-search')).toBeInTheDocument();
    expect(screen.getByTestId('shortcut-warning-search')).toHaveTextContent(INVALID_SHORTCUT_MESSAGE);

    fireEvent.keyDown(screen.getByTestId('shortcut-capture-search'), { key: 'Tab', code: 'Tab' });
    expect(screen.getByTestId('shortcut-capture-search')).toBeInTheDocument();
    expect(screen.getByTestId('shortcut-warning-search')).toHaveTextContent(INVALID_SHORTCUT_MESSAGE);
  });

  it('cancels capture and returns to display mode', () => {
    render(<ShortcutCaptureRow action={searchAction} />);
    fireEvent.click(screen.getByTestId('change-shortcut-search'));
    expect(screen.getByTestId('shortcut-capture-search')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('cancel-capture-search'));

    expect(screen.getByTestId('shortcut-value-search')).toBeInTheDocument();
  });

  it('resets the binding to its default via the store', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'update_config') return Promise.resolve(buildConfig());
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    // Start from a customized binding so reset is observable.
    useSettingsStore.setState({
      bindings: { ...useSettingsStore.getState().bindings, search: 'Ctrl+G' },
    });
    render(<ShortcutCaptureRow action={searchAction} />);
    expect(screen.getByTestId('shortcut-value-search')).toHaveTextContent('Ctrl+G');

    fireEvent.click(screen.getByTestId('reset-shortcut-search'));

    await waitFor(() => {
      expect(screen.getByTestId('shortcut-value-search')).toHaveTextContent('Ctrl+F');
    });
  });
});
