//! Local-socket listener, framing, lifecycle, and per-user security for the IPC
//! server.
//!
//! Transport: `interprocess` local sockets (Unix domain socket on Linux/macOS,
//! named pipe on Windows). Each message is length-prefixed — a `u32` big-endian
//! byte count followed by a UTF-8 JSON body — so note content containing newlines
//! is carried safely and an oversized frame is rejected before allocation.
//!
//! Security (Unix): the socket lives under the per-user runtime dir
//! (`$XDG_RUNTIME_DIR/notey.sock`, itself `0700`) with file mode `0600`, so no
//! other local user can connect (RISK-E6-002 / NFR11). True cross-user access is
//! verified by manual/platform QA (RISK-E6-007); the automatable guarantees are
//! the `0600` mode and the user-scoped path.

use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};

use interprocess::local_socket::traits::Stream as _;
use interprocess::local_socket::{prelude::*, ListenerOptions, Name, Stream};

use crate::errors::NoteyError;
use crate::ipc::protocol::IpcResponse;

/// Hard cap on a single request frame. Set well above the 1 MiB content cap to
/// allow envelope/escaping overhead while still bounding a memory-DoS frame.
const MAX_REQUEST_BYTES: usize = 8 * 1024 * 1024;

/// A request handler: given a de-framed JSON body, produce a response.
///
/// Production wiring locks the app's single managed `Mutex<Connection>` via the
/// `AppHandle`; tests pass a handler over their own temp connection. Either way
/// it ultimately calls [`handle_request`].
pub type Handler = Arc<dyn Fn(&[u8]) -> IpcResponse + Send + Sync>;

/// Resolve the per-user socket path.
///
/// Honors the `NOTEY_SOCKET_PATH` override first (the testability seam). On Unix,
/// prefers `$XDG_RUNTIME_DIR/notey.sock`, falling back to a user-scoped temp-dir
/// path. On Windows, returns a user-scoped namespaced pipe name.
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
/// namespaced pipe (from the final path component) on Windows.
fn to_name(path: &Path) -> io::Result<Name<'static>> {
    #[cfg(windows)]
    {
        let raw = path
            .file_name()
            .unwrap_or(path.as_os_str())
            .to_owned();
        raw.to_ns_name::<interprocess::local_socket::GenericNamespaced>()
    }

    #[cfg(not(windows))]
    {
        path.as_os_str().to_owned().to_fs_name::<interprocess::local_socket::GenericFilePath>()
    }
}

/// Read one length-prefixed frame, rejecting an over-cap length before allocating.
pub fn read_frame(reader: &mut impl Read) -> io::Result<Vec<u8>> {
    let mut len_buf = [0u8; 4];
    reader.read_exact(&mut len_buf)?;
    let len = u32::from_be_bytes(len_buf) as usize;
    if len > MAX_REQUEST_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("frame too large: {len} bytes (max {MAX_REQUEST_BYTES})"),
        ));
    }
    let mut buf = vec![0u8; len];
    reader.read_exact(&mut buf)?;
    Ok(buf)
}

/// Write one length-prefixed frame.
pub fn write_frame(writer: &mut impl Write, body: &[u8]) -> io::Result<()> {
    let len = body.len() as u32;
    writer.write_all(&len.to_be_bytes())?;
    writer.write_all(body)?;
    writer.flush()
}

/// Connect to a server at `path`, send one framed request body, and return the
/// framed response body. Used by the CLI-less integration tests (and, later, as
/// the reference for the duplicated CLI client).
pub fn connect_stream(path: &Path) -> Result<Stream, NoteyError> {
    let name = to_name(path).map_err(NoteyError::Io)?;
    Stream::connect(name).map_err(NoteyError::Io)
}

/// Connect to a server at `path`, send one framed request body, and return the
/// framed response body. Used by the CLI-less integration tests (and, later, as
/// the reference for the duplicated CLI client).
pub fn request(path: &Path, request_body: &[u8]) -> Result<Vec<u8>, NoteyError> {
    let mut stream = connect_stream(path)?;
    write_frame(&mut stream, request_body).map_err(NoteyError::Io)?;
    read_frame(&mut stream).map_err(NoteyError::Io)
}

/// A running IPC socket server. Dropping it (or calling [`IpcServer::shutdown`])
/// stops the accept loop and removes the socket file.
pub struct IpcServer {
    shutdown: Arc<AtomicBool>,
    path: PathBuf,
    handle: Option<JoinHandle<()>>,
    /// `true` once the socket file is a real filesystem path we own (Unix).
    owns_file: bool,
}

