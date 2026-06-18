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

use std::collections::HashMap;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use interprocess::local_socket::traits::Stream as _;
use interprocess::local_socket::{prelude::*, ListenerOptions, Name, Stream};

use crate::errors::NoteyError;
use crate::ipc::protocol::IpcResponse;

/// Hard cap on a single request frame. Set well above the 1 MiB content cap to
/// allow envelope/escaping overhead while still bounding a memory-DoS frame.
const MAX_REQUEST_BYTES: usize = 8 * 1024 * 1024;

/// Default concurrent-worker budget when `NOTEY_IPC_MAX_WORKERS` is unset.
const DEFAULT_MAX_WORKERS: usize = 128;

/// Default request-read deadline (ms) when `NOTEY_IPC_READ_DEADLINE_MS` is unset.
const DEFAULT_READ_DEADLINE_MS: u64 = 5000;

/// How often the reaper wakes to unblock workers past their read deadline. Kept
/// short so a reclaimed slot becomes available promptly (and tests run fast).
const REAPER_INTERVAL: Duration = Duration::from_millis(100);

/// Resolved budget cap: `NOTEY_IPC_MAX_WORKERS` or [`DEFAULT_MAX_WORKERS`].
///
/// Parsed once at server start (mirrors the `NOTEY_SOCKET_PATH` seam). A value of
/// `0` or an unparseable value falls back to the default.
fn max_workers() -> usize {
    std::env::var("NOTEY_IPC_MAX_WORKERS")
        .ok()
        .and_then(|raw| raw.parse::<usize>().ok())
        .filter(|&n| n > 0)
        .unwrap_or(DEFAULT_MAX_WORKERS)
}

/// Resolved request-read deadline: `NOTEY_IPC_READ_DEADLINE_MS` or
/// [`DEFAULT_READ_DEADLINE_MS`]. Parsed once at server start.
fn read_deadline() -> Duration {
    let ms = std::env::var("NOTEY_IPC_READ_DEADLINE_MS")
        .ok()
        .and_then(|raw| raw.parse::<u64>().ok())
        .filter(|&n| n > 0)
        .unwrap_or(DEFAULT_READ_DEADLINE_MS);
    Duration::from_millis(ms)
}

/// A raw, non-owning reference to a worker's open connection, used solely so the
/// reaper can unblock a stuck read without owning (and thus closing) the stream.
///
/// The raw fd/handle is captured from the [`Stream`] at accept time and stored
/// here as a plain value. It is only ever acted upon (`shutdown`/`CancelIoEx`)
/// while the owning worker's registry entry is held under the registry lock,
/// which guarantees the underlying fd/handle is still open (the worker removes
/// its entry under that same lock *before* dropping its `Stream`).
#[derive(Clone, Copy)]
struct RawConn {
    #[cfg(unix)]
    fd: std::os::fd::RawFd,
    #[cfg(windows)]
    handle: std::os::windows::io::RawHandle,
}

// SAFETY: `RawConn` holds only a raw fd/handle as a plain integer/pointer value.
// We never dereference or close it; we only pass it to `shutdown`/`CancelIoEx`
// under the registry lock (see the safety invariant on the reaper). Sending the
// raw value across threads is sound because ownership of the fd/handle stays with
// the worker's `Stream`; the registry merely borrows its raw value to unblock it.
unsafe impl Send for RawConn {}

/// One live worker's registry entry: its raw connection plus, while it is still
/// in the request-read phase, a deadline after which the reaper may unblock it.
/// `read_deadline` is cleared (`None`) once a full frame is read so the handler
/// and response write are never reaped mid-flight.
struct WorkerEntry {
    conn: RawConn,
    read_deadline: Option<Instant>,
}

/// Shared map of in-flight workers keyed by a monotonic id. The map's length
/// under its lock *is* the connection budget.
type WorkerRegistry = Arc<Mutex<HashMap<u64, WorkerEntry>>>;

/// A request handler: given a de-framed JSON body, produce a response.
///
/// Production wiring locks the app's single managed `Mutex<Connection>` via the
/// `AppHandle`; tests pass a handler over their own temp connection. Either way
/// it ultimately calls [`handle_request`].
pub type Handler = Arc<dyn Fn(&[u8]) -> IpcResponse + Send + Sync>;

