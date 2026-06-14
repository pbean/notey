//! Story 6.5 integration tests — the `notey search` CLI↔IPC round-trip.
//!
//! Like `cli_list.rs`, these stand up their OWN stub socket server (AC6: no
//! dependency on `src-tauri/`): it binds a temp socket, reads one length-prefixed
//! request, returns a canned `{success,data,error}` response, and hands the
//! captured request bytes back. The real `notey` binary is driven via
//! `CARGO_BIN_EXE_notey` and pointed at the stub through `NOTEY_SOCKET_PATH`.
//! Scenario IDs trace to `test-design-epic-6.md` (6.5-INT-001/002/003).
//!
//! Canned `updatedAt` values are intentionally far in the past so the rendered
//! relative date is a stable `MonthAbbr Day` regardless of when the suite runs;
//! the time-bucket logic itself is unit-tested in `lib.rs` with an injected `now`.

use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::sync::atomic::{AtomicU32, Ordering};
use std::thread::{self, JoinHandle};

use interprocess::local_socket::{prelude::*, GenericFilePath, ListenerOptions};
use serde_json::{json, Value};

static COUNTER: AtomicU32 = AtomicU32::new(0);

fn unique_suffix() -> String {
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{}-{n}", std::process::id())
}

fn unique_socket_path() -> PathBuf {
    std::env::temp_dir().join(format!("notey-cli-search-{}.sock", unique_suffix()))
}

// ── duplicated framing (matches socket_server / client) ──────────────────────

fn write_frame(writer: &mut impl Write, body: &[u8]) {
    writer
        .write_all(&(body.len() as u32).to_be_bytes())
        .expect("write len");
    writer.write_all(body).expect("write body");
    writer.flush().expect("flush");
}

fn read_frame(reader: &mut impl Read) -> Vec<u8> {
    let mut len = [0u8; 4];
    reader.read_exact(&mut len).expect("read len");
    let n = u32::from_be_bytes(len) as usize;
    let mut buf = vec![0u8; n];
    reader.read_exact(&mut buf).expect("read body");
    buf
}

/// A one-shot stub IPC server: serves a single connection with `response`, then
/// yields the request bytes it captured.
struct StubServer {
    path: PathBuf,
    handle: Option<JoinHandle<Vec<u8>>>,
}

impl StubServer {
    fn start(response: Value) -> StubServer {
        let path = unique_socket_path();
        let _ = std::fs::remove_file(&path);
        let name = path
            .as_os_str()
            .to_owned()
            .to_fs_name::<GenericFilePath>()
            .expect("fs name");
        let listener = ListenerOptions::new()
            .name(name)
            .create_sync()
            .expect("bind stub socket");
        let response_bytes = serde_json::to_vec(&response).expect("encode response");
        let handle = thread::spawn(move || {
            let mut stream = listener
                .incoming()
                .next()
                .expect("a connection")
                .expect("accept connection");
            let request = read_frame(&mut stream);
            write_frame(&mut stream, &response_bytes);
            request
        });
        StubServer {
            path,
            handle: Some(handle),
        }
    }

    fn join_request(mut self) -> Vec<u8> {
        self.handle
            .take()
            .expect("handle")
            .join()
            .expect("stub server thread")
    }
}

impl Drop for StubServer {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
    }
}

fn run_notey(socket: &Path, args: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_notey"))
        .args(args)
        .env("NOTEY_SOCKET_PATH", socket)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn notey binary")
        .wait_with_output()
        .expect("wait for notey")
}

fn request_json(bytes: &[u8]) -> Value {
    serde_json::from_slice(bytes).expect("request is valid JSON")
}

fn stdout_lines(output: &Output) -> Vec<String> {
    String::from_utf8(output.stdout.clone())
        .expect("utf8 stdout")
        .lines()
        .map(str::to_string)
        .collect()
}

// ── 6.5-INT-001 — search prints one 4-field line per result ──────────────────

