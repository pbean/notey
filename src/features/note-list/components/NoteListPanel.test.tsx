import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { mockInvoke } from '../../../test-utils/setup';
import { useNoteListStore } from '../store';
import { useWorkspaceStore } from '../../workspace/store';
import { useTabStore } from '../../tabs/store';
import { useEditorStore } from '../../editor/store';
import { useSearchStore } from '../../search/store';
import { useCommandPaletteStore } from '../../command-palette/store';
import { NoteListPanel } from './NoteListPanel';
import type { Note } from '../../../generated/bindings';

const makeNote = (overrides: Partial<Note> & { id: number }): Note => ({
  title: `Note ${overrides.id}`,
  content: `Content ${overrides.id}`,
  format: 'markdown',
  workspaceId: 1,
  createdAt: '2026-04-10T10:00:00+00:00',
  updatedAt: '2026-04-10T10:00:00+00:00',
  deletedAt: null,
  isTrashed: false,
  ...overrides,
});

const MOCK_NOTES: Note[] = [
  makeNote({ id: 1, title: 'Meeting Notes', updatedAt: '2026-04-10T12:00:00+00:00' }),
  makeNote({ id: 2, title: 'Shopping List', format: 'plaintext', updatedAt: '2026-04-10T10:00:00+00:00' }),
  makeNote({ id: 3, title: 'Project Ideas', updatedAt: '2026-04-09T08:00:00+00:00' }),
];

