//! Standalone IPC socket client for the `notey` CLI (Story 6.3).
//!
//! This module is the CLI half of the IPC contract whose server half lives in
//! `src-tauri/src/ipc/`. Per Story 6.1 **AC6** the two crates share **no code**:
//! the wire framing and the per-user socket-path resolution are **duplicated**
//! here against the same observable contract —
//!
//! - **Framing:** each message is a 4-byte big-endian length prefix followed by a
//!   UTF-8 JSON body (matches `socket_server::{read_frame, write_frame}`).
//! - **Path:** `NOTEY_SOCKET_PATH` override → `dirs::runtime_dir()/notey.sock` on
//!   Unix (temp-dir fallback) → namespaced pipe on Windows (matches
//!   `socket_server::socket_path`).
//!
//! Only the single request/response round-trip needed by `add` (and, later,
//! `list`/`search`) is implemented; lifecycle, permissions, and concurrency are
//! server-side concerns.

use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

use interprocess::local_socket::traits::Stream as _;
use interprocess::local_socket::{prelude::*, GenericFilePath, Name, Stream};

use crate::{CliRequest, CliResponse};

/// Hard cap on a single response frame, mirroring the server's `MAX_REQUEST_BYTES`
/// (8 MiB). Bounds a hostile/garbage length prefix before allocation.
const MAX_FRAME_BYTES: usize = 8 * 1024 * 1024;

/// Default bound on the **entire** CLI round-trip (connect + write + read). The
/// realistic hang is a server that accepts the connection but never frames a
/// reply, so the bound must cover the whole operation, not just the read
/// (Story 6.7 / AC5, RISK-E6-003/004). Overridable for tests via
/// `NOTEY_CONNECT_TIMEOUT_MS` (see [`connect_timeout`]).
const DEFAULT_CONNECT_TIMEOUT: Duration = Duration::from_secs(5);

/// Why a CLI round-trip failed. The caller maps these onto a [`CommandOutcome`].
///
/// [`CommandOutcome`]: crate::CommandOutcome
#[derive(Debug)]
pub enum ClientError {
    /// The desktop app is not reachable — no socket file, or the connection was
    /// refused (stale socket with no live server). Maps to `NotRunning` (exit 2).
    NotRunning,
    /// A transport-level I/O failure after a connection was established.
    Io(io::Error),
    /// The response framed back was not a well-formed [`CliResponse`].
    Decode(String),
    /// The round-trip did not complete within the connection timeout — the
    /// server accepted the connection but never framed a reply. Maps to
    /// `Timeout` (exit 2).
    Timeout,
}

impl std::fmt::Display for ClientError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ClientError::NotRunning => f.write_str("desktop app is not running"),
            ClientError::Io(e) => write!(f, "IPC transport error: {e}"),
            ClientError::Decode(e) => write!(f, "malformed response: {e}"),
            ClientError::Timeout => f.write_str("timed out waiting for the desktop app"),
        }
    }
}

/// Resolve the round-trip timeout. Honors `NOTEY_CONNECT_TIMEOUT_MS` (unsigned
/// milliseconds) as a **test-only** seam mirroring `NOTEY_SOCKET_PATH`; an unset
/// or unparseable value falls back to [`DEFAULT_CONNECT_TIMEOUT`] (5 s).
fn connect_timeout() -> Duration {
    std::env::var("NOTEY_CONNECT_TIMEOUT_MS")
        .ok()
        .and_then(|raw| raw.parse::<u64>().ok())
        .map(Duration::from_millis)
        .unwrap_or(DEFAULT_CONNECT_TIMEOUT)
}

/// Resolve the per-user socket path the desktop server binds.
///
/// Honors `NOTEY_SOCKET_PATH` first (the test seam). On Unix prefers
/// `$XDG_RUNTIME_DIR/notey.sock`, then a user-scoped temp-dir path. On Windows
/// returns a user-scoped namespaced pipe name. Mirrors `socket_server::socket_path`.
pub fn socket_path() -> PathBuf {
    if let Ok(custom) = std::env::var("NOTEY_SOCKET_PATH") {
        return PathBuf::from(custom);
    }

    #[cfg(unix)]
    {
        if let Some(dir) = dirs::runtime_dir() {
            return dir.join("notey.sock");
        }
        let file_name = user_scope_token()
            .map(|token| format!("notey-{token}.sock"))
            .unwrap_or_else(|| "notey.sock".to_string());
        std::env::temp_dir().join(file_name)
    }

    #[cfg(windows)]
    {
        PathBuf::from(
            user_scope_token()
                .map(|token| format!("notey-{token}"))
                .unwrap_or_else(|| "notey".to_string()),
        )
    }
}

