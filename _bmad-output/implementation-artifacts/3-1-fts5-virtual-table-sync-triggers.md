# Story 3.1: FTS5 Virtual Table & Sync Triggers

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a full-text search index that stays in sync with the notes table,
So that search queries return accurate, up-to-date results.

## Acceptance Criteria

1. **Given** the existing database with notes table
   **When** a new migration is added
   **Then** it creates the `notes_fts` virtual table using FTS5 with `external content=notes`, `content_rowid=id`, indexing `title` and `content` columns

2. **Given** the FTS5 table exists
   **When** SQLite triggers are created
   **Then** an INSERT trigger on `notes` inserts the new row into `notes_fts`
   **And** an UPDATE trigger on `notes` deletes the old FTS row and inserts the updated row
   **And** a DELETE trigger on `notes` removes the row from `notes_fts`

3. **Given** existing notes exist before the migration
   **When** the migration runs
   **Then** a backfill statement populates `notes_fts` from all existing `notes` rows

4. **Given** the triggers are active
   **When** a note is created, updated, or deleted via CRUD commands
   **Then** the FTS5 index reflects the change without additional application code

## Required Tests

| Test ID | Description | Priority | Status |
|---------|-------------|----------|--------|
| P0-INT-004a | FTS5 index reflects newly created note (INSERT trigger) | P0 | |
| P0-INT-004b | FTS5 index reflects updated note title/content (UPDATE trigger) | P0 | |
| P0-INT-004c | FTS5 index removes hard-deleted note (DELETE trigger) | P0 | |
| P0-INT-004d | FTS5 index reflects trashed note (still searchable, trigger fires on is_trashed update) | P0 | |
| P0-INT-005a | FTS5 backfill — existing notes appear in FTS index after migration | P0 | |
| P0-INT-005b | FTS5 virtual table and all 3 triggers exist in sqlite_master | P0 | |
| P1-INT-001 | FTS5 MATCH query returns correct results with BM25 ranking | P1 | |
| P1-INT-002 | FTS5 index handles empty title/content gracefully (no errors, no phantom matches) | P1 | |
| P1-INT-003 | FTS5 index stays consistent after multiple rapid create/update/delete cycles | P1 | |

## Tasks / Subtasks

