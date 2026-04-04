use chrono::Utc;
use rusqlite::{params, Connection};
use std::path::PathBuf;

use tauri_app_lib::db;
use tauri_app_lib::models::Note;

/// Create a file-backed temp DB with full init (PRAGMAs + migrations).
/// Returns the connection and temp directory path for cleanup.
pub fn create_temp_db() -> (Connection, PathBuf) {
    let dir = std::env::temp_dir().join(format!(
        "notey_test_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&dir).expect("failed to create temp dir");
    let conn = db::init_db(dir.clone()).expect("failed to init db");
    (conn, dir)
}

/// Remove the temp DB directory.
pub fn cleanup_temp_db(dir: &std::path::Path) {
    let _ = std::fs::remove_dir_all(dir);
}

/// Create an in-memory test DB with PRAGMAs and migrations applied.
/// Faster than file-backed; use when file persistence isn't needed.
pub fn setup_test_db() -> Connection {
    let mut conn = Connection::open_in_memory().expect("failed to open in-memory db");
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA foreign_keys=ON;",
    )
    .expect("failed to set pragmas");
    db::MIGRATIONS
        .to_latest(&mut conn)
        .expect("failed to run migrations");
    conn
}

/// Builder for `Note` structs with sensible defaults.
///
/// Use `.build()` for an in-memory struct (assertions, comparisons).
/// Use `.insert(conn)` to write directly to the DB and return the persisted Note.
pub struct NoteBuilder {
    title: String,
    content: String,
    format: String,
    workspace_id: Option<i64>,
    is_trashed: bool,
    deleted_at: Option<String>,
}

impl Default for NoteBuilder {
    fn default() -> Self {
        Self {
            title: "Test Note".to_string(),
            content: String::new(),
            format: "markdown".to_string(),
            workspace_id: None,
            is_trashed: false,
            deleted_at: None,
        }
    }
}

impl NoteBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn title(mut self, title: &str) -> Self {
        self.title = title.to_string();
        self
    }

    pub fn content(mut self, content: &str) -> Self {
        self.content = content.to_string();
        self
    }

    pub fn format(mut self, format: &str) -> Self {
        self.format = format.to_string();
        self
    }

    pub fn workspace_id(mut self, id: i64) -> Self {
        self.workspace_id = Some(id);
        self
    }

    pub fn trashed(mut self) -> Self {
        self.is_trashed = true;
        self.deleted_at = Some(Utc::now().to_rfc3339());
        self
    }

    /// Build an in-memory `Note` struct (not persisted). Uses id=0 and current timestamps.
    pub fn build(self) -> Note {
        let now = Utc::now().to_rfc3339();
        Note {
            id: 0,
            title: self.title,
            content: self.content,
            format: self.format,
            workspace_id: self.workspace_id,
            created_at: now.clone(),
            updated_at: now,
            deleted_at: self.deleted_at,
            is_trashed: self.is_trashed,
        }
    }

    /// Insert into the database and return the persisted Note with a real ID.
    pub fn insert(self, conn: &Connection) -> Note {
        let now = Utc::now().to_rfc3339();
        let is_trashed_int: i64 = if self.is_trashed { 1 } else { 0 };

        conn.execute(
            "INSERT INTO notes (title, content, format, workspace_id, created_at, updated_at, deleted_at, is_trashed)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                self.title,
                self.content,
                self.format,
                self.workspace_id,
                now,
                now,
                self.deleted_at,
                is_trashed_int,
            ],
        )
        .expect("failed to insert test note");

        let id = conn.last_insert_rowid();
        conn.query_row(
            "SELECT id, title, content, format, workspace_id, created_at, updated_at, deleted_at, is_trashed
             FROM notes WHERE id = ?",
            params![id],
            |row| {
                Ok(Note {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    content: row.get(2)?,
                    format: row.get(3)?,
                    workspace_id: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                    deleted_at: row.get(7)?,
                    is_trashed: row.get::<_, i64>(8)? != 0,
                })
            },
        )
        .expect("failed to read back inserted test note")
    }
}
