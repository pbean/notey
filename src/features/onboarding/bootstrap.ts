import { commands } from '../../generated/bindings';
import { platformDefaultShortcut } from '../settings/shortcut';
import { checkAccessibilityPermission, incrementSession } from './api';
import { useOnboardingStore } from './store';

/**
 * Guards against double-counting a session under React StrictMode's double-mount
 * (module-level, mirroring the theme-listener guard in command-palette/actions).
 */
let sessionRecorded = false;

/** Resets the session-recorded guard. Test-only. */
export function resetOnboardingBootstrap(): void {
  sessionRecorded = false;
}

/**
 * First-run onboarding startup wiring. Reads the configured capture hotkey, loads
 * persisted onboarding state into the store (which decides whether to show the
 * overlay and seeds the command-hint session count), then records this launch so
 * the count advances for the next one.
 *
 * Order matters: {@link useOnboardingStore.init} reads the *prior* session count
 * to gate the hint (shown while `sessionsSeen < 5`), and the increment here bumps
 * the persisted count for the next launch — so the hint shows for the first five
 * sessions. The increment is best-effort and never blocks startup.
 */
export async function initOnboarding(): Promise<void> {
  let hotkey = platformDefaultShortcut();
  try {
    const configResult = await commands.getConfig();
    if (configResult.status === 'ok') {
      hotkey =
        configResult.data.hotkey?.globalShortcut || platformDefaultShortcut();
    } else {
      console.error('initOnboarding: getConfig failed:', configResult.error);
    }
  } catch (e) {
    console.error('initOnboarding: getConfig threw:', e);
  }

  try {
    await useOnboardingStore.getState().init(hotkey);
  } catch (e) {
    console.error('initOnboarding: store init failed:', e);
  }

  // First-run only: detect a missing macOS accessibility grant so the overlay can
  // show its guidance (Story 8.2). Best-effort — a failed check is treated as
  // "granted" so onboarding is never blocked. Off macOS the backend reports
  // granted, so this is a no-op and the step is skipped entirely.
  if (useOnboardingStore.getState().isVisible) {
    try {
      const granted = await checkAccessibilityPermission();
      useOnboardingStore.getState().setAccessibilityNeeded(!granted);
    } catch (e) {
      console.error('initOnboarding: accessibility check failed:', e);
    }
  }

  if (!sessionRecorded) {
    sessionRecorded = true;
    try {
      await incrementSession();
    } catch (e) {
      console.error('initOnboarding: incrementSession failed:', e);
    }
  }
}
