import { describe, it, expect, vi, beforeEach } from 'vitest';
import { singleflight, resetSingleflight } from './singleflight';

/** A promise whose settlement the test controls. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('singleflight', () => {
  beforeEach(() => {
    resetSingleflight();
  });

  it('runs fn and returns its result for the first call', async () => {
    const fn = vi.fn(async () => 42);
    await expect(singleflight('k', fn)).resolves.toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent same-key calls onto one shared result', async () => {
    const d = deferred<number>();
    const fn = vi.fn(() => d.promise);

    const a = singleflight('k', fn);
    const b = singleflight('k', fn);

    expect(a).toBe(b); // same promise instance handed to both callers
    expect(fn).toHaveBeenCalledTimes(1);

    d.resolve(7);
    await expect(a).resolves.toBe(7);
    await expect(b).resolves.toBe(7);
  });

  it('runs independent keys concurrently', async () => {
    const f1 = vi.fn(async () => 'a');
    const f2 = vi.fn(async () => 'b');

    const [r1, r2] = await Promise.all([
      singleflight('k1', f1),
      singleflight('k2', f2),
    ]);

    expect(r1).toBe('a');
    expect(r2).toBe('b');
    expect(f1).toHaveBeenCalledTimes(1);
    expect(f2).toHaveBeenCalledTimes(1);
  });

  it('clears the key on rejection so the next call re-runs fn', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('ok');

    await expect(singleflight('k', fn)).rejects.toThrow('boom');
    await expect(singleflight('k', fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('re-runs fn for a sequential call after the prior settled', async () => {
    const fn = vi.fn(async () => 'x');
    await singleflight('k', fn);
    await singleflight('k', fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('surfaces a synchronous throw as a rejection and leaves no in-flight entry', async () => {
    const throwing = (): Promise<void> => {
      throw new Error('sync-boom');
    };
    await expect(singleflight('k', throwing)).rejects.toThrow('sync-boom');

    // Key was never wedged: a subsequent call runs fresh.
    const ok = vi.fn(async () => 'recovered');
    await expect(singleflight('k', ok)).resolves.toBe('recovered');
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('fires onCoalesced exactly once when calls coalesced mid-flight', async () => {
    const d = deferred<void>();
    const fn = vi.fn(() => d.promise);
    const onCoalesced = vi.fn();

    const a = singleflight('k', fn, { onCoalesced });
    singleflight('k', fn, { onCoalesced });
    singleflight('k', fn, { onCoalesced });

    expect(onCoalesced).not.toHaveBeenCalled(); // not until the run settles

    d.resolve();
    await a;

    expect(fn).toHaveBeenCalledTimes(1);
    expect(onCoalesced).toHaveBeenCalledTimes(1);
  });

  it('does not fire onCoalesced when no call coalesced', async () => {
    const onCoalesced = vi.fn();
    await singleflight('k', async () => undefined, { onCoalesced });
    expect(onCoalesced).not.toHaveBeenCalled();
  });

  it('fires onCoalesced even after the in-flight run rejects', async () => {
    const d = deferred<void>();
    const fn = vi.fn(() => d.promise);
    const onCoalesced = vi.fn();

    const a = singleflight('k', fn, { onCoalesced });
    singleflight('k', fn, { onCoalesced });

    d.reject(new Error('boom'));
    await expect(a).rejects.toThrow('boom');

    expect(onCoalesced).toHaveBeenCalledTimes(1);
  });

  it('resetSingleflight drops in-flight state so the key starts fresh', async () => {
    const d = deferred<number>();
    singleflight('k', () => d.promise);

    resetSingleflight();

    const fn2 = vi.fn(async () => 2);
    await expect(singleflight('k', fn2)).resolves.toBe(2);
    expect(fn2).toHaveBeenCalledTimes(1);

    d.resolve(1); // settle the orphaned promise for a clean test exit
  });
});
