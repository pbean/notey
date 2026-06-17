//! IPC wire protocol: request/response envelope and the pure action dispatcher.
//!
//! The protocol is intentionally framing-agnostic: [`handle_request`] takes an
//! already-de-framed JSON body plus a borrowed [`Connection`] and returns an
//! [`IpcResponse`]. That keeps it trivially unit-testable (no socket required)
//! and lets both the socket layer and integration tests share one code path.
//!
//! Wire shapes (all `camelCase`, dates ISO 8601):
//! - request:  `{ "action": "create_note", "payload": { … } }`
//! - response: `{ "success": true, "data": <value|null>, "error": <string|null> }`

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::services::{notes, search_service, workspace_service};

/// Maximum accepted note content, in bytes (1 MiB). Guards against a
/// `cat hugefile | notey add --stdin` memory-DoS at the IPC boundary
/// (RISK-E6-001 / NFR10).
pub const MAX_CONTENT_BYTES: usize = 1024 * 1024;

/// A decoded IPC request envelope.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpcRequest {
    /// One of `create_note`, `list_notes`, `search_notes`.
    pub action: String,
    /// Action-specific payload. Absent/`null` is normalized per action.
    #[serde(default)]
    pub payload: Value,
}

/// The IPC response envelope returned for every request, well-formed or not.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IpcResponse {
    /// `true` for a successful action, `false` for any error.
    pub success: bool,
    /// Action result on success (`Note`, `Vec<Note>`, `Vec<SearchResult>`), else `null`.
    pub data: Option<Value>,
    /// Human-readable error message on failure, else `null`.
    pub error: Option<String>,
}

