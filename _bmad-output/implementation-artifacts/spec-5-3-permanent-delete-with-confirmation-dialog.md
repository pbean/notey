---
title: "Story 5.3: Permanent Delete with Confirmation Dialog"
type: "feature"
created: "2026-06-12"
status: "done"
baseline_commit: "a9c03086b7c12a08ea33d97b3c9bf5618e263275"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 5.2 gives the Trash view restore, but trashed notes can only be recovered — there is no way to remove a note forever, so trash grows without an explicit escape hatch. Permanent deletion is the one irreversible lifecycle action and must be gated by a confirmation step so a single click never destroys data.

**Approach:** Add a `delete_note_permanently` Tauri command/service that hard-`DELETE`s a *trashed* note (the FTS5 DELETE trigger removes its index row automatically), then add a per-row "Delete" trigger in the Trash view that opens an accessible confirmation modal ("Permanently delete [title]? This cannot be undone.") built on the existing `@/components/ui/dialog` (Base UI) component. Confirming permanently deletes the note and refreshes trash; Cancel/Esc dismiss with no action.

## Boundaries & Constraints

**Always:**
- Permanent delete is the ONLY irreversible action and the ONLY place a confirmation modal is intentional. The dialog uses the project's shadcn-style `Dialog`/`DialogContent` (Base UI) with `role="alertdialog"` and `aria-modal="true"`; **Cancel is the default-focused, safe action**; Esc or Cancel dismisses with no deletion.
- The "Delete Forever" confirm button is rendered in the error color using `var(--error)`.
- Backend `delete_note_permanently(conn, id)` runs `DELETE FROM notes WHERE id = ?1 AND is_trashed = 1` — the `AND is_trashed = 1` guard makes it impossible to hard-delete an active note; 0 rows changed returns `NoteyError::NotFound`. The existing `notes_fts_ad` DELETE trigger keeps `notes_fts` in sync — never touch the FTS table manually.
- All IPC via tauri-specta generated bindings (`commands.deleteNotePermanently`) — never raw `invoke()`. Regenerate `src/generated/bindings.ts` by running backend tests after registering the command.
- The command handler stays thin and synchronous: lock via `recover_poisoned_db`, delegate to `services::notes`. Mirror the existing `trash_note` / `restore_note` command shapes exactly.
- Confirm state lives in `useTrashStore` (`pendingDeleteNote`). Guard concurrent confirm clicks with a per-id in-flight latch (mirror the `restoringIds` pattern). Follow project conventions: named Zustand actions only, `camelCase` IPC fields, JSDoc on exported symbols, no barrel files.
- Reuse `useToastStore.addToast` for feedback: "Note permanently deleted" on success, "Couldn't delete note" on failure.

**Ask First:**
- Adding an "Empty Trash" / bulk permanent-delete affordance (this story is per-note only).
- Allowing permanent delete from anywhere other than the Trash view, or permanently deleting a non-trashed note.

**Never:**
- No hard-delete of active (non-trashed) notes — the `is_trashed = 1` guard is mandatory.
- No manual mutation of `notes_fts` — the DELETE trigger handles index sync.
- No skipping the confirmation for permanent delete; no confirmation added to reversible actions (trash/restore stay prompt-free).
- No auto-purge, export, or changes to the existing `trash_note` / `restore_note` / `list_trashed_notes` SQL (Stories 5.4–5.6 / already shipped).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| -------- | ------------- | -------------------------- | -------------- |
| Open confirm dialog | click "Delete" on trashed note N | Centered modal over dimmed backdrop, `role="alertdialog"`, `aria-modal="true"`, message "Permanently delete {title or 'New note'}? This cannot be undone."; Cancel default-focused; "Delete Forever" in `var(--error)` | N/A |
| Confirm permanent delete (happy) | click "Delete Forever" | `deleteNotePermanently(N)` deletes the row (+ FTS via trigger); N removed from `trashedNotes`; `selectedIndex` clamped; dialog closes; toast "Note permanently deleted" | N/A |
| Cancel via button or Esc | Cancel / Esc / backdrop click | Dialog closes, no backend call, note remains in trash; Trash panel stays open and is not also dismissed by the Esc | N/A |
| Delete last trashed note | confirm on the only item | `trashedNotes` empties → "Trash is empty." shown; dialog closed | N/A |
| Delete missing / already-gone / active | `deleteNotePermanently(N)` where N absent, not trashed, or already deleted | Backend returns `NotFound`; trash list unchanged; error toast "Couldn't delete note" | Frontend logs error, returns false |
| Concurrent confirm clicks | double-click "Delete Forever" | Second call ignored while first is in flight (single backend call, one toast) | Per-id in-flight latch, no-op |

</frozen-after-approval>

## Code Map

