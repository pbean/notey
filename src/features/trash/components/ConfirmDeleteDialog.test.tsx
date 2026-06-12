import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { mockInvoke } from '../../../test-utils/setup';
import { useTrashStore } from '../store';
import { useToastStore } from '../../toast/store';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { buildNote } from '../../../test-utils/factories';

// Base UI's Dialog uses ResizeObserver internally, which jsdom does not provide.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

const NOTE = buildNote({ id: 1, title: 'My Note', isTrashed: true, deletedAt: '2026-06-10T12:00:00+00:00' });

describe('ConfirmDeleteDialog', () => {
  beforeEach(() => {
    useTrashStore.getState().resetTrash();
  });

  it('renders nothing when there is no pending delete', () => {
    render(<ConfirmDeleteDialog />);
    expect(screen.queryByTestId('confirm-delete-dialog')).toBeNull();
  });

  it('shows the confirmation message for the pending note', async () => {
    useTrashStore.setState({ pendingDeleteNote: NOTE });
    render(<ConfirmDeleteDialog />);
    await waitFor(() => {
      expect(
        screen.getByText('Permanently delete My Note? This cannot be undone.'),
      ).toBeInTheDocument();
    });
  });

  it('falls back to "New note" for an untitled note', async () => {
    useTrashStore.setState({
      pendingDeleteNote: buildNote({ id: 2, title: '', isTrashed: true, deletedAt: null }),
    });
    render(<ConfirmDeleteDialog />);
    await waitFor(() => {
      expect(
        screen.getByText('Permanently delete New note? This cannot be undone.'),
      ).toBeInTheDocument();
    });
  });

  it('exposes accessible alertdialog markup', async () => {
    useTrashStore.setState({ pendingDeleteNote: NOTE });
    render(<ConfirmDeleteDialog />);
    const dialog = await screen.findByTestId('confirm-delete-dialog');
    expect(dialog).toHaveAttribute('role', 'alertdialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('renders above the Trash panel stacking layer', async () => {
    useTrashStore.setState({ pendingDeleteNote: NOTE });
    render(<ConfirmDeleteDialog />);
    const dialog = await screen.findByTestId('confirm-delete-dialog');
    expect(dialog.className).toContain('z-[61]');

    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    expect(overlay?.className).toContain('z-[60]');
  });

  it('Cancel dismisses without deleting', async () => {
    useTrashStore.setState({ pendingDeleteNote: NOTE });
    render(<ConfirmDeleteDialog />);
    const cancel = await screen.findByTestId('confirm-delete-cancel');
    fireEvent.click(cancel);

    expect(useTrashStore.getState().pendingDeleteNote).toBeNull();
    expect(mockInvoke).not.toHaveBeenCalledWith('delete_note_permanently', expect.anything());
  });

  it('Delete Forever deletes the note and shows a success toast', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'delete_note_permanently') return Promise.resolve(null);
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useTrashStore.setState({ trashedNotes: [NOTE], pendingDeleteNote: NOTE });
    render(<ConfirmDeleteDialog />);

    fireEvent.click(await screen.findByTestId('confirm-delete-confirm'));

    await waitFor(() => {
      expect(useTrashStore.getState().trashedNotes).toEqual([]);
    });
    await waitFor(() => {
      expect(
        useToastStore.getState().toasts.some((t) => t.message === 'Note permanently deleted'),
      ).toBe(true);
    });
    expect(useTrashStore.getState().pendingDeleteNote).toBeNull();
  });

  it('ignores a second confirm click while the same delete is already in flight', async () => {
    let resolveDelete: ((value: null) => void) | undefined;
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'delete_note_permanently') {
        return new Promise<null>((resolve) => {
          resolveDelete = resolve;
        });
      }
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useTrashStore.setState({ trashedNotes: [NOTE], pendingDeleteNote: NOTE });
    render(<ConfirmDeleteDialog />);

    const confirm = await screen.findByTestId('confirm-delete-confirm');
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(mockInvoke.mock.calls.filter(([cmd]) => cmd === 'delete_note_permanently')).toHaveLength(1);
    expect(useToastStore.getState().toasts).toEqual([]);

    resolveDelete?.(null);

    await waitFor(() => {
      expect(
        useToastStore.getState().toasts.filter((t) => t.message === 'Note permanently deleted'),
      ).toHaveLength(1);
    });
    expect(
      useToastStore.getState().toasts.some((t) => t.message === "Couldn't delete note"),
    ).toBe(false);
  });

  it('keeps a newer confirmation dialog open when an earlier delete resolves', async () => {
    const secondNote = buildNote({
      id: 2,
      title: 'Second Note',
      isTrashed: true,
      deletedAt: '2026-06-11T12:00:00+00:00',
    });
    let resolveDelete: ((value: null) => void) | undefined;
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'delete_note_permanently') {
        return new Promise<null>((resolve) => {
          resolveDelete = resolve;
        });
      }
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useTrashStore.setState({
      trashedNotes: [NOTE, secondNote],
      pendingDeleteNote: NOTE,
    });
    render(<ConfirmDeleteDialog />);

    fireEvent.click(await screen.findByTestId('confirm-delete-confirm'));
    useTrashStore.getState().requestPermanentDelete(secondNote);
    resolveDelete?.(null);

    await waitFor(() => {
      expect(useTrashStore.getState().trashedNotes.map((note) => note.id)).toEqual([2]);
    });
    expect(useTrashStore.getState().pendingDeleteNote?.id).toBe(2);
    expect(
      await screen.findByText('Permanently delete Second Note? This cannot be undone.'),
    ).toBeInTheDocument();
  });

  it('shows an error toast when permanent delete fails', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'delete_note_permanently') return Promise.reject({ type: 'NotFound' });
      return Promise.reject(new Error(`unmocked: ${cmd}`));
    });
    useTrashStore.setState({ trashedNotes: [NOTE], pendingDeleteNote: NOTE });
    render(<ConfirmDeleteDialog />);

    fireEvent.click(await screen.findByTestId('confirm-delete-confirm'));

    await waitFor(() => {
      expect(
        useToastStore.getState().toasts.some((t) => t.message === "Couldn't delete note"),
      ).toBe(true);
    });
    expect(useTrashStore.getState().trashedNotes).toEqual([NOTE]);
  });
});
