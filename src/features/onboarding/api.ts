/**
 * Backend bridge for first-run onboarding state (Epic 8 — Stories 8.1 & 8.3).
 *
 * Wraps the generated tauri-specta `commands.*` bindings (never raw `invoke()`),
 * unwrapping their `Result` shape into plain values / throws so the onboarding
 * store ({@link import('./store')}) can orchestrate against a simple Promise API.
 * The backend lives in `src-tauri/src/services/onboarding.rs`.
 */

import { commands } from '../../generated/bindings';

/** Mirror of the backend `OnboardingState` (camelCase IPC contract). */
export interface OnboardingState {
  /** True once the user has dismissed the onboarding overlay. */
  complete: boolean;
  /** Number of app sessions started (drives the early command-palette hint). */
  sessionsSeen: number;
}

/** Load persisted onboarding state from the backend. */
export async function loadOnboardingState(): Promise<OnboardingState> {
  const result = await commands.getOnboardingState();
  if (result.status === 'error') {
    throw new Error(`getOnboardingState failed: ${String(result.error)}`);
  }
  // The generated type marks fields optional (serde defaults); normalize to the
  // strict frontend contract.
  return {
    complete: result.data.complete ?? false,
    sessionsSeen: result.data.sessionsSeen ?? 0,
  };
}

/** Mark onboarding complete (persists `complete = true`). */
export async function completeOnboarding(): Promise<void> {
  const result = await commands.completeOnboarding();
  if (result.status === 'error') {
    throw new Error(`completeOnboarding failed: ${String(result.error)}`);
  }
}

/** Increment and return the persisted session counter. */
export async function incrementSession(): Promise<number> {
  const result = await commands.incrementOnboardingSession();
  if (result.status === 'error') {
    throw new Error(`incrementOnboardingSession failed: ${String(result.error)}`);
  }
  return result.data;
}