Backend (`src-tauri/`):
- `src/services/notes.rs` -- ADD `delete_note_permanently(conn, id) -> Result<(), NoteyError>` (`DELETE ... WHERE id = ?1 AND is_trashed = 1`, `NotFound` on 0 rows). `trash_note`/`restore_note` are the pattern to mirror; `notes_fts_ad` trigger (`src/db/mod.rs`) auto-syncs FTS on DELETE.
- `src/commands/notes.rs` -- ADD thin `delete_note_permanently(state, id)` handler mirroring `trash_note`.
- `src/lib.rs` -- register `commands::notes::delete_note_permanently` in `collect_commands![]` (the `export_bindings` test regenerates `bindings.ts`).
- `capabilities/default.json` -- add `"allow-delete-note-permanently"` to `permissions`.
- `tests/acl_tests.rs` -- add `"allow-delete-note-permanently"` to `EXPECTED_COMMANDS`.
- `permissions/autogenerated/delete_note_permanently.toml` -- create manually only if `cargo build` skips it (known Tauri v2 issue per project-context).

Frontend (`src/`):
- `generated/bindings.ts` -- auto-generated; `deleteNotePermanently` appears after backend test run. Never hand-edit.
- `features/trash/store.ts` -- ADD `pendingDeleteNote: Note | null` state + actions `requestPermanentDelete(note)`, `cancelPermanentDelete()`, `permanentlyDeleteNote(noteId): Promise<boolean>`; add a module-level `deletingIds` latch; extend `resetTrash` to clear the new field.
- `features/trash/components/ConfirmDeleteDialog.tsx` -- NEW confirmation modal using `@/components/ui/dialog` + `@/components/ui/button`.
- `features/trash/components/TrashPanel.tsx` -- add a per-row "Delete" button (opens the dialog via `requestPermanentDelete`), render `<ConfirmDeleteDialog />`, and early-return in `handleKeyDown` when `pendingDeleteNote` is set so the dialog owns its keys.
- `features/toast/store.ts` -- reuse `addToast`. Reference only.
- `components/ui/dialog.tsx`, `components/ui/button.tsx` -- existing Base UI components to reuse. Reference only.
- `test-utils/setup.ts` -- already calls `resetTrash()` in `afterEach`; no change needed once `resetTrash` clears the new field.

## Tasks & Acceptance

**Execution:**

