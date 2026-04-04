import { describe, it, expect, beforeEach } from 'vitest';
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
});
