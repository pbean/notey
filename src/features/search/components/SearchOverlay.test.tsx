import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { mockInvoke } from '../../../test-utils/setup';
import { useEditorStore } from '../../editor/store';
import { useSearchStore } from '../store';
import { SearchOverlay } from './SearchOverlay';

const MOCK_RESULTS = [
  {
    id: 1,
    title: 'Meeting Notes',
    snippet: 'discussed <mark>project</mark> timeline',
    workspaceName: 'work',
    updatedAt: '2026-04-07T10:00:00+00:00',
    format: 'markdown',
  },
  {
    id: 2,
    title: 'Shopping List',
    snippet: 'buy <mark>project</mark>or supplies',
    workspaceName: null,
    updatedAt: '2026-04-06T08:00:00+00:00',
    format: 'plaintext',
  },
];

describe('SearchOverlay', () => {
  beforeEach(() => {
    useSearchStore.getState().closeSearch();
    useSearchStore.getState().openSearch();
    useEditorStore.getState().resetNote();
  });

  afterEach(() => {
    document.querySelectorAll('.cm-content').forEach((el) => el.remove());
  });

  // COMP-3.3-02: Overlay renders when isOpen=true, input auto-focused
  it('renders overlay with auto-focused input', () => {
    render(<SearchOverlay />);
    const overlay = screen.getByTestId('search-overlay');
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveAttribute('role', 'search');

    const input = screen.getByTestId('search-input');
    expect(input).toHaveAttribute('aria-label', 'Search notes');
    expect(input).toHaveAttribute('placeholder', 'Search notes...');
    expect(document.activeElement).toBe(input);
  });

  // COMP-3.3-03: Typing in input calls searchNotes and displays results
  it('invokes searchNotes on input and displays results', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'search_notes') return Promise.resolve(MOCK_RESULTS);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    render(<SearchOverlay />);
    const input = screen.getByTestId('search-input');

    fireEvent.change(input, { target: { value: 'project' } });

    await waitFor(() => {
      expect(screen.getByTestId('search-result-1')).toBeInTheDocument();
      expect(screen.getByTestId('search-result-2')).toBeInTheDocument();
    });

    expect(mockInvoke).toHaveBeenCalledWith('search_notes', {
      query: 'project',
      workspaceId: null,
    });
  });

  // COMP-3.3-04: Empty state shows "No notes matching" message
  it('shows empty state when query has no results', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'search_notes') return Promise.resolve([]);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    render(<SearchOverlay />);
    const input = screen.getByTestId('search-input');

    fireEvent.change(input, { target: { value: 'nonexistent' } });

    await waitFor(() => {
      expect(screen.getByTestId('search-empty-state')).toHaveTextContent(
        "No notes matching 'nonexistent'",
      );
    });
  });

  // COMP-3.3-05: Esc key closes overlay
  it('closes overlay on Esc key', () => {
    render(<SearchOverlay />);
    expect(useSearchStore.getState().isOpen).toBe(true);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useSearchStore.getState().isOpen).toBe(false);
  });

  // COMP-3.3-07: Result count header displays correct count
  it('shows result count header with correct count', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'search_notes') return Promise.resolve(MOCK_RESULTS);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    render(<SearchOverlay />);
    fireEvent.change(screen.getByTestId('search-input'), {
      target: { value: 'project' },
    });

    await waitFor(() => {
      expect(screen.getByText(/2 results/)).toBeInTheDocument();
    });
  });

  it('shows singular "1 result" for single result', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'search_notes') return Promise.resolve([MOCK_RESULTS[0]]);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    render(<SearchOverlay />);
    fireEvent.change(screen.getByTestId('search-input'), {
      target: { value: 'project' },
    });

    await waitFor(() => {
      expect(screen.getByText(/1 result\b/)).toBeInTheDocument();
    });
  });

  it('does not show empty state or results when query is empty', () => {
    render(<SearchOverlay />);
    expect(screen.queryByTestId('search-empty-state')).toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('clears results when input is cleared', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'search_notes') return Promise.resolve(MOCK_RESULTS);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    render(<SearchOverlay />);
    const input = screen.getByTestId('search-input');

    fireEvent.change(input, { target: { value: 'project' } });
    await waitFor(() => {
      expect(screen.getByTestId('search-result-1')).toBeInTheDocument();
    });

    fireEvent.change(input, { target: { value: '' } });
    await waitFor(() => {
      expect(screen.queryByTestId('search-result-1')).toBeNull();
    });
  });

  it('displays workspace name or "No workspace" fallback', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'search_notes') return Promise.resolve(MOCK_RESULTS);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    render(<SearchOverlay />);
    fireEvent.change(screen.getByTestId('search-input'), {
      target: { value: 'project' },
    });

    await waitFor(() => {
      expect(screen.getByText('work')).toBeInTheDocument();
      expect(screen.getByText('No workspace')).toBeInTheDocument();
    });
  });

  it('handles searchNotes error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'search_notes') return Promise.reject({ type: 'Database' });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    render(<SearchOverlay />);
    fireEvent.change(screen.getByTestId('search-input'), {
      target: { value: 'test' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-empty-state')).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it('renders results with listbox role for accessibility', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'search_notes') return Promise.resolve(MOCK_RESULTS);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    render(<SearchOverlay />);
    fireEvent.change(screen.getByTestId('search-input'), {
      target: { value: 'project' },
    });

    await waitFor(() => {
      const listbox = screen.getByRole('listbox');
      expect(listbox).toBeInTheDocument();

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
      expect(options[1]).toHaveAttribute('aria-selected', 'false');
    });
  });

  // COMP-3.4-01: Enter key on selected result calls loadNote and closes overlay
  it('opens note and closes overlay when Enter is pressed on selected result', async () => {
    const mockNote = {
      id: 1,
      title: 'Meeting Notes',
      content: '# Hello',
      workspaceId: null,
      workspaceName: null,
      format: 'markdown',
      isTrashed: false,
      createdAt: '2026-04-07T10:00:00+00:00',
      updatedAt: '2026-04-07T10:00:00+00:00',
      deletedAt: null,
    };

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'search_notes') return Promise.resolve(MOCK_RESULTS);
      if (cmd === 'get_note') return Promise.resolve(mockNote);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    const editorEl = document.createElement('div');
    editorEl.className = 'cm-content';
    editorEl.tabIndex = 0;
    document.body.appendChild(editorEl);

    render(<SearchOverlay />);
    fireEvent.change(screen.getByTestId('search-input'), {
      target: { value: 'project' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-result-1')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Enter' });
    });

    await waitFor(() => {
      expect(useSearchStore.getState().isOpen).toBe(false);
      expect(mockInvoke).toHaveBeenCalledWith('get_note', { id: 1 });
      expect(useEditorStore.getState().activeNoteId).toBe(1);
      expect(document.activeElement).toBe(editorEl);
    });
  });

  // COMP-3.4-02: Click on result item calls loadNote and closes overlay
  it('opens note and closes overlay when result is clicked', async () => {
    const mockNote = {
      id: 2,
      title: 'Shopping List',
      content: 'buy supplies',
      workspaceId: null,
      workspaceName: null,
      format: 'plaintext',
      isTrashed: false,
      createdAt: '2026-04-06T08:00:00+00:00',
      updatedAt: '2026-04-06T08:00:00+00:00',
      deletedAt: null,
    };

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'search_notes') return Promise.resolve(MOCK_RESULTS);
      if (cmd === 'get_note') return Promise.resolve(mockNote);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    const editorEl = document.createElement('div');
    editorEl.className = 'cm-content';
    editorEl.tabIndex = 0;
    document.body.appendChild(editorEl);

    render(<SearchOverlay />);
    fireEvent.change(screen.getByTestId('search-input'), {
      target: { value: 'project' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-result-2')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('search-result-2'));
    });

    await waitFor(() => {
      expect(useSearchStore.getState().isOpen).toBe(false);
      expect(mockInvoke).toHaveBeenCalledWith('get_note', { id: 2 });
      expect(useEditorStore.getState().activeNoteId).toBe(2);
      expect(document.activeElement).toBe(editorEl);
    });
  });

  // COMP-3.4-03: Focus is trapped within overlay — Tab does not escape to editor
  it('traps focus within overlay on Tab key — preventDefault called', () => {
    render(<SearchOverlay />);
    const input = screen.getByTestId('search-input');
    expect(document.activeElement).toBe(input);

    const overlay = screen.getByTestId('search-overlay');
    // fireEvent returns false when preventDefault was called on the event
    const notPrevented = fireEvent.keyDown(overlay, { key: 'Tab' });
    expect(notPrevented).toBe(false);
  });

  it('traps focus on Shift+Tab at first element — preventDefault called', () => {
    render(<SearchOverlay />);
    const input = screen.getByTestId('search-input');
    expect(document.activeElement).toBe(input);

    const overlay = screen.getByTestId('search-overlay');
    const notPrevented = fireEvent.keyDown(overlay, { key: 'Tab', shiftKey: true });
    expect(notPrevented).toBe(false);
  });

  // COMP-3.4-04: Arrow Down/Up navigation updates selectedIndex
  it('navigates results with Arrow Down and Arrow Up', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'search_notes') return Promise.resolve(MOCK_RESULTS);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    render(<SearchOverlay />);
    fireEvent.change(screen.getByTestId('search-input'), {
      target: { value: 'project' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-result-1')).toBeInTheDocument();
    });

    // Initially selectedIndex is 0 — first result highlighted
    expect(useSearchStore.getState().selectedIndex).toBe(0);
    expect(screen.getByTestId('search-result-1')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('search-result-2')).toHaveAttribute('aria-selected', 'false');

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(useSearchStore.getState().selectedIndex).toBe(1);
    expect(screen.getByTestId('search-result-1')).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByTestId('search-result-2')).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(useSearchStore.getState().selectedIndex).toBe(0);
    expect(screen.getByTestId('search-result-1')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('search-result-2')).toHaveAttribute('aria-selected', 'false');
  });

  // COMP-3.4-05: Enter with no results does nothing
  it('does nothing when Enter is pressed with no results', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'search_notes') return Promise.resolve([]);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    render(<SearchOverlay />);
    fireEvent.change(screen.getByTestId('search-input'), {
      target: { value: 'nonexistent' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-empty-state')).toBeInTheDocument();
    });

    // Store should still be open after Enter with no results
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(useSearchStore.getState().isOpen).toBe(true);
    expect(mockInvoke).not.toHaveBeenCalledWith('get_note', expect.anything());
  });

  // COMP-3.4-06: After opening note, editor receives focus (.cm-content focused)
  it('focuses .cm-content after opening a note via Enter', async () => {
    const mockNote = {
      id: 1,
      title: 'Meeting Notes',
      content: '# Hello',
      workspaceId: null,
      workspaceName: null,
      format: 'markdown',
      isTrashed: false,
      createdAt: '2026-04-07T10:00:00+00:00',
      updatedAt: '2026-04-07T10:00:00+00:00',
      deletedAt: null,
    };

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'search_notes') return Promise.resolve(MOCK_RESULTS);
      if (cmd === 'get_note') return Promise.resolve(mockNote);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    const editorEl = document.createElement('div');
    editorEl.className = 'cm-content';
    editorEl.tabIndex = 0;
    document.body.appendChild(editorEl);

    render(<SearchOverlay />);
    fireEvent.change(screen.getByTestId('search-input'), {
      target: { value: 'project' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-result-1')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Enter' });
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(editorEl);
    });
  });

  // COMP-3.4-07: Mouse click sets selectedIndex to clicked item before opening
  it('click on second result opens that note (not selectedIndex)', async () => {
    const mockNote = {
      id: 2,
      title: 'Shopping List',
      content: 'buy supplies',
      workspaceId: null,
      workspaceName: null,
      format: 'plaintext',
      isTrashed: false,
      createdAt: '2026-04-06T08:00:00+00:00',
      updatedAt: '2026-04-06T08:00:00+00:00',
      deletedAt: null,
    };

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'search_notes') return Promise.resolve(MOCK_RESULTS);
      if (cmd === 'get_note') return Promise.resolve(mockNote);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    const editorEl = document.createElement('div');
    editorEl.className = 'cm-content';
    editorEl.tabIndex = 0;
    document.body.appendChild(editorEl);

    render(<SearchOverlay />);
    fireEvent.change(screen.getByTestId('search-input'), {
      target: { value: 'project' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-result-2')).toBeInTheDocument();
    });

    // selectedIndex is 0, but we click on the second result (id=2)
    expect(useSearchStore.getState().selectedIndex).toBe(0);

    await act(async () => {
      fireEvent.click(screen.getByTestId('search-result-2'));
    });

    await waitFor(() => {
      // Should have called get_note with id=2 (from click), not id=1 (from selectedIndex)
      expect(mockInvoke).toHaveBeenCalledWith('get_note', { id: 2 });
      expect(useEditorStore.getState().activeNoteId).toBe(2);
    });
  });
});