- [x] `src-tauri/src/services/notes.rs` -- add `delete_note_permanently(conn: &Connection, id: i64) -> Result<(), NoteyError>` running `DELETE FROM notes WHERE id = ?1 AND is_trashed = 1`; return `NoteyError::NotFound` when 0 rows change, else `Ok(())`. rustdoc it (note the trashed-only guard and automatic FTS sync).
- [x] `src-tauri/src/services/notes.rs` -- add unit tests: deletes a trashed note (row gone from `notes`; gone from `list_trashed_notes`); deleting a nonexistent id, an active (non-trashed) note, and an already-deleted id each return `NoteyError::NotFound`; deleting a trashed note removes its `notes_fts` row (search no longer returns it).
- [x] `src-tauri/src/commands/notes.rs` -- add thin `delete_note_permanently(state, id: i64) -> Result<(), NoteyError>` locking via `recover_poisoned_db` and delegating to the service; rustdoc + `#[tauri::command] #[specta::specta]`.
- [x] `src-tauri/src/lib.rs` -- add `commands::notes::delete_note_permanently` to `collect_commands![]`.
- [x] `src-tauri/capabilities/default.json` -- add `"allow-delete-note-permanently"` to `permissions`.
- [x] `src-tauri/tests/acl_tests.rs` -- add `"allow-delete-note-permanently"` to `EXPECTED_COMMANDS`.
- [x] `src-tauri/permissions/autogenerated/delete_note_permanently.toml` -- create per the project-context template only if absent after `cargo build`.
- [x] `src/features/trash/store.ts` -- add `pendingDeleteNote: Note | null` (init null); `requestPermanentDelete(note)` sets it; `cancelPermanentDelete()` sets it null; `permanentlyDeleteNote(noteId): Promise<boolean>` — guard duplicate in-flight via module `deletingIds: Set<number>`; await `commands.deleteNotePermanently(noteId)`; ok → remove from `trashedNotes`, clamp `selectedIndex` to `Math.max(0, len-1)`, set `pendingDeleteNote: null`, return true; error → `console.error`, return false; `finally` clears the latch. Extend `resetTrash` to set `pendingDeleteNote: null` and `deletingIds.clear()`. JSDoc all new exports.
- [x] `src/features/trash/components/ConfirmDeleteDialog.tsx` -- NEW. Subscribe `pendingDeleteNote`; render the Base UI `Dialog` controlled by `open={pendingDeleteNote != null}` with `onOpenChange(open) => { if (!open) cancelPermanentDelete() }`. `DialogContent` with `showCloseButton={false}`, `role="alertdialog"`, `aria-modal="true"` (via the Popup `render`/role override; assert in tests), `initialFocus` set to the Cancel button ref. Body text: ``Permanently delete ${pendingDeleteNote.title || 'New note'}? This cannot be undone.`` Footer: Cancel `<Button variant="outline">` (default-focused) calling `cancelPermanentDelete`; "Delete Forever" `<Button>` styled with `var(--error)` (e.g. `className="bg-[var(--error)] text-white hover:opacity-90"`) calling `permanentlyDeleteNote(note.id)` then `addToast(ok ? 'Note permanently deleted' : "Couldn't delete note")`. JSDoc.
- [x] `src/features/trash/components/TrashPanel.tsx` -- add a per-row "Delete" `<button>` (next to Restore, `data-testid={`trash-delete-${note.id}`}`) calling `useTrashStore.getState().requestPermanentDelete(note)`; render `<ConfirmDeleteDialog />` inside the panel; in `handleKeyDown`, early-return when `useTrashStore.getState().pendingDeleteNote` is set so Esc/Enter/Arrows are handled by the dialog, not the panel.
- [x] `src/features/trash/store.test.ts` -- add: `requestPermanentDelete`/`cancelPermanentDelete` toggle `pendingDeleteNote`; `permanentlyDeleteNote` success removes the note, clamps `selectedIndex`, clears `pendingDeleteNote`, returns true; backend error returns false and leaves the list unchanged; concurrent calls for the same id make a single backend call; `resetTrash` clears `pendingDeleteNote`.
- [x] `src/features/trash/components/ConfirmDeleteDialog.test.tsx` -- NEW: shows nothing when `pendingDeleteNote` is null; renders the "Permanently delete {title}? This cannot be undone." message (and "New note" for empty title); the dialog element exposes `role="alertdialog"` and `aria-modal="true"`; clicking Cancel (and pressing Esc) calls `cancelPermanentDelete` and makes no backend call; clicking "Delete Forever" calls the store and shows the success/failure toast.
- [x] `src/features/trash/components/TrashPanel.test.tsx` -- add: clicking a row's "Delete" button sets `pendingDeleteNote` (dialog appears); pressing Esc while the confirm dialog is open does not close the Trash panel.

**Acceptance Criteria:**

- Given the `delete_note_permanently` command is registered, when the frontend calls `commands.deleteNotePermanently(id)` for a trashed note, then the row is removed from `notes` and no longer returned by `listTrashedNotes` or full-text search; calling it for a missing or non-trashed note returns `NotFound`.
- Given a trashed note in the Trash view, when the user clicks its "Delete" control, then a centered modal appears over a dimmed backdrop with `role="alertdialog"`, `aria-modal="true"`, the message "Permanently delete [title]? This cannot be undone.", a Cancel button that is default-focused, and a "Delete Forever" button in `var(--error)`.
- Given the confirmation dialog is open, when the user clicks "Delete Forever", then the note is permanently deleted, the dialog closes, the trash list refreshes (the note is gone, "Trash is empty." if it was the last), and a "Note permanently deleted" toast appears.
- Given the confirmation dialog is open, when the user clicks Cancel or presses Esc, then the dialog closes with no deletion and the Trash panel remains open.
- Given the new command, when `cargo test` runs, then `acl_tests` passes with `allow-delete-note-permanently` and `bindings.ts` contains `deleteNotePermanently`.

### Review Findings

- [x] [Review][Patch] Duplicate confirm click emits a failure toast instead of a no-op [src/features/trash/components/ConfirmDeleteDialog.tsx:31]
- [x] [Review][Patch] In-flight delete completion can close a newer confirmation dialog [src/features/trash/store.ts:158]
- [x] [Review][Patch] Confirmation dialog renders beneath the Trash panel [src/components/ui/dialog.tsx:32]

#### Review Ledger (2026-06-12T16:06:42-07:00)