impl IpcResponse {
    /// Build a success envelope wrapping `data`.
    pub fn ok(data: Value) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    /// Build an error envelope carrying `message`.
    pub fn err(message: impl Into<String>) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message.into()),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateNotePayload {
    content: String,
    #[serde(default)]
    format: Option<String>,
    #[serde(default)]
    workspace_path: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ListNotesPayload {
    #[serde(default)]
    workspace_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SearchNotesPayload {
    query: String,
    #[serde(default)]
    workspace_name: Option<String>,
}

/// Derive a note title from its content, mirroring the GUI auto-save rule
/// (`useAutoSave.ts`): the first line, trimmed, capped at 100 chars; an empty
/// result falls back to `"Untitled"`.
pub fn derive_title(content: &str) -> String {
    let first_line = content.split('\n').next().unwrap_or("").trim();
    let title: String = first_line.chars().take(100).collect();
    if title.is_empty() {
        "Untitled".to_string()
    } else {
        title
    }
}

/// Parse, validate, and dispatch one request body against `conn`.
///
/// Never panics: malformed JSON, a missing/garbage payload, or an unknown action
/// all return a `success: false` envelope. The host GUI process must survive any
/// input a hostile client sends.
pub fn handle_request(conn: &Connection, raw: &[u8]) -> IpcResponse {
    let request: IpcRequest = match serde_json::from_slice(raw) {
        Ok(req) => req,
        Err(e) => return IpcResponse::err(format!("malformed request: {e}")),
    };

    match request.action.as_str() {
        "create_note" => handle_create(conn, request.payload),
        "list_notes" => handle_list(conn, request.payload),
        "search_notes" => handle_search(conn, request.payload),
        other => IpcResponse::err(format!("unknown action: {other}")),
    }
}

/// If `raw` was a *successful* `create_note` request, return the new note's id
/// so the caller (which holds the `AppHandle`) can emit the `note-created`
/// real-time-sync event (Story 6.6). Returns `None` for a failed response, any
/// other action, an unparseable request, or a success response whose `data`
/// lacks an integer `id`.
///
/// This is the pure, socket- and runtime-agnostic seam: [`handle_request`] stays
/// `AppHandle`-free, and only `lib.rs` performs the actual emit.
pub fn created_note_id(raw: &[u8], response: &IpcResponse) -> Option<i64> {
    if !response.success {
        return None;
    }
    let request: IpcRequest = serde_json::from_slice(raw).ok()?;
    if request.action != "create_note" {
        return None;
    }
    response.data.as_ref()?.get("id")?.as_i64()
}

fn ok_value<T: Serialize>(value: T) -> IpcResponse {
    match serde_json::to_value(value) {
        Ok(data) => IpcResponse::ok(data),
        Err(e) => IpcResponse::err(format!("serialization error: {e}")),
    }
}

fn handle_create(conn: &Connection, payload: Value) -> IpcResponse {
    let payload: CreateNotePayload = match serde_json::from_value(payload) {
        Ok(p) => p,
        Err(e) => return IpcResponse::err(format!("invalid create_note payload: {e}")),
    };

    // Size cap BEFORE any DB work (RISK-E6-001).
    if payload.content.len() > MAX_CONTENT_BYTES {
        return IpcResponse::err(format!(
            "content too large: {} bytes (max {MAX_CONTENT_BYTES})",
            payload.content.len()
        ));
    }

    let format = payload.format.as_deref().unwrap_or("markdown");
    if let Err(e) = conn.execute_batch("BEGIN IMMEDIATE") {
        return IpcResponse::err(e.to_string());
    }

    let result: Result<_, crate::errors::NoteyError> = (|| {
        // Resolve the optional workspace through the SAME Epic-2 logic the GUI
        // uses (detect git root + upsert) so CLI-created notes can't
        // orphan/duplicate rows. Keep it inside the transaction so a later
        // failure rolls any workspace insert back too.
        let workspace_id = match payload.workspace_path.as_deref() {
            Some(path) => Some(workspace_service::resolve_workspace(conn, path)?.id),
            None => None,
        };

        // Create blank then set content — identical to the GUI create→auto-save
        // path, but wrapped in one transaction so a failed update cannot leave a
        // half-created row behind.
        let note = notes::create_note(conn, format, workspace_id)?;
        let title = derive_title(&payload.content);
        notes::update_note(conn, note.id, Some(title), Some(payload.content), None)
    })();

    match result {
        Ok(updated) => match conn.execute_batch("COMMIT") {
            Ok(()) => ok_value(updated),
            Err(e) => {
                let _ = conn.execute_batch("ROLLBACK");
                IpcResponse::err(e.to_string())
            }
        },
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            IpcResponse::err(e.to_string())
        }
    }
}

fn handle_list(conn: &Connection, payload: Value) -> IpcResponse {
    // An absent payload (`null`) means "no workspace filter".
    let payload: ListNotesPayload = if payload.is_null() {
        ListNotesPayload::default()
    } else {
        match serde_json::from_value(payload) {
            Ok(p) => p,
            Err(e) => return IpcResponse::err(format!("invalid list_notes payload: {e}")),
        }
    };

    match notes::list_notes_with_workspace(conn, payload.workspace_name.as_deref()) {
        Ok(list) => ok_value(list),
        Err(e) => IpcResponse::err(e.to_string()),
    }
}

fn handle_search(conn: &Connection, payload: Value) -> IpcResponse {
    let payload: SearchNotesPayload = match serde_json::from_value(payload) {
        Ok(p) => p,
        Err(e) => return IpcResponse::err(format!("invalid search_notes payload: {e}")),
    };

    match search_service::search_notes_by_workspace_name(
        conn,
        &payload.query,
        payload.workspace_name.as_deref(),
    ) {
        Ok(results) => ok_value(results),
        Err(e) => IpcResponse::err(e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let mut conn = Connection::open_in_memory().expect("open in-memory db");
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .expect("set pragmas");
        crate::db::MIGRATIONS
            .to_latest(&mut conn)
            .expect("run migrations");
        conn
    }

    fn request(action: &str, payload: Value) -> Vec<u8> {
        serde_json::to_vec(&serde_json::json!({ "action": action, "payload": payload }))
            .expect("serialize request")
    }

    #[test]
    fn derive_title_uses_first_line_capped() {
        assert_eq!(derive_title("# Heading\nbody"), "# Heading");
        assert_eq!(derive_title("   spaced   \nrest"), "spaced");
        assert_eq!(derive_title(""), "Untitled");
        assert_eq!(derive_title("   \n  "), "Untitled");
        assert_eq!(derive_title(&"x".repeat(250)).chars().count(), 100);
    }

    #[test]
    fn create_note_routes_and_persists_content() {
        let conn = setup_test_db();
        let resp = handle_request(
            &conn,
            &request(
                "create_note",
                serde_json::json!({ "content": "hello world" }),
            ),
        );
        assert!(resp.success, "expected success, got {:?}", resp.error);
        let data = resp.data.expect("data");
        assert!(data["id"].as_i64().unwrap() > 0);
        assert_eq!(data["title"], "hello world");
        assert_eq!(data["content"], "hello world");
        assert_eq!(data["format"], "markdown");
    }

    #[test]
    fn create_note_empty_content_titles_untitled() {
        let conn = setup_test_db();
        let resp = handle_request(
            &conn,
            &request("create_note", serde_json::json!({ "content": "" })),
        );
        assert!(resp.success);
        assert_eq!(resp.data.unwrap()["title"], "Untitled");
    }

    #[test]
    fn create_note_rejects_over_cap_content() {
        let conn = setup_test_db();
        let big = "a".repeat(MAX_CONTENT_BYTES + 1);
        let resp = handle_request(
            &conn,
            &request("create_note", serde_json::json!({ "content": big })),
        );
        assert!(!resp.success);
        assert!(resp.error.unwrap().contains("too large"));
        // Nothing was written.
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM notes", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn create_note_at_cap_is_accepted() {
        let conn = setup_test_db();
        let exact = "a".repeat(MAX_CONTENT_BYTES);
        let resp = handle_request(
            &conn,
            &request("create_note", serde_json::json!({ "content": exact })),
        );
        assert!(resp.success, "1 MiB exactly must be accepted");
    }

    #[test]
    fn create_note_stores_injection_payload_literally() {
        let conn = setup_test_db();
        let payload = "'); DROP TABLE notes;-- ../../etc/passwd";
        let resp = handle_request(
            &conn,
            &request("create_note", serde_json::json!({ "content": payload })),
        );
        assert!(resp.success);
        // Schema intact + stored verbatim (parameterized queries, no SQL effect).
        let stored: String = conn
            .query_row(
                "SELECT content FROM notes WHERE id = ?1",
                [resp.data.unwrap()["id"].as_i64().unwrap()],
                |r| r.get(0),
            )
            .expect("notes table still queryable");
        assert_eq!(stored, payload);
    }

    #[test]
    fn create_note_rolls_back_when_update_fails() {
        let conn = setup_test_db();
        conn.execute_batch(
            "CREATE TRIGGER fail_ipc_note_update
             BEFORE UPDATE ON notes
             BEGIN
               SELECT RAISE(FAIL, 'boom');
             END;",
        )
        .expect("install failing trigger");

        let resp = handle_request(
            &conn,
            &request(
                "create_note",
                serde_json::json!({ "content": "will rollback" }),
            ),
        );
        assert!(!resp.success);
        assert!(resp.error.unwrap().contains("boom"));

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM notes", [], |r| r.get(0))
            .expect("query notes");
        assert_eq!(count, 0, "failed create must not leave a blank note behind");
    }

    #[test]
    fn list_notes_routes_enriched_with_and_without_name_filter() {
        let conn = setup_test_db();
        // A note inside a git-resolved workspace (server detects + upserts it).
        let repo = tempfile::tempdir().expect("tempdir");
        std::fs::create_dir(repo.path().join(".git")).expect("mk .git");
        let repo_path = repo.path().to_str().unwrap();
        handle_request(
            &conn,
            &request(
                "create_note",
                serde_json::json!({ "content": "scoped", "workspacePath": repo_path }),
            ),
        );
        // A workspace-less note.
        handle_request(
            &conn,
            &request("create_note", serde_json::json!({ "content": "loose" })),
        );

        // No filter: both notes, each carrying a (possibly null) workspaceName.
        let resp = handle_request(&conn, &request("list_notes", serde_json::json!({})));
        assert!(resp.success);
        let all = resp.data.unwrap();
        let all = all.as_array().unwrap();
        assert_eq!(all.len(), 2);
        assert!(all.iter().all(|n| n.get("workspaceName").is_some()));

        // Filter by the detected workspace name → only the scoped note.
        let ws_name = repo
            .path()
            .file_name()
            .unwrap()
            .to_str()
            .unwrap()
            .to_string();
        let filtered = handle_request(
            &conn,
            &request(
                "list_notes",
                serde_json::json!({ "workspaceName": ws_name }),
            ),
        );
        assert!(filtered.success);
        let rows = filtered.data.unwrap();
        let rows = rows.as_array().unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["title"], "scoped");
        assert_eq!(rows[0]["workspaceName"], ws_name);

        // A non-existent workspace name → empty.
        let none = handle_request(
            &conn,
            &request(
                "list_notes",
                serde_json::json!({ "workspaceName": "no-such-ws" }),
            ),
        );
        assert!(none.success);
        assert!(none.data.unwrap().as_array().unwrap().is_empty());
    }

    #[test]
    fn search_notes_routes() {
        let conn = setup_test_db();
        handle_request(
            &conn,
            &request(
                "create_note",
                serde_json::json!({ "content": "findme keyword" }),
            ),
        );
        let resp = handle_request(
            &conn,
            &request("search_notes", serde_json::json!({ "query": "findme" })),
        );
        assert!(resp.success, "{:?}", resp.error);
        assert_eq!(resp.data.unwrap().as_array().unwrap().len(), 1);
    }

    #[test]
    fn search_notes_missing_query_is_error() {
        let conn = setup_test_db();
        let resp = handle_request(&conn, &request("search_notes", serde_json::json!({})));
        assert!(!resp.success);
        assert!(resp.error.unwrap().contains("payload"));
    }

    #[test]
    fn search_notes_legacy_workspace_id_is_error() {
        let conn = setup_test_db();
        let resp = handle_request(
            &conn,
            &request(
                "search_notes",
                serde_json::json!({ "query": "findme", "workspaceId": 7 }),
            ),
        );
        assert!(!resp.success);
        assert!(resp.error.unwrap().contains("workspaceId"));
    }

    #[test]
    fn unknown_action_is_error() {
        let conn = setup_test_db();
        let resp = handle_request(&conn, &request("delete_everything", Value::Null));
        assert!(!resp.success);
        assert!(resp.error.unwrap().contains("unknown action"));
    }

    #[test]
    fn created_note_id_returns_id_for_successful_create() {
        let conn = setup_test_db();
        let raw = request("create_note", serde_json::json!({ "content": "sync me" }));
        let resp = handle_request(&conn, &raw);
        assert!(resp.success);
        let expected = resp.data.as_ref().unwrap()["id"].as_i64().unwrap();
        assert_eq!(created_note_id(&raw, &resp), Some(expected));
    }

    #[test]
    fn created_note_id_none_for_failed_create() {
        let raw = request("create_note", serde_json::json!({ "content": "nope" }));
        let resp = IpcResponse::err("boom");
        assert_eq!(created_note_id(&raw, &resp), None);
    }

    #[test]
    fn created_note_id_none_for_other_action() {
        // A successful list response must not trigger a note-created emit.
        let raw = request("list_notes", serde_json::json!({}));
        let resp = IpcResponse::ok(serde_json::json!([{ "id": 5 }]));
        assert_eq!(created_note_id(&raw, &resp), None);
    }

    #[test]
    fn created_note_id_none_when_data_missing_id() {
        let raw = request("create_note", serde_json::json!({ "content": "x" }));
        let resp = IpcResponse::ok(serde_json::json!({ "title": "x" }));
        assert_eq!(created_note_id(&raw, &resp), None);
        // Unparseable request bytes never panic.
        assert_eq!(
            created_note_id(b"{not json", &IpcResponse::ok(Value::Null)),
            None
        );
    }

    #[test]
    fn malformed_json_is_error_no_panic() {
        let conn = setup_test_db();
        let resp = handle_request(&conn, b"{not valid json");
        assert!(!resp.success);
        assert!(resp.error.unwrap().contains("malformed"));

        let empty = handle_request(&conn, b"");
        assert!(!empty.success);
    }
}
