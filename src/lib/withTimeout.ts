/**
 * Default bound on a single Tauri IPC round-trip, mirroring the CLI's 5s
 * connect/round-trip timeout (Story 6.7). Notey commands are quick local-SQLite
 * operations, so a round-trip that has not settled in 5s is treated as a hung
 * IPC promise rather than slow work.
 */
export const IPC_TIMEOUT_MS = 5000;

/**
 * Generous bound for the long-running export commands (`export_markdown` /
 * `export_json`), which write one file per note and can legitimately run for
 * many seconds on a large workspace. The bound is not about latency — it exists
 * only so a genuinely hung export promise still settles and releases its
 * `singleflight` key instead of disabling export until reload.
 */
export const EXPORT_IPC_TIMEOUT_MS = 60_000;

/**
 * Rejection raised by {@link withTimeout} when the wrapped operation does not
 * settle within its bound. Distinct from any backend `NoteyError` so callers'
 * existing error paths log it as just another invoke failure.
 */
export class IpcTimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`IPC operation "${label}" timed out after ${timeoutMs}ms`);
    this.name = 'IpcTimeoutError';
  }
}

/**
 * Race a Tauri IPC promise against a timeout so it always settles.
 *
 * The shared `singleflight` helper only releases an in-flight key once its
 * wrapped operation settles; a Tauri invoke promise that never settles would
 * therefore wedge that key forever (see DW-90). Wrapping the invoke with
 * `withTimeout` guarantees the operation settles — either with the invoke's own
 * result/rejection, or with an {@link IpcTimeoutError} once the bound elapses —
 * so the `singleflight` `finally` always runs. `singleflight` itself stays
 * timer-free.
 *
 * This is a frontend-side bound: it stops the UI awaiting a dead promise, but it
 * cannot cancel the backend command, which may still complete. The timer is
 * always cleared once `operation` settles, win or lose the race, so no timer
 * leaks and a late settlement after the timeout neither double-settles the
 * returned promise nor surfaces an unhandled rejection.
 *
 * Do NOT wrap native dialog promises (`save`/`open`): those legitimately wait on
 * the user and must not be bounded.
 *
 * @param operation The IPC promise to bound (typically a generated `commands.*` call).
 * @param opts.timeoutMs Bound in milliseconds; defaults to {@link IPC_TIMEOUT_MS}.
 * @param opts.label     Human-readable name for the operation, used in the timeout message.
 * @returns A promise that settles with `operation`'s result, or rejects with
 *          {@link IpcTimeoutError} if the bound elapses first.
 */
export function withTimeout<T>(
  operation: Promise<T>,
  opts?: { timeoutMs?: number; label?: string },
): Promise<T> {
  const timeoutMs = opts?.timeoutMs ?? IPC_TIMEOUT_MS;
  const label = opts?.label ?? 'ipc';

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new IpcTimeoutError(label, timeoutMs));
    }, timeoutMs);

    // Attaching handlers here (rather than racing a separate promise) means a
    // rejection from `operation` is always observed — never an unhandled
    // rejection — even if the timeout already won the race. The timer is cleared
    // synchronously with settlement, so it is gone the moment the returned
    // promise settles. Once the outer promise has settled, these resolve/reject
    // calls are inert no-ops, so a late settlement neither double-settles nor
    // throws.
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (reason) => {
        clearTimeout(timer);
        reject(reason);
      },
    );
  });
}
