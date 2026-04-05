# FTS5 External Content Table Research

Research document for Epic 3 / Story 3.1: Full-text search for notey using SQLite FTS5.

**Source:** [SQLite FTS5 Extension — Official Documentation](https://www.sqlite.org/fts5.html)

---

## 1. FTS5 External Content Table Creation Syntax

### SQL

```sql
CREATE VIRTUAL TABLE notes_fts USING fts5(
    title,
    content,
    content=notes,
    content_rowid=id
);
```

### What external content mode means

An FTS5 table created with `content=<table_name>` is an **external content** table. In this mode the FTS5 virtual table does **not** store its own copy of the indexed text. It stores only the inverted index (token positions, document frequencies, etc.). Whenever FTS5 needs the actual column values — for example when returning results from `snippet()` or when the user `SELECT`s a column — it reads them on-the-fly from the source table by executing:

```sql
SELECT id, title, content FROM notes WHERE id = ?;
```

This has two important consequences:

1. **Storage efficiency.** The full text of every note is stored exactly once (in `notes`), not duplicated in the FTS shadow tables. For a note-taking app where `content` can be large, this roughly halves the disk footprint compared to a regular (content-storing) FTS5 table.

2. **Sync is the caller's responsibility.** FTS5 does not automatically detect changes to the source table. If a row in `notes` is inserted, updated, or deleted without a corresponding FTS index update, the index becomes stale. Queries may return phantom results (deleted notes), miss new notes, or return snippets that don't match. SQLite will not warn you — the inconsistency is **silent**.

### Implications for INSERT / UPDATE / DELETE

| Operation on `notes` | What must happen to `notes_fts` |
|-----------------------|---------------------------------|
| INSERT                | INSERT corresponding row into FTS index |
| UPDATE                | DELETE the **old** values from FTS, then INSERT the **new** values (FTS5 external content does not support in-place UPDATE) |
| DELETE                | DELETE the row from the FTS index using the special `'delete'` command |

The standard approach is to use AFTER triggers on the source table, covered in the next section.

---

## 2. Required Sync Triggers (Exact SQL)

All three triggers must be `AFTER` triggers. They must fire after the source-table row has been written, so that `NEW.*` and `OLD.*` values are available.

### INSERT trigger

When a new note is created, add it to the FTS index.

```sql
CREATE TRIGGER notes_fts_ai AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, title, content)
    VALUES (NEW.id, NEW.title, NEW.content);
END;
```

### DELETE trigger

When a note is hard-deleted, remove it from the FTS index. FTS5 external content tables use a **special delete syntax**: you INSERT a row where the first column is the literal string `'delete'` and the table name is used as that first column name.

```sql
CREATE TRIGGER notes_fts_ad AFTER DELETE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, content)
    VALUES ('delete', OLD.id, OLD.title, OLD.content);
END;
```

**Critical detail:** The values passed (`OLD.title`, `OLD.content`) must exactly match what was indexed. FTS5 tokenizes these values again to determine which index entries to remove. If the values differ from what was originally indexed, the index becomes corrupted with orphaned entries.

### UPDATE trigger

FTS5 external content tables do not support in-place UPDATE. Instead, the trigger must delete the old entry and insert the new one as two separate operations.

```sql
CREATE TRIGGER notes_fts_au AFTER UPDATE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, content)
    VALUES ('delete', OLD.id, OLD.title, OLD.content);
    INSERT INTO notes_fts(rowid, title, content)
    VALUES (NEW.id, NEW.title, NEW.content);
END;
```

This fires on **any** column change to a `notes` row — including updates to `is_trashed`, `workspace_id`, `deleted_at`, or `updated_at`. Since only `title` and `content` are indexed, updates that change only non-indexed columns will still fire the trigger (delete + re-insert the same text). This is correct behavior — the cost is negligible and it guarantees the index stays in sync no matter which columns changed.

### Complete migration SQL (single string for `MIGRATIONS_SLICE`)

```sql
CREATE VIRTUAL TABLE notes_fts USING fts5(
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
```

---

## 3. Backfill Statement

After the virtual table and triggers are created, any **existing** notes must be loaded into the FTS index. The triggers only capture future changes.

```sql
INSERT INTO notes_fts(rowid, title, content)
    SELECT id, title, content FROM notes;
```

This runs as the final statement in the migration, after the table and all three triggers have been created. It does a single bulk pass over `notes` and populates the FTS index.

### Notes on backfill

- **Idempotent migrations:** Because `rusqlite_migration` tracks which migrations have been applied, this backfill runs exactly once — the first time this migration is applied.
- **Rebuild command:** If the index ever becomes inconsistent (e.g., due to a bug), it can be rebuilt from scratch with: `INSERT INTO notes_fts(notes_fts) VALUES('rebuild');` This drops the entire index and re-reads every row from `notes`. It is **not** part of the migration — it is an operational recovery tool.
- **Performance:** For a desktop note-taking app the `notes` table will typically contain hundreds to low thousands of rows. The backfill is effectively instant.

---

## 4. FTS5 Query Functions

### MATCH syntax

FTS5 queries use the `MATCH` operator or the table-valued function shorthand:

```sql
-- MATCH operator
SELECT * FROM notes_fts WHERE notes_fts MATCH 'search terms';

-- Table-valued function shorthand (equivalent)
SELECT * FROM notes_fts('search terms');
```

#### Query expression syntax

| Expression | Meaning |
|-----------|---------|
| `hello world` | Implicit AND — both tokens must appear |
| `hello OR world` | Either token |
| `hello NOT world` | First token but not second |
| `"hello world"` | Exact phrase |
| `hel*` | Prefix query — matches `hello`, `help`, etc. |
| `title : hello` | Column filter — match only in `title` column |
| `NEAR(hello world, 5)` | Both tokens within 5 tokens of each other |

Operator precedence (tightest to loosest): NOT > AND > OR. Use parentheses to override.

### `rank` column for relevance ordering

Every FTS5 table has a hidden `rank` column. In a full-text query context, it contains the BM25 relevance score. **Lower (more negative) values indicate better matches.**

```sql
SELECT rowid, rank
FROM notes_fts
WHERE notes_fts MATCH 'search terms'
ORDER BY rank;
```

Using `ORDER BY rank` is **faster** than `ORDER BY bm25(notes_fts)` because SQLite can optimize the sort internally and short-circuit with LIMIT clauses. Always prefer `rank` over calling `bm25()` directly when sorting.

### `snippet()` function for highlighting

```sql
snippet(table, column_index, open_markup, close_markup, ellipsis, max_tokens)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `table` | name | FTS5 table name (`notes_fts`) |
| `column_index` | integer | 0-based column index. `0` = `title`, `1` = `content`. Use `-1` to let FTS5 auto-select the best column. |
| `open_markup` | string | Text inserted before each matched token (e.g., `'<mark>'`) |
| `close_markup` | string | Text inserted after each matched token (e.g., `'</mark>'`) |
| `ellipsis` | string | Text added at start/end if the snippet is a fragment (e.g., `'...'`) |
| `max_tokens` | integer | Maximum number of tokens in the returned snippet (1-64) |

#### Planned usage for notey

```sql
snippet(notes_fts, 1, '<mark>', '</mark>', '...', 32)
```

This extracts a snippet from the `content` column (index 1) with matched terms wrapped in `<mark>` tags, ellipsis at truncation boundaries, and a maximum of 32 tokens.

### `bm25()` vs default `rank`

The `rank` column defaults to `bm25(notes_fts)` with equal weight (1.0) for all columns.

To weight title matches higher than content matches:

```sql
-- Direct call with weights: title=10.0, content=1.0
SELECT *, bm25(notes_fts, 10.0, 1.0) AS relevance
FROM notes_fts
WHERE notes_fts MATCH 'search terms'
ORDER BY relevance;
```

Or set a persistent default so `rank` uses custom weights:

```sql
INSERT INTO notes_fts(notes_fts, rank) VALUES('rank', 'bm25(10.0, 1.0)');
```

After this, `ORDER BY rank` automatically applies `bm25(notes_fts, 10.0, 1.0)`.

**Recommendation for notey:** Use `bm25(notes_fts, 10.0, 1.0)` to weight title matches 10x over content matches. Title matches are far more likely to represent the note the user is looking for. Set this via the persistent `rank` configuration in the migration so all queries benefit from `ORDER BY rank`.

---

## 5. Gotchas and Edge Cases

### 5.1 Missing triggers = silent stale index

If the triggers are accidentally dropped or not created, the FTS index becomes stale with no error or warning. New notes won't appear in search; deleted notes will appear as phantom results. FTS5 will happily return rowids that point to deleted or changed rows.

**Mitigation:** The triggers are created inside the same migration string as the virtual table. They cannot be partially applied because `rusqlite_migration` runs each `M::up()` as a single transaction.

### 5.2 Trashed notes remain in the FTS index

The `AFTER UPDATE` trigger fires on every update to a `notes` row — including `trash_note()` which sets `is_trashed = 1`. Since FTS5 indexes only `title` and `content` (not `is_trashed`), the trashed note's text stays in the index. This is **by design** — removing the note from FTS on trash would mean we could not search the trash in the future.

**Required handling:** The search query must JOIN back to `notes` and filter:

```sql
SELECT
    n.id,
    n.title,
    snippet(notes_fts, 1, '<mark>', '</mark>', '...', 32) AS snippet,
    n.workspace_id,
    n.updated_at,
    n.format
FROM notes_fts
JOIN notes n ON n.id = notes_fts.rowid
WHERE notes_fts MATCH ?1
  AND n.is_trashed = 0
ORDER BY rank
LIMIT 50;
```

The JOIN is not a performance concern — it hits `notes` by primary key (rowid lookup) for each FTS match, which is O(1) per result row.

### 5.3 NULL content / empty titles

The `notes` schema defaults both `title` and `content` to `''` (empty string, not NULL). FTS5 will tokenize empty strings to zero tokens — these rows are indexed but will never match any search term. This is correct behavior; no special handling is needed.

If a future schema change allows NULL for these columns, FTS5 treats NULL the same as an empty string during indexing. The triggers will pass NULL through and FTS5 will handle it gracefully.

### 5.4 Performance impact of triggers on auto-save

notey auto-saves notes on a debounced interval. Each save calls `update_note()` which fires the `AFTER UPDATE` trigger. The trigger performs:

1. One FTS delete (tokenize old content, remove index entries)
2. One FTS insert (tokenize new content, add index entries)

**Benchmarks from SQLite documentation and community reports:**

- FTS5 INSERT for a ~5KB document: < 1ms
- FTS5 DELETE (external content): < 1ms
- Total trigger overhead per save: **~1-2ms**

This is well within the 500ms auto-save budget. Even for large notes (50KB+), FTS5 tokenization and index update stays under 10ms. The trigger runs inside the same transaction as the UPDATE, so there is no additional fsync cost.

### 5.5 COALESCE in update_note creates a subtle trigger interaction

The `update_note` service uses `COALESCE(?1, title)` to only update provided fields. When `title` is NULL (not provided), SQLite resolves COALESCE to the existing value. The row is still UPDATEd (even if values don't change), so the AFTER UPDATE trigger fires. This means `OLD.title` and `NEW.title` are identical — the trigger deletes and re-inserts the same text. This is a no-op for the index content but does cause a small amount of I/O.

**Acceptable trade-off:** The alternative (conditional trigger logic with `WHEN OLD.title != NEW.title OR OLD.content != NEW.content`) adds complexity for negligible gain. The 1-2ms overhead is not worth optimizing away.

### 5.6 Rebuild after index corruption

If the index ever becomes inconsistent, the rebuild command re-creates it from scratch:

```sql
INSERT INTO notes_fts(notes_fts) VALUES('rebuild');
```

This is a manual recovery operation, not something that should run in normal code paths. It could be exposed as a developer/debug command.

### 5.7 FTS5 requires the fts5 extension to be compiled in

SQLite's FTS5 is a compile-time extension. The `rusqlite` crate must be built with the `bundled` feature (which includes FTS5 by default) or with `bundled-full`. Verify in `Cargo.toml`:

```toml
rusqlite = { version = "...", features = ["bundled"] }
```

The `bundled` feature compiles SQLite from source with FTS5 enabled. If using a system SQLite instead, verify FTS5 is present with: `SELECT fts5();` — it should return an error about wrong number of arguments (not "no such function").

---

## 6. Integration with notey Codebase

### 6.1 Migration placement

The migration goes as the **3rd element** (index 2) in `MIGRATIONS_SLICE` in `src-tauri/src/db/mod.rs`:

```rust
const MIGRATIONS_SLICE: &[M<'static>] = &[
    M::up(
        "CREATE TABLE IF NOT EXISTS notes ( ... )",   // Migration 1: notes table
    ),
    M::up(
        "CREATE TABLE IF NOT EXISTS workspaces ( ... ); // Migration 2: workspaces table
         CREATE INDEX IF NOT EXISTS idx_workspaces_path ON workspaces(path);",
    ),
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
            SELECT id, title, content FROM notes;"
    ),
];
```

### 6.2 Search service

New file: `src-tauri/src/services/search_service.rs`

Register in `src-tauri/src/services/mod.rs`:

```rust
pub mod search_service;
```

The service exposes a single function:

```rust
pub fn search_notes(
    conn: &Connection,
    query: &str,
    workspace_id: Option<i64>,
    limit: Option<i64>,
) -> Result<Vec<SearchResult>, NoteyError>
```

Core query (with optional workspace filter):

```sql
SELECT
    n.id,
    n.title,
    snippet(notes_fts, 1, '<mark>', '</mark>', '...', 32) AS snippet,
    w.name AS workspace_name,
    n.updated_at,
    n.format