/// Derive a stable, filesystem-safe per-user token for fallback socket naming.
/// Mirrors `socket_server::user_scope_token`.
fn user_scope_token() -> Option<String> {
    dirs::home_dir()
        .as_deref()
        .and_then(Path::file_name)
        .and_then(|name| name.to_str())
        .map(str::to_owned)
        .or_else(|| std::env::var("USER").ok())
        .or_else(|| std::env::var("USERNAME").ok())
        .and_then(|candidate| {
            let sanitized: String = candidate
                .chars()
                .map(|c| {
                    if c.is_ascii_alphanumeric() {
                        c.to_ascii_lowercase()
                    } else {
                        '-'
                    }
                })
                .collect();
            let trimmed = sanitized.trim_matches('-');
            (!trimmed.is_empty()).then(|| trimmed.to_string())
        })
}

/// Build the transport `Name` for `path`: a filesystem socket on Unix, a
/// namespaced pipe (from the final path component) on Windows. Mirrors
/// `socket_server::to_name`.
fn to_name(path: &Path) -> io::Result<Name<'static>> {
    #[cfg(windows)]
    {
        let raw = path
            .file_name()
            .unwrap_or_else(|| path.as_os_str())
            .to_owned();
        raw.to_ns_name::<interprocess::local_socket::GenericNamespaced>()
    }

    #[cfg(not(windows))]
    {
        path.as_os_str().to_owned().to_fs_name::<GenericFilePath>()
    }
}

/// Read one length-prefixed frame, rejecting an over-cap length before allocating.
fn read_frame(reader: &mut impl Read) -> io::Result<Vec<u8>> {
    let mut len_buf = [0u8; 4];
    reader.read_exact(&mut len_buf)?;
    let len = u32::from_be_bytes(len_buf) as usize;
    if len > MAX_FRAME_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("frame too large: {len} bytes (max {MAX_FRAME_BYTES})"),
        ));
    }
    let mut buf = vec![0u8; len];
    reader.read_exact(&mut buf)?;
    Ok(buf)
}

/// Write one length-prefixed frame.
fn write_frame(writer: &mut impl Write, body: &[u8]) -> io::Result<()> {
    let len = body.len() as u32;
    writer.write_all(&len.to_be_bytes())?;
    writer.write_all(body)?;
    writer.flush()
}

/// Connect to the running desktop app, send `request`, and return its response,
/// bounded by [`connect_timeout`].
///
/// The blocking round-trip ([`send_request_blocking`]) runs on a worker thread;
/// this function waits for it with [`mpsc::Receiver::recv_timeout`] so the
/// **entire** connect + write + read is bounded. If the bound elapses first the
/// call returns [`ClientError::Timeout`] (exit 2) and the orphaned worker — still
/// blocked on the dead socket — is harmless: the one-shot CLI prints and exits, a
/// late `tx.send` on the dropped channel returns `Err` and is ignored, and the OS
/// reaps the thread. A worker that drops its sender without producing a value maps
/// to a transport [`ClientError::Io`], never a false success.
///
/// Connection-refused / socket-missing collapse to [`ClientError::NotRunning`] so
/// the caller can print the actionable "Notey is not running" guidance and exit 2.
/// All other transport failures surface as [`ClientError::Io`]; a malformed reply
/// surfaces as [`ClientError::Decode`].
pub fn send_request(request: &CliRequest) -> Result<CliResponse, ClientError> {
    let (tx, rx) = mpsc::sync_channel::<Result<CliResponse, ClientError>>(1);
    let req = request.clone();

    // A failure to even spawn the worker is a local transport failure, not a
    // panic — surface it as `Io` so the caller maps it to a clean exit code.
    thread::Builder::new()
        .name("notey-ipc".to_string())
        .spawn(move || {
            // Late send after a timeout (receiver dropped) returns Err — ignore it.
            let _ = tx.send(send_request_blocking(&req));
        })
        .map_err(|e| ClientError::Io(io::Error::other(format!("failed to spawn IPC worker: {e}"))))?;

    match rx.recv_timeout(connect_timeout()) {
        Ok(result) => result,
        Err(mpsc::RecvTimeoutError::Timeout) => Err(ClientError::Timeout),
        Err(mpsc::RecvTimeoutError::Disconnected) => Err(ClientError::Io(io::Error::other(
            "IPC worker exited without responding",
        ))),
    }
}

