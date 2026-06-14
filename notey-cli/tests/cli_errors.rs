//! Story 6.7 integration tests — CLI error handling & connection timeout.
//!
//! Like the other Epic 6 CLI suites these stand up their OWN stub socket server
//! (AC6: the CLI shares no code with `src-tauri/`), drive the real `notey` binary
//! via `CARGO_BIN_EXE_notey`, and point it at the stub through `NOTEY_SOCKET_PATH`.
//! Scenario IDs trace to `test-design-epic-6.md` (6.7-INT-001..004).
//!
//! The harness explicitly clears any inherited `NOTEY_CONNECT_TIMEOUT_MS` so the
//! non-timeout cases use the real 5 s default, and sets a short override only for
//! the timeout case — which is then asserted to return in well under the real 5 s.

use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::sync::atomic::{AtomicU32, Ordering};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use interprocess::local_socket::{prelude::*, GenericFilePath, ListenerOptions};
use serde_json::{json, Value};

static COUNTER: AtomicU32 = AtomicU32::new(0);

fn unique_suffix() -> String {
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{}-{n}", std::process::id())
}

fn unique_socket_path() -> PathBuf {
    std::env::temp_dir().join(format!("notey-cli-err-{}.sock", unique_suffix()))
}

// ── duplicated framing (matches socket_server / client) ──────────────────────

fn write_frame(writer: &mut impl Write, body: &[u8]) {
    writer
        .write_all(&(body.len() as u32).to_be_bytes())
        .expect("write len");
    writer.write_all(body).expect("write body");
    writer.flush().expect("flush");
}

fn read_frame(reader: &mut impl Read) -> std::io::Result<Vec<u8>> {
    let mut len = [0u8; 4];
    reader.read_exact(&mut len)?;
    let n = u32::from_be_bytes(len) as usize;
    let mut buf = vec![0u8; n];
    reader.read_exact(&mut buf)?;
    Ok(buf)
}

/// A one-shot stub IPC server that serves a single connection with `response`.
struct StubServer {
    path: PathBuf,
    handle: Option<JoinHandle<()>>,
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
            if let Some(Ok(mut stream)) = listener.incoming().next() {
                let _ = read_frame(&mut stream);
                write_frame(&mut stream, &response_bytes);
            }
        });
        StubServer {
            path,
            handle: Some(handle),
        }
    }
}

impl Drop for StubServer {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
    }
}

/// A stub that accepts a connection, reads the request, and then **never frames a
/// reply** — it sleeps long enough to stay silent past the CLI's (shortened)
/// timeout, then exits. This is the slow-loris hang AC5 must bound (RISK-E6-003).
struct HangServer {
    path: PathBuf,
}

impl HangServer {
    fn start() -> HangServer {
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
        // Detached: the CLI times out and exits well before this thread wakes; it
        // must outlive the CLI's short timeout so the connection stays "accepted
        // but silent" rather than closing early (which would surface as an I/O
        // error instead of a timeout). The OS reaps it at process exit.
        thread::spawn(move || {
            if let Some(Ok(mut stream)) = listener.incoming().next() {
                let _ = read_frame(&mut stream);
                thread::sleep(Duration::from_millis(1500));
            }
        });
        HangServer { path }
    }
}

impl Drop for HangServer {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
    }
}

/// Run the real `notey` binary against `socket`. Inherited `NOTEY_CONNECT_TIMEOUT_MS`
/// is always cleared so each test controls the timeout explicitly; `timeout_ms`
/// (when set) shortens the round-trip bound for the timeout scenarios.
fn run_notey(socket: &Path, args: &[&str], timeout_ms: Option<&str>) -> Output {
    let mut cmd = Command::new(env!("CARGO_BIN_EXE_notey"));
    cmd.args(args)
        .env("NOTEY_SOCKET_PATH", socket)
        .env_remove("NOTEY_CONNECT_TIMEOUT_MS")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(ms) = timeout_ms {
        cmd.env("NOTEY_CONNECT_TIMEOUT_MS", ms);
    }
    cmd.output().expect("run notey binary")
}

