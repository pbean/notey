import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useToastStore, DEFAULT_TOAST_DURATION_MS } from './store';

describe('useToastStore', () => {
  beforeEach(() => {
    useToastStore.getState().reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with no toasts', () => {
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('addToast appends a toast with the given message', () => {
    useToastStore.getState().addToast('Note moved to trash');
    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Note moved to trash');
  });

  it('assigns unique ids to successive toasts', () => {
    const id1 = useToastStore.getState().addToast('first');
    const id2 = useToastStore.getState().addToast('second');
    expect(id1).not.toBe(id2);
    const ids = useToastStore.getState().toasts.map((t) => t.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('auto-dismisses a toast after the default 3s duration', () => {
    useToastStore.getState().addToast('Note moved to trash');
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(DEFAULT_TOAST_DURATION_MS - 1);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('honors a custom duration', () => {
    useToastStore.getState().addToast('quick', 1000);
    vi.advanceTimersByTime(999);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('dismissToast removes the matching toast and leaves others', () => {
    const id1 = useToastStore.getState().addToast('keep');
    const id2 = useToastStore.getState().addToast('drop');
    useToastStore.getState().dismissToast(id2);
    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].id).toBe(id1);
  });

  it('dismissToast is idempotent for an unknown id', () => {
    useToastStore.getState().addToast('only');
    useToastStore.getState().dismissToast(99999);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });
});
