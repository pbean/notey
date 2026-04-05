import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockInvoke } from '../../test-utils/setup';
import { useEditorStore } from './store';

// P1-UNIT-008: useEditorStore state management
describe('useEditorStore', () => {
  beforeEach(() => {
    useEditorStore.getState().resetNote();
  });

  it('starts with default state', () => {
    const state = useEditorStore.getState();
    expect(state.activeNoteId).toBeNull();
    expect(state.content).toBe('');
    expect(state.format).toBe('markdown');
    expect(state.saveStatus).toBe('idle');
    expect(state.lastSavedAt).toBeNull();
  });

  it('setContent updates content', () => {
    useEditorStore.getState().setContent('hello');
    expect(useEditorStore.getState().content).toBe('hello');
  });

  it('setFormat switches between markdown and plaintext', () => {
    useEditorStore.getState().setFormat('plaintext');
    expect(useEditorStore.getState().format).toBe('plaintext');

    useEditorStore.getState().setFormat('markdown');
    expect(useEditorStore.getState().format).toBe('markdown');
  });

  it('setActiveNote sets the active note ID', () => {
    useEditorStore.getState().setActiveNote(42);
    expect(useEditorStore.getState().activeNoteId).toBe(42);
  });

  it('setSaveStatus transitions through states', () => {
    useEditorStore.getState().setSaveStatus('saving');
    expect(useEditorStore.getState().saveStatus).toBe('saving');

    useEditorStore.getState().setSaveStatus('saved');
    expect(useEditorStore.getState().saveStatus).toBe('saved');

    useEditorStore.getState().setSaveStatus('failed');
    expect(useEditorStore.getState().saveStatus).toBe('failed');
  });

  it('markSaved sets status and timestamp atomically', () => {
    const ts = '2026-01-01T00:00:00+00:00';
    useEditorStore.getState().markSaved(ts);

    const state = useEditorStore.getState();
    expect(state.saveStatus).toBe('saved');
    expect(state.lastSavedAt).toBe(ts);
  });

  it('resetNote clears all state to defaults', () => {
    // Set up non-default state
    useEditorStore.getState().setActiveNote(99);
    useEditorStore.getState().setContent('some text');
    useEditorStore.getState().setFormat('plaintext');
    useEditorStore.getState().setSaveStatus('saving');

    useEditorStore.getState().resetNote();

    const state = useEditorStore.getState();
    expect(state.activeNoteId).toBeNull();
    expect(state.content).toBe('');
    expect(state.format).toBe('markdown');
    expect(state.saveStatus).toBe('idle');
    expect(state.lastSavedAt).toBeNull();
    expect(state.isHydrating).toBe(false);
  });

  it('loadNote sets content and isHydrating for existing note', async () => {
    const mockNote = {
      id: 1,
      title: 'Test Note',
      content: '# Hello world',
      format: 'markdown',
      workspaceId: 7,
      createdAt: '2026-01-01T00:00:00+00:00',
      updatedAt: '2026-01-02T00:00:00+00:00',
      deletedAt: null,
      isTrashed: false,
    };
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_note') return Promise.resolve(mockNote);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await useEditorStore.getState().loadNote(1);

    const state = useEditorStore.getState();
    expect(state.activeNoteId).toBe(1);
    expect(state.content).toBe('# Hello world');
    expect(state.format).toBe('markdown');
    expect(state.saveStatus).toBe('idle');
    expect(state.lastSavedAt).toBe('2026-01-02T00:00:00+00:00');
    expect(state.isHydrating).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith('get_note', { id: 1 });
  });

  // P1-UNIT-005: Note format toggle persists through save/reload
  it('loadNote restores plaintext format from backend', async () => {
    const plaintextNote = {
      id: 2,
      title: 'Plain Note',
      content: 'no markdown here',
      format: 'plaintext',
      workspaceId: null,
      createdAt: '2026-01-01T00:00:00+00:00',
      updatedAt: '2026-01-02T00:00:00+00:00',
      deletedAt: null,
      isTrashed: false,
    };
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_note') return Promise.resolve(plaintextNote);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    // Start with markdown (default), then load a plaintext note
    expect(useEditorStore.getState().format).toBe('markdown');
    await useEditorStore.getState().loadNote(2);

    const state = useEditorStore.getState();
    expect(state.format).toBe('plaintext');
    expect(state.activeNoteId).toBe(2);
    expect(state.content).toBe('no markdown here');
  });

  it('loadNote sets saveStatus failed and logs error on command error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_note') return Promise.reject({ type: 'NotFound', message: 'Note not found' });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    await useEditorStore.getState().loadNote(999);

    const state = useEditorStore.getState();
    expect(state.saveStatus).toBe('failed');
    expect(state.isHydrating).toBe(false);
    expect(state.activeNoteId).toBeNull(); // unchanged from default
    expect(state.content).toBe(''); // unchanged from default
    expect(consoleSpy).toHaveBeenCalledWith('loadNote failed:', expect.objectContaining({ type: 'NotFound' }));
    consoleSpy.mockRestore();
  });
});
