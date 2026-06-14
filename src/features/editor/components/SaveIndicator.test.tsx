import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useEditorStore } from '../store';
import { SaveIndicator } from './SaveIndicator';

/**
 * Story 7.8 (WCAG 2.1 AA) — the save status must be exposed through ONE
 * persistent `aria-live="polite"` region that stays mounted across every state
 * (including idle), so a screen reader reliably announces the change. State is
 * also conveyed by WORD ("Saving..." / "Saved" / "Save failed"), never by color
 * alone.
 */
describe('SaveIndicator', () => {
  beforeEach(() => {
    useEditorStore.setState({ saveStatus: 'idle' });
  });

  afterEach(() => {
    vi.useRealTimers();
    useEditorStore.setState({ saveStatus: 'idle' });
  });

  it('mounts a persistent polite live region even when idle', () => {
    render(<SaveIndicator />);
    const live = screen.getByTestId('save-indicator-live');
    expect(live).toBeDefined();
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.getAttribute('aria-atomic')).toBe('true');
    // Idle = mounted but empty: no announcement, no visible text.
    expect(live.textContent).toBe('');
    expect(screen.queryByTestId('save-indicator')).toBeNull();
  });

  it('keeps ONE mounted live region across status transitions', () => {
    vi.useFakeTimers();
    render(<SaveIndicator />);
    const liveAtIdle = screen.getByTestId('save-indicator-live');

    // idle → saving: the "Saving..." word appears only after the 200ms delay.
    act(() => {
      useEditorStore.setState({ saveStatus: 'saving' });
    });
    expect(screen.queryByText('Saving...')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByText('Saving...')).toBeDefined();

    // saving → saved → failed: same region instance updates its text.
    act(() => {
      useEditorStore.setState({ saveStatus: 'saved' });
    });
    expect(screen.getByText('Saved')).toBeDefined();
    act(() => {
      useEditorStore.setState({ saveStatus: 'failed' });
    });
    expect(screen.getByText('Save failed')).toBeDefined();

    // The live region node is the SAME element throughout — never remounted.
    expect(screen.getByTestId('save-indicator-live')).toBe(liveAtIdle);
  });

  it('hides "Saving..." on a fast save (under the 200ms delay)', () => {
    vi.useFakeTimers();
    render(<SaveIndicator />);
    act(() => {
      useEditorStore.setState({ saveStatus: 'saving' });
    });
    // Save resolves before the 200ms threshold — "Saving..." never shows.
    act(() => {
      vi.advanceTimersByTime(150);
      useEditorStore.setState({ saveStatus: 'saved' });
      vi.advanceTimersByTime(100);
    });
    expect(screen.queryByText('Saving...')).toBeNull();
    expect(screen.getByText('Saved')).toBeDefined();
  });

  it('keeps "Save failed" visible until the retry succeeds', () => {
    vi.useFakeTimers();
    useEditorStore.setState({ saveStatus: 'failed' });
    render(<SaveIndicator />);
    expect(screen.getByText('Save failed')).toBeDefined();

    act(() => {
      useEditorStore.setState({ saveStatus: 'saving' });
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByText('Save failed')).toBeDefined();
    expect(screen.queryByText('Saving...')).toBeNull();

    act(() => {
      useEditorStore.setState({ saveStatus: 'saved' });
    });
    expect(screen.getByText('Saved')).toBeDefined();
  });

  it('conveys "saved" by word (color-independent)', () => {
    useEditorStore.setState({ saveStatus: 'saved' });
    render(<SaveIndicator />);
    expect(screen.getByText('Saved')).toBeDefined();
  });

  it('conveys "failed" by word (color-independent)', () => {
    useEditorStore.setState({ saveStatus: 'failed' });
    render(<SaveIndicator />);
    expect(screen.getByText('Save failed')).toBeDefined();
  });
});
