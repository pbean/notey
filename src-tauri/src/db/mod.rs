use rusqlite::Connection;
use rusqlite_migration::{Migrations, M};
use std::path::PathBuf;

pub mod workspace_repo;

use crate::errors::NoteyError;

const MIGRATIONS_SLICE: &[M<'static>] = &[
    M::up(
        "CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            format TEXT NOT NULL DEFAULT 'markdown' CHECK(format IN ('markdown', 'plaintext')),
            workspace_id INTEGER NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deleted_at TEXT NULL,
            is_trashed INTEGER NOT NULL DEFAULT 0
        )",
    ),
    M::up(
        "CREATE TABLE IF NOT EXISTS workspaces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL
        );
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
            SELECT id, title, content FROM notes;

        INSERT INTO notes_fts(notes_fts, rank) VALUES('rank', 'bm25(10.0, 1.0)');",
    ),
];

pub const MIGRATIONS: Migrations<'static> = Migrations::from_slice(MIGRATIONS_SLICE);

pub fn init_db(app_data_dir: PathBuf) -> Result<Connection, NoteyError> {
    std::fs::create_dir_all(&app_data_dir)?;

    let db_path = app_data_dir.join("notey.db");
    let mut conn = Connection::open(db_path)?;

    // Set PRAGMAs for optimal performance and safety
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA synchronous=NORMAL;
         PRAGMA busy_timeout=5000;
         PRAGMA foreign_keys=ON;
         PRAGMA cache_size=-10000;",
    )?;

    // Run migrations
    MIGRATIONS.to_latest(&mut conn)?;

    Ok(conn)
}
