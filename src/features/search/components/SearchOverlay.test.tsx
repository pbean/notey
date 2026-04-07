import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { mockInvoke } from '../../../test-utils/setup';
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
});
