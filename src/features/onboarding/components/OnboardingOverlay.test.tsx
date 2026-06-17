import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useOnboardingStore } from '../store';
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
});
