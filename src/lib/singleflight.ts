/**
 * Keyed singleflight: collapse concurrent async calls that share a `key` into a
 * single in-flight execution.
 *
 * The first call for a key stores its promise and invokes `fn`; concurrent calls
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
 * promise and leaves no in-flight entry behind. The in-flight marker is installed
 * before `fn` runs, so same-key calls made reentrantly during `fn`'s synchronous
 * prefix still coalesce onto the first call.
 *
 * @param key   Identifies the logical operation. Same key ⇒ shared in-flight run.
 *              Callers must use a consistent `T` for a given key.
 * @param fn    The async operation to run (or share).
 * @param opts.onCoalesced Optional one-shot trailing hook: fires exactly once,
 *              after the in-flight run settles, IF at least one call coalesced
 *              onto it while it was running. The hook honored is the first hook
 *              supplied for the flight, so all calls for a key should pass the
 *              same hook. Used by the note-list refresh to schedule a single
 *              follow-up pass for events that arrived mid-flight.
 */
interface Flight<T> {
  promise: Promise<T>;
  coalesced: boolean;
  onCoalesced?: () => void;
}

const inFlight = new Map<string, Flight<unknown>>();

export function singleflight<T>(
  key: string,
  fn: () => Promise<T>,
  opts?: { onCoalesced?: () => void },
): Promise<T> {
  const existing = inFlight.get(key);
  if (existing !== undefined) {
    existing.coalesced = true;
    if (opts?.onCoalesced && existing.onCoalesced === undefined) {
      existing.onCoalesced = opts.onCoalesced;
    }
    return existing.promise as Promise<T>;
  }

  let resolveFlight!: (value: T) => void;
  let rejectFlight!: (reason?: unknown) => void;
  const flight: Flight<T> = {
    promise: new Promise<T>((resolve, reject) => {
      resolveFlight = resolve;
      rejectFlight = reject;
    }),
    coalesced: false,
    onCoalesced: opts?.onCoalesced,
  };

  inFlight.set(key, flight as Flight<unknown>);

  const finish = (): void => {
    if (inFlight.get(key) !== flight) return;
    inFlight.delete(key);
    if (flight.coalesced && flight.onCoalesced) {
      try {
        flight.onCoalesced();
      } catch (err) {
        console.error('singleflight onCoalesced failed:', err);
      }
    }
  };

  try {
    fn().then(
      (value) => {
        finish();
        resolveFlight(value);
      },
      (reason) => {
        finish();
        rejectFlight(reason);
      },
    );
  } catch (err) {
    finish();
    rejectFlight(err);
  }

  return flight.promise;
}

/**
 * Test-only: drop all in-flight entries and pending trailing markers. Invoked by
 * the global test cleanup so an in-flight dedup key never leaks between tests.
 */
export function resetSingleflight(): void {
  inFlight.clear();
}
