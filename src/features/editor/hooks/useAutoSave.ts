import { useEffect, useRef } from 'react';
import { commands } from '../../../generated/bindings';
import { useEditorStore } from '../store';

/** Ref to the active debounce timer, shared between hook and flushSave. */
let sharedDebounceRef: ReturnType<typeof setTimeout> | null = null;

/** Guards against overlapping createNote calls across flushSave and the debounce callback. */
let isCreating = false;

/**
 * Immediately saves the current editor content if dirty, bypassing debounce.
 * Returns a Promise that resolves when the save completes (or immediately if nothing to save).
 */
export async function flushSave(): Promise<void> {
  // Cancel any pending debounce
  if (sharedDebounceRef) {
    clearTimeout(sharedDebounceRef);
    sharedDebounceRef = null;
  }

  // Skip if a createNote call is already in flight
  if (isCreating) return;

  const { activeNoteId, content, format, setSaveStatus, markSaved, setActiveNote } =
    useEditorStore.getState();

  // Nothing to save if content is empty and no note exists
  if (content.trim() === '' && activeNoteId === null) return;

  setSaveStatus('saving');

  let noteId = activeNoteId;

  if (noteId === null) {
    isCreating = true;
    const createResult = await commands.createNote(format);
    isCreating = false;
    if (createResult.status === 'error') {
      setSaveStatus('failed');
      console.error('flushSave createNote failed:', createResult.error);
      return;
    }
    noteId = createResult.data.id;
    setActiveNote(noteId);
  }

  const firstLine = content.split('\n')[0].trim();
  const title = firstLine.slice(0, 100) || 'Untitled';

  const updateResult = await commands.updateNote(noteId, title, content, null);
  if (updateResult.status === 'error') {
    setSaveStatus('failed');
    console.error('flushSave updateNote failed:', updateResult.error);
    return;
  }

  markSaved(updateResult.data.updatedAt);
}

/**
 * Watches editor content and orchestrates auto-save via Tauri IPC.
 *
 * - On the first non-empty keystroke (no active note), calls `createNote` then `updateNote`.
 * - On subsequent changes, debounces 300ms then calls `updateNote`.
 * - Drives `saveStatus` transitions in `useEditorStore`.
 */
export function useAutoSave(): void {
  const content = useEditorStore((s) => s.content);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      if (sharedDebounceRef) clearTimeout(sharedDebounceRef);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    // Always cancel any pending save before evaluating the guard
    if (sharedDebounceRef) clearTimeout(sharedDebounceRef);

    // No-op: empty content with no existing note
    if (content.trim() === '' && useEditorStore.getState().activeNoteId === null) return;

    // Skip auto-save when content was set by loadNote hydration, not user typing
    if (useEditorStore.getState().isHydrating) return;

    sharedDebounceRef = setTimeout(async () => {
      sharedDebounceRef = null;

      // Skip if a createNote call is already in flight
      if (isCreating) return;

      const { setActiveNote, setSaveStatus, markSaved } = useEditorStore.getState();
      // Fallback to 'Untitled' when the first line is blank (e.g. user pressed Enter first)
      const firstLine = content.split('\n')[0].trim();
      const title = firstLine.slice(0, 100) || 'Untitled';

      setSaveStatus('saving');
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

      let noteId = useEditorStore.getState().activeNoteId;

      if (noteId === null) {
        isCreating = true;
        const createResult = await commands.createNote(useEditorStore.getState().format);
        isCreating = false;
        if (createResult.status === 'error') {
          setSaveStatus('failed');
          console.error('createNote failed:', createResult.error);
          return;
        }
        noteId = createResult.data.id;
        setActiveNote(noteId);
      }

      const updateResult = await commands.updateNote(noteId, title, content, null);
      if (updateResult.status === 'error') {
        setSaveStatus('failed');
        console.error('updateNote failed:', updateResult.error);
        return;
      }

      markSaved(updateResult.data.updatedAt);
      idleTimerRef.current = setTimeout(() => {
        if (useEditorStore.getState().saveStatus === 'saved') {
          useEditorStore.getState().setSaveStatus('idle');
        }
      }, 2000);
    }, 300);
  }, [content]);
}
