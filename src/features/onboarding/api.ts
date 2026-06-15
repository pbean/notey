/**
 * Backend bridge for first-run onboarding state (Epic 8 — Stories 8.1 & 8.3).
 *
 * **RED-PHASE STUB.** These functions are the minimal green-phase surface: the
 * onboarding store ({@link import('./store')}) orchestrates against them, and the
 * `describe.skip` tests assert that orchestration. Each throws until implemented.
 *
 * Green-phase wiring: replace the throws with calls to the generated tauri-specta
 * bindings — `commands.getOnboardingState()` and `commands.completeOnboarding()`
 * (add those Tauri commands + permissions first; see
 * `src-tauri/src/services/onboarding.rs`). Per project rules, NEVER use raw
 * `invoke()` — only generated `commands.*`.
 */

/** Mirror of the backend `OnboardingState` (camelCase IPC contract). */
export interface OnboardingState {
  /** True once the user has dismissed the onboarding overlay. */
  complete: boolean;
  /** Number of app sessions started (drives the early command-palette hint). */
  sessionsSeen: number;
}

const NOT_IMPLEMENTED = 'not implemented: Epic 8 green phase';

/** Load persisted onboarding state from the backend. */
export async function loadOnboardingState(): Promise<OnboardingState> {
  // Green phase: const r = await commands.getOnboardingState(); return r...;
  throw new Error(NOT_IMPLEMENTED);
}

/** Mark onboarding complete (persists `complete = true`). */
export async function completeOnboarding(): Promise<void> {
  // Green phase: await commands.completeOnboarding();
  throw new Error(NOT_IMPLEMENTED);
}

/** Increment and return the persisted session counter. */
export async function incrementSession(): Promise<number> {
  // Green phase: return (await commands.incrementOnboardingSession());
  throw new Error(NOT_IMPLEMENTED);
}