/// The blocking connect + write + read round-trip, run on a worker thread by
/// [`send_request`]. Splitting it out keeps the timeout wrapper thin and lets the
/// blocking body stay a straightforward sequence of fallible steps.
fn send_request_blocking(request: &CliRequest) -> Result<CliResponse, ClientError> {
    let path = socket_path();
    let name = to_name(&path).map_err(map_connect_err)?;
    let mut stream = Stream::connect(name).map_err(map_connect_err)?;

    let body = serde_json::to_vec(request)
        .map_err(|e| ClientError::Io(io::Error::new(io::ErrorKind::InvalidData, e)))?;
    write_frame(&mut stream, &body).map_err(ClientError::Io)?;

    let response_body = read_frame(&mut stream).map_err(ClientError::Io)?;
    serde_json::from_slice(&response_body).map_err(|e| ClientError::Decode(e.to_string()))
}

/// Treat "no server there" connect failures as [`ClientError::NotRunning`]; keep
/// everything else as a transport error.
fn map_connect_err(err: io::Error) -> ClientError {
    match err.kind() {
        io::ErrorKind::ConnectionRefused | io::ErrorKind::NotFound => ClientError::NotRunning,
        _ => ClientError::Io(err),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    /// Serializes the env-mutating tests in this module — the process env is global
    /// shared state, so without a lock these would race when run in parallel.
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    /// RAII guard that restores an env var to its prior value on drop, keeping the
    /// inherited process environment clean for any other test.
    struct EnvVarGuard {
        key: &'static str,
        prior: Option<String>,
    }

    impl EnvVarGuard {
        fn set(key: &'static str, value: &str) -> EnvVarGuard {
            let prior = std::env::var(key).ok();
            std::env::set_var(key, value);
            EnvVarGuard { key, prior }
        }

        fn unset(key: &'static str) -> EnvVarGuard {
            let prior = std::env::var(key).ok();
            std::env::remove_var(key);
            EnvVarGuard { key, prior }
        }
    }

    impl Drop for EnvVarGuard {
        fn drop(&mut self) {
            match &self.prior {
                Some(value) => std::env::set_var(self.key, value),
                None => std::env::remove_var(self.key),
            }
        }
    }

    // ── 6.7 — NOTEY_CONNECT_TIMEOUT_MS test seam parsing ─────────────────────

    #[test]
    fn connect_timeout_defaults_to_five_seconds_when_unset() {
        let _lock = ENV_LOCK.lock().unwrap_or_else(|p| p.into_inner());
        let _guard = EnvVarGuard::unset("NOTEY_CONNECT_TIMEOUT_MS");
        assert_eq!(connect_timeout(), Duration::from_secs(5));
    }

    #[test]
    fn connect_timeout_defaults_to_five_seconds_on_garbage() {
        let _lock = ENV_LOCK.lock().unwrap_or_else(|p| p.into_inner());
        let _guard = EnvVarGuard::set("NOTEY_CONNECT_TIMEOUT_MS", "abc");
        assert_eq!(connect_timeout(), Duration::from_secs(5));
    }

    #[test]
    fn connect_timeout_uses_a_valid_override() {
        let _lock = ENV_LOCK.lock().unwrap_or_else(|p| p.into_inner());
        let _guard = EnvVarGuard::set("NOTEY_CONNECT_TIMEOUT_MS", "250");
        assert_eq!(connect_timeout(), Duration::from_millis(250));
    }

    // ── 6.7 / AC4 — CLI socket path is user-scoped (mirrors server 6.2-INT-002/008)

    #[test]
    fn socket_path_honors_the_override_seam() {
        let _lock = ENV_LOCK.lock().unwrap_or_else(|p| p.into_inner());
        let _guard = EnvVarGuard::set("NOTEY_SOCKET_PATH", "/tmp/notey-override.sock");
        assert_eq!(socket_path(), PathBuf::from("/tmp/notey-override.sock"));
    }

    /// AC4 (CLI side): with no override, the default Linux path is the per-user
    /// `$XDG_RUNTIME_DIR/notey.sock`, matching the server's per-user resolution so
    /// both halves bind the same owner-only socket. True multi-uid isolation is
    /// the server's 0600 + 0700-runtime-dir guarantee (manual QA, RISK-E6-007).
    #[cfg(target_os = "linux")]
    #[test]
    fn socket_path_is_user_scoped_under_xdg_runtime_dir() {
        let _lock = ENV_LOCK.lock().unwrap_or_else(|p| p.into_inner());
        let _no_override = EnvVarGuard::unset("NOTEY_SOCKET_PATH");
        // Force a known runtime dir so the assertion is deterministic regardless of
        // the host's inherited environment.
        let _runtime = EnvVarGuard::set("XDG_RUNTIME_DIR", "/run/user/4242");

        let resolved = socket_path();
        assert_eq!(
            resolved,
            PathBuf::from("/run/user/4242/notey.sock"),
            "default Linux path must be the per-user runtime socket"
        );
        assert!(resolved.starts_with("/run/user/4242"));
        assert_eq!(resolved.file_name().unwrap(), "notey.sock");
    }
}