patch: Duplicate confirm click emits a failure toast instead of a no-op [src/features/trash/components/ConfirmDeleteDialog.tsx:31] — second click hits the in-flight guard but still triggers the dialog's failure toast path
patch: In-flight delete completion can close a newer confirmation dialog [src/features/trash/store.ts:158] — success always clears `pendingDeleteNote`, even if the user already opened a different note
patch: Confirmation dialog renders beneath the Trash panel [src/components/ui/dialog.tsx:32] — shared dialog overlay/popup use `z-50` while the Trash panel sits at `zIndex: 51`
dismiss: Missing toast handling in the trash store [src/features/trash/store.ts:152] — contradicted by `ConfirmDeleteDialog`, which already owns success/failure toasts
dismiss: Selected index should be rebased instead of clamped [src/features/trash/store.ts:162] — the story explicitly calls for clamping `selectedIndex`, and the implementation matches that contract
dismiss: `resetTrash()` makes permanent-delete concurrency unsafe [src/features/trash/store.ts:189] — `resetTrash()` is test cleanup only, not a runtime user path
dismiss: Failed permanent delete should close the dialog [src/features/trash/store.ts:167] — the story requires an unchanged list plus an error toast, not forced dismissal
dismiss: Imperative `getState()` usage desynchronizes `TrashPanel` [src/features/trash/components/TrashPanel.tsx:65] — no concrete bug remained after code verification, and this matches existing store usage patterns
dismiss: Delete button must use the shared Button primitive [src/features/trash/components/TrashPanel.tsx:246] — the approved story checklist explicitly called for a per-row `button`
dismiss: `ConfirmDeleteDialog` is missing from the change set [src/features/trash/components/ConfirmDeleteDialog.tsx:1] — contradicted by the added component file and its test coverage in the current diff
dismiss: Permanent-delete permission TOML is missing [src-tauri/permissions/autogenerated/delete_note_permanently.toml:1] — contradicted by the added permission artifact in the current diff
dismiss: Destructive flow lacks confirm/toast coverage [src/features/trash/components/ConfirmDeleteDialog.test.tsx:69] — current tests already cover confirm success and failure toasts; the remaining gaps are non-blocking

## Spec Change Log

## Design Notes

This story is a thin backend command + an accessible confirm modal layered onto the existing Trash view. The hard infrastructure (FTS DELETE trigger, Trash overlay, toast, Base UI Dialog) already exists — reuse it.

- **Backend symmetry:** `delete_note_permanently` mirrors `trash_note`/`restore_note` exactly (same lock → service → rowcount → `NotFound` shape), but it is a `DELETE` and returns `()` — there is no note to return once it is gone. The `AND is_trashed = 1` guard is the safety invariant that upholds project-context's "never hard-delete active notes" rule: permanent delete is reachable only for already-trashed rows. The `notes_fts_ad` trigger in `src/db/mod.rs` removes the FTS row on DELETE — do not write to `notes_fts`.
- **Dialog choice:** the project already ships a Base UI–based shadcn-style `Dialog` (`src/components/ui/dialog.tsx`, used by the command palette). Reuse it rather than hand-rolling a modal: it provides the focus trap, scroll lock, backdrop, Esc-to-close, and `initialFocus`. Base UI's Popup renders `role="dialog"` by default — override to `alertdialog` (direct `role`/`aria-modal` props or the Popup `render` prop) and assert it in the component test so the AC is enforced. `showCloseButton={false}` keeps the only actions Cancel / Delete Forever.
- **Token-system note:** the Dialog lives in the shadcn/Tailwind token world (`bg-popover`, etc.), while the rest of the Trash view uses the app's `var(--…)` tokens. The "Delete Forever" button bridges this by setting its color explicitly to `var(--error)` (the AC's literal requirement) via an arbitrary Tailwind value.
- **Keyboard isolation:** the confirm Dialog is modal and portaled, but Base UI's portal preserves React-tree event bubbling, so a keydown inside the dialog can reach `TrashPanel.handleKeyDown`. Early-returning from that handler whenever `pendingDeleteNote` is set prevents the panel from also acting on the dialog's Esc/Enter (e.g. Esc cancelling the delete must not also close Trash).
- **Concurrency:** reuse the `restoringIds`-style module `Set<number>` latch (`deletingIds`) keyed per-note so a double-click on "Delete Forever" issues exactly one backend call and one toast.

## Verification

**Commands:**

- `cd src-tauri && cargo test` -- expected: all pass, including `acl_tests` (with `allow-delete-note-permanently`) and the new `delete_note_permanently` service tests; regenerates `src/generated/bindings.ts` with `deleteNotePermanently`.
- `cd src-tauri && cargo clippy -- -D warnings` -- expected: clean (CI gate).
- `npm run test` -- expected: trash store, ConfirmDeleteDialog, and TrashPanel tests pass.
- `npm run build` -- expected: `tsc` typecheck clean (confirms the new binding exists and types line up) and Vite build succeeds.

**Manual checks:**

- Trash a note, Ctrl/Cmd+P → "View Trash", click its "Delete": a centered modal appears reading "Permanently delete [title]? This cannot be undone." with Cancel focused and a red "Delete Forever" button. Press Esc: dialog closes, note still in trash, panel still open. Click "Delete" again → "Delete Forever": note vanishes from trash, a bottom-right "Note permanently deleted" toast fades, and reopening search confirms the note is unrecoverable.