FROM notes_fts
JOIN notes n ON n.id = notes_fts.rowid
LEFT JOIN workspaces w ON w.id = n.workspace_id
WHERE notes_fts MATCH ?1
  AND n.is_trashed = 0
ORDER BY rank
LIMIT ?2;
```

When `workspace_id` is `Some(id)`, add `AND n.workspace_id = ?3` to the WHERE clause.

### 6.3 Search command

New file: `src-tauri/src/commands/search.rs`

Register in `src-tauri/src/commands/mod.rs`:

```rust
pub mod search;
```

The command follows the existing pattern (see `commands/notes.rs`):

```rust
#[tauri::command]
#[specta::specta]
pub async fn search_notes(
    state: State<'_, Mutex<rusqlite::Connection>>,
    query: String,
    workspace_id: Option<i64>,
    limit: Option<i64>,
) -> Result<Vec<SearchResult>, NoteyError> {
    let conn = state.lock().unwrap_or_else(|e| e.into_inner());
    services::search_service::search_notes(&conn, &query, workspace_id, limit)
}
```

### 6.4 SearchResult struct

Add to `src-tauri/src/models/mod.rs` alongside the existing `Note` struct:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub id: i64,
    pub title: String,
    pub snippet: String,
    pub workspace_name: Option<String>,
    pub updated_at: String,
    pub format: String,
}
```

