import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { EventCallback } from '@tauri-apps/api/event';
import { events, type HotkeyPressed } from '../../../generated/bindings';
import { useOnboardingStore } from '../store';
import { useSettingsStore } from '../../settings/store';
import * as api from '../api';
import { OnboardingOverlay } from './OnboardingOverlay';

/**
 * ATDD red-phase acceptance tests — Stories 8.1, 8.2, 8.3 (onboarding overlay UI).
 *
 * `describe.skip` keeps these inert against the empty overlay shell. Activate by
 * switching `describe.skip` → `describe` once `OnboardingOverlay` renders the
 * required markup (TEA data-testid: `onboarding-overlay`, `hotkey-display`).
 */
describe('OnboardingOverlay (red-phase: Stories 8.1, 8.2, 8.3)', () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
    vi.restoreAllMocks();
  });

  /** Make the overlay visible with a known hotkey. */
  function showOverlay(hotkey = 'Ctrl+Shift+N') {
    useOnboardingStore.setState({ isVisible: true, hotkey });
  }

  it('renders an accessible modal dialog when visible (8.1)', () => {
    showOverlay();
    render(<OnboardingOverlay />);

    const dialog = screen.getByTestId('onboarding-overlay');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Welcome to Notey');
  });

  it('displays the capture shortcut as key caps with the try prompt (8.1)', () => {
    showOverlay('Ctrl+Shift+N');
    render(<OnboardingOverlay />);

    expect(screen.getByText(/your capture shortcut is/i)).toBeInTheDocument();
    const keyCaps = screen.getByTestId('hotkey-display');
    expect(keyCaps).toHaveTextContent('Ctrl');
    expect(keyCaps).toHaveTextContent('Shift');
    expect(keyCaps).toHaveTextContent('N');
    expect(screen.getByText(/press it now to try/i)).toBeInTheDocument();
  });

  it('moves focus to the onboarding instruction when opened (8.1)', () => {
    showOverlay();
    render(<OnboardingOverlay />);

    expect(screen.getByText(/your capture shortcut is/i)).toHaveFocus();
  });

  it('renders nothing once onboarding is dismissed (8.1)', () => {
    useOnboardingStore.setState({ isVisible: false });
    render(<OnboardingOverlay />);
    expect(screen.queryByTestId('onboarding-overlay')).not.toBeInTheDocument();
  });

  it('dismisses and persists completion on Esc (8.1)', () => {
    const dismiss = vi
      .spyOn(useOnboardingStore.getState(), 'dismiss')
      .mockResolvedValue();
    showOverlay();
    render(<OnboardingOverlay />);

    fireEvent.keyDown(screen.getByTestId('onboarding-overlay'), {
      key: 'Escape',
    });

    expect(dismiss).toHaveBeenCalledOnce();
  });

  it('offers a Customize control that enters capture mode (8.3)', () => {
    showOverlay();
    render(<OnboardingOverlay />);

    fireEvent.click(screen.getByRole('button', { name: /customize/i }));

    expect(useOnboardingStore.getState().customizing).toBe(true);
    expect(
      screen.getByText(/press your preferred shortcut/i),
    ).toBeInTheDocument();
  });

  it('live-previews a captured combination and enables Save (8.3)', () => {
    showOverlay();
    useOnboardingStore.setState({ customizing: true });
    render(<OnboardingOverlay />);

    expect(screen.getByTestId('save-custom-hotkey')).toBeDisabled();

    fireEvent.keyDown(window, {
      code: 'KeyJ',
      key: 'j',
      ctrlKey: true,
      shiftKey: true,
    });

    const preview = screen.getByTestId('hotkey-capture');
    expect(preview).toHaveTextContent('Ctrl');
    expect(preview).toHaveTextContent('Shift');
    expect(preview).toHaveTextContent('J');
    expect(screen.getByTestId('save-custom-hotkey')).toBeEnabled();
  });

  it('warns on an unbindable combination and leaves Save disabled (8.3)', () => {
    showOverlay();
    useOnboardingStore.setState({ customizing: true });
    render(<OnboardingOverlay />);

    // No modifier — not a bindable global shortcut.
    fireEvent.keyDown(window, { code: 'KeyJ', key: 'j' });

    expect(screen.getByTestId('hotkey-warning')).toHaveTextContent(
      /at least one modifier/i,
    );
    expect(screen.getByTestId('save-custom-hotkey')).toBeDisabled();
  });

  it('saves a captured shortcut via the shared path and shows the new caps (8.3)', async () => {
    const setGlobalShortcut = vi
      .spyOn(useSettingsStore.getState(), 'setGlobalShortcut')
      .mockResolvedValue(true);
    showOverlay('Ctrl+Shift+N');
    useOnboardingStore.setState({ customizing: true });
    render(<OnboardingOverlay />);

    fireEvent.keyDown(window, {
      code: 'KeyJ',
      key: 'j',
      ctrlKey: true,
      shiftKey: true,
    });
    fireEvent.click(screen.getByTestId('save-custom-hotkey'));

    await waitFor(() =>
      expect(useOnboardingStore.getState().customizing).toBe(false),
    );
    expect(setGlobalShortcut).toHaveBeenCalledWith('Ctrl+Shift+J');
    expect(useOnboardingStore.getState().hotkey).toBe('Ctrl+Shift+J');
    const caps = screen.getByTestId('hotkey-display');
    expect(caps).toHaveTextContent('J');
  });

  it('warns and stays in capture when the shortcut conflicts (8.3)', async () => {
    vi.spyOn(useSettingsStore.getState(), 'setGlobalShortcut').mockResolvedValue(
      false,
    );
    showOverlay('Ctrl+Shift+N');
    useOnboardingStore.setState({ customizing: true });
    render(<OnboardingOverlay />);

    fireEvent.keyDown(window, {
      code: 'KeyJ',
      key: 'j',
      ctrlKey: true,
      shiftKey: true,
    });
    fireEvent.click(screen.getByTestId('save-custom-hotkey'));

    await waitFor(() =>
      expect(screen.getByTestId('hotkey-warning')).toHaveTextContent(
        /unavailable/i,
      ),
    );
    expect(useOnboardingStore.getState().customizing).toBe(true);
    expect(useOnboardingStore.getState().hotkey).toBe('Ctrl+Shift+N');
  });

  it('does not submit duplicate saves while registration is pending (8.3)', async () => {
    let resolveShortcut!: (value: boolean) => void;
    const pending = new Promise<boolean>((resolve) => {
      resolveShortcut = resolve;
    });
    const applyCustomHotkey = vi
      .spyOn(useOnboardingStore.getState(), 'applyCustomHotkey')
      .mockReturnValue(pending);
    showOverlay('Ctrl+Shift+N');
    useOnboardingStore.setState({ customizing: true });
    render(<OnboardingOverlay />);

    fireEvent.keyDown(window, {
      code: 'KeyJ',
      key: 'j',
      ctrlKey: true,
      shiftKey: true,
    });
    const save = screen.getByTestId('save-custom-hotkey');
    fireEvent.click(save);
    fireEvent.click(save);

    expect(applyCustomHotkey).toHaveBeenCalledTimes(1);
    expect(save).toBeDisabled();
    expect(screen.getByTestId('cancel-custom-hotkey')).toBeDisabled();

    resolveShortcut(false);
    await waitFor(() =>
      expect(screen.getByTestId('hotkey-warning')).toHaveTextContent(
        /unavailable/i,
      ),
    );
    expect(save).toBeDisabled();
    expect(screen.getByTestId('cancel-custom-hotkey')).toBeEnabled();
  });

  it('lets focused capture controls receive Enter without treating it as a shortcut (8.3)', () => {
    showOverlay();
    useOnboardingStore.setState({ customizing: true });
    render(<OnboardingOverlay />);

    fireEvent.keyDown(window, {
      code: 'KeyJ',
      key: 'j',
      ctrlKey: true,
      shiftKey: true,
    });
    const save = screen.getByTestId('save-custom-hotkey');
    save.focus();

    fireEvent.keyDown(save, { key: 'Enter', code: 'Enter' });

    expect(screen.queryByTestId('hotkey-warning')).not.toBeInTheDocument();
    expect(screen.getByTestId('hotkey-capture')).toHaveTextContent('J');
  });

  it('cancels capture without dismissing onboarding (8.3)', () => {
    showOverlay();
    useOnboardingStore.setState({ customizing: true });
    render(<OnboardingOverlay />);

    fireEvent.click(screen.getByTestId('cancel-custom-hotkey'));

    // Capture is abandoned and the overlay returns to the normal instruction;
    // onboarding is NOT completed (still visible).
    expect(useOnboardingStore.getState().customizing).toBe(false);
    expect(useOnboardingStore.getState().isVisible).toBe(true);
    expect(screen.getByText(/your capture shortcut is/i)).toBeInTheDocument();
  });

  it('Esc during capture cancels capture, not onboarding (8.3)', () => {
    showOverlay();
    useOnboardingStore.setState({ customizing: true });
    render(<OnboardingOverlay />);

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    // Esc exits capture but leaves onboarding open (the Esc-dismiss handler is
    // suppressed while customizing).
    expect(useOnboardingStore.getState().customizing).toBe(false);
    expect(useOnboardingStore.getState().isVisible).toBe(true);
  });

  it('ignores stale global-hotkey events after capture starts (8.3)', async () => {
    let captured: EventCallback<HotkeyPressed> | null = null;
    vi.spyOn(events.hotkeyPressed, 'listen').mockImplementation((cb) => {
      captured = cb;
      return Promise.resolve(vi.fn());
    });
    const dismiss = vi
      .spyOn(useOnboardingStore.getState(), 'dismiss')
      .mockResolvedValue();
    showOverlay();
    render(<OnboardingOverlay />);
    await waitFor(() => expect(captured).not.toBeNull());

    act(() => {
      useOnboardingStore.setState({ isVisible: true, customizing: true });
    });
    expect(useOnboardingStore.getState().customizing).toBe(true);
    dismiss.mockClear();
    captured!({ event: 'hotkey-pressed', id: 1, payload: null });

    expect(dismiss).not.toHaveBeenCalled();
    expect(useOnboardingStore.getState().isVisible).toBe(true);
  });

  it('shows macOS accessibility guidance with a settings link when required (8.2)', () => {
    vi.spyOn(api, 'loadOnboardingState').mockResolvedValue({
      complete: false,
      sessionsSeen: 0,
    });
    showOverlay();
    useOnboardingStore.setState({ accessibilityNeeded: true });
    render(<OnboardingOverlay />);

    expect(
      screen.getByText(
        /needs accessibility permission for the global shortcut/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /system settings/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/shortcut may not work without this permission/i),
    ).toBeInTheDocument();
  });

  it('opens the accessibility settings pane from the guidance button (8.2)', () => {
    const open = vi
      .spyOn(api, 'openAccessibilitySettings')
      .mockResolvedValue();
    showOverlay();
    useOnboardingStore.setState({ accessibilityNeeded: true });
    render(<OnboardingOverlay />);

    fireEvent.click(screen.getByRole('button', { name: /system settings/i }));

    expect(open).toHaveBeenCalledOnce();
  });

  it('lets the user skip the accessibility guidance and continue (8.2)', () => {
    showOverlay();
    useOnboardingStore.setState({ accessibilityNeeded: true });
    render(<OnboardingOverlay />);

    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }));

    expect(useOnboardingStore.getState().accessibilityNeeded).toBe(false);
    // Onboarding continues: the normal hotkey instruction is now shown.
    expect(screen.getByText(/your capture shortcut is/i)).toBeInTheDocument();
  });

  it('auto-dismisses the guidance when the grant is detected (8.2)', async () => {
    vi.spyOn(api, 'checkAccessibilityPermission').mockResolvedValue(true);
    showOverlay();
    useOnboardingStore.setState({ accessibilityNeeded: true });
    render(<OnboardingOverlay />);

    // Simulate the user returning from System Settings after granting.
    fireEvent.focus(window);

    await waitFor(() =>
      expect(useOnboardingStore.getState().accessibilityNeeded).toBe(false),
    );
    expect(screen.getByText(/your capture shortcut is/i)).toBeInTheDocument();
  });
});
