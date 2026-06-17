import { create } from 'zustand';
import { completeOnboarding, loadOnboardingState } from './api';

/**
 * Number of early sessions during which the "Ctrl+P for commands" status-bar hint
 * is shown (Story 8.1 progressive disclosure). Mirrors the backend
 * `COMMAND_HINT_SESSION_LIMIT`.
 */
export const COMMAND_HINT_SESSION_LIMIT = 5;

/** First-run onboarding overlay state. */
interface OnboardingStateShape {
  /** Whether the onboarding overlay is currently shown. */
  isVisible: boolean;
  /** The capture hotkey rendered as key caps (e.g. `Ctrl+Shift+N`). */
  hotkey: string;
  /** Whether the user is in "press your preferred shortcut" capture mode (8.3). */
  customizing: boolean;
  /** macOS only: accessibility permission not yet granted, show guidance (8.2). */
  accessibilityNeeded: boolean;
  /** Persisted session count, used to retire the command hint. */
  sessionsSeen: number;
  /** Whether persisted onboarding state has been loaded for this session. */
  initialized: boolean;
}

/** Onboarding actions. */
interface OnboardingActions {
  /**
   * Load persisted state and decide whether to show the overlay. Shows it only
   * on first run (when `complete` is false), seeding the displayed hotkey.
   */
  init: (hotkey: string) => Promise<void>;
  /** Dismiss the overlay and persist completion (hotkey press or Esc). */
  dismiss: () => Promise<void>;
  /** Enter hotkey capture mode (Story 8.3 "Customize"). */
  startCustomize: () => void;
  /** Apply a captured shortcut and leave capture mode (Story 8.3). */
  applyCustomHotkey: (combo: string) => void;
  /** Set whether macOS accessibility guidance should be shown (Story 8.2). */
  setAccessibilityNeeded: (needed: boolean) => void;
  /** Whether the early command-palette hint should still be shown. */
  shouldShowCommandHint: () => boolean;
  /** Reset to initial state (test cleanup). */
  reset: () => void;
}

const INITIAL: OnboardingStateShape = {
  isVisible: false,
  hotkey: '',
  customizing: false,
  accessibilityNeeded: false,
  sessionsSeen: 0,
  initialized: false,
};

/**
 * Per-feature store for the first-run onboarding flow.
 *
 * RED-PHASE NOTE: the orchestration here is real; it delegates persistence to the
 * stubbed {@link import('./api')} bridge, which throws until the green phase. The
 * `describe.skip` tests in `store.test.ts` assert these transitions.
 */
export const useOnboardingStore = create<
  OnboardingStateShape & OnboardingActions
>((set, get) => ({
  ...INITIAL,
  init: async (hotkey) => {
    const state = await loadOnboardingState();
    set({
      hotkey,
      sessionsSeen: state.sessionsSeen,
      isVisible: !state.complete,
      initialized: true,
    });
  },
  dismiss: async () => {
    try {
      await completeOnboarding();
    } catch (e) {
      console.error('completeOnboarding failed during dismiss:', e);
    } finally {
      set({ isVisible: false, customizing: false });
    }
  },
  startCustomize: () => set({ customizing: true }),
  applyCustomHotkey: (combo) => set({ hotkey: combo, customizing: false }),
  setAccessibilityNeeded: (needed) => set({ accessibilityNeeded: needed }),
  shouldShowCommandHint: () =>
    get().initialized && get().sessionsSeen < COMMAND_HINT_SESSION_LIMIT,
  reset: () => set({ ...INITIAL }),
}));
