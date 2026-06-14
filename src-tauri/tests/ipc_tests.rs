//! Integration tests for the Story 6.2 IPC socket server.
//!
//! These exercise the real `interprocess` transport against a temp socket bound
//! over a temp SQLite DB — the reusable harness the rest of Epic 6's integration
//! tier builds on. Test IDs map to `test-design-epic-6.md` (6.2-INT-001..008).

mod helpers;

use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use std::thread;

use rusqlite::Connection;
use serde_json::{json, Value};
use tempfile::TempDir;

use helpers::factories::create_temp_db;
use interprocess::local_socket::Stream;
use tauri_app_lib::ipc::protocol::{IpcResponse, MAX_CONTENT_BYTES};
use tauri_app_lib::ipc::socket_server::{self, Handler, IpcServer};

/// A running server bound to a temp socket over a shared temp DB. The server is
/// held only to keep it alive and to unlink its socket on drop.
struct TestServer {
    _server: IpcServer,
    path: PathBuf,
    conn: Arc<Mutex<Connection>>,
    _sock_dir: TempDir,
    _db_dir: TempDir,
}

/// Unique per-process counter so concurrent temp socket paths never collide.
static SOCKET_SEQ: AtomicUsize = AtomicUsize::new(0);
static SOCKET_PATH_ENV_LOCK: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));

impl TestServer {
    fn start() -> TestServer {
        let (conn, db_dir) = create_temp_db();
        let conn = Arc::new(Mutex::new(conn));
        let sock_dir = TempDir::new().expect("socket dir");
        let n = SOCKET_SEQ.fetch_add(1, Ordering::SeqCst);
        let path = sock_dir.path().join(format!("notey-test-{n}.sock"));

        let handler_conn = Arc::clone(&conn);
        let handler: Handler = Arc::new(move |raw: &[u8]| {
            let guard = handler_conn.lock().unwrap_or_else(|e| e.into_inner());
            tauri_app_lib::ipc::protocol::handle_request(&guard, raw)
        });
        let server = IpcServer::start(&path, handler).expect("start IPC server");

        TestServer {
            _server: server,
            path,
            conn,
            _sock_dir: sock_dir,
            _db_dir: db_dir,
        }
    }

    /// Send a `{action,payload}` request and parse the response envelope.
    fn send(&self, action: &str, payload: Value) -> IpcResponse {
        send_to(&self.path, action, payload)
    }
}

fn send_to(path: &Path, action: &str, payload: Value) -> IpcResponse {
    let body = serde_json::to_vec(&json!({ "action": action, "payload": payload })).unwrap();
    let raw = socket_server::request(path, &body).expect("request round-trip");
    serde_json::from_slice(&raw).expect("parse response envelope")
}

/// Low-level raw client for malformed/oversized/slow-client tests.
fn raw_connect(path: &Path) -> Stream {
    socket_server::connect_stream(path).expect("connect")
}

// ── 6.2-INT-001: bind, accept, route the three actions, envelope ──────────────

#[test]
fn int_001_routes_all_three_actions_with_envelope() {
    let ts = TestServer::start();

    let create = ts.send("create_note", json!({ "content": "hello ipc" }));
    assert!(create.success, "create error: {:?}", create.error);
    let data = create.data.expect("create data");
    assert!(data["id"].as_i64().unwrap() > 0);
    assert_eq!(data["title"], "hello ipc");
    assert_eq!(data["content"], "hello ipc");
    assert!(create.error.is_none());

    let list = ts.send("list_notes", json!({}));
    assert!(list.success);
    assert_eq!(list.data.unwrap().as_array().unwrap().len(), 1);

    let search = ts.send("search_notes", json!({ "query": "hello" }));
    assert!(search.success, "search error: {:?}", search.error);
    assert_eq!(search.data.unwrap().as_array().unwrap().len(), 1);
}

#[test]
fn int_001_routes_workspace_resolution_and_positive_filters() {
    let ts = TestServer::start();
    let workspace_dir = TempDir::new().expect("workspace dir");

    let scoped = ts.send(
        "create_note",
        json!({
            "content": "workspace note",
            "workspacePath": workspace_dir.path().to_str().unwrap()
        }),
    );
    assert!(scoped.success, "create error: {:?}", scoped.error);
    let scoped_data = scoped.data.expect("scoped data");
    let workspace_id = scoped_data["workspaceId"].as_i64().expect("workspace id");

    let unscoped = ts.send("create_note", json!({ "content": "workspace note other" }));
    assert!(unscoped.success, "create error: {:?}", unscoped.error);

    // `list_notes` filters by workspace NAME (Story 6.4): the server detects the
    // workspace from the create path; with no `.git`, the name is the dir basename.
    let workspace_name = workspace_dir
        .path()
        .file_name()
        .and_then(|n| n.to_str())
        .expect("workspace name")
        .to_string();
    let filtered_list = ts.send("list_notes", json!({ "workspaceName": workspace_name }));
    assert!(
        filtered_list.success,
        "list error: {:?}",
        filtered_list.error
    );
    let list_items = filtered_list.data.unwrap();
    let list_items = list_items.as_array().expect("list array");
    assert_eq!(list_items.len(), 1);
    assert_eq!(list_items[0]["id"], scoped_data["id"]);
    assert_eq!(list_items[0]["workspaceName"], workspace_name);

    let filtered_search = ts.send(
        "search_notes",
        json!({ "query": "workspace", "workspaceId": workspace_id }),
    );
    assert!(
        filtered_search.success,
        "search error: {:?}",
        filtered_search.error
    );
    let search_items = filtered_search.data.unwrap();
    let search_items = search_items.as_array().expect("search array");
    assert_eq!(search_items.len(), 1);
    assert_eq!(search_items[0]["id"], scoped_data["id"]);
}

