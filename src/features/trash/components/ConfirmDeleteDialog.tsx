import { useRef } from 'react';
import { useTrashStore } from '../store';
import { useToastStore } from '../../toast/store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * Confirmation modal for the one irreversible note action: permanent deletion.
 *
 * Renders nothing until `pendingDeleteNote` is set (via the Trash view's "Delete"
 * control). Uses the shadcn-style Base UI Dialog as an `alertdialog`, with Cancel
 * as the default-focused safe action and a danger-styled "Delete Forever" button
 * in `var(--error)`. Esc, Cancel, or a backdrop click dismiss with no deletion.
 */
export function ConfirmDeleteDialog() {
  const pendingDeleteNote = useTrashStore((s) => s.pendingDeleteNote);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const handleOpenChange = (open: boolean) => {
    if (!open) useTrashStore.getState().cancelPermanentDelete();
  };

  /** Permanently delete the pending note and surface the outcome as a toast. */
  const confirmDelete = async (noteId: number) => {
    const trashStore = useTrashStore.getState();
    if (trashStore.isPermanentlyDeleting(noteId)) return;

    const ok = await trashStore.permanentlyDeleteNote(noteId);
    useToastStore
      .getState()
      .addToast(ok ? 'Note permanently deleted' : "Couldn't delete note");
  };

  const title = pendingDeleteNote?.title || 'New note';

  return (
    <Dialog open={pendingDeleteNote != null} onOpenChange={handleOpenChange}>
      <DialogContent
        role="alertdialog"
        aria-modal="true"
        showCloseButton={false}
        initialFocus={cancelRef}
        data-testid="confirm-delete-dialog"
        className="max-w-sm"
      >
        <DialogHeader>
          <DialogTitle className="sr-only">Confirm permanent deletion</DialogTitle>
          <DialogDescription className="text-foreground">
            Permanently delete {title}? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            ref={cancelRef}
            variant="outline"
            data-testid="confirm-delete-cancel"
            onClick={() => useTrashStore.getState().cancelPermanentDelete()}
          >
            Cancel
          </Button>
          <Button
            data-testid="confirm-delete-confirm"
            className="bg-[var(--error)] text-white hover:opacity-90"
            onClick={() => {
              if (pendingDeleteNote) void confirmDelete(pendingDeleteNote.id);
            }}
          >
            Delete Forever
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
