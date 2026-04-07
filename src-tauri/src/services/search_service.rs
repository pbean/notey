use rusqlite::{Connection, params};

use crate::errors::NoteyError;
use crate::models::SearchResult;

/// Sanitize user input for FTS5 MATCH syntax.
///
/// Replaces all non-alphanumeric, non-whitespace characters with spaces, then
/// removes FTS5 keyword operators (`AND`, `OR`, `NOT`, `NEAR`). This allowlist
/// approach ensures unknown punctuation (hyphens, slashes, etc.) can never
/// reach the FTS5 parser and cause syntax errors.
fn sanitize_fts_query(query: &str) -> String {
    let cleaned: String = query
        .chars()
        .map(|c| if c.is_alphanumeric() || c.is_whitespace() { c } else { ' ' })
        .collect();

    let fts_keywords = ["AND", "OR", "NOT", "NEAR"];
    let tokens: Vec<&str> = cleaned
        .split_whitespace()
        .filter(|t| !fts_keywords.contains(&t.to_uppercase().as_str()))
        .collect();

    if tokens.is_empty() {
        return String::new();
    }

    tokens.join(" ")
}

/// Search notes using FTS5 full-text search with BM25 ranking.
///
/// Returns up to 50 results ordered by relevance (title weighted 10x over content).
/// An empty or operator-only query returns an empty vec without hitting the database.
pub fn search_notes(
    conn: &Connection,
    query: &str,
    workspace_id: Option<i64>,
) -> Result<Vec<SearchResult>, NoteyError> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(vec![]);
    }

    let sanitized = sanitize_fts_query(trimmed);
    if sanitized.is_empty() {
        return Ok(vec![]);
    }

    let results = match workspace_id {
        Some(ws_id) => {
            let mut stmt = conn.prepare(
                "SELECT
                    n.id,
                    n.title,
                    CASE
                        WHEN snippet(notes_fts, 1, '<mark>', '</mark>', '...', 32) IN ('', '...')
                        THEN snippet(notes_fts, 0, '<mark>', '</mark>', '...', 32)
                        ELSE snippet(notes_fts, 1, '<mark>', '</mark>', '...', 32)
                    END AS snippet,
                    w.name AS workspace_name,
                    n.updated_at,
                    n.format
                FROM notes_fts
                JOIN notes n ON n.id = notes_fts.rowid
                LEFT JOIN workspaces w ON w.id = n.workspace_id
                WHERE notes_fts MATCH ?1
                  AND n.is_trashed = 0
                  AND n.workspace_id = ?2
                ORDER BY rank
                LIMIT 50",
            )?;
            let rows = stmt
                .query_map(params![sanitized, ws_id], |row| {
                    Ok(SearchResult {
                        id: row.get(0)?,
                        title: row.get(1)?,
                        snippet: row.get(2)?,
                        workspace_name: row.get(3)?,
                        updated_at: row.get(4)?,
                        format: row.get(5)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;
            rows
        }
        None => {
            let mut stmt = conn.prepare(
                "SELECT
                    n.id,
                    n.title,
                    CASE
                        WHEN snippet(notes_fts, 1, '<mark>', '</mark>', '...', 32) IN ('', '...')
                        THEN snippet(notes_fts, 0, '<mark>', '</mark>', '...', 32)
                        ELSE snippet(notes_fts, 1, '<mark>', '</mark>', '...', 32)
                    END AS snippet,
                    w.name AS workspace_name,
                    n.updated_at,
                    n.format
                FROM notes_fts
                JOIN notes n ON n.id = notes_fts.rowid
                LEFT JOIN workspaces w ON w.id = n.workspace_id
                WHERE notes_fts MATCH ?1
                  AND n.is_trashed = 0
                ORDER BY rank
                LIMIT 50",
            )?;
            let rows = stmt
                .query_map(params![sanitized], |row| {
                    Ok(SearchResult {
                        id: row.get(0)?,
                        title: row.get(1)?,
                        snippet: row.get(2)?,
                        workspace_name: row.get(3)?,
                        updated_at: row.get(4)?,
                        format: row.get(5)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;
            rows
        }
    };

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let mut conn = Connection::open_in_memory().expect("failed to open in-memory db");
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA foreign_keys=ON;",
        )
        .expect("failed to set pragmas");
        crate::db::MIGRATIONS
            .to_latest(&mut conn)
            .expect("failed to run migrations");
        conn
    }

    fn insert_note(conn: &Connection, title: &str, content: &str) -> i64 {
        conn.execute(
            "INSERT INTO notes (title, content, format, created_at, updated_at)
             VALUES (?1, ?2, 'markdown', '2026-01-01T00:00:00+00:00', '2026-01-01T00:00:00+00:00')",
            params![title, content],
        )
        .expect("insert note");
        conn.last_insert_rowid()
    }

    fn insert_note_in_workspace(conn: &Connection, title: &str, content: &str, ws_id: i64) -> i64 {
        conn.execute(
            "INSERT INTO notes (title, content, format, workspace_id, created_at, updated_at)
             VALUES (?1, ?2, 'markdown', ?3, '2026-01-01T00:00:00+00:00', '2026-01-01T00:00:00+00:00')",
            params![title, content, ws_id],
        )
        .expect("insert note in workspace");
        conn.last_insert_rowid()
    }

    fn create_workspace(conn: &Connection, name: &str) -> i64 {
        conn.execute(
            "INSERT INTO workspaces (name, path, created_at) VALUES (?1, ?2, '2026-01-01T00:00:00+00:00')",
            params![name, format!("/tmp/{}", name)],
        )
        .expect("insert workspace");
        conn.last_insert_rowid()
    }

    // P1-UNIT-001: search_notes returns results ranked by BM25 relevance
    #[test]
    fn test_search_returns_ranked_results() {
        let conn = setup_test_db();

        // Note with term only in content (many times)
        insert_note(&conn, "generic note", "findme findme findme findme findme findme findme findme findme findme");
        // Note with term in title (10x weight)
        insert_note(&conn, "findme", "a completely different topic");

        let results = search_notes(&conn, "findme", None).expect("search failed");
        assert_eq!(results.len(), 2);
        // Title match should rank first due to bm25(10.0, 1.0)
        assert_eq!(results[0].title, "findme");
    }

    // P1-UNIT-002: search_notes with workspace_id filters results
    #[test]
    fn test_search_filters_by_workspace() {
        let conn = setup_test_db();
        let ws_a = create_workspace(&conn, "ws-a");
        let ws_b = create_workspace(&conn, "ws-b");

        insert_note_in_workspace(&conn, "alpha note", "searchable content", ws_a);
        insert_note_in_workspace(&conn, "beta note", "searchable content", ws_b);

        let results = search_notes(&conn, "searchable", Some(ws_a)).expect("search failed");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "alpha note");
    }

    // P1-UNIT-003: search_notes excludes trashed notes
    #[test]
    fn test_search_excludes_trashed() {
        let conn = setup_test_db();
        let id = insert_note(&conn, "trashable note", "unique_trash_term_xyz");
        conn.execute(
            "UPDATE notes SET is_trashed = 1, deleted_at = '2026-01-01T00:00:00+00:00' WHERE id = ?1",
            params![id],
        )
        .expect("trash note");

        let results = search_notes(&conn, "unique_trash_term_xyz", None).expect("search failed");
        assert!(results.is_empty(), "trashed notes should be excluded");
    }

    // P1-UNIT-004: search_notes with empty query returns empty vec
    #[test]
    fn test_search_empty_query_returns_empty() {
        let conn = setup_test_db();
        insert_note(&conn, "some note", "some content");

        let results = search_notes(&conn, "", None).expect("search failed");
        assert!(results.is_empty());

        let results = search_notes(&conn, "   ", None).expect("search failed");
        assert!(results.is_empty());
    }

    // P1-UNIT-005: search_notes respects LIMIT 50
    #[test]
    fn test_search_limit_50() {
        let conn = setup_test_db();
        for i in 0..55 {
            insert_note(&conn, &format!("limitnote {}", i), "limitterm_unique_xyz");
        }

        let results = search_notes(&conn, "limitterm_unique_xyz", None).expect("search failed");
        assert_eq!(results.len(), 50, "should cap at 50 results");
    }

    // P1-UNIT-006: search_notes returns correct workspace_name via LEFT JOIN
    #[test]
    fn test_search_returns_workspace_name() {
        let conn = setup_test_db();
        let ws = create_workspace(&conn, "my-workspace");
        insert_note_in_workspace(&conn, "ws note", "workspace_term_abc", ws);
        insert_note(&conn, "unscoped note", "workspace_term_abc");

        let results = search_notes(&conn, "workspace_term_abc", None).expect("search failed");
        assert_eq!(results.len(), 2);

        let ws_result = results.iter().find(|r| r.title == "ws note").expect("ws note not found");
        assert_eq!(ws_result.workspace_name, Some("my-workspace".to_string()));

        let unscoped = results.iter().find(|r| r.title == "unscoped note").expect("unscoped not found");
        assert!(unscoped.workspace_name.is_none());
    }

    // P1-UNIT-007: search_notes handles FTS5 special characters without panic
    #[test]
    fn test_search_handles_fts5_special_chars() {
        let conn = setup_test_db();
        insert_note(&conn, "safe note", "hello world");

        // These should not panic or error — covers FTS5 operators, common punctuation, and edge cases
        let special_queries = vec![
            "hello\"world",
            "hello*",
            "NOT",
            "OR",
            "AND",
            "NEAR",
            "hello:world",
            "(hello)",
            "^hello",
            "\"",
            "*",
            "NOT OR AND",
            "to-do",
            "foo-bar",
            "C++",
            "C#",
            "hello/world",
            "NEAR/5",
            "file.txt",
            "foo@bar.com",
            "#tag",
            "a & b",
            "a | b",
            "[bracket]",
            "hello\\world",
        ];

        for q in special_queries {
            let result = search_notes(&conn, q, None);
            assert!(result.is_ok(), "query '{}' should not error: {:?}", q, result.err());
        }
    }

    // P1-UNIT-008: SearchResult serializes with camelCase field names
    #[test]
    fn test_search_result_camel_case_serialization() {
        let result = SearchResult {
            id: 1,
            title: "Test".to_string(),
            snippet: "snippet".to_string(),
            workspace_name: Some("ws".to_string()),
            updated_at: "2026-01-01".to_string(),
            format: "markdown".to_string(),
        };

        let json = serde_json::to_value(&result).expect("serialize failed");
        assert!(json.get("workspaceName").is_some(), "should have camelCase workspaceName");
        assert!(json.get("updatedAt").is_some(), "should have camelCase updatedAt");
        assert!(json.get("workspace_name").is_none(), "should not have snake_case");
        assert!(json.get("updated_at").is_none(), "should not have snake_case");
    }

    #[test]
    fn test_sanitize_fts_query_strips_operators() {
        assert_eq!(sanitize_fts_query("hello world"), "hello world");
        assert_eq!(sanitize_fts_query("hello\"world"), "hello world");
        assert_eq!(sanitize_fts_query("hello*"), "hello");
        assert_eq!(sanitize_fts_query("NOT"), "");
        assert_eq!(sanitize_fts_query("hello OR world"), "hello world");
        assert_eq!(sanitize_fts_query("hello:world"), "hello world");
        assert_eq!(sanitize_fts_query("(test)"), "test");
        assert_eq!(sanitize_fts_query("^hello"), "hello");
        // Allowlist catches all non-alphanumeric punctuation
        assert_eq!(sanitize_fts_query("to-do"), "to do");
        assert_eq!(sanitize_fts_query("C++"), "C");
        assert_eq!(sanitize_fts_query("hello/world"), "hello world");
        assert_eq!(sanitize_fts_query("NEAR/5"), "5");
        assert_eq!(sanitize_fts_query("file.txt"), "file txt");
        assert_eq!(sanitize_fts_query("foo@bar.com"), "foo bar com");
        assert_eq!(sanitize_fts_query("#tag"), "tag");
    }

    #[test]
    fn test_sanitize_fts_query_preserves_normal_text() {
        assert_eq!(sanitize_fts_query("meeting notes project"), "meeting notes project");
        assert_eq!(sanitize_fts_query("rust programming"), "rust programming");
    }
}
