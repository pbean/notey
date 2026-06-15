/**
 * Keyed singleflight: collapse concurrent async calls that share a `key` into a
 * single in-flight execution.
 *
 * The first call for a key invokes `fn` and stores its promise; concurrent calls
 * for the same in-flight key receive that **same** promise — and therefore the
 * same resolved value or rejection — without invoking `fn` again. The in-flight
 * entry is removed once the promise settles, in a `finally`, so a rejection can
 * never wedge a key: the next call after settlement runs `fn` afresh.
 *
 * This replaces the hand-rolled module-level boolean guards (`isExporting`,
 * `isCreatingNote`, `refreshInFlight`, …) scattered across the frontend. Unlike
 * those guards, a coalesced caller is never handed an ambiguous `null`/`void`
 * "you were deduped" sentinel — it awaits and observes the genuine result of the
 * single in-flight run, which retires the dedup→false-toast bug class.
 *
 * `fn` is invoked eagerly (synchronously up to its first `await`), matching the
 * timing of the guards it replaces; a synchronous throw is surfaced as a rejected
 * promise and leaves no in-flight entry behind.
 *
 * @param key   Identifies the logical operation. Same key ⇒ shared in-flight run.
 *              Callers must use a consistent `T` for a given key.
 * @param fn    The async operation to run (or share).
 * @param opts.onCoalesced Optional one-shot trailing hook: fires exactly once,
 *              after the in-flight run settles, IF at least one call coalesced
 *              onto it while it was running. The hook honored is the one supplied
 *              by the call that *started* the flight; a coalescing caller's own
 *              `onCoalesced` only arms (not replaces) it, so all calls for a key
 *              should pass the same hook. Used by the note-list refresh to
 *              schedule a single follow-up pass for events that arrived mid-flight.
 */
const inFlight = new Map<string, Promise<unknown>>();
const coalesced = new Set<string>();

export function singleflight<T>(
  key: string,
  fn: () => Promise<T>,
  opts?: { onCoalesced?: () => void },
): Promise<T> {
  const existing = inFlight.get(key);
  if (existing !== undefined) {
    if (opts?.onCoalesced) coalesced.add(key);
    return existing as Promise<T>;
  }

  let started: Promise<T>;
  try {
    started = fn();
  } catch (err) {
    // Synchronous throw: nothing entered flight, surface as a rejection.
    return Promise.reject(err);
  }

  const tracked = started.finally(() => {
    inFlight.delete(key);
    if (coalesced.delete(key)) opts?.onCoalesced?.();
  });

  inFlight.set(key, tracked);
  return tracked;
}

/**
 * Test-only: drop all in-flight entries and pending trailing markers. Invoked by
 * the global test cleanup so an in-flight dedup key never leaks between tests.
 */
export function resetSingleflight(): void {
  inFlight.clear();
  coalesced.clear();
}
