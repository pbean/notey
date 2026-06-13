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

use interprocess::local_socket::traits::Stream as _;
use interprocess::local_socket::{prelude::*, GenericFilePath, Name, Stream};

use crate::{CliRequest, CliResponse};

/// Hard cap on a single response frame, mirroring the server's `MAX_REQUEST_BYTES`
/// (8 MiB). Bounds a hostile/garbage length prefix before allocation.
const MAX_FRAME_BYTES: usize = 8 * 1024 * 1024;

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
}

impl std::fmt::Display for ClientError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ClientError::NotRunning => f.write_str("desktop app is not running"),
            ClientError::Io(e) => write!(f, "IPC transport error: {e}"),
            ClientError::Decode(e) => write!(f, "malformed response: {e}"),
        }
    }
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

/// Connect to the running desktop app, send `request`, and return its response.
///
/// Connection-refused / socket-missing collapse to [`ClientError::NotRunning`] so
/// the caller can print the actionable "Notey is not running" guidance and exit 2.
/// All other transport failures surface as [`ClientError::Io`]; a malformed reply
/// surfaces as [`ClientError::Decode`].
pub fn send_request(request: &CliRequest) -> Result<CliResponse, ClientError> {
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