#[test]
fn search_prints_title_snippet_workspace_date_per_result() {
    let data = json!([
        {
            "id": 1,
            "title": "deploy guide",
            "snippet": "the <mark>deploy</mark> steps...",
            "workspaceName": "proj-a",
            "updatedAt": "2020-05-04T12:00:00+00:00",
            "format": "markdown"
        },
        {
            "id": 2,
            "title": "loose note",
            "snippet": "another <mark>deploy</mark> hit",
            "workspaceName": null,
            "updatedAt": "2020-01-15T12:00:00+00:00",
            "format": "markdown"
        }
    ]);
    let server = StubServer::start(json!({ "success": true, "data": data, "error": null }));
    let output = run_notey(&server.path, &["search", "deploy"]);
    let request = server.join_request();

    assert_eq!(output.status.code(), Some(0), "search success exits 0");

    // No filter → action search_notes, payload carries only the query.
    let req = request_json(&request);
    assert_eq!(req["action"], "search_notes");
    assert_eq!(req["payload"], json!({ "query": "deploy" }));

    let lines = stdout_lines(&output);
    assert_eq!(lines.len(), 2, "one line per result");

    // Line 1: title \t snippet (marks stripped) \t workspace \t reldate.
    let fields: Vec<&str> = lines[0].split('\t').collect();
    assert_eq!(fields.len(), 4, "four TAB-separated fields");
    assert_eq!(fields[0], "deploy guide");
    assert_eq!(fields[1], "the deploy steps...", "mark tags stripped");
    assert_eq!(fields[2], "proj-a");
    assert_eq!(fields[3], "May 4", "old date renders as month-day");

    // Line 2: workspace-less result → empty third field, tab still present.
    let fields2: Vec<&str> = lines[1].split('\t').collect();
    assert_eq!(fields2.len(), 4);
    assert_eq!(fields2[1], "another deploy hit");
    assert_eq!(fields2[2], "", "absent workspace → empty field");

    let stdout = String::from_utf8(output.stdout).expect("utf8");
    assert!(!stdout.contains('\u{1b}'), "search rows carry no ANSI escapes");
}

// ── 6.5-INT-002 — --workspace filter is passed through ───────────────────────

#[test]
fn search_workspace_filter_is_sent_in_payload() {
    let server = StubServer::start(json!({ "success": true, "data": [], "error": null }));
    let output = run_notey(&server.path, &["search", "deploy", "--workspace", "my-proj"]);
    let request = server.join_request();

    assert_eq!(output.status.code(), Some(0));
    let req = request_json(&request);
    assert_eq!(req["action"], "search_notes");
    assert_eq!(req["payload"]["query"], "deploy");
    assert_eq!(req["payload"]["workspaceName"], "my-proj");
}

#[test]
fn search_invalid_workspace_rejected_before_connecting() {
    // Nothing bound: a connection attempt would surface "not running" instead.
    let socket = unique_socket_path();
    let output = run_notey(&socket, &["search", "deploy", "--workspace", "../escape"]);

    assert_eq!(output.status.code(), Some(2));
    let stderr = String::from_utf8(output.stderr).expect("utf8 stderr");
    assert!(
        stderr.contains("invalid workspace name"),
        "expected validation message, got: {stderr}"
    );
    assert!(
        !stderr.contains("Notey is not running"),
        "invalid input must fail before any socket attempt: {stderr}"
    );
}

// ── 6.5-INT-003 — no match → stdout message, exit 0 ──────────────────────────

#[test]
fn search_no_match_prints_message_and_exits_zero() {
    let server = StubServer::start(json!({ "success": true, "data": [], "error": null }));
    let output = run_notey(&server.path, &["search", "nothinghere"]);
    let _ = server.join_request();

    assert_eq!(output.status.code(), Some(0));
    let lines = stdout_lines(&output);
    assert_eq!(lines.len(), 1);
    assert_eq!(lines[0], "No notes matching 'nothinghere'");
}

// ── output / error mappings ──────────────────────────────────────────────────

#[test]
fn search_app_error_exits_one() {
    let server =
        StubServer::start(json!({ "success": false, "data": null, "error": "db locked" }));
    let output = run_notey(&server.path, &["search", "deploy"]);
    let _ = server.join_request();

    assert_eq!(output.status.code(), Some(1));
    let stderr = String::from_utf8(output.stderr).expect("utf8 stderr");
    assert!(
        stderr.contains("\u{2717} db locked"),
        "expected app error line, got: {stderr}"
    );
}

#[test]
fn search_not_running_exits_two() {
    let socket = unique_socket_path(); // nothing bound here
    let output = run_notey(&socket, &["search", "deploy"]);

    assert_eq!(output.status.code(), Some(2));
    let stderr = String::from_utf8(output.stderr).expect("utf8 stderr");
    assert!(
        stderr.contains("Notey is not running. Start the application first."),
        "expected not-running guidance, got: {stderr}"
    );
}
