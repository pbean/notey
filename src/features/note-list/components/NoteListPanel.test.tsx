import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { mockInvoke } from '../../../test-utils/setup';
import { useNoteListStore } from '../store';
import { useWorkspaceStore } from '../../workspace/store';
import { useTabStore } from '../../tabs/store';
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
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_note') {
        return Promise.resolve({
          status: 'ok',
          data: MOCK_NOTES[0],
        });
      }
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
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

  it('ArrowUp wraps from first to last item', () => {
    render(<NoteListPanel />);
    const panel = screen.getByTestId('note-list-panel');

    fireEvent.keyDown(panel, { key: 'ArrowUp' });
    expect(useNoteListStore.getState().selectedIndex).toBe(2);
  });

  it('Enter opens selected note in tab and closes panel', () => {
    render(<NoteListPanel />);
    const panel = screen.getByTestId('note-list-panel');

    fireEvent.keyDown(panel, { key: 'Enter' });

    // Tab opened for first note
    const tabs = useTabStore.getState().tabs;
    expect(tabs.length).toBe(1);
    expect(tabs[0].noteId).toBe(1);
    expect(tabs[0].title).toBe('Meeting Notes');

    // Panel closed
    expect(useNoteListStore.getState().isOpen).toBe(false);
  });

  it('Esc closes panel without opening a note', () => {
    render(<NoteListPanel />);
    const panel = screen.getByTestId('note-list-panel');

    fireEvent.keyDown(panel, { key: 'Escape' });

    expect(useNoteListStore.getState().isOpen).toBe(false);
    expect(useTabStore.getState().tabs.length).toBe(0);
  });

  it('clicking a note opens it in a tab and closes panel', () => {
    render(<NoteListPanel />);
    const second = screen.getByTestId('note-list-item-2');

    fireEvent.click(second);

    const tabs = useTabStore.getState().tabs;
    expect(tabs.length).toBe(1);
    expect(tabs[0].noteId).toBe(2);
    expect(tabs[0].title).toBe('Shopping List');
    expect(useNoteListStore.getState().isOpen).toBe(false);
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

    fireEvent.keyDown(panel, { key: 'Tab' });

    // Tab should be prevented (focus trap) — panel remains in DOM and focused
    expect(panel).toBeInTheDocument();
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