/// Scan an argument iterator for a `--socket-path <PATH>` (or
/// `--socket-path=<PATH>`) override, returning the first non-empty value.
///
/// Parsed permissively so the desktop app never aborts on flags injected by its
/// launcher (e.g. a WebDriver harness forwarding `tauri:options.args`): unknown
/// arguments are ignored, and a flag with a missing or empty value is treated as
/// absent (falls through to env/default) rather than an error.
fn socket_path_arg_from<I: Iterator<Item = String>>(args: I) -> Option<PathBuf> {
    let mut args = args;
    while let Some(arg) = args.next() {
        if let Some(value) = arg.strip_prefix("--socket-path=") {
            if !value.is_empty() {
                return Some(PathBuf::from(value));
            }
            continue;
        }
        if arg == "--socket-path" {
            let Some(value) = args.next() else {
                continue;
            };
            if !value.is_empty() && !value.starts_with("--") {
                return Some(PathBuf::from(value));
            }
        }
    }
    None
}

/// Read the `--socket-path` override from this process's actual arguments.
fn socket_path_arg() -> Option<PathBuf> {
    socket_path_arg_from(std::env::args())
}

/// Resolve the per-user socket path.
///
/// Precedence: an explicit `--socket-path` CLI argument wins (the channel the
/// E2E harness routes through `tauri:options.args`, since it survives a launcher
/// that resets the environment), then the `NOTEY_SOCKET_PATH` env override (the
/// testability seam). Otherwise it delegates to the platform abstraction's
/// [`crate::platform::Platform::socket_path`], the single source of truth for the
/// default per-user path (Story 8.5).
pub fn socket_path() -> PathBuf {
    if let Some(custom) = socket_path_arg() {
        return custom;
    }

    if let Ok(custom) = std::env::var("NOTEY_SOCKET_PATH") {
        return PathBuf::from(custom);
    }

    crate::platform::current().socket_path()
}

