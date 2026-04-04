use rusqlite::Connection;
use rusqlite_migration::{Migrations, M};
use std::path::PathBuf;

use crate::errors::NoteyError;

const MIGRATIONS_SLICE: &[M<'static>] = &[M::up(
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
)];

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
