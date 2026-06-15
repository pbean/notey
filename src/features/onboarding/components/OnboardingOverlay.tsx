import { useOnboardingStore } from '../store';

/**
 * First-run onboarding overlay (Epic 8 — Stories 8.1, 8.2, 8.3).
 *
 * **RED-PHASE STUB** — renders nothing yet. The `describe.skip` tests in
 * `OnboardingOverlay.test.tsx` assert the full required markup; implementing it is
 * the green phase. Required when implemented:
 *  - centered dialog with `role="dialog"`, `aria-label="Welcome to Notey"`,
 *    `aria-modal="true"`, `data-testid="onboarding-overlay"` (8.1)
 *  - "Your capture shortcut is" + key-cap visualization of the hotkey with
 *    `data-testid="hotkey-display"`, then "Press it now to try" (8.1)
 *  - Esc / hotkey press → {@link useOnboardingStore.dismiss} (8.1)
 *  - "Customize" control → capture mode → {@link useOnboardingStore.applyCustomHotkey} (8.3)
 *  - macOS accessibility guidance + "Open System Settings" + skip-with-warning when
 *    {@link useOnboardingStore} `accessibilityNeeded` (8.2)
 */
export function OnboardingOverlay() {
  const isVisible = useOnboardingStore((s) => s.isVisible);
  if (!isVisible) return null;
  // TODO(Story 8.1/8.2/8.3): render the overlay described above.
  return null;
}
