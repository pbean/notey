import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  withTimeout,
  IpcTimeoutError,
  IPC_TIMEOUT_MS,
} from './withTimeout';

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

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with the operation value when it settles before the timeout', async () => {
    const d = deferred<number>();
    const wrapped = withTimeout(d.promise);

    d.resolve(42);
    await expect(wrapped).resolves.toBe(42);
  });

  it('rejects with the operation reason when it rejects before the timeout', async () => {
    const d = deferred<number>();
    const wrapped = withTimeout(d.promise);
    const boom = new Error('invoke failed');

    d.reject(boom);
    await expect(wrapped).rejects.toBe(boom);
  });

  it('rejects with IpcTimeoutError when the operation never settles', async () => {
    const d = deferred<number>();
    const wrapped = withTimeout(d.promise, { label: 'create_note' });
    // Surface the eventual rejection before advancing timers so the rejection
    // is observed (avoids an unhandled-rejection warning under fake timers).
    const assertion = expect(wrapped).rejects.toBeInstanceOf(IpcTimeoutError);

    await vi.advanceTimersByTimeAsync(IPC_TIMEOUT_MS);
    await assertion;
    // d.promise is intentionally left pending — it models a hung invoke.
  });

  it('clears the timer once the operation resolves (no leaked timeout)', async () => {
    const d = deferred<number>();
    const wrapped = withTimeout(d.promise);

    d.resolve(1);
    await wrapped;

    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not double-settle or throw when the operation settles after the timeout', async () => {
    const d = deferred<number>();
    const wrapped = withTimeout(d.promise, { timeoutMs: 1000 });
    const assertion = expect(wrapped).rejects.toBeInstanceOf(IpcTimeoutError);

    await vi.advanceTimersByTimeAsync(1000);
    await assertion;

    // A late settlement of the (already-lost) operation must be a harmless
    // no-op: no unhandled rejection, no second settlement of `wrapped`.
    d.reject(new Error('late failure'));
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('honors a custom timeoutMs', async () => {
    const d = deferred<number>();
    const wrapped = withTimeout(d.promise, { timeoutMs: 250 });
    const assertion = expect(wrapped).rejects.toBeInstanceOf(IpcTimeoutError);

    // Not yet elapsed at the default bound's earlier point...
    await vi.advanceTimersByTimeAsync(249);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(1);
    await assertion;
  });

  it('includes the label and bound in the timeout message', async () => {
    const d = deferred<number>();
    const wrapped = withTimeout(d.promise, { label: 'export_json', timeoutMs: 500 });
    const assertion = wrapped.then(
      () => {
        throw new Error('expected a timeout rejection');
      },
      (e: unknown) => e as Error,
    );

    await vi.advanceTimersByTimeAsync(500);
    const err = await assertion;
    expect(err.message).toContain('export_json');
    expect(err.message).toContain('500');
  });
});