- [x] Task 1: Add FTS5 migration to `MIGRATIONS_SLICE` (AC: #1, #2, #3)
  - [x] 1.1 In `src-tauri/src/db/mod.rs`, add 3rd migration element to `MIGRATIONS_SLICE`
  - [x] 1.2 Migration SQL creates `notes_fts` virtual table: `CREATE VIRTUAL TABLE notes_fts USING fts5(title, content, content=notes, content_rowid=id)`
  - [x] 1.3 Migration SQL creates AFTER INSERT trigger `notes_fts_ai`
  - [x] 1.4 Migration SQL creates AFTER DELETE trigger `notes_fts_ad` (uses FTS5 special delete syntax)
  - [x] 1.5 Migration SQL creates AFTER UPDATE trigger `notes_fts_au` (delete old + insert new)
  - [x] 1.6 Migration SQL ends with backfill: `INSERT INTO notes_fts(rowid, title, content) SELECT id, title, content FROM notes`
  - [x] 1.7 Set persistent BM25 rank weights: `INSERT INTO notes_fts(notes_fts, rank) VALUES('rank', 'bm25(10.0, 1.0)')` — title matches weighted 10x over content

- [x] Task 2: Write integration tests for FTS5 sync (AC: #1, #2, #3, #4)
  - [x] 2.1 Create `src-tauri/tests/search_tests.rs` — new integration test file
  - [x] 2.2 Add `mod search_tests;` in test discovery (Cargo auto-discovers files in `tests/`)
  - [x] 2.3 Test: `test_fts5_table_and_triggers_exist` — query `sqlite_master` for `notes_fts` (type=table) and all 3 triggers (`notes_fts_ai`, `notes_fts_ad`, `notes_fts_au`)
  - [x] 2.4 Test: `test_fts5_insert_trigger_indexes_new_note` — create note via `NoteBuilder`, query `notes_fts` with MATCH, verify match found
  - [x] 2.5 Test: `test_fts5_update_trigger_reindexes_note` — create note, update title/content via `notes::update_note`, verify old content NOT matched, new content IS matched
  - [x] 2.6 Test: `test_fts5_delete_trigger_removes_from_index` — create note, hard-delete row from `notes`, verify MATCH returns 0 results
  - [x] 2.7 Test: `test_fts5_trashed_note_still_searchable` — create note, trash via `notes::trash_note`, verify MATCH still finds it (trashed notes stay in FTS index)
  - [x] 2.8 Test: `test_fts5_backfill_existing_notes` — insert notes directly via SQL BEFORE migration, run migration, verify all pre-existing notes appear in FTS MATCH queries
  - [x] 2.9 Test: `test_fts5_empty_content_no_phantom_matches` — create note with empty title/content, verify MATCH for random term returns 0 results
  - [x] 2.10 Test: `test_fts5_match_returns_ranked_results` — create notes with varying keyword density, verify MATCH results ordered by rank (BM25)
  - [x] 2.11 Test: `test_fts5_rapid_crud_consistency` — create, update, delete multiple notes in sequence, verify final FTS state matches final notes table state

- [x] Task 3: Verify no regressions (AC: all)
  - [x] 3.1 Run `cargo test` — all existing tests pass + new FTS tests pass
  - [x] 3.2 Run `cargo build` — clean compilation, tauri-specta bindings unchanged (no new commands in this story)

## Dev Notes

### What This Story Does

This story adds the FTS5 full-text search index infrastructure as a **database migration only**. No new Rust service, no new Tauri command, no new frontend code. The search command, model, and UI come in stories 3.2-3.5.

The migration creates an **external content** FTS5 virtual table (`notes_fts`) that indexes `title` and `content` from the `notes` table, plus three SQLite triggers that keep the index in sync automatically whenever notes are created, updated, or deleted.

### Migration SQL (Exact)

Add as the **3rd element** (index 2) in `MIGRATIONS_SLICE` in `src-tauri/src/db/mod.rs`:

```rust
M::up(
    "CREATE VIRTUAL TABLE notes_fts USING fts5(
        title,
        content,
        content=notes,
        content_rowid=id
    );

    CREATE TRIGGER notes_fts_ai AFTER INSERT ON notes BEGIN
        INSERT INTO notes_fts(rowid, title, content)
        VALUES (NEW.id, NEW.title, NEW.content);
    END;

    CREATE TRIGGER notes_fts_ad AFTER DELETE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, title, content)
        VALUES ('delete', OLD.id, OLD.title, OLD.content);
    END;

    CREATE TRIGGER notes_fts_au AFTER UPDATE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, title, content)
        VALUES ('delete', OLD.id, OLD.title, OLD.content);
        INSERT INTO notes_fts(rowid, title, content)
        VALUES (NEW.id, NEW.title, NEW.content);
    END;

    INSERT INTO notes_fts(rowid, title, content)
        SELECT id, title, content FROM notes;

    INSERT INTO notes_fts(notes_fts, rank) VALUES('rank', 'bm25(10.0, 1.0)');"
),
```

### Key Technical Details

**External content mode:** `notes_fts` does NOT store its own copy of text — it stores only the inverted index. It reads actual column values from `notes` on-the-fly when needed (e.g., for `snippet()`). This halves disk footprint.

**FTS5 special delete syntax:** The DELETE and UPDATE triggers use `INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES ('delete', ...)`. This is NOT a typo — it's the FTS5 external content API. The first column name matches the table name and the value is the literal string `'delete'`. The OLD values MUST exactly match what was indexed or the index becomes corrupted.

**UPDATE trigger fires on ANY column change:** This includes `is_trashed`, `workspace_id`, `updated_at`, etc. Since only `title` and `content` are indexed, non-content updates result in a delete+re-insert of the same text. This is correct — cost is negligible (~1-2ms) and guarantees sync.

**Trashed notes stay in the FTS index:** By design. The search query (story 3.2) will filter with `AND n.is_trashed = 0`. This allows future trash-search if needed.

**BM25 rank weights:** `bm25(10.0, 1.0)` weights title matches 10x over content matches. The persistent rank config (`INSERT INTO notes_fts(notes_fts, rank) ...`) means all queries using `ORDER BY rank` automatically apply these weights. This is set once in the migration.

**FTS5 requires `bundled` feature:** Already present in `Cargo.toml`: `rusqlite = { version = "0.34", features = ["bundled", "modern_sqlite"] }`. The `bundled` feature compiles SQLite from source with FTS5 enabled.

**Auto-save performance impact:** Each save fires the UPDATE trigger (~1-2ms for FTS delete+insert). Well within the 500ms auto-save budget.

### Testing Strategy

**All tests go in `src-tauri/tests/search_tests.rs`** (new file).

Use `create_temp_db()` from `helpers::factories` — this calls `db::init_db()` which runs all migrations including the new FTS5 migration. Tests verify the triggers work by:
1. Performing CRUD operations via the existing `services::notes` functions
2. Querying `notes_fts` directly with `SELECT ... FROM notes_fts WHERE notes_fts MATCH ?`
3. Asserting the FTS index state matches expectations

**Backfill test (P0-INT-005a):** This test is special — it must insert notes BEFORE the FTS migration runs. Use a two-phase setup:
1. Create a temp DB directory
2. Open a raw connection, apply only the first 2 migrations manually
3. Insert notes directly via SQL
4. Close and re-open with `init_db()` (which applies migration 3 including backfill)
5. Query `notes_fts` to verify pre-existing notes were indexed

**Hard-delete test:** The `notes` service only does soft-delete (`trash_note`). For the DELETE trigger test, use `conn.execute("DELETE FROM notes WHERE id = ?", params![id])` directly — the trigger fires on actual row deletion.

**FTS5 MATCH query pattern for tests:**
```rust
let count: i64 = conn.query_row(
    "SELECT COUNT(*) FROM notes_fts WHERE notes_fts MATCH ?1",
    params![search_term],
    |row| row.get(0),
)?;
```

### Project Structure Notes

**Modified files:**
- `src-tauri/src/db/mod.rs` — add 3rd migration to `MIGRATIONS_SLICE`

**New files:**
- `src-tauri/tests/search_tests.rs` — FTS5 integration tests

**No changes to:**
- Models (no new structs — `SearchResult` comes in story 3.2)
- Commands (no new Tauri commands — `search_notes` comes in story 3.2)
- Services (no new service — `search_service.rs` comes in story 3.2)
- Frontend (nothing — search UI comes in stories 3.3-3.5)
- `src/generated/bindings.ts` — no new commands, bindings unchanged

### Pitfalls to Avoid

- **Do NOT create `SearchResult` struct, search service, or search command** — those are story 3.2. This story is migration + tests only.
- **Do NOT put SQL in a `db/search_repo.rs` file** — the current codebase pattern has SQL directly in service functions (see `services/notes.rs`). The architecture doc mentions `db/search_repo.rs` but the actual pattern differs. Follow the actual codebase, not the aspirational architecture.
- **Do NOT modify existing migrations** — forward-only migrations per project rules. Add a new 3rd migration.
- **Do NOT add `IF NOT EXISTS` to the FTS5 table creation** — `rusqlite_migration` tracks applied migrations, so this runs exactly once.
- **Do NOT use `WHEN OLD.title != NEW.title` in the UPDATE trigger** — adding conditional logic is unnecessary complexity for negligible gain. The unconditional delete+re-insert pattern is correct.
- **Do NOT forget the backfill statement** — without it, existing notes won't appear in search results.
- **Do NOT forget the BM25 rank config** — without it, title and content matches are weighted equally, making search results less relevant.
- **Do NOT create a `db/search_repo.rs` or `services/search_service.rs`** — no search service code in this story.

### Previous Story Intelligence (Story 2.6)

**Patterns to reuse:**
- `create_temp_db()` for file-backed integration tests in `tests/search_tests.rs`
- `NoteBuilder` factory for creating test notes with specific titles/content
- `services::notes::create_note`, `update_note`, `trash_note` for CRUD operations that fire triggers
- Test file structure: `mod helpers;` + `use helpers::factories::{create_temp_db, NoteBuilder};`

**Learnings from Epic 2:**
- `cargo build` must succeed before `cargo test` — migrations are compiled into the binary
- Integration tests use temp directories via `TempDir` — auto-cleanup even on panic
- The `params![]` macro handles `Option<i64>` correctly (None → SQL NULL)
- `NoteBuilder::insert(conn)` goes through the DB (fires triggers), not just builds an in-memory struct

### Git Intelligence

Recent commits show Epic 2 fully complete (stories 2.1-2.6 all done). Current test suite: ~40 Rust tests + ~54 Vitest tests. All passing. The codebase has a mature migration infrastructure with 2 existing migrations.

Expected commit pattern: `feat(story-3.1): FTS5 Virtual Table & Sync Triggers`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3, Story 3.1] — acceptance criteria, TEA test scenarios
- [Source: _bmad-output/implementation-artifacts/fts5-research.md] — complete FTS5 implementation guide with exact SQL, gotchas, query functions
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture] — FTS5 external content, migration strategy, schema design
- [Source: _bmad-output/planning-artifacts/architecture.md#Architectural Boundaries] — service boundary, data boundary patterns
- [Source: _bmad-output/project-context.md#Database Gotchas] — FTS5 trigger requirements, parameterized queries only
- [Source: _bmad-output/project-context.md#Testing Rules] — integration tests in `src-tauri/tests/*.rs`, real SQLite with temp DBs
- [Source: _bmad-output/implementation-artifacts/2-6-manual-workspace-reassignment.md] — previous story patterns and learnings

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Backfill test required named array binding to avoid E0716 temporary lifetime issue with `rusqlite_migration::Migrations::from_slice`. Fixed by storing `[M::up(...), M::up(...)]` in a local `pre_fts_slice` variable.

### Completion Notes List

- Added 3rd migration to `MIGRATIONS_SLICE` in `src-tauri/src/db/mod.rs` creating `notes_fts` FTS5 external content virtual table, 3 sync triggers (`notes_fts_ai`, `notes_fts_ad`, `notes_fts_au`), backfill from existing notes, and BM25 rank config (10x title weight).
- Created `src-tauri/tests/search_tests.rs` with 9 integration tests covering all P0 and P1 test IDs from the story (P0-INT-004a/b/c/d, P0-INT-005a/b, P1-INT-001/002/003).
- All 110 tests pass (40 unit + 4 ACL + 13 DB + 9 FTS5 search + 44 workspace). Zero regressions. `cargo build` clean.
- No new Tauri commands, no frontend changes, no bindings changes — migration + tests only as specified.

### File List

- `src-tauri/src/db/mod.rs` — added 3rd migration with FTS5 virtual table, 3 sync triggers, backfill, BM25 rank config
- `src-tauri/tests/search_tests.rs` — new file: 9 FTS5 integration tests

## Change Log

- 2026-04-05: feat(story-3.1): FTS5 virtual table, sync triggers, BM25 rank config, backfill migration + 9 integration tests
