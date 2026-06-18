import { create } from 'zustand';
import { useSettingsStore } from '../settings/store';
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
  /** Leave hotkey capture mode without changing the shortcut (Story 8.3). */
  cancelCustomize: () => void;
  /**
   * Register + persist a captured shortcut through the shared Epic 7 path and,
   * on success, adopt it as the displayed hotkey and leave capture mode (Story
   * 8.3). On a conflict/failure the previous shortcut stays registered and
   * capture mode is kept so the user can retry. Resolves `true` on success,
   * `false` on conflict/error.
   */
  applyCustomHotkey: (combo: string) => Promise<boolean>;
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
 * Persistence is delegated to the {@link import('./api')} bridge (onboarding
 * completion + session count) and, for hotkey customization (Story 8.3), to the
 * shared Settings {@link useSettingsStore.setGlobalShortcut} register-before-commit
 * path. The transitions are asserted by `store.test.ts`.
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
  cancelCustomize: () => set({ customizing: false }),
  applyCustomHotkey: async (combo) => {
    // Reuse Settings' register-before-commit path (Epic 7): it validates,
    // registers the new shortcut, unregisters the old, persists, and reports a
    // conflict by resolving `false` — so onboarding never reimplements that logic.
    const ok = await useSettingsStore.getState().setGlobalShortcut(combo);
    if (ok) {
      set({ hotkey: combo, customizing: false });
    }
    return ok;
  },
  setAccessibilityNeeded: (needed) => set({ accessibilityNeeded: needed }),
  shouldShowCommandHint: () =>
    get().initialized && get().sessionsSeen < COMMAND_HINT_SESSION_LIMIT,
  reset: () => set({ ...INITIAL }),
}));
