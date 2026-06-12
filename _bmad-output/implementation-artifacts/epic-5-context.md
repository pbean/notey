# Epic 5 Context: Note Lifecycle & Data Export

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

This epic gives users full control over the end of a note's life and the portability of their data. Notes are never destroyed by a single action: deleting a note moves it to a recoverable trash, where it can be restored to its original workspace or, deliberately, removed forever. Trash older than a configurable retention window is silently purged so deleted notes don't accumulate. In parallel, the epic delivers data portability — users can export all active notes either as individual Markdown files (with YAML frontmatter) or as a single JSON bundle — reinforcing the product's "your data is local, yours, and never locked in" trust promise. The throughline is data-loss anxiety elimination: deletion is reversible, irreversible actions are explicitly confirmed, and an escape hatch to standard formats is always one command away.

## Stories

- Story 5.1: Soft-Delete Note to Trash with Toast
- Story 5.2: Trash View & Note Restoration
- Story 5.3: Permanent Delete with Confirmation Dialog
- Story 5.4: Trash Auto-Purge (30-Day Retention)
- Story 5.5: Markdown Export with Native File Picker
- Story 5.6: JSON Export

## Requirements & Constraints

- Soft-delete, restore, and permanent-delete are the three distinct lifecycle operations. Soft-delete and restore are reversible and require no confirmation; permanent delete is irreversible and must be explicitly confirmed.
- Soft-deleted notes must remain recoverable for at least 30 days. The retention threshold is configurable in `config.toml` (e.g., `[trash] retention_days = 30`).
- Auto-purge runs at application startup as a silent background operation with no user notification, using a single date-comparison DELETE.
- Markdown export writes one `.md` file per active (non-trashed) note, each with YAML frontmatter (`title`, `created_at`, `updated_at`, `workspace`, `format`); filenames derive from the note title, sanitized for filesystem safety.
- JSON export writes all active notes as a single, 2-space-indented `.json` file containing an array of note objects with full metadata.
- Filesystem access must be scoped strictly to the user-selected export directory/file via Tauri's scoped filesystem capability — no broad filesystem access.
- Bulk export of 10,000 notes must complete within 30 seconds; export is performed in a streaming fashion to meet this budget.
- Permanent-delete confirmation must use accessible modal markup (`role="alertdialog"`, `aria-modal="true"`), with Cancel as the default-focused, safe action.

## Technical Decisions

- **Data model:** The `notes` table carries `deleted_at` (TEXT NULL) and `is_trashed` (INTEGER NOT NULL DEFAULT 0). Convention: `deletedAt: null` / `isTrashed: false` means active; a timestamp means soft-deleted. Soft-delete sets `is_trashed = 1` and `deleted_at` to an ISO8601 timestamp; restore resets them to `0` / `null`.
- **FTS5 sync is automatic:** `notes_fts` is an external-content FTS5 virtual table kept in sync by SQLite triggers on INSERT/UPDATE/DELETE. Soft-delete/restore are plain UPDATEs; permanent delete and auto-purge are DELETEs from `notes` — the triggers remove the corresponding `notes_fts` rows. Do not manually mutate the FTS table.
- **Layering:** Thin Tauri command handlers delegate to testable services. Lifecycle logic lives in the note service; export generation lives in a dedicated export service. The frontend never touches the database, filesystem, or system APIs directly — it only invokes commands.
- **Relevant commands:** `trash_note`, `restore_note`, permanent delete, plus `export_markdown` and `export_json`. Command names are `snake_case`; the IPC/serialization boundary uses `camelCase` JSON fields (e.g., `workspaceName`, `createdAt`, `isTrashed`).
- **Type generation:** Use tauri-specta generated TypeScript bindings for all command invocations — never hand-write `invoke()` types.
- **Path safety:** Validate/canonicalize file paths (`std::fs::canonicalize()`) before any filesystem write to prevent traversal, in addition to Tauri scope enforcement.
- **Error handling:** Rust services surface errors via a `thiserror` enum, serialized by Tauri commands to strings for the frontend's consistent error handling.

## UX & Interaction Patterns

- **Discovery via command palette:** Trash view, restore, and both export formats are reached through the Ctrl/Cmd+P command palette ("View Trash", "Export to Markdown", "Export to JSON") — none clutter the default editor view.
- **Feedback is non-blocking toasts** (bottom-right, do not interrupt typing): "Note moved to trash" (3s), "Note restored" (3s), "Exported N notes to /path" (5s). Markdown export shows a progress toast ("Exporting... N/total") when it exceeds ~2s.
- **Soft-delete side effects:** if the deleted note was open in a tab, close that tab and activate an adjacent tab (or fall back to the empty state).
- **Trash view:** lists soft-deleted notes ordered by `deleted_at` DESC, showing title and a relative deletion time ("deleted 3 days ago"); empty state reads "Trash is empty." in `var(--text-muted)`.
- **Permanent delete confirmation:** centered shadcn Dialog with dimmed backdrop, message "Permanently delete [title]? This cannot be undone."; the "Delete Forever" button uses `var(--error)`; Cancel is default-focused; Esc or Cancel dismisses with no action. This is the one place a modal confirmation is intentional — irreversible actions only; reversible actions never prompt.
- **Native pickers:** Markdown export opens an OS directory picker; JSON export opens an OS file-save dialog.

## Cross-Story Dependencies

- Stories 5.1–5.4 (lifecycle) build on the existing `notes` schema, FTS5 triggers, and the note service from earlier epics; the trash view (5.2) and permanent delete (5.3) depend on soft-delete (5.1) existing first.
- Toast and command-palette infrastructure are shared cross-epic dependencies reused by every story here.
- Export stories (5.5–5.6) depend on the export service/commands and Tauri scoped-filesystem capability configuration; they map to TEA test scenarios P1-INT-009 (Markdown) and P1-INT-010 (JSON).
