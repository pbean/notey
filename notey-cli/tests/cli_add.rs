//! Story 6.3 integration tests — the `notey add` CLI↔IPC round-trip.
//!
//! The CLI is a standalone crate (AC6: no dependency on `src-tauri/`), so these
//! tests stand up their OWN stub socket server with `interprocess`: it binds a
//! temp socket, reads one length-prefixed request, returns a canned response, and
//! hands the captured request bytes back to the test. The real `notey` binary is
//! driven via `CARGO_BIN_EXE_notey` and pointed at the stub through
//! `NOTEY_SOCKET_PATH`. Scenario IDs trace to `test-design-epic-6.md`
//! (6.3-INT-001/002/003).

use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::sync::atomic::{AtomicU32, Ordering};
use std::thread::{self, JoinHandle};

use interprocess::local_socket::{prelude::*, GenericFilePath, ListenerOptions};
use serde_json::{json, Value};

const ONE_MIB: usize = 1024 * 1024;

static COUNTER: AtomicU32 = AtomicU32::new(0);

fn unique_suffix() -> String {
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{}-{n}", std::process::id())
}

fn unique_socket_path() -> PathBuf {
    std::env::temp_dir().join(format!("notey-cli-test-{}.sock", unique_suffix()))
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

    /// Wait for the served request and return its raw bytes.
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

/// A temp directory removed on drop — used as a deterministic CWD for workspace
/// path assertions.
struct TempDir {
    path: PathBuf,
}

impl TempDir {
    fn new() -> TempDir {
        let path = std::env::temp_dir().join(format!("notey-cli-cwd-{}", unique_suffix()));
        std::fs::create_dir_all(&path).expect("create temp dir");
        TempDir { path }
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.path);
    }
}

fn repo_workdir() -> (TempDir, PathBuf) {
    let repo = TempDir::new();
    std::fs::create_dir_all(repo.path.join(".git")).expect("create .git dir");

    let cwd = repo.path.join("nested").join("project");
    std::fs::create_dir_all(&cwd).expect("create repo workdir");

    (repo, cwd)
}

