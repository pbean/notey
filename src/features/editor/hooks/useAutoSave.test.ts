import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { mockInvoke } from '../../../test-utils/setup';
import { useEditorStore } from '../store';
import { useWorkspaceStore } from '../../workspace/store';
import { useAutoSave, flushSave } from './useAutoSave';
import { buildNote } from '../../../test-utils/factories';

const testNote = buildNote({ id: 1, updatedAt: '2026-01-01T00:00:00+00:00' });

function mockCreateAndUpdate() {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'create_note') return Promise.resolve(testNote);
    if (cmd === 'update_note') return Promise.resolve(testNote);
    return Promise.reject(new Error(`unmocked: ${cmd}`));
  });
}

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useEditorStore.getState().resetNote();
    useWorkspaceStore.setState({ activeWorkspaceId: null, activeWorkspaceName: null });
    mockCreateAndUpdate();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // P0-INT-001: Auto-save persists within 500ms debounced
  it('triggers save within 500ms of content change', async () => {
    renderHook(() => useAutoSave());

    // Simulate content change
    act(() => {
      useEditorStore.getState().setContent('Hello world');
    });

    // At 299ms, save should not have fired yet
    await act(async () => {
      vi.advanceTimersByTime(299);
    });
    expect(mockInvoke).not.toHaveBeenCalledWith('update_note', expect.anything());

    // At 300ms, debounce fires (within 500ms budget)
    await act(async () => {
      vi.advanceTimersByTime(1);
      // Flush microtask queue for async callbacks
      await vi.runAllTimersAsync();
    });

    expect(mockInvoke).toHaveBeenCalledWith('create_note', expect.anything());
  });

  // Gap: auto-save passes workspaceId from workspace store to createNote
  it('passes activeWorkspaceId to createNote', async () => {
    useWorkspaceStore.getState().setActiveWorkspace(42, 'my-project');
    renderHook(() => useAutoSave());

    act(() => {
      useEditorStore.getState().setContent('workspace test');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(mockInvoke).toHaveBeenCalledWith('create_note', { format: 'markdown', workspaceId: 42 });
  });

  // Gap: auto-save passes null workspaceId when no workspace is active
  it('passes null workspaceId when no workspace is active', async () => {
    renderHook(() => useAutoSave());

    act(() => {
      useEditorStore.getState().setContent('no workspace');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(mockInvoke).toHaveBeenCalledWith('create_note', { format: 'markdown', workspaceId: null });
  });
});

describe('flushSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useEditorStore.getState().resetNote();
    useWorkspaceStore.setState({ activeWorkspaceId: null, activeWorkspaceName: null });
    mockCreateAndUpdate();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // P1-INT-011: flushSave bypasses debounce
  it('saves immediately without waiting for debounce', async () => {
    useEditorStore.getState().setContent('Flush me');

    await act(async () => {
      await flushSave();
    });

    expect(mockInvoke).toHaveBeenCalledWith('create_note', expect.anything());
    expect(mockInvoke).toHaveBeenCalledWith('update_note', expect.anything());
    expect(useEditorStore.getState().saveStatus).toBe('saved');
  });

  it('skips save when content is empty and no active note', async () => {
    useEditorStore.getState().setContent('');

    await act(async () => {
      await flushSave();
    });

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  // P1-INT-011: debounce resets on rapid keystrokes
  it('resets debounce timer on rapid content changes', async () => {
    renderHook(() => useAutoSave());

    // Rapid changes — each should reset the 300ms timer
    act(() => {
      useEditorStore.getState().setContent('a');
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    act(() => {
      useEditorStore.getState().setContent('ab');
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    act(() => {
      useEditorStore.getState().setContent('abc');
    });

    // Only 200ms since last change — no save yet
    expect(mockInvoke).not.toHaveBeenCalledWith('create_note', expect.anything());

    // After full 300ms from last change
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(mockInvoke).toHaveBeenCalledWith('create_note', expect.anything());
  });

  // Gap: flushSave passes workspaceId from workspace store to createNote
  it('passes activeWorkspaceId to createNote', async () => {
    useWorkspaceStore.getState().setActiveWorkspace(99, 'flush-project');
    useEditorStore.getState().setContent('Flush with workspace');

    await act(async () => {
      await flushSave();
    });

    expect(mockInvoke).toHaveBeenCalledWith('create_note', { format: 'markdown', workspaceId: 99 });
  });

  // Gap: flushSave passes null workspaceId when no workspace
  it('passes null workspaceId when no workspace is active', async () => {
    useEditorStore.getState().setContent('Flush no workspace');

    await act(async () => {
      await flushSave();
    });

    expect(mockInvoke).toHaveBeenCalledWith('create_note', { format: 'markdown', workspaceId: null });
  });
});
