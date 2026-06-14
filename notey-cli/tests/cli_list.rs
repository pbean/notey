//! Story 6.4 integration tests — the `notey list` CLI↔IPC round-trip.
//!
//! Like `cli_add.rs`, these stand up their OWN stub socket server (AC6: no
//! dependency on `src-tauri/`): it binds a temp socket, reads one length-prefixed
//! request, returns a canned `{success,data,error}` response, and hands the
//! captured request bytes back. The real `notey` binary is driven via
//! `CARGO_BIN_EXE_notey` and pointed at the stub through `NOTEY_SOCKET_PATH`.
//! Scenario IDs trace to `test-design-epic-6.md` (6.4-INT-001/002).
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
    std::env::temp_dir().join(format!("notey-cli-list-{}.sock", unique_suffix()))
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

// ── 6.4-INT-001 — list prints one TAB-separated line per note ────────────────

#[test]
fn list_prints_one_line_per_note_tab_separated() {
    let data = json!([
        { "id": 1, "title": "first note", "workspaceName": "proj-a", "updatedAt": "2020-05-04T12:00:00+00:00" },
        { "id": 2, "title": "loose note", "workspaceName": null, "updatedAt": "2020-01-15T12:00:00+00:00" }
    ]);
    let server = StubServer::start(json!({ "success": true, "data": data, "error": null }));
    let output = run_notey(&server.path, &["list"]);
    let request = server.join_request();

    assert_eq!(output.status.code(), Some(0), "list success exits 0");

    // No filter → action list_notes, empty payload object.
    let req = request_json(&request);
    assert_eq!(req["action"], "list_notes");
    assert_eq!(req["payload"], json!({}), "no-filter payload is exactly {{}}");

    let lines = stdout_lines(&output);
    assert_eq!(lines.len(), 2, "one line per note");

    // Line 1: title \t reldate \t workspace.
    let fields: Vec<&str> = lines[0].split('\t').collect();
    assert_eq!(fields.len(), 3, "three TAB-separated fields");
    assert_eq!(fields[0], "first note");
    assert_eq!(fields[1], "May 4", "old date renders as month-day");
    assert_eq!(fields[2], "proj-a");

    // Line 2: workspace-less note → empty third field, but the tab is still there.
    let fields2: Vec<&str> = lines[1].split('\t').collect();
    assert_eq!(fields2.len(), 3);
    assert_eq!(fields2[0], "loose note");
    assert_eq!(fields2[2], "", "absent workspace → empty field");

    let stdout = String::from_utf8(output.stdout).expect("utf8");
    assert!(!stdout.contains('\u{1b}'), "list rows carry no ANSI escapes");
}

#[test]
fn list_truncates_long_title_to_fifty_chars() {
    let long_title = "x".repeat(80);
    let data = json!([
        { "id": 1, "title": long_title, "workspaceName": null, "updatedAt": "2020-05-04T12:00:00+00:00" }
    ]);
    let server = StubServer::start(json!({ "success": true, "data": data, "error": null }));
    let output = run_notey(&server.path, &["list"]);
    let _ = server.join_request();

    assert_eq!(output.status.code(), Some(0));
    let lines = stdout_lines(&output);
    let title = lines[0].split('\t').next().expect("title field");
    assert_eq!(title.chars().count(), 50, "title truncated to 50 chars");
    assert!(title.ends_with('\u{2026}'), "overflowed title ends with …");
}

// ── 6.4-INT-002 — --workspace filter is passed through ───────────────────────

#[test]
fn list_workspace_filter_is_sent_in_payload() {
    let server = StubServer::start(json!({ "success": true, "data": [], "error": null }));
    let output = run_notey(&server.path, &["list", "--workspace", "my-proj"]);
    let request = server.join_request();

    assert_eq!(output.status.code(), Some(0));
    let req = request_json(&request);
    assert_eq!(req["action"], "list_notes");
    assert_eq!(req["payload"]["workspaceName"], "my-proj");
}

#[test]
fn list_invalid_workspace_rejected_before_connecting() {
    // Nothing bound: a connection attempt would surface "not running" instead.
    let socket = unique_socket_path();
    let output = run_notey(&socket, &["list", "--workspace", "../escape"]);

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

// ── output / error mappings ──────────────────────────────────────────────────

#[test]
fn list_empty_result_prints_nothing_and_exits_zero() {
    let server = StubServer::start(json!({ "success": true, "data": [], "error": null }));
    let output = run_notey(&server.path, &["list"]);
    let _ = server.join_request();

    assert_eq!(output.status.code(), Some(0));
    assert!(output.stdout.is_empty(), "empty list prints no stdout lines");
}

#[test]
fn list_app_error_exits_one() {
    let server =
        StubServer::start(json!({ "success": false, "data": null, "error": "db locked" }));
    let output = run_notey(&server.path, &["list"]);
    let _ = server.join_request();

    assert_eq!(output.status.code(), Some(1));
    let stderr = String::from_utf8(output.stderr).expect("utf8 stderr");
    assert!(
        stderr.contains("\u{2717} db locked"),
        "expected app error line, got: {stderr}"
    );
}

#[test]
fn list_not_running_exits_two() {
    let socket = unique_socket_path(); // nothing bound here
    let output = run_notey(&socket, &["list"]);

    assert_eq!(output.status.code(), Some(2));
    let stderr = String::from_utf8(output.stderr).expect("utf8 stderr");
    assert!(
        stderr.contains("Notey is not running. Start the application first."),
        "expected not-running guidance, got: {stderr}"
    );
}
