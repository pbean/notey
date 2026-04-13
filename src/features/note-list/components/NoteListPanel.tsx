import { useEffect, useRef } from 'react';
import { useNoteListStore } from '../store';
import { useWorkspaceStore } from '../../workspace/store';
import { useTabStore } from '../../tabs/store';
import { useEditorStore } from '../../editor/store';
import { formatRelativeDate } from '../../../lib/format-relative-date';

/**
 * Slide-from-left overlay panel showing workspace notes.
 * 200px fixed width, dimmed backdrop, keyboard-navigable listbox.
 */
export function NoteListPanel() {
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedIndex = useNoteListStore((s) => s.selectedIndex);
  const filteredNotes = useWorkspaceStore((s) => s.filteredNotes);
  const activeWorkspaceName = useWorkspaceStore((s) => s.activeWorkspaceName);
  const isAllWorkspaces = useWorkspaceStore((s) => s.isAllWorkspaces);

  // Clamp selectedIndex if filteredNotes shrinks while panel is open
  const clampedIndex = filteredNotes.length === 0
    ? 0
    : Math.min(selectedIndex, filteredNotes.length - 1);

  const headerText = isAllWorkspaces
    ? `All workspaces \u00b7 ${filteredNotes.length} notes`
    : `${activeWorkspaceName ?? 'Workspace'} \u00b7 ${filteredNotes.length} notes`;

  /**
   * Open a note in a tab and dismiss the panel. If loadNote fails to make
   * `noteId` the active note, close the orphan tab so the user isn't left
   * with a tab pointing at an unloaded note. Comparing `activeNoteId`
   * (rather than the shared `saveStatus`) is race-safe under rapid clicks.
   */
  const selectNote = async (noteId: number, title: string) => {
    useTabStore.getState().openTab(noteId, title);
    await useEditorStore.getState().loadNote(noteId);
    if (useEditorStore.getState().activeNoteId !== noteId) {
      const tabIndex = useTabStore.getState().tabs.findIndex((t) => t.noteId === noteId);
      if (tabIndex !== -1) {
        useTabStore.getState().closeTab(tabIndex);
      }
      return;
    }
    useNoteListStore.getState().close();
    const editor = document.querySelector<HTMLElement>('.cm-content');
    editor?.focus();
  };

  // Focus panel on mount
  useEffect(() => {
    if (filteredNotes.length > 0) {
      const firstItem = listRef.current?.children[0] as HTMLElement | undefined;
      firstItem?.focus();
    } else {
      panelRef.current?.focus();
    }
  }, [filteredNotes.length]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current || filteredNotes.length === 0) return;
    const selected = listRef.current.children[clampedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView?.({ block: 'nearest' });
  }, [clampedIndex, filteredNotes.length]);

  /** Handle keyboard navigation within the panel. */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const noteCount = filteredNotes.length;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      useNoteListStore.getState().close();
      const editor = document.querySelector<HTMLElement>('.cm-content');
      editor?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      useNoteListStore.getState().selectNext(noteCount);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      useNoteListStore.getState().selectPrev(noteCount);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (noteCount === 0) return;
      const note = filteredNotes[useNoteListStore.getState().selectedIndex];
      if (note) void selectNote(note.id, note.title || 'New note');
    } else if (e.key === 'Tab') {
      // Focus trap: keep focus within the panel
      e.preventDefault();
    }
  };

  /** Close when clicking the backdrop. */
  const handleBackdropClick = () => {
    useNoteListStore.getState().close();
    const editor = document.querySelector<HTMLElement>('.cm-content');
    editor?.focus();
  };

  const formatBadge = (format: string) => {
    return format === 'markdown' ? 'MD' : 'TXT';
  };

  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="note-list-backdrop"
        onClick={handleBackdropClick}
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
        data-testid="note-list-panel"
        role="navigation"
        aria-label="Note list"
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
          outline: 'none',
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

        {/* Note list or empty state */}
        {filteredNotes.length === 0 ? (
          <div
            data-testid="note-list-empty"
            style={{
              padding: 'var(--space-4)',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}
          >
            No notes yet
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
            {filteredNotes.map((note, index) => (
              <div
                key={note.id}
                data-testid={`note-list-item-${note.id}`}
                role="option"
                aria-selected={index === clampedIndex}
                tabIndex={-1}
                onClick={() => void selectNote(note.id, note.title || 'New note')}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  cursor: 'pointer',
                  background: index === clampedIndex ? 'var(--accent-muted)' : 'transparent',
                }}
              >
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
                {/* Date + format */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 'var(--space-1)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>{formatRelativeDate(note.updatedAt)}</span>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '0 4px',
                      borderRadius: '2px',
                      background: 'var(--bg-surface)',
                    }}
                  >
                    {formatBadge(note.format)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
