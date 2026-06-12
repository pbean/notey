---
title: "Story 5.2: Trash View & Note Restoration"
type: "feature"
created: "2026-06-12"
status: "done"
baseline_commit: "4cd793e973d023b29ae66cbe49655cd642b1c2e7"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 5.1 lets users soft-delete notes to trash, but trashed notes are now invisible and unrecoverable from the UI — there is no way to see what was deleted or undo it. The backend can soft-delete, but offers no way to list trashed notes or un-trash them.

**Approach:** Add a `list_trashed_notes` and a `restore_note` Tauri command (mirroring the existing `list_notes` / `trash_note` patterns), then surface a command-palette "View Trash" action that opens an overlay panel listing soft-deleted notes (newest-deleted first) with a relative deletion time and a per-note Restore action. Restoring un-trashes the note back to its original workspace, removes it from the trash list, refreshes active views, and shows a "Note restored" toast.

## Boundaries & Constraints

**Always:**
- Restore is reversible and requires NO confirmation. Set `is_trashed = 0`, `deleted_at = NULL`, `updated_at = now`, guarded by `AND is_trashed = 1`; return `NotFound` when no row changes. Never touch `workspace_id` — the note's original workspace is already stored on the row and is restored automatically.
- All IPC via tauri-specta generated bindings (`commands.restoreNote`, `commands.listTrashedNotes`) — never raw `invoke()`. Regenerate `src/generated/bindings.ts` by running backend tests after registering the commands.
- Command handlers stay thin and synchronous: lock via `recover_poisoned_db`, delegate to `services::notes`. Mirror the existing `trash_note` / `list_notes` command shapes exactly.
- Trash is global (not workspace-filtered): `list_trashed_notes` returns ALL trashed notes ordered by `deleted_at DESC`.
- The Trash view is a new overlay registered with the overlays manager (`'trash'`), mutually exclusive with search / command-palette / note-list. Reuse the `NoteListPanel` slide-from-left structure, design tokens, backdrop, and keyboard model (ArrowUp/Down, Enter, Esc, focus trap).
- Reuse `formatRelativeDate` for the deletion time, rendered as "deleted {relative}". Reuse `useToastStore.addToast` for feedback. Follow project conventions: named Zustand actions only, per-feature store, `camelCase` IPC fields, JSDoc on exported symbols, no barrel files.

