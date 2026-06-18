import { check } from "@tauri-apps/plugin-updater";
import { useUpdateStore } from "./store";

/**
 * True when running inside the Tauri webview (as opposed to jsdom unit tests or
 * a plain browser). The updater plugin's `check()` reaches the OS over IPC, so
 * the startup probe must be skipped anywhere `__TAURI_INTERNALS__` is absent.
 */
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Guards against re-running the one-shot startup check. React StrictMode mounts
 * the root effect twice in development; the update probe should fire at most
 * once per session.
 */
let started = false;

/**
 * Probe the configured GitHub Releases `latest.json` endpoint on startup and,
 * when a newer signed build exists, record it so {@link UpdateBanner} offers an
 * in-app install. No-op outside Tauri.
 *
 * Best-effort and idempotent: a network error, a missing/draft release (404),
 * or "already up to date" must never block startup or surface an error — the
 * banner only appears when there is genuinely something to install. The check
 * is deliberately not awaited by the caller.
 */
export async function checkForUpdates(): Promise<void> {
  if (started || !isTauri()) return;
  started = true;

  try {
    const update = await check();
    if (update?.available) {
      useUpdateStore.getState().setAvailable(update);
    }
  } catch (e) {
    // Swallow: no endpoint yet, offline, or up to date — none are user-facing.
    console.warn("update check failed:", e);
  }
}

/**
 * Reset the one-shot guard. Test-only — production code calls
 * {@link checkForUpdates} exactly once at startup.
 */
export function resetUpdateCheck(): void {
  started = false;
}