This struct intentionally **excludes** the full `content` field. Search results only need the snippet for display in the results list. The full content is loaded via `get_note` when the user clicks a result.

### 6.5 File summary

| What | Where |
|------|-------|
| Migration (FTS table + triggers + backfill) | `src-tauri/src/db/mod.rs` — 3rd element in `MIGRATIONS_SLICE` |
| SearchResult model | `src-tauri/src/models/mod.rs` |
| Search service function | `src-tauri/src/services/search_service.rs` (new file) |
| Search Tauri command | `src-tauri/src/commands/search.rs` (new file) |
| Service module registration | `src-tauri/src/services/mod.rs` — add `pub mod search_service;` |
| Command module registration | `src-tauri/src/commands/mod.rs` — add `pub mod search;` |

---

## Sources

- [SQLite FTS5 Extension — Official Documentation](https://www.sqlite.org/fts5.html)
- [SQLite FTS5 Triggers — simonh.uk](https://simonh.uk/2021/05/11/sqlite-fts5-triggers/)
- [FTS5 External Content Tables — SQLite Forum](https://sqlite.org/forum/forumpost/acdc2aa30a)
- [FTS5 External Content Update Statement — SQLite Forum](https://sqlite.org/forum/info/ac5fbb99316b3a5f3800e8b6d2db5a5274525e45ab1db0f02396f38e0b5e3e4a)