fn run_notey(socket: &Path, args: &[&str], cwd: Option<&Path>, stdin: Option<&[u8]>) -> Output {
    let mut cmd = Command::new(env!("CARGO_BIN_EXE_notey"));
    cmd.args(args)
        .env("NOTEY_SOCKET_PATH", socket)
        .stdin(if stdin.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    let mut child = cmd.spawn().expect("spawn notey binary");
    if let Some(bytes) = stdin {
        let mut sink = child.stdin.take().expect("stdin pipe");
        sink.write_all(bytes).expect("write stdin");
        drop(sink); // close → EOF so `--stdin` finishes reading
    }
    child.wait_with_output().expect("wait for notey")
}

fn request_json(bytes: &[u8]) -> Value {
    serde_json::from_slice(bytes).expect("request is valid JSON")
}

// ── 6.3-INT-001 — add <TEXT> round-trips create_note ─────────────────────────

#[test]
fn add_text_sends_create_note_and_prints_success() {
    let server = StubServer::start(json!({ "success": true, "data": { "id": 7 }, "error": null }));
    let output = run_notey(&server.path, &["add", "hello world"], None, None);
    let request = server.join_request();

    assert_eq!(output.status.code(), Some(0), "add success exits 0");
    let stdout = String::from_utf8(output.stdout).expect("utf8 stdout");
    assert!(
        stdout.contains("\u{2713} Note created"),
        "expected success line, got: {stdout}"
    );

    let req = request_json(&request);
    assert_eq!(req["action"], "create_note", "wire action is create_note");
    assert_eq!(req["payload"]["content"], "hello world");
    assert_eq!(req["payload"]["format"], "markdown");
}

// ── 6.3-INT-002 — stdin read to EOF + 1 MiB cap end-to-end ───────────────────

#[test]
fn add_stdin_reads_to_eof() {
    let server = StubServer::start(json!({ "success": true, "data": null, "error": null }));
    let output = run_notey(&server.path, &["add", "--stdin"], None, Some(b"piped body\n"));
    let request = server.join_request();

    assert_eq!(output.status.code(), Some(0));
    let req = request_json(&request);
    assert_eq!(req["payload"]["content"], "piped body\n");
}

#[test]
fn add_stdin_at_one_mib_is_accepted_end_to_end() {
    let server = StubServer::start(json!({ "success": true, "data": null, "error": null }));
    let body = vec![b'a'; ONE_MIB];
    let output = run_notey(&server.path, &["add", "--stdin"], None, Some(&body));
    let request = server.join_request();

    assert_eq!(output.status.code(), Some(0), "exactly 1 MiB must round-trip");
    let req = request_json(&request);
    assert_eq!(
        req["payload"]["content"].as_str().expect("content").len(),
        ONE_MIB
    );
}

#[test]
fn add_oversized_stdin_is_rejected_before_connecting() {
    // No server bound: if the CLI tried to connect it would report "not running".
    let socket = unique_socket_path();
    let body = vec![b'a'; ONE_MIB + 1];
    let output = run_notey(&socket, &["add", "--stdin"], None, Some(&body));

    assert_eq!(output.status.code(), Some(2));
    let stderr = String::from_utf8(output.stderr).expect("utf8 stderr");
    assert!(
        stderr.contains("note content exceeds the 1 MiB limit"),
        "expected size-limit message, got: {stderr}"
    );
    assert!(
        !stderr.contains("Notey is not running"),
        "oversized input must fail before any socket attempt: {stderr}"
    );
}

// ── 6.3-INT-003 — auto-detected workspace = canonical CWD, stable ────────────

#[test]
fn add_includes_canonical_cwd_as_workspace_path() {
    let (_repo, cwd) = repo_workdir();
    let expected = std::fs::canonicalize(&cwd).expect("canonicalize cwd");

    let server = StubServer::start(json!({ "success": true, "data": null, "error": null }));
    let output = run_notey(&server.path, &["add", "note"], Some(&cwd), None);
    let request = server.join_request();

    assert_eq!(output.status.code(), Some(0));
    let req = request_json(&request);
    assert_eq!(
        req["payload"]["workspacePath"],
        json!(expected.to_str().expect("utf8 path")),
        "workspacePath must be the canonical CWD"
    );
}

#[test]
fn add_sends_same_workspace_path_on_repeat() {
    let (_repo, cwd) = repo_workdir();

    let server1 = StubServer::start(json!({ "success": true, "data": null, "error": null }));
    run_notey(&server1.path, &["add", "first"], Some(&cwd), None);
    let first = request_json(&server1.join_request());

    let server2 = StubServer::start(json!({ "success": true, "data": null, "error": null }));
    run_notey(&server2.path, &["add", "second"], Some(&cwd), None);
    let second = request_json(&server2.join_request());

    assert_eq!(
        first["payload"]["workspacePath"], second["payload"]["workspacePath"],
        "the same CWD must yield the same workspacePath (no dup/orphan)"
    );
}

// ── error mapping: app error → exit 1, not running → exit 2 ───────────────────

#[test]
fn add_app_error_exits_one() {
    let server = StubServer::start(json!({ "success": false, "data": null, "error": "db locked" }));
    let output = run_notey(&server.path, &["add", "x"], None, None);
    let _ = server.join_request();

    assert_eq!(output.status.code(), Some(1));
    let stderr = String::from_utf8(output.stderr).expect("utf8 stderr");
    assert!(
        stderr.contains("\u{2717} db locked"),
        "expected app error line, got: {stderr}"
    );
}

#[test]
fn add_not_running_exits_two() {
    let socket = unique_socket_path(); // nothing bound here
    let output = run_notey(&socket, &["add", "x"], None, None);

    assert_eq!(output.status.code(), Some(2));
    let stderr = String::from_utf8(output.stderr).expect("utf8 stderr");
    assert!(
        stderr.contains("Notey is not running. Start the application first."),
        "expected not-running guidance, got: {stderr}"
    );
}
