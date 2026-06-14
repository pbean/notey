import { useEffect, useRef } from 'react';
import { useTrashStore } from '../store';
import { useToastStore } from '../../toast/store';
import { formatRelativeDate } from '../../../lib/format-relative-date';
import { useFocusTrap } from '../../../lib/useFocusTrap';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

/**
 * Slide-from-left overlay panel listing soft-deleted notes with a per-note
 * Restore action. 200px fixed width, dimmed backdrop, keyboard-navigable
 * listbox. Mirrors the NoteListPanel structure and keyboard model; restoring is
 * reversible, so there is no confirmation.
 */
export function TrashPanel() {
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedIndex = useTrashStore((s) => s.selectedIndex);
  const trashedNotes = useTrashStore((s) => s.trashedNotes);
  const restoringNoteIds = useTrashStore((s) => s.restoringNoteIds);
  const isLoading = useTrashStore((s) => s.isLoading);
  const error = useTrashStore((s) => s.error);
  const pendingDeleteNote = useTrashStore((s) => s.pendingDeleteNote);

  // Trap Tab within the panel — but yield to the confirm-delete dialog, which
  // is portaled outside the panel and runs its own Base UI focus trap.
  useFocusTrap(panelRef, !pendingDeleteNote);

  // Clamp selectedIndex if the list shrinks (e.g. after a restore) while open.
  const clampedIndex =
    trashedNotes.length === 0 ? 0 : Math.min(selectedIndex, trashedNotes.length - 1);

  const noteWord = trashedNotes.length === 1 ? 'note' : 'notes';
  const headerText = `Trash · ${trashedNotes.length} ${noteWord}`;

  /** Restore a note and surface the outcome as a toast. */
  const restoreNote = async (noteId: number) => {
    if (useTrashStore.getState().restoringNoteIds.includes(noteId)) return;
    const note = await useTrashStore.getState().restoreNote(noteId);
    useToastStore.getState().addToast(note ? 'Note restored' : "Couldn't restore note");
  };

  /** Close the panel and return focus to the editor. */
  const closePanel = () => {
    useTrashStore.getState().close();
    const editor = document.querySelector<HTMLElement>('.cm-content');
    editor?.focus();
  };

  // Focus the first item (or the panel when empty) on mount.
  useEffect(() => {
    if (trashedNotes.length > 0) {
      const firstItem = listRef.current?.children[0] as HTMLElement | undefined;
      firstItem?.focus();
    } else {
      panelRef.current?.focus();
    }
  }, [trashedNotes.length]);

  // Scroll the selected item into view.
  useEffect(() => {
    if (!listRef.current || trashedNotes.length === 0) return;
    const selected = listRef.current.children[clampedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView?.({ block: 'nearest' });
  }, [clampedIndex, trashedNotes.length]);

  /** Handle keyboard navigation within the panel. */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // While the confirm-delete alertdialog is open it owns the keyboard
    // (Esc cancels the delete, not the panel). The dialog is portaled but Base
    // UI preserves React-tree event bubbling, so guard here to avoid double-handling.
    if (useTrashStore.getState().pendingDeleteNote) return;

    const noteCount = trashedNotes.length;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closePanel();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      useTrashStore.getState().selectNext(noteCount);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      useTrashStore.getState().selectPrev(noteCount);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (noteCount === 0) return;
      const note = trashedNotes[clampedIndex];
      if (note) void restoreNote(note.id);
    }
    // Tab is trapped within the panel by useFocusTrap.
  };

  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="trash-backdrop"
        onClick={closePanel}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 50,
          background: 'var(--bg-primary)',
          opacity: 0.8,
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        data-testid="trash-panel"
        role="navigation"
        aria-label="Trash"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: 200,
          zIndex: 51,
          background: 'var(--bg-elevated)',
          borderRight: '1px solid var(--border-default)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 'var(--space-3)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            borderBottom: '1px solid var(--border-default)',
            flexShrink: 0,
          }}
        >
          {headerText}
        </div>

        {/* Trashed note list, empty state, or error */}
        {isLoading ? (
          <div
            data-testid="trash-loading"
            style={{
              padding: 'var(--space-4)',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}
          >
            Loading trash...
          </div>
        ) : error ? (
          <div
            data-testid="trash-error"
            style={{
              padding: 'var(--space-4)',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        ) : trashedNotes.length === 0 ? (
          <div
            data-testid="trash-empty"
            style={{
              padding: 'var(--space-4)',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}
          >
            Trash is empty.
          </div>
        ) : (
          <div
            ref={listRef}
            role="listbox"
            style={{
              flex: 1,
              overflowY: 'auto',
            }}
          >
            {trashedNotes.map((note, index) => (
              <div
                key={note.id}
                data-testid={`trash-item-${note.id}`}
                role="option"
                aria-selected={index === clampedIndex}
                tabIndex={-1}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  background: index === clampedIndex ? 'var(--accent-muted)' : 'transparent',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Title */}
                  <div
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {note.title || 'New note'}
                  </div>
                  {/* Deletion time */}
                  <div
                    style={{
                      marginTop: 'var(--space-1)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {note.deletedAt ? `deleted ${formatRelativeDate(note.deletedAt)}` : ''}
                  </div>
                </div>
                {/* Restore action */}
                <button
                  type="button"
                  data-testid={`trash-restore-${note.id}`}
                  onClick={() => void restoreNote(note.id)}
                  disabled={restoringNoteIds.includes(note.id)}
                  style={{
                    flexShrink: 0,
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-primary)',
                    padding: '2px 6px',
                    borderRadius: '2px',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-surface)',
                    cursor: restoringNoteIds.includes(note.id) ? 'default' : 'pointer',
                    opacity: restoringNoteIds.includes(note.id) ? 0.6 : 1,
                  }}
                >
                  Restore
                </button>
                {/* Permanent delete action (opens confirmation) */}
                <button
                  type="button"
                  data-testid={`trash-delete-${note.id}`}
                  aria-label={`Permanently delete ${note.title || 'New note'}`}
                  onClick={() => useTrashStore.getState().requestPermanentDelete(note)}
                  style={{
                    flexShrink: 0,
                    fontSize: 'var(--text-xs)',
                    color: 'var(--error)',
                    padding: '2px 6px',
                    borderRadius: '2px',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-surface)',
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Permanent-delete confirmation modal */}
      <ConfirmDeleteDialog />
    </>
  );
}
