import { useEffect, useRef } from 'react';
import { commands } from '../../../generated/bindings';
import { useEditorStore } from '../store';

/**
 * Watches editor content and orchestrates auto-save via Tauri IPC.
 *
 * - On the first non-empty keystroke (no active note), calls `createNote` then `updateNote`.
 * - On subsequent changes, debounces 300ms then calls `updateNote`.
 * - Drives `saveStatus` transitions in `useEditorStore`.
 */
export function useAutoSave(): void {
  const content = useEditorStore((s) => s.content);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against two overlapping debounce callbacks both entering createNote
  const isCreatingRef = useRef(false);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    // Always cancel any pending save before evaluating the guard
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // No-op: empty content with no existing note
    if (content.trim() === '' && useEditorStore.getState().activeNoteId === null) return;

    debounceRef.current = setTimeout(async () => {
      // Skip if a createNote call is already in flight
      if (isCreatingRef.current) return;

      const { setActiveNote, setSaveStatus, markSaved } = useEditorStore.getState();
      // Fallback to 'Untitled' when the first line is blank (e.g. user pressed Enter first)
      const firstLine = content.split('\n')[0].trim();
      const title = firstLine.slice(0, 100) || 'Untitled';

      setSaveStatus('saving');
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

      let noteId = useEditorStore.getState().activeNoteId;

      if (noteId === null) {
        isCreatingRef.current = true;
        const createResult = await commands.createNote(useEditorStore.getState().format);
        isCreatingRef.current = false;
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

      markSaved(new Date().toISOString());
      idleTimerRef.current = setTimeout(() => {
        if (useEditorStore.getState().saveStatus === 'saved') {
          useEditorStore.getState().setSaveStatus('idle');
        }
      }, 2000);
    }, 300);
  }, [content]);
}