// ── 6.2-INT-002 / 008: 0600 socket mode + per-user, owner-only path ───────────

#[cfg(unix)]
#[test]
fn int_002_socket_file_mode_is_0600() {
    use std::os::unix::fs::PermissionsExt;
    let ts = TestServer::start();
    let mode = std::fs::metadata(&ts.path)
        .expect("stat socket")
        .permissions()
        .mode();
    assert_eq!(mode & 0o777, 0o600, "socket must be owner-only (0600)");
}

#[test]
fn int_002_008_socket_path_is_user_scoped() {
    let _guard = SOCKET_PATH_ENV_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());

    // Override seam works (the testability ASR).
    std::env::set_var("NOTEY_SOCKET_PATH", "/tmp/notey-override.sock");
    assert_eq!(
        socket_server::socket_path(),
        PathBuf::from("/tmp/notey-override.sock")
    );
    std::env::remove_var("NOTEY_SOCKET_PATH");

    // Default resolves under the per-user runtime dir (itself 0700) on Linux,
    // which — together with the 0600 file mode — is the automatable slice of
    // cross-user isolation. True multi-uid access is manual QA (RISK-E6-007).
    #[cfg(target_os = "linux")]
    if let Some(runtime) = dirs::runtime_dir() {
        let resolved = socket_server::socket_path();
        assert!(
            resolved.starts_with(&runtime),
            "{resolved:?} should live under {runtime:?}"
        );
        assert_eq!(resolved.file_name().unwrap(), "notey.sock");
    }
}

// ── 6.2-INT-003: protocol robustness — malformed / unknown, no panic ──────────

#[test]
fn int_003_malformed_and_unknown_are_errors_without_crashing() {
    let ts = TestServer::start();

    // Malformed JSON body (still correctly framed).
    let raw = socket_server::request(&ts.path, b"{ not json").expect("round-trip");
    let resp: IpcResponse = serde_json::from_slice(&raw).unwrap();
    assert!(!resp.success);
    assert!(resp.error.unwrap().contains("malformed"));

    // Unknown action.
    let unknown = ts.send("obliterate", json!({}));
    assert!(!unknown.success);
    assert!(unknown.error.unwrap().contains("unknown action"));

    // Server survived both — a well-formed request still works.
    let ok = ts.send("create_note", json!({ "content": "still alive" }));
    assert!(ok.success, "server should survive bad input");
}

// ── 6.2-INT-004: injection payload stored literally (parameterized) ───────────

#[test]
fn int_004_injection_payload_stored_literally() {
    let ts = TestServer::start();
    let payload = "'); DROP TABLE notes;-- ../../etc/passwd \u{0007}control";

    let resp = ts.send("create_note", json!({ "content": payload }));
    assert!(resp.success, "create error: {:?}", resp.error);
    let id = resp.data.unwrap()["id"].as_i64().unwrap();

    // Verify directly against the shared connection: schema intact, stored verbatim.
    let guard = ts.conn.lock().unwrap();
    let stored: String = guard
        .query_row("SELECT content FROM notes WHERE id = ?1", [id], |r| {
            r.get(0)
        })
        .expect("notes table still queryable (no SQL injection effect)");
    assert_eq!(stored, payload, "content must be stored literally");
    let count: i64 = guard
        .query_row("SELECT COUNT(*) FROM notes", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 1);
}

#[test]
fn int_004_content_over_cap_rejected() {
    let ts = TestServer::start();
    let big = "a".repeat(MAX_CONTENT_BYTES + 1);
    let resp = ts.send("create_note", json!({ "content": big }));
    assert!(!resp.success);
    assert!(resp.error.unwrap().contains("too large"));

    let guard = ts.conn.lock().unwrap();
    let count: i64 = guard
        .query_row("SELECT COUNT(*) FROM notes", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 0, "over-cap content must not be written");
}

// ── 6.2-INT-005: cleanup on shutdown + stale-socket rebind ────────────────────

