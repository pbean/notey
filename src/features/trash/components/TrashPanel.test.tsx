import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { mockInvoke } from '../../../test-utils/setup';
import { useTrashStore } from '../store';
import { useToastStore } from '../../toast/store';
import { TrashPanel } from './TrashPanel';
import { buildNote } from '../../../test-utils/factories';

const TRASHED = [
  buildNote({ id: 1, title: 'Trashed A', isTrashed: true, deletedAt: '2026-06-10T12:00:00+00:00' }),
  buildNote({ id: 2, title: 'Trashed B', isTrashed: true, deletedAt: '2026-06-09T12:00:00+00:00' }),
];

describe('TrashPanel', () => {
  beforeEach(() => {
    useTrashStore.getState().resetTrash();
    useTrashStore.setState({ isOpen: true, trashedNotes: TRASHED });
  });

  it('renders the panel with correct ARIA attributes', () => {
    render(<TrashPanel />);
    const panel = screen.getByTestId('trash-panel');
    expect(panel).toHaveAttribute('role', 'navigation');
    expect(panel).toHaveAttribute('aria-label', 'Trash');
  });

  it('lists trashed notes with title and a relative deletion time', () => {
    render(<TrashPanel />);
    expect(screen.getByTestId('trash-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('trash-item-2')).toBeInTheDocument();
    expect(screen.getByText('Trashed A')).toBeInTheDocument();
    // Each row shows a "deleted ..." subtitle derived from deletedAt.
    expect(screen.getAllByText(/^deleted /).length).toBe(2);
  });

  it('renders items in the order provided (newest deleted first)', () => {
    render(<TrashPanel />);
    const items = screen.getAllByRole('option');
    expect(items[0]).toHaveAttribute('data-testid', 'trash-item-1');
    expect(items[1]).toHaveAttribute('data-testid', 'trash-item-2');
  });

  it('shows the empty state when there are no trashed notes', () => {
    useTrashStore.setState({ trashedNotes: [] });
    render(<TrashPanel />);
    expect(screen.getByTestId('trash-empty')).toHaveTextContent('Trash is empty.');
  });

  it('shows a loading state instead of the empty state while trash is loading', () => {
    useTrashStore.setState({ trashedNotes: [], isLoading: true });
    render(<TrashPanel />);
    expect(screen.getByTestId('trash-loading')).toHaveTextContent('Loading trash...');
    expect(screen.queryByTestId('trash-empty')).toBeNull();
  });

  it('clicking Restore calls the store and shows a "Note restored" toast', async () => {
    let listNotesCalls = 0;
    mockInvoke.mockImplementation((cmd: string, args?: { id?: number }) => {
      if (cmd === 'restore_note') {
        return Promise.resolve(buildNote({ id: args?.id ?? 1, isTrashed: false, deletedAt: null }));
      }
      if (cmd === 'list_notes') {
        listNotesCalls += 1;
        return Promise.resolve([]);
      }
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    render(<TrashPanel />);
    fireEvent.click(screen.getByTestId('trash-restore-1'));

    await waitFor(() => {
      expect(useTrashStore.getState().trashedNotes.map((n) => n.id)).toEqual([2]);
    });
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some((t) => t.message === 'Note restored')).toBe(true);
    });
    expect(listNotesCalls).toBeGreaterThan(0);
  });

  it('ignores a second restore click while the first request is still pending', async () => {
    let resolveRestore!: (note: ReturnType<typeof buildNote>) => void;
    let restoreCalls = 0;
    const restorePromise = new Promise<ReturnType<typeof buildNote>>((resolve) => {
      resolveRestore = resolve;
    });

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'restore_note') {
        restoreCalls += 1;
        return restorePromise;
      }
      if (cmd === 'list_notes') return Promise.resolve([]);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    render(<TrashPanel />);
    const button = screen.getByTestId('trash-restore-1');
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
    });

    fireEvent.click(button);
    expect(restoreCalls).toBe(1);
    expect(
      useToastStore.getState().toasts.some((t) => t.message === "Couldn't restore note"),
    ).toBe(false);

    resolveRestore(buildNote({ id: 1, isTrashed: false, deletedAt: null }));

    await waitFor(() => {
      expect(useTrashStore.getState().trashedNotes.map((n) => n.id)).toEqual([2]);
    });
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some((t) => t.message === 'Note restored')).toBe(true);
    });
    expect(
      useToastStore.getState().toasts.some((t) => t.message === "Couldn't restore note"),
    ).toBe(false);
  });

  it('shows an error toast when restore fails', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'restore_note') return Promise.reject({ type: 'NotFound' });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    render(<TrashPanel />);
    fireEvent.click(screen.getByTestId('trash-restore-1'));

    await waitFor(() => {
      expect(
        useToastStore.getState().toasts.some((t) => t.message === "Couldn't restore note"),
      ).toBe(true);
    });
    // List unchanged on failure.
    expect(useTrashStore.getState().trashedNotes.map((n) => n.id)).toEqual([1, 2]);
  });

  it('Enter on the selected row restores it', async () => {
    mockInvoke.mockImplementation((cmd: string, args?: { id?: number }) => {
      if (cmd === 'restore_note') {
        return Promise.resolve(buildNote({ id: args?.id ?? 1, isTrashed: false, deletedAt: null }));
      }
      if (cmd === 'list_notes') return Promise.resolve([]);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });

    render(<TrashPanel />);
    fireEvent.keyDown(screen.getByTestId('trash-panel'), { key: 'Enter' });

    await waitFor(() => {
      expect(useTrashStore.getState().trashedNotes.map((n) => n.id)).toEqual([2]);
    });
  });

  it('keeps Enter aligned with the highlighted row after restoring the selected tail item', async () => {
    const restoredIds: number[] = [];
    mockInvoke.mockImplementation((cmd: string, args?: { id?: number }) => {
      if (cmd === 'restore_note') {
        const id = args?.id ?? 1;
        restoredIds.push(id);
        return Promise.resolve(buildNote({ id, isTrashed: false, deletedAt: null }));
      }
      if (cmd === 'list_notes') return Promise.resolve([]);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useTrashStore.setState({ selectedIndex: 1 });

    render(<TrashPanel />);
    fireEvent.keyDown(screen.getByTestId('trash-panel'), { key: 'Enter' });

    await waitFor(() => {
      expect(useTrashStore.getState().trashedNotes.map((n) => n.id)).toEqual([1]);
    });

    fireEvent.keyDown(screen.getByTestId('trash-panel'), { key: 'Enter' });

    await waitFor(() => {
      expect(useTrashStore.getState().trashedNotes).toEqual([]);
    });
    expect(restoredIds).toEqual([2, 1]);
  });

  it('Escape closes the panel', () => {
    render(<TrashPanel />);
    fireEvent.keyDown(screen.getByTestId('trash-panel'), { key: 'Escape' });
    expect(useTrashStore.getState().isOpen).toBe(false);
  });

  it('clicking the backdrop closes the panel', () => {
    render(<TrashPanel />);
    fireEvent.click(screen.getByTestId('trash-backdrop'));
    expect(useTrashStore.getState().isOpen).toBe(false);
  });

  it('clicking a row Delete button opens the confirm dialog (sets pendingDeleteNote)', () => {
    render(<TrashPanel />);
    expect(useTrashStore.getState().pendingDeleteNote).toBeNull();
    fireEvent.click(screen.getByTestId('trash-delete-1'));
    expect(useTrashStore.getState().pendingDeleteNote?.id).toBe(1);
  });

  it('Escape does not close the Trash panel while the confirm dialog is open', () => {
    useTrashStore.setState({ pendingDeleteNote: TRASHED[0] });
    render(<TrashPanel />);
    fireEvent.keyDown(screen.getByTestId('trash-panel'), { key: 'Escape' });
    // The confirm dialog owns the keyboard; the panel must stay open.
    expect(useTrashStore.getState().isOpen).toBe(true);
  });

  it('traps Tab within the panel — wrapping the last action back to the first (Story 7.7)', () => {
    render(<TrashPanel />);
    const last = screen.getByTestId('trash-delete-2');
    last.focus();
    const notPrevented = fireEvent.keyDown(last, { key: 'Tab' });
    expect(notPrevented).toBe(false); // preventDefault — focus is wrapped, not freed
    expect(screen.getByTestId('trash-panel').contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(screen.getByTestId('trash-restore-1'));
  });

  it('wraps Shift+Tab from the initially focused row to the last action (Story 7.7)', () => {
    render(<TrashPanel />);
    const firstRow = screen.getByTestId('trash-item-1');
    expect(document.activeElement).toBe(firstRow);
    const notPrevented = fireEvent.keyDown(firstRow, { key: 'Tab', shiftKey: true });
    expect(notPrevented).toBe(false);
    expect(document.activeElement).toBe(screen.getByTestId('trash-delete-2'));
  });

  it('yields the Tab trap to the confirm-delete dialog while it is open (Story 7.7)', async () => {
    useTrashStore.setState({ pendingDeleteNote: TRASHED[0] });
    render(<TrashPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-dialog').contains(document.activeElement)).toBe(true);
    });
    // The panel-level trap is disabled (the portaled Base UI dialog runs its own).
    const notPrevented = fireEvent.keyDown(screen.getByTestId('trash-panel'), { key: 'Tab' });
    expect(notPrevented).toBe(true);
  });
});