**Ask First:**
- Adding permanent-delete or "empty trash" affordances to the Trash view (that is Story 5.3's confirmed-irreversible concern).
- Auto-opening the restored note in a tab, or adding a global keyboard shortcut for the Trash view (palette discovery only here).

**Never:**
- No confirmation dialog (restore is reversible).
- No permanent delete, auto-purge, or export (Stories 5.3–5.6).
- No manual mutation of `notes_fts` — restore is a plain UPDATE; the existing triggers handle sync.
- No changes to the already-correct `trash_note` service SQL or the `list_notes` active-filter.
- No workspace filtering of the trash list.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| -------- | ------------- | -------------------------- | -------------- |
| View Trash with items | ≥1 trashed note | Panel lists notes ordered `deleted_at DESC`, each showing title (or "New note") and "deleted {relative}" | N/A |
| View Trash empty | no trashed notes | Panel shows empty state "Trash is empty." in `var(--text-muted)` | N/A |
| Restore a note (happy) | click/Enter Restore on note N | `restore_note(N)` sets `is_trashed=0`, `deleted_at=null`; N removed from trash list; active note list refreshed (N reappears if its workspace is in view); toast "Note restored" | N/A |
| Restore missing / already-restored | `restore_note(N)` where N absent or `is_trashed=0` | Backend returns `NotFound`; trash list and active list unchanged; error toast "Couldn't restore note" | Frontend logs error, returns null |
| Restore last trashed note | single item restored | List becomes empty → empty state shows; panel stays open | N/A |
| Trash list load fails | backend error on `list_trashed_notes` | Panel shows error text; no crash; list empty | Logs error, sets `error` |
| Concurrent restore of same note | double-click Restore on N | Second call ignored while first is in flight (no duplicate request, no contradictory toast) | In-flight guard, no-op |

</frozen-after-approval>

## Code Map

Backend (`src-tauri/`):
- `src/services/notes.rs` -- `trash_note`/`list_notes` exist as the pattern to mirror. ADD `restore_note(conn, id)` (UPDATE un-trash, guarded `AND is_trashed = 1`, `NotFound` on 0 rows, returns `get_note`) and `list_trashed_notes(conn)` (SELECT `WHERE is_trashed = 1 ORDER BY deleted_at DESC`). `get_note` already exists.
- `src/commands/notes.rs` -- ADD thin `restore_note` and `list_trashed_notes` handlers mirroring `trash_note` / `list_notes`.
- `src/lib.rs` -- register `commands::notes::restore_note` and `commands::notes::list_trashed_notes` in `collect_commands![]` (the `export_bindings` test regenerates `bindings.ts`).
- `src/models/mod.rs` -- `Note` already carries `workspaceId`/`deletedAt`/`isTrashed`. Reference only.
- `capabilities/default.json` -- add `"allow-restore-note"`, `"allow-list-trashed-notes"`.
- `tests/acl_tests.rs` -- add both to `EXPECTED_COMMANDS`.
- `permissions/autogenerated/{restore_note,list_trashed_notes}.toml` -- create manually only if `cargo build` skips them (known Tauri v2 issue).

Frontend (`src/`):
- `generated/bindings.ts` -- auto-generated; `restoreNote`/`listTrashedNotes` appear after backend test run. Never hand-edit.
- `features/trash/store.ts` -- NEW `useTrashStore` (isOpen, trashedNotes, isLoading, error, selectedIndex; open/close/loadTrashedNotes/restoreNote/selectNext/selectPrev/resetTrash). Registers overlay `'trash'`.
- `features/trash/components/TrashPanel.tsx` -- NEW slide-from-left overlay mirroring `NoteListPanel` (backdrop, panel, header, list/empty state, keyboard nav), with a per-row Restore action and "deleted {relative}" subtitle.
- `features/overlays/manager.ts` -- add `'trash'` to the `OverlayId` union.
- `features/command-palette/hooks/usePaletteCommands.ts` -- replace the `view-trash` `stubAction` with `() => useTrashStore.getState().open()`.
- `features/editor/components/CaptureWindow.tsx` -- subscribe `isTrashOpen`, render `{isTrashOpen && <TrashPanel />}` inside the relative editor container, and include `useTrashStore.getState().isOpen` in the Ctrl+N / theme-toggle overlay guards.
- `lib/format-relative-date.ts` -- reuse `formatRelativeDate`. Reference only.
- `test-utils/setup.ts` -- add `useTrashStore.getState().resetTrash()` to the `afterEach` reset list.

## Tasks & Acceptance

**Execution:**

- [x] `src-tauri/src/services/notes.rs` -- add `restore_note(conn: &Connection, id: i64) -> Result<Note, NoteyError>` (UPDATE `is_trashed = 0, deleted_at = NULL, updated_at = ?1 WHERE id = ?2 AND is_trashed = 1`; `NotFound` on 0 rows; return `get_note(conn, id)`) and `list_trashed_notes(conn: &Connection) -> Result<Vec<Note>, NoteyError>` (`SELECT ... WHERE is_trashed = 1 ORDER BY deleted_at DESC`, same row-mapping as `list_notes`). rustdoc both.
- [x] `src-tauri/src/services/notes.rs` -- add unit tests: restore un-trashes (fields cleared, returns note); restoring a nonexistent id and an already-active note both return `NoteyError::NotFound`; `list_trashed_notes` returns only trashed notes ordered by `deleted_at DESC` and excludes active notes.
- [x] `src-tauri/src/commands/notes.rs` -- add thin `restore_note(state, id: i64) -> Result<Note, NoteyError>` and `list_trashed_notes(state) -> Result<Vec<Note>, NoteyError>`, locking via `recover_poisoned_db` and delegating to the service. Mirror `trash_note` / `list_notes`.
- [x] `src-tauri/src/lib.rs` -- add both commands to `collect_commands![]`.
- [x] `src-tauri/capabilities/default.json` -- add `"allow-restore-note"` and `"allow-list-trashed-notes"` to `permissions`.
- [x] `src-tauri/tests/acl_tests.rs` -- add both identifiers to `EXPECTED_COMMANDS`.
- [x] `src-tauri/permissions/autogenerated/restore_note.toml` & `list_trashed_notes.toml` -- create per the project-context template if absent after `cargo build`.
- [x] `src/features/trash/store.ts` -- NEW `useTrashStore`: state `{ isOpen: boolean; trashedNotes: Note[]; isLoading: boolean; error: string | null; selectedIndex: number }`; `open()` (closeOtherOverlays('trash'), set open + selectedIndex 0, then `void loadTrashedNotes()`), `close()`, `loadTrashedNotes()` (await `commands.listTrashedNotes()`; ok → set `trashedNotes`; error → console.error + `error` message), `restoreNote(noteId): Promise<Note | null>` (guard duplicate in-flight calls per id via a module `Set<number>`; await `commands.restoreNote`; ok → remove from `trashedNotes`, `void useWorkspaceStore.getState().loadFilteredNotes()`, return note; error → console.error, return null), `selectNext`/`selectPrev` (wrapping, like note-list), `resetTrash()`. JSDoc all exports. `registerOverlay('trash', () => useTrashStore.getState().close())` at module scope.
- [x] `src/features/trash/components/TrashPanel.tsx` -- NEW overlay mirroring `NoteListPanel`: backdrop (closes), focus-trapped panel (`role="navigation"`, `aria-label="Trash"`), header "Trash · N notes", list (`role="listbox"`, items `role="option"`) or empty state "Trash is empty.". Each row shows title (`note.title || 'New note'`) and `note.deletedAt ? \`deleted ${formatRelativeDate(note.deletedAt)}\` : ''`, plus a Restore control (button) — clicking it or pressing Enter on the selected row calls `restoreNote(note.id)` and shows toast "Note restored" on success / "Couldn't restore note" on null. Esc / backdrop closes and refocuses the editor. JSDoc.
- [x] `src/features/overlays/manager.ts` -- add `'trash'` to the `OverlayId` union type.
- [x] `src/features/command-palette/hooks/usePaletteCommands.ts` -- import `useTrashStore`; set the `view-trash` command `action` to `() => useTrashStore.getState().open()` (remove its `stubAction`).
- [x] `src/features/editor/components/CaptureWindow.tsx` -- import `TrashPanel`/`useTrashStore`; subscribe `isTrashOpen`; render `{isTrashOpen && <TrashPanel />}` in the relative container; add `useTrashStore.getState().isOpen` to the existing overlay guards in the Ctrl+N and Ctrl/Cmd+Shift+T handlers.
- [x] `src/test-utils/setup.ts` -- add `useTrashStore.getState().resetTrash()` to the `afterEach` cleanup.
- [x] `src/features/trash/store.test.ts` -- NEW: `loadTrashedNotes` populates from `listTrashedNotes` and sets error on failure; `restoreNote` success removes the note and triggers a filtered-notes refresh, returns the note; backend error returns null; concurrent restore of the same id makes a single backend call; `open` closes other overlays and loads.
- [x] `src/features/trash/components/TrashPanel.test.tsx` -- NEW: renders trashed notes with "deleted {relative}" subtitles ordered as given; empty state shows "Trash is empty."; clicking Restore calls the store and shows the "Note restored" toast; Esc closes.

**Acceptance Criteria:**

- Given registered commands, when the frontend calls `commands.listTrashedNotes()`, then it returns only notes with `is_trashed = 1` ordered by `deleted_at` descending, and `commands.restoreNote(id)` on a trashed note sets `is_trashed=0` and `deleted_at=null` and returns the note now appearing in `listNotes`.
- Given the palette "View Trash" command is invoked, when it runs, then the Trash overlay opens (closing any other overlay) and lists soft-deleted notes with a relative deletion time, or shows "Trash is empty." when there are none.
- Given a trashed note in the Trash view, when the user restores it, then it disappears from the trash list, reappears in the active note list for its original workspace, and a non-blocking toast "Note restored" appears.
- Given `restore_note` is invoked for a missing or already-active note, when it runs, then the backend returns `NotFound`, lists are unchanged, and an error toast "Couldn't restore note" is shown.
- Given the new commands, when `cargo test` runs, then `acl_tests` passes with `allow-restore-note` and `allow-list-trashed-notes`, and `bindings.ts` contains `restoreNote` and `listTrashedNotes`.

### Review Findings

- [x] [Review][Patch] Concurrent restore shows a false failure toast [src/features/trash/components/TrashPanel.tsx:27]
- [x] [Review][Patch] Restoring the selected last item leaves keyboard selection stale [src/features/trash/store.ts:80]
- [x] [Review][Patch] Trash loading can show stale or misleading state and misses thrown binding errors [src/features/trash/store.ts:61]
- [x] [Review][Patch] The View Trash palette flow lacks regression coverage [src/features/command-palette/components/CommandPalette.test.tsx:81]

#### Review Ledger (2026-06-12T15:33:52-07:00)

patch: Concurrent restore shows a false failure toast [src/features/trash/components/TrashPanel.tsx:27] — duplicate restore clicks are supposed to be ignored, but the panel turns the deduped null result into "Couldn't restore note".
patch: Restoring the selected last item leaves keyboard selection stale [src/features/trash/store.ts:80] — the store removes the row without clamping selectedIndex, so Enter can stop matching the highlighted row.
patch: Trash loading can show stale or misleading state and misses thrown binding errors [src/features/trash/store.ts:61] — opening trash can flash empty or stale content, older loads can win races, and thrown Error instances bypass the intended error UI.
patch: The View Trash palette flow lacks regression coverage [src/features/command-palette/components/CommandPalette.test.tsx:81] — the only command-selection test was repointed to Open Settings, so the acceptance path is no longer covered.
dismiss: Restore buttons stay enabled during an in-flight restore [src/features/trash/components/TrashPanel.tsx:205] — duplicate of the concurrent-restore bug; fixing the dedupe/toast path resolves the user-visible defect.
dismiss: Arrow navigation does not move DOM focus [src/features/trash/components/TrashPanel.tsx:64] — matches the existing NoteListPanel keyboard model that this story was asked to mirror.
dismiss: Tab focus trap does not cycle between child controls [src/features/trash/components/TrashPanel.tsx:75] — matches the existing NoteListPanel focus-trap behavior requested by the spec.

## Design Notes

This story is mostly *exposure + a new read-only overlay*: the schema, FTS triggers, and `Note` model already support trash/restore. The hard parts are already solved patterns — copy them rather than invent.

- `restore_note` is the exact inverse of `trash_note`: same guard-and-rowcount shape, just clearing the fields instead of setting them. Keep the `AND is_trashed = 1` guard so restoring a non-trashed/absent note is a clean `NotFound`, not a silent no-op.
- The Trash overlay is a structural clone of `NoteListPanel` (backdrop + slide-from-left panel + listbox + keyboard model). The differences are: data source is `useTrashStore.trashedNotes` (not workspace `filteredNotes`), the subtitle is "deleted {relative}" from `deletedAt`, and the row action is Restore (not open-in-tab).
- Toast lives in the UI layer (component), mirroring 5.1 where the store does data and the orchestrator shows the toast. The store's `restoreNote` returns `Note | null`; the panel decides the toast.
- Guard concurrent restores of the same id with a module-level `Set<number>` (added on entry, removed in `finally`), cleared by `resetTrash`. This mirrors the `isTrashingNote` guard in `command-palette/actions.ts` but keyed per-note so restoring two different notes quickly still works.

## Verification

**Commands:**

- `cd src-tauri && cargo test` -- expected: all pass, including `acl_tests` (with `allow-restore-note`, `allow-list-trashed-notes`) and the new notes service tests; regenerates `src/generated/bindings.ts` with `restoreNote`/`listTrashedNotes`.
- `cd src-tauri && cargo clippy -- -D warnings` -- expected: clean (CI gate).
- `npm run test` -- expected: trash store and TrashPanel tests pass.
- `npm run build` -- expected: `tsc` typecheck clean (confirms the new bindings exist and types line up) and Vite build succeeds.

**Manual checks:**

- Trash a note, then Ctrl/Cmd+P → "View Trash": the note appears with "deleted just now". Click Restore: it vanishes from the trash list, reappears in the note list, and a bottom-right "Note restored" toast fades after ~3s. Reopen Trash with nothing deleted: it reads "Trash is empty."
