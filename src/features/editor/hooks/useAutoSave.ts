import { useEffect, useRef } from 'react';
import { commands } from '../../../generated/bindings';
import { useEditorStore } from '../store';
import { useWorkspaceStore } from '../../workspace/store';

/** Module-level reference to the active hook instance's flush function. */
let registeredFlush: (() => Promise<void>) | null = null;

/**
 * Immediately saves the current editor content if dirty, bypassing debounce.
 * When useAutoSave is mounted, delegates to its instance to properly cancel timers.
 * When called standalone (no hook), performs a direct save.
 */
export async function flushSave(): Promise<void> {
  if (registeredFlush) return registeredFlush();
  await performSave();
}

/**
 * Core save logic shared by flushSave and the debounce callback.
 * Reads current state from stores, creates a note if needed, then updates.
 *
 * @param isCreatingRef - optional guard ref to prevent overlapping createNote calls.
 *   When provided (hook-managed path), the ref is checked and set during creation.
 *   When omitted (standalone flushSave), no guard is needed since there's no concurrent debounce.
 */
async function performSave(
  isCreatingRef?: React.MutableRefObject<boolean>,
): Promise<void> {
  if (isCreatingRef?.current) return;

  const { activeNoteId, content, format, setSaveStatus, markSaved, setActiveNote } =
    useEditorStore.getState();

  if (content.trim() === '' && activeNoteId === null) return;

  setSaveStatus('saving');

  let noteId = activeNoteId;

  if (noteId === null) {
    if (isCreatingRef) isCreatingRef.current = true;
    try {
      const workspaceId = useWorkspaceStore.getState().activeWorkspaceId;
      const createResult = await commands.createNote(format, workspaceId);
      if (createResult.status === 'error') {
        setSaveStatus('failed');
        console.error('createNote failed:', createResult.error);
        return;
      }
      noteId = createResult.data.id;
      setActiveNote(noteId);
    } finally {
      if (isCreatingRef) isCreatingRef.current = false;
    }
  }

  const firstLine = content.split('\n')[0].trim();
  const title = firstLine.slice(0, 100) || 'Untitled';

  const updateResult = await commands.updateNote(noteId, title, content, null);
  if (updateResult.status === 'error') {
    setSaveStatus('failed');
    console.error('updateNote failed:', updateResult.error);
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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCreatingRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Register instance flush on mount, cleanup on unmount
  useEffect(() => {
    const instanceFlush = async () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      await performSave(isCreatingRef);
    };

    registeredFlush = instanceFlush;

    return () => {
      if (registeredFlush === instanceFlush) registeredFlush = null;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  // Debounced auto-save on content change
  useEffect(() => {
    // Always cancel any pending save before evaluating the guard
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // No-op: empty content with no existing note
    if (content.trim() === '' && useEditorStore.getState().activeNoteId === null) return;

    // Skip auto-save when content was set by loadNote hydration, not user typing
    if (useEditorStore.getState().isHydrating) return;

    debounceRef.current = setTimeout(async () => {
      debounceRef.current = null;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

      await performSave(isCreatingRef);

      // Transition saved → idle after 2s
      if (useEditorStore.getState().saveStatus === 'saved') {
        idleTimerRef.current = setTimeout(() => {
          if (useEditorStore.getState().saveStatus === 'saved') {
            useEditorStore.getState().setSaveStatus('idle');
          }
        }, 2000);
      }
    }, 300);
  }, [content]);
}
