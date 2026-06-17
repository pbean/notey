import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useOnboardingStore, COMMAND_HINT_SESSION_LIMIT } from './store';
import * as api from './api';

/**
 * ATDD red-phase acceptance tests — Stories 8.1 & 8.3 (onboarding store logic).
 *
 * `describe.skip` keeps these inert (the store delegates persistence to the
 * stubbed `./api`, which throws until the green phase). Activate by switching
 * `describe.skip` → `describe` once `./api` is wired to the generated bindings.
 */
describe('useOnboardingStore (red-phase: Stories 8.1, 8.3)', () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
    vi.restoreAllMocks();
  });

  it('shows the overlay on first run and seeds the hotkey (8.1)', async () => {
    vi.spyOn(api, 'loadOnboardingState').mockResolvedValue({
      complete: false,
      sessionsSeen: 0,
    });

    await useOnboardingStore.getState().init('Ctrl+Shift+N');

    const s = useOnboardingStore.getState();
    expect(s.isVisible).toBe(true);
    expect(s.hotkey).toBe('Ctrl+Shift+N');
  });

  it('keeps the overlay hidden when onboarding is already complete (8.1)', async () => {
    vi.spyOn(api, 'loadOnboardingState').mockResolvedValue({
      complete: true,
      sessionsSeen: 3,
    });

    await useOnboardingStore.getState().init('Ctrl+Shift+N');

    expect(useOnboardingStore.getState().isVisible).toBe(false);
  });

  it('dismiss persists completion and hides the overlay (8.1)', async () => {
    const complete = vi.spyOn(api, 'completeOnboarding').mockResolvedValue();
    useOnboardingStore.setState({ isVisible: true });

    await useOnboardingStore.getState().dismiss();

    expect(complete).toHaveBeenCalledOnce();
    expect(useOnboardingStore.getState().isVisible).toBe(false);
  });

  it('dismiss logs persistence failure but still hides the overlay (8.1)', async () => {
    vi.spyOn(api, 'completeOnboarding').mockRejectedValue(
      new Error('disk full'),
    );
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    useOnboardingStore.setState({ isVisible: true, customizing: true });

    await useOnboardingStore.getState().dismiss();

    expect(consoleError).toHaveBeenCalledWith(
      'completeOnboarding failed during dismiss:',
      expect.any(Error),
    );
    expect(useOnboardingStore.getState().isVisible).toBe(false);
    expect(useOnboardingStore.getState().customizing).toBe(false);
  });

  it('startCustomize enters capture mode (8.3)', () => {
    useOnboardingStore.getState().startCustomize();
    expect(useOnboardingStore.getState().customizing).toBe(true);
  });

  it('applyCustomHotkey updates the displayed shortcut and exits capture mode (8.3)', () => {
    useOnboardingStore.setState({ customizing: true, hotkey: 'Ctrl+Shift+N' });

    useOnboardingStore.getState().applyCustomHotkey('Alt+Space');

    const s = useOnboardingStore.getState();
    expect(s.hotkey).toBe('Alt+Space');
    expect(s.customizing).toBe(false);
  });

  it('shows the command hint only within the first 5 sessions (8.1)', () => {
    useOnboardingStore.setState({
      initialized: true,
      sessionsSeen: COMMAND_HINT_SESSION_LIMIT - 1,
    });
    expect(useOnboardingStore.getState().shouldShowCommandHint()).toBe(true);

    useOnboardingStore.setState({ sessionsSeen: COMMAND_HINT_SESSION_LIMIT });
    expect(useOnboardingStore.getState().shouldShowCommandHint()).toBe(false);
  });

  it('does not show the command hint before onboarding state loads (8.1)', () => {
    useOnboardingStore.setState({ initialized: false, sessionsSeen: 0 });
    expect(useOnboardingStore.getState().shouldShowCommandHint()).toBe(false);
  });

  it('flags macOS accessibility guidance when required (8.2)', () => {
    useOnboardingStore.getState().setAccessibilityNeeded(true);
    expect(useOnboardingStore.getState().accessibilityNeeded).toBe(true);
  });
});