/// Build the transport `Name` for `path`: a filesystem socket on Unix, a
/// namespaced pipe (from the final path component) on Windows.
fn to_name(path: &Path) -> io::Result<Name<'static>> {
    #[cfg(windows)]
    {
        let raw = path.file_name().unwrap_or(path.as_os_str()).to_owned();
        raw.to_ns_name::<interprocess::local_socket::GenericNamespaced>()
    }

    #[cfg(not(windows))]
    {
        path.as_os_str()
            .to_owned()
            .to_fs_name::<interprocess::local_socket::GenericFilePath>()
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
    /// Join handle for the read-phase watchdog/reaper thread.
    reaper: Option<JoinHandle<()>>,
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
    ///
    /// Worker threads are bounded two ways: a concurrent-connection budget
    /// (`NOTEY_IPC_MAX_WORKERS`, default [`DEFAULT_MAX_WORKERS`]) and a
    /// cross-platform read-phase watchdog. A single reaper thread unblocks any
    /// worker still waiting to read its request frame past the read deadline
    /// (`NOTEY_IPC_READ_DEADLINE_MS`, default [`DEFAULT_READ_DEADLINE_MS`]).
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

        // Parse the env-override config once at start (mirrors `NOTEY_SOCKET_PATH`).
        let max_workers = max_workers();
        let read_deadline = read_deadline();

        let shutdown = Arc::new(AtomicBool::new(false));
        let registry: WorkerRegistry = Arc::new(Mutex::new(HashMap::new()));

        let accept_shutdown = Arc::clone(&shutdown);
        let accept_registry = Arc::clone(&registry);
        let handle = thread::spawn(move || {
            accept_loop(
                listener,
                accept_shutdown,
                handler,
                accept_registry,
                max_workers,
                read_deadline,
            )
        });

        let reaper_shutdown = Arc::clone(&shutdown);
        let reaper_registry = Arc::clone(&registry);
        let reaper = thread::spawn(move || reaper_loop(reaper_shutdown, reaper_registry));

        Ok(IpcServer {
            shutdown,
            path: path.to_path_buf(),
            handle: Some(handle),
            reaper: Some(reaper),
            owns_file,
        })
    }

    /// Signal the accept loop and reaper to stop, wake the accept loop with a
    /// throwaway connection, join both threads, and remove the socket file.
    /// Idempotent.
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
        // The reaper observes the shutdown flag within REAPER_INTERVAL and exits.
        if let Some(reaper) = self.reaper.take() {
            let _ = reaper.join();
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

/// Capture the raw fd (Unix) / handle (Windows) of a connection by matching the
/// unified [`Stream`] enum. The raw value is stored in the registry as a plain
/// value; ownership of the fd/handle remains with the worker's `Stream`.
fn raw_conn(stream: &Stream) -> RawConn {
    match stream {
        #[cfg(unix)]
        Stream::UdSocket(s) => {
            use std::os::fd::{AsFd, AsRawFd};
            RawConn {
                fd: s.as_fd().as_raw_fd(),
            }
        }
        #[cfg(windows)]
        Stream::NamedPipe(s) => {
            use std::os::windows::io::{AsHandle, AsRawHandle};
            RawConn {
                handle: s.as_handle().as_raw_handle(),
            }
        }
    }
}

/// Unblock a worker stuck in its read by acting on its raw connection — without
/// closing it (the owning worker's `Stream` still owns the fd/handle).
///
/// On Unix, `shutdown(SHUT_RD)` makes the worker's `read_exact` return so it
/// errors and drops its stream normally (no double-close). Only the *read* half
/// is shut down: if the reaper fires in the narrow window after a frame finished
/// reading but before the worker cleared its deadline, the response write half is
/// left intact, so a just-completed request is never torn. On Windows,
/// `CancelIoEx` cross-thread-cancels the worker's synchronous `ReadFile`.
///
/// MUST be called only while holding the registry lock (see the reaper's safety
/// invariant): an entry observed under the lock is guaranteed still-open.
fn unblock_conn(conn: RawConn) {
    #[cfg(unix)]
    {
        // SAFETY: `conn.fd` is still open (entry held under the registry lock);
        // `shutdown(SHUT_RD)` does not close the fd (and leaves the write half
        // open), so the owning `Stream` may still drop it normally afterwards.
        unsafe {
            libc::shutdown(conn.fd, libc::SHUT_RD);
        }
    }
    #[cfg(windows)]
    {
        use windows::Win32::Foundation::HANDLE;
        use windows::Win32::System::IO::CancelIoEx;
        // SAFETY: `conn.handle` is still open (entry held under the registry
        // lock). `CancelIoEx` cancels pending I/O cross-thread without closing
        // the handle; the owning `Stream` still drops it normally afterwards.
        unsafe {
            let _ = CancelIoEx(HANDLE(conn.handle as *mut _), None);
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn accept_loop(
    listener: interprocess::local_socket::Listener,
    shutdown: Arc<AtomicBool>,
    handler: Handler,
    registry: WorkerRegistry,
    max_workers: usize,
    read_deadline: Duration,
) {
    let next_id = AtomicU64::new(0);

    for incoming in listener.incoming() {
        if shutdown.load(Ordering::SeqCst) {
            break;
        }
        match incoming {
            Ok(mut stream) => {
                // Capture the raw fd/handle BEFORE moving the stream into a worker
                // so the reaper can later unblock it.
                let conn = raw_conn(&stream);
                let id = next_id.fetch_add(1, Ordering::Relaxed);

                // Budget gate: hold the registry lock only briefly. If at capacity,
                // reply "server busy" and drop the connection without spawning.
                // Otherwise register the worker, then spawn outside the lock so the
                // accept loop is never blocked on worker work.
                let admitted = {
                    let mut reg = registry.lock().unwrap_or_else(|e| e.into_inner());
                    if reg.len() >= max_workers {
                        false
                    } else {
                        reg.insert(
                            id,
                            WorkerEntry {
                                conn,
                                read_deadline: Some(Instant::now() + read_deadline),
                            },
                        );
                        true
                    }
                };

                if !admitted {
                    let busy = IpcResponse::err("server busy");
                    let encoded = serde_json::to_vec(&busy).unwrap_or_else(|_| {
                        br#"{"success":false,"data":null,"error":"server busy"}"#.to_vec()
                    });
                    let _ = write_frame(&mut stream, &encoded);
                    drop(stream);
                    continue;
                }

                let handler = Arc::clone(&handler);
                let registry = Arc::clone(&registry);
                // One worker per connection (within budget): a slow/never-closing
                // client parks its own thread without blocking the accept loop
                // (RISK-E6-003), and is reclaimed by the reaper past the deadline.
                thread::spawn(move || handle_connection(stream, handler, registry, id));
            }
            Err(_) => continue, // transient accept error — keep serving
        }
    }
}

/// RAII guard that removes a worker's registry entry under the registry lock when
/// the worker exits. Declared *after* the `stream` binding so it drops *before*
/// the `stream` (Rust drops locals in reverse declaration order): the entry is
/// removed under the lock before the fd/handle closes, so an entry observed under
/// the lock by the reaper is always still-open.
struct DeregisterGuard {
    registry: WorkerRegistry,
    id: u64,
}

impl Drop for DeregisterGuard {
    fn drop(&mut self) {
        let mut reg = self.registry.lock().unwrap_or_else(|e| e.into_inner());
        reg.remove(&self.id);
    }
}

fn handle_connection(stream: Stream, handler: Handler, registry: WorkerRegistry, id: u64) {
    // Bind `stream` first, then the guard: the guard drops first (reverse
    // declaration order), removing the registry entry UNDER THE LOCK before the
    // stream — and thus the fd/handle — is dropped/closed.
    let mut stream = stream;
    let _guard = DeregisterGuard {
        registry: Arc::clone(&registry),
        id,
    };

    let response = match read_frame(&mut stream) {
        Ok(body) => {
            // Full frame read: clear this worker's deadline so the handler and
            // response write are never reaped mid-flight.
            {
                let mut reg = registry.lock().unwrap_or_else(|e| e.into_inner());
                if let Some(entry) = reg.get_mut(&id) {
                    entry.read_deadline = None;
                }
            }
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

/// Single watchdog/reaper thread: periodically unblock any worker still in its
/// request-read phase past its deadline so its slot is reclaimed. Exits when the
/// shared `shutdown` flag is set (within [`REAPER_INTERVAL`]).
///
/// Safety invariant: `unblock_conn` is called *while holding the registry lock*.
/// Because a worker removes its entry — and only then drops its `Stream`/closes
/// its fd/handle — under that same lock, any entry observed here is guaranteed
/// still-open, so shutdown/cancel can never race a reused fd/handle.
fn reaper_loop(shutdown: Arc<AtomicBool>, registry: WorkerRegistry) {
    while !shutdown.load(Ordering::SeqCst) {
        thread::sleep(REAPER_INTERVAL);
        if shutdown.load(Ordering::SeqCst) {
            break;
        }
        let reg = registry.lock().unwrap_or_else(|e| e.into_inner());
        let now = Instant::now();
        for entry in reg.values() {
            if let Some(deadline) = entry.read_deadline {
                if deadline <= now {
                    unblock_conn(entry.conn);
                }
            }
        }
        drop(reg);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Build an owned-`String` argument iterator from string literals, mirroring
    /// what `std::env::args()` yields (the program name is included as argv[0]).
    fn argv(items: &[&str]) -> std::vec::IntoIter<String> {
        items
            .iter()
            .map(|s| s.to_string())
            .collect::<Vec<_>>()
            .into_iter()
    }

    #[test]
    fn socket_path_arg_space_form() {
        let got = socket_path_arg_from(argv(&["notey", "--socket-path", "/tmp/x.sock"]));
        assert_eq!(got, Some(PathBuf::from("/tmp/x.sock")));
    }

    #[test]
    fn socket_path_arg_equals_form() {
        let got = socket_path_arg_from(argv(&["notey", "--socket-path=/tmp/x.sock"]));
        assert_eq!(got, Some(PathBuf::from("/tmp/x.sock")));
    }

    #[test]
    fn socket_path_arg_missing_value_is_absent() {
        // Flag is the final token with no value following it.
        let got = socket_path_arg_from(argv(&["notey", "--socket-path"]));
        assert_eq!(got, None);
    }

    #[test]
    fn socket_path_arg_missing_value_before_unknown_flag_is_absent() {
        let got = socket_path_arg_from(argv(&["notey", "--socket-path", "--unrelated"]));
        assert_eq!(got, None);
    }

    #[test]
    fn socket_path_arg_empty_value_is_absent() {
        assert_eq!(
            socket_path_arg_from(argv(&["notey", "--socket-path="])),
            None
        );
        assert_eq!(
            socket_path_arg_from(argv(&["notey", "--socket-path", ""])),
            None
        );
    }

    #[test]
    fn socket_path_arg_skips_empty_value_and_keeps_scanning() {
        let got = socket_path_arg_from(argv(&[
            "notey",
            "--socket-path=",
            "--socket-path",
            "/tmp/x.sock",
        ]));
        assert_eq!(got, Some(PathBuf::from("/tmp/x.sock")));
    }

    #[test]
    fn socket_path_arg_ignores_unknown_extra_args() {
        let got = socket_path_arg_from(argv(&[
            "notey",
            "--unrelated",
            "value",
            "--socket-path",
            "/tmp/x.sock",
            "--another",
        ]));
        assert_eq!(got, Some(PathBuf::from("/tmp/x.sock")));
    }

    #[test]
    fn socket_path_arg_absent() {
        let got = socket_path_arg_from(argv(&["notey", "--unrelated", "value"]));
        assert_eq!(got, None);
    }

    #[test]
    fn socket_path_arg_first_occurrence_wins() {
        // Defensive: a duplicated flag resolves to the first value, not the last.
        let got = socket_path_arg_from(argv(&[
            "notey",
            "--socket-path",
            "/tmp/first.sock",
            "--socket-path",
            "/tmp/second.sock",
        ]));
        assert_eq!(got, Some(PathBuf::from("/tmp/first.sock")));
    }
}