describe('NoteListPanel', () => {
  beforeEach(() => {
    mockInvoke.mockImplementation((cmd: string, args?: { id?: number }) => {
      if (cmd === 'get_note') {
        const id = args?.id ?? 1;
        const note = MOCK_NOTES.find((n) => n.id === id) ?? MOCK_NOTES[0];
        return Promise.resolve(note);
      }
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useTabStore.getState().reset();
    useEditorStore.getState().resetNote();
    useNoteListStore.getState().open();
    useWorkspaceStore.setState({
      filteredNotes: MOCK_NOTES,
      activeWorkspaceName: 'my-project',
      isAllWorkspaces: false,
    });
  });

  it('renders panel with correct ARIA attributes', () => {
    render(<NoteListPanel />);
    const panel = screen.getByTestId('note-list-panel');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute('role', 'navigation');
    expect(panel).toHaveAttribute('aria-label', 'Note list');
  });

  it('displays workspace header with note count', () => {
    render(<NoteListPanel />);
    expect(screen.getByText('my-project \u00b7 3 notes')).toBeInTheDocument();
  });

  it('renders all notes with data-testid attributes', () => {
    render(<NoteListPanel />);
    expect(screen.getByTestId('note-list-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('note-list-item-2')).toBeInTheDocument();
    expect(screen.getByTestId('note-list-item-3')).toBeInTheDocument();
  });

  it('renders note titles, format badges, and relative dates', () => {
    render(<NoteListPanel />);
    expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
    expect(screen.getByText('Shopping List')).toBeInTheDocument();
    expect(screen.getByText('Project Ideas')).toBeInTheDocument();

    // Format badges
    const mdBadges = screen.getAllByText('MD');
    expect(mdBadges.length).toBe(2);
    expect(screen.getByText('TXT')).toBeInTheDocument();
  });

  it('shows listbox role on the list container', () => {
    render(<NoteListPanel />);
    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeInTheDocument();
  });

  it('marks first item as selected by default', () => {
    render(<NoteListPanel />);
    const first = screen.getByTestId('note-list-item-1');
    expect(first).toHaveAttribute('aria-selected', 'true');
    const second = screen.getByTestId('note-list-item-2');
    expect(second).toHaveAttribute('aria-selected', 'false');
  });

  it('ArrowDown moves selection to next item', () => {
    render(<NoteListPanel />);
    const panel = screen.getByTestId('note-list-panel');

    fireEvent.keyDown(panel, { key: 'ArrowDown' });
    expect(useNoteListStore.getState().selectedIndex).toBe(1);

    const second = screen.getByTestId('note-list-item-2');
    expect(second).toHaveAttribute('aria-selected', 'true');
  });

  it('focuses the panel itself on open', () => {
    render(<NoteListPanel />);
    expect(document.activeElement).toBe(screen.getByTestId('note-list-panel'));
  });

  it('ArrowUp wraps from first to last item', () => {
    render(<NoteListPanel />);
    const panel = screen.getByTestId('note-list-panel');

    fireEvent.keyDown(panel, { key: 'ArrowUp' });
    expect(useNoteListStore.getState().selectedIndex).toBe(2);
  });

  it('Enter opens selected note in tab and closes panel', async () => {
    render(<NoteListPanel />);
    const panel = screen.getByTestId('note-list-panel');

    fireEvent.keyDown(panel, { key: 'Enter' });

    // Tab opens synchronously before the loadNote await
    const tabs = useTabStore.getState().tabs;
    expect(tabs.length).toBe(1);
    expect(tabs[0].noteId).toBe(1);
    expect(tabs[0].title).toBe('Meeting Notes');

    // Panel closes after loadNote resolves
    await waitFor(() => {
      expect(useNoteListStore.getState().isOpen).toBe(false);
    });
  });

  it('Esc closes panel without opening a note', () => {
    render(<NoteListPanel />);
    const panel = screen.getByTestId('note-list-panel');

    fireEvent.keyDown(panel, { key: 'Escape' });

    expect(useNoteListStore.getState().isOpen).toBe(false);
    expect(useTabStore.getState().tabs.length).toBe(0);
  });

  it('clicking a note opens it in a tab and closes panel', async () => {
    render(<NoteListPanel />);
    const second = screen.getByTestId('note-list-item-2');

    fireEvent.click(second);

    const tabs = useTabStore.getState().tabs;
    expect(tabs.length).toBe(1);
    expect(tabs[0].noteId).toBe(2);
    expect(tabs[0].title).toBe('Shopping List');
    await waitFor(() => {
      expect(useNoteListStore.getState().isOpen).toBe(false);
    });
  });

  it('closes orphan tab when loadNote fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_note') {
        return Promise.reject({ type: 'Database', message: 'boom' });
      }
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    render(<NoteListPanel />);
    const target = screen.getByTestId('note-list-item-2');

    fireEvent.click(target);

    // Tab opens synchronously
    expect(useTabStore.getState().tabs.length).toBe(1);
    expect(useTabStore.getState().tabs[0].noteId).toBe(2);

    // After loadNote rejects, the orphan tab is removed and panel stays open
    await waitFor(() => {
      expect(useTabStore.getState().tabs.length).toBe(0);
    });
    expect(useEditorStore.getState().saveStatus).toBe('failed');
    expect(useNoteListStore.getState().isOpen).toBe(true);
    consoleSpy.mockRestore();
  });

  it('clicking backdrop closes panel', () => {
    render(<NoteListPanel />);
    const backdrop = screen.getByTestId('note-list-backdrop');

    fireEvent.click(backdrop);

    expect(useNoteListStore.getState().isOpen).toBe(false);
  });

  it('Tab key is trapped within panel', () => {
    render(<NoteListPanel />);
    const panel = screen.getByTestId('note-list-panel');

    const notPrevented = fireEvent.keyDown(panel, { key: 'Tab' });

    expect(notPrevented).toBe(false);
    expect(document.activeElement).toBe(panel);
  });

  it('shows empty state when no notes', () => {
    useWorkspaceStore.setState({ filteredNotes: [] });
    render(<NoteListPanel />);

    expect(screen.getByTestId('note-list-empty')).toBeInTheDocument();
    expect(screen.getByText('No notes yet')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows "All workspaces" header when isAllWorkspaces is true', () => {
    useWorkspaceStore.setState({ isAllWorkspaces: true });
    render(<NoteListPanel />);

    expect(screen.getByText('All workspaces \u00b7 3 notes')).toBeInTheDocument();
  });

  it('displays "New note" for notes with empty title', () => {
    useWorkspaceStore.setState({
      filteredNotes: [makeNote({ id: 10, title: '' })],
    });
    render(<NoteListPanel />);

    expect(screen.getByText('New note')).toBeInTheDocument();
  });

  it('open() closes search and command palette (mutual exclusion)', () => {
    useNoteListStore.getState().close();
    useSearchStore.getState().openSearch();
    useCommandPaletteStore.getState().open();

    useNoteListStore.getState().open();

    expect(useSearchStore.getState().isOpen).toBe(false);
    expect(useCommandPaletteStore.getState().isOpen).toBe(false);
    expect(useNoteListStore.getState().isOpen).toBe(true);
  });
});
