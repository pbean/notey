import { commands } from '../../generated/bindings';
import { useToastStore } from '../toast/store';

/**
 * User-facing message shown when no global-shortcut backend is available on the
 * session (Story 8.6 / FR57, DW-99). The technical reason is logged to the
 * console rather than surfaced here.
 */
export const HOTKEY_UNAVAILABLE_MESSAGE =
  'Global hotkey unavailable on this system — open Notey from the tray icon.';

/**
 * Guards against re-running the one-shot startup check. React StrictMode mounts
 * the root effect twice in development, and the check should query status and
 * raise the notice at most once per session.
 */
let started = false;

/**
 * Pull the global-shortcut backend status on startup and, when no backend is
 * available, raise a persistent toast telling the user the hotkey will not work
 * and that they can summon Notey from the tray icon.
 *
 * Pull (not a backend event) because the status is decided in the Rust `setup`
 * hook before the startup-hidden webview attaches any listener — a `setup`-time
 * event would be dropped. The toast is persistent (`durationMs <= 0`) so it
 * survives until the user actually opens the window and dismisses it by clicking.
 *
 * Best-effort and idempotent: a failed status query or toast must never block
 * startup, and duplicate invocations raise the notice at most once.
 */
export async function startHotkeyUnavailableNotice(): Promise<void> {
  if (started) return;
  started = true;

  try {
    const status = await commands.getHotkeyStatus();
    if (!status.available) {
      if (status.reason) {
        console.warn(`Global hotkey unavailable: ${status.reason}`);
      }
      // Persistent toast (no auto-dismiss); the user clears it by clicking.
      useToastStore.getState().addToast(HOTKEY_UNAVAILABLE_MESSAGE, 0);
    }
  } catch (e) {
    console.error('hotkey status check failed:', e);
  }
}

/**
 * Reset the one-shot guard. Test-only — production code calls
 * {@link startHotkeyUnavailableNotice} exactly once at startup.
 */
export function resetHotkeyUnavailableNotice(): void {
  started = false;
}
