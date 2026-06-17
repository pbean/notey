import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { commands, type HotkeyStatus } from '../../generated/bindings';
import { useToastStore } from '../toast/store';
import {
  startHotkeyUnavailableNotice,
  resetHotkeyUnavailableNotice,
  HOTKEY_UNAVAILABLE_MESSAGE,
} from './unavailableNotice';

describe('startHotkeyUnavailableNotice', () => {
  let getStatusSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetHotkeyUnavailableNotice();
    useToastStore.getState().reset();
    getStatusSpy = vi.spyOn(commands, 'getHotkeyStatus');
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useToastStore.getState().reset();
  });

  function mockStatus(status: HotkeyStatus): void {
    getStatusSpy.mockResolvedValue(status);
  }

  it('raises a persistent toast and logs the reason when unavailable', async () => {
    mockStatus({ available: false, reason: 'no portal backend' });

    await startHotkeyUnavailableNotice();

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe(HOTKEY_UNAVAILABLE_MESSAGE);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('no portal backend'),
    );
  });

  it('persists the toast (no auto-dismiss) past the default duration', async () => {
    vi.useFakeTimers();
    mockStatus({ available: false, reason: 'no portal backend' });

    await startHotkeyUnavailableNotice();
    // Advance well beyond the default 3s auto-dismiss window.
    vi.advanceTimersByTime(60_000);

    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.useRealTimers();
  });

  it('shows no toast when the hotkey is available', async () => {
    mockStatus({ available: true, reason: null });

    await startHotkeyUnavailableNotice();

    expect(useToastStore.getState().toasts).toHaveLength(0);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('shows the toast but skips the warn when reason is null', async () => {
    mockStatus({ available: false, reason: null });

    await startHotkeyUnavailableNotice();

    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('is idempotent across duplicate startup invocations', async () => {
    mockStatus({ available: false, reason: 'no portal backend' });

    await startHotkeyUnavailableNotice();
    await startHotkeyUnavailableNotice();

    expect(getStatusSpy).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('swallows and logs a status-query rejection without showing a toast', async () => {
    getStatusSpy.mockRejectedValue(new Error('ipc down'));

    await expect(startHotkeyUnavailableNotice()).resolves.toBeUndefined();

    expect(useToastStore.getState().toasts).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalled();
  });
});