impl IpcServer {
    /// Bind a listener at `path` and spawn its accept loop.
    ///
    /// Reclaims a stale socket file left by a previous crash (probe-then-remove),
    /// sets mode `0600` on Unix, and dispatches every accepted connection's
    /// request to `handler` on a per-connection worker thread so one slow client
    /// cannot block the accept loop.
    pub fn start(path: &Path, handler: Handler) -> Result<IpcServer, NoteyError> {
        reclaim_stale(path)?;

        let name = to_name(path).map_err(NoteyError::Io)?;
        let listener = ListenerOptions::new()
            .name(name)
            .create_sync()
            .map_err(NoteyError::Io)?;

        let owns_file = match set_owner_only(path) {
            Ok(owns_file) => owns_file,
            Err(err) => {
                drop(listener);
                let _ = std::fs::remove_file(path);
                return Err(err);
            }
        };

        let shutdown = Arc::new(AtomicBool::new(false));
        let accept_shutdown = Arc::clone(&shutdown);
        let handle = thread::spawn(move || accept_loop(listener, accept_shutdown, handler));

        Ok(IpcServer {
            shutdown,
            path: path.to_path_buf(),
            handle: Some(handle),
            owns_file,
        })
    }

    /// Signal the accept loop to stop, wake it with a throwaway connection, join
    /// it, and remove the socket file. Idempotent.
    pub fn shutdown(&mut self) {
        if self.shutdown.swap(true, Ordering::SeqCst) {
            return; // already shut down
        }
        // Unblock the blocking `incoming()` accept with a self-connect.
        if let Ok(name) = to_name(&self.path) {
            let _ = Stream::connect(name);
        }
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
        if self.owns_file {
            let _ = std::fs::remove_file(&self.path);
        }
    }
}

impl Drop for IpcServer {
    fn drop(&mut self) {
        self.shutdown();
    }
}

/// On Unix, remove a leftover socket file if no live server answers on it.
fn reclaim_stale(path: &Path) -> Result<(), NoteyError> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::FileTypeExt;

        if !path.exists() {
            return Ok(());
        }

        let metadata = std::fs::symlink_metadata(path).map_err(NoteyError::Io)?;
        if !metadata.file_type().is_socket() {
            return Err(NoteyError::Validation(format!(
                "IPC socket path already exists and is not a socket: {}",
                path.display()
            )));
        }
        // A live server would accept the connection; a refused/dead one means the
        // file is stale and safe to remove before we rebind.
        match to_name(path).and_then(Stream::connect) {
            Ok(_) => Ok(()), // someone is listening — let bind fail loudly
            Err(err)
                if matches!(
                    err.kind(),
                    io::ErrorKind::ConnectionRefused | io::ErrorKind::NotFound
                ) =>
            {
                match std::fs::remove_file(path) {
                    Ok(()) => Ok(()),
                    Err(remove_err) if remove_err.kind() == io::ErrorKind::NotFound => Ok(()),
                    Err(remove_err) => Err(NoteyError::Io(remove_err)),
                }
            }
            Err(err) => Err(NoteyError::Io(err)),
        }
    }
    #[cfg(not(unix))]
    {
        let _ = path;
        Ok(())
    }
}

/// Restrict the socket file to owner-only (`0600`). Returns whether a real file
/// path is being managed (always `false` on non-Unix namespaced pipes).
fn set_owner_only(path: &Path) -> Result<bool, NoteyError> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
            .map_err(NoteyError::Io)?;
        Ok(true)
    }
    #[cfg(not(unix))]
    {
        let _ = path;
        Ok(false)
    }
}

fn accept_loop(
    listener: interprocess::local_socket::Listener,
    shutdown: Arc<AtomicBool>,
    handler: Handler,
) {
    for incoming in listener.incoming() {
        if shutdown.load(Ordering::SeqCst) {
            break;
        }
        match incoming {
            Ok(stream) => {
                let handler = Arc::clone(&handler);
                // One worker per connection: a slow/never-closing client parks its
                // own thread without blocking the accept loop (RISK-E6-003).
                thread::spawn(move || handle_connection(stream, handler));
            }
            Err(_) => continue, // transient accept error — keep serving
        }
    }
}

fn handle_connection(mut stream: Stream, handler: Handler) {
    let response = match read_frame(&mut stream) {
        Ok(body) => {
            // Defense in depth: a content payload can never legitimately exceed the
            // frame cap, but reject early regardless.
            if body.len() > MAX_REQUEST_BYTES {
                IpcResponse::err("request too large")
            } else {
                handler(&body)
            }
        }
        Err(e) => IpcResponse::err(format!("frame error: {e}")),
    };

    let encoded = serde_json::to_vec(&response).unwrap_or_else(|_| {
        br#"{"success":false,"data":null,"error":"response encode failed"}"#.to_vec()
    });
    let _ = write_frame(&mut stream, &encoded);
}