#[cfg(unix)]
#[test]
fn int_005_cleanup_on_shutdown_and_stale_rebind() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("lifecycle.sock");

    // 1) A live server creates the socket file...
    let (conn, _db) = create_temp_db();
    let conn = Arc::new(Mutex::new(conn));
    let server = start_at(&path, Arc::clone(&conn));
    assert!(path.exists(), "socket file should exist while running");

    // ...and removes it on graceful shutdown.
    drop(server);
    assert!(!path.exists(), "socket file should be removed on shutdown");

    // 2) A stale leftover file from a prior crash must be reclaimed on rebind.
    create_stale_socket(&path);
    let (conn2, _db2) = create_temp_db();
    let conn2 = Arc::new(Mutex::new(conn2));
    let server2 = start_at(&path, conn2);
    let resp = send_to(&path, "create_note", json!({ "content": "after rebind" }));
    assert!(resp.success, "server should rebind over a stale socket");
    drop(server2);
}

#[cfg(unix)]
#[test]
fn int_005_existing_regular_file_is_not_reclaimed() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("not-a-socket.sock");
    std::fs::write(&path, b"regular file").expect("write regular file");

    let (conn, _db) = create_temp_db();
    let conn = Arc::new(Mutex::new(conn));
    match IpcServer::start(&path, handler_for_conn(conn)) {
        Ok(_) => panic!("regular files must not be reclaimed as stale sockets"),
        Err(err) => assert!(
            err.to_string().contains("not a socket"),
            "unexpected error: {err}"
        ),
    }
    let bytes = std::fs::read(&path).expect("regular file preserved");
    assert_eq!(bytes, b"regular file");
}

#[cfg(unix)]
fn start_at(path: &Path, conn: Arc<Mutex<Connection>>) -> IpcServer {
    IpcServer::start(path, handler_for_conn(conn)).expect("start server")
}

fn handler_for_conn(conn: Arc<Mutex<Connection>>) -> Handler {
    Arc::new(move |raw: &[u8]| {
        let guard = conn.lock().unwrap_or_else(|e| e.into_inner());
        tauri_app_lib::ipc::protocol::handle_request(&guard, raw)
    })
}

#[cfg(unix)]
fn create_stale_socket(path: &Path) {
    let listener =
        std::os::unix::net::UnixListener::bind(path).expect("create stale socket with stdlib");
    assert!(path.exists(), "listener should create a socket file");
    drop(listener);
    assert!(
        path.exists(),
        "dropping listener should leave a stale socket file"
    );
}

// ── 6.2-INT-006: N concurrent clients get independent correct responses ───────

#[test]
fn int_006_concurrent_clients_each_get_correct_response() {
    let ts = TestServer::start();
    let path = ts.path.clone();
    const N: usize = 12;

    let handles: Vec<_> = (0..N)
        .map(|i| {
            let p = path.clone();
            thread::spawn(move || {
                let resp = send_to(&p, "create_note", json!({ "content": format!("note-{i}") }));
                assert!(resp.success, "client {i} failed: {:?}", resp.error);
                let data = resp.data.unwrap();
                assert_eq!(data["title"], format!("note-{i}"));
                assert_eq!(data["content"], format!("note-{i}"));
                data["id"].as_i64().unwrap()
            })
        })
        .collect();

    let mut ids: Vec<i64> = handles.into_iter().map(|h| h.join().unwrap()).collect();
    ids.sort_unstable();
    ids.dedup();
    assert_eq!(
        ids.len(),
        N,
        "every concurrent create must yield a distinct note"
    );
}

// ── 6.2-INT-007: oversized frame + slow client don't block/crash the server ───

#[test]
fn int_007_oversized_frame_rejected_server_survives() {
    let ts = TestServer::start();

    // Claim a frame far larger than MAX_REQUEST_BYTES without sending a body.
    let mut stream = raw_connect(&ts.path);
    stream.write_all(&u32::MAX.to_be_bytes()).unwrap();
    stream.flush().unwrap();
    // Read whatever the server replies (an error frame) or EOF; must not hang us.
    let mut buf = Vec::new();
    let _ = stream.read_to_end(&mut buf);
    drop(stream);

    // The accept loop is unharmed — a normal request still succeeds.
    let ok = ts.send("create_note", json!({ "content": "post-oversize" }));
    assert!(ok.success, "server must survive an oversized frame");
}

#[test]
fn int_007_slow_client_does_not_block_accept_loop() {
    let ts = TestServer::start();

    // A client that sends a partial length prefix and then stalls indefinitely.
    let mut slow = raw_connect(&ts.path);
    slow.write_all(&[0x00, 0x00]).unwrap(); // 2 of 4 length bytes, then nothing
    slow.flush().unwrap();

    // Meanwhile a normal client must be served promptly.
    let ok = ts.send("list_notes", json!({}));
    assert!(ok.success, "a slow client must not block other clients");

    drop(slow); // release the parked worker
}