fn stderr_of(output: &Output) -> String {
    String::from_utf8(output.stderr.clone()).expect("utf8 stderr")
}

fn stderr_line(output: &Output) -> String {
    stderr_of(output)
        .trim_end_matches(['\r', '\n'])
        .to_string()
}

fn expected_error_line(message: &str) -> String {
    format!("\u{2717} {message}")
}

const NOT_RUNNING: &str = "Notey is not running. Start the application first.";
const TIMEOUT_READ_ONLY: &str = "Notey did not respond in time.";
const TIMEOUT_MUTATING: &str =
    "Notey did not respond in time; your note may or may not have been saved. \
Run 'notey list' to check.";

// ── 6.7-INT-001 — app not running (no socket) → exit 2 + guidance ─────────────

#[test]
fn no_socket_exits_two_with_not_running_guidance() {
    let socket = unique_socket_path(); // nothing bound
    let output = run_notey(&socket, &["list"], None);

    assert_eq!(output.status.code(), Some(2), "no socket → exit 2");
    assert_eq!(stderr_line(&output), expected_error_line(NOT_RUNNING));
}

// ── 6.7-INT-002 — stale/refused socket file → exit 2 + guidance ───────────────

#[cfg(unix)]
#[test]
fn stale_socket_exits_two_with_not_running_guidance() {
    // A socket file that exists but has no live listener: connecting yields
    // ECONNREFUSED, which must collapse to the same not-running guidance as a
    // missing socket. `std`'s `UnixListener` leaves the file on disk when dropped.
    let path = unique_socket_path();
    let _ = std::fs::remove_file(&path);
    let listener = std::os::unix::net::UnixListener::bind(&path).expect("bind stale socket");
    drop(listener); // no listener now, but the socket file remains

    let output = run_notey(&path, &["search", "anything"], None);
    let _ = std::fs::remove_file(&path);

    assert_eq!(output.status.code(), Some(2), "stale socket → exit 2");
    assert_eq!(stderr_line(&output), expected_error_line(NOT_RUNNING));
}

// ── 6.7-INT-003 — app processing error → exit 1 + `✕ <error>` ─────────────────

#[test]
fn app_error_response_exits_one() {
    let server = StubServer::start(json!({ "success": false, "data": null, "error": "db locked" }));
    let output = run_notey(&server.path, &["list"], None);

    assert_eq!(output.status.code(), Some(1), "app error → exit 1");
    assert_eq!(stderr_line(&output), expected_error_line("db locked"));
}

// ── 6.7-INT-004 — server hangs → exit 2, well under the real 5 s ──────────────

#[test]
fn timeout_read_only_command_exits_two_quickly() {
    let server = HangServer::start();
    let started = Instant::now();
    let output = run_notey(&server.path, &["list"], Some("200"));
    let elapsed = started.elapsed();

    assert_eq!(output.status.code(), Some(2), "read-only timeout → exit 2");
    assert_eq!(stderr_line(&output), expected_error_line(TIMEOUT_READ_ONLY));
    assert!(
        elapsed < Duration::from_secs(2),
        "shortened timeout must return well under the real 5 s (took {elapsed:?})"
    );
}

#[test]
fn timeout_mutating_add_reports_indeterminate_and_exits_two() {
    let server = HangServer::start();
    let started = Instant::now();
    let output = run_notey(&server.path, &["add", "note body"], Some("200"));
    let elapsed = started.elapsed();

    assert_eq!(output.status.code(), Some(2), "mutating timeout → exit 2");
    let stderr = stderr_line(&output);
    assert_eq!(stderr, expected_error_line(TIMEOUT_MUTATING));
    // Must never claim a definite failure for a possibly-committed write.
    assert!(
        !stderr.to_lowercase().contains("failed"),
        "indeterminate timeout must not claim failure, got: {stderr}"
    );
    assert!(
        elapsed < Duration::from_secs(2),
        "shortened timeout must return well under the real 5 s (took {elapsed:?})"
    );
}
