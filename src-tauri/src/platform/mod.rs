//! Cross-platform abstraction over OS-specific behavior: standard paths, global
//! hotkey registration (with a Wayland fallback on Linux), auto-start, and the
//! macOS accessibility-permission flow.
//!
//! **RED-PHASE STUB (Epic 8 — Stories 8.2, 8.5, 8.6).** The [`Platform`] trait
//! defines the contract; the per-OS implementations in [`linux`], [`macos`], and
//! [`windows`] are unimplemented scaffolds (`todo!`). Acceptance tests live in
//! `tests/platform_tests.rs`, marked `#[ignore = "red-phase: Story 8.x"]`.
//!
//! ## Green-phase wiring (do this when implementing)
//! - Implement each `#[cfg(target_os = ...)]` struct against the real OS APIs.
//! - Linux `register_hotkey`: try the standard Tauri global-shortcut plugin first;
//!   on failure under Wayland, attempt the XDG GlobalShortcuts portal (verify the
//!   current `ashpd` version on crates.io — do not pin from memory); if neither
//!   works, return [`NoteyError::Config`] so the caller can notify the user (FR57).
//!
//! **Story 8.5 (done):** `data_dir` and `socket_path` are implemented for all
//! three targets via the shared resolvers below; the DB location (`lib.rs`) and
//! `crate::ipc::socket_server::socket_path` route through this trait so per-user
//! isolation has a single source of truth. `config_dir`, `log_dir`,
//! `register_hotkey`, and the `autostart_*` methods remain Story 8.6 stubs (the
//! live config path still resolves via `services::config::config_dir`).

use std::path::{Path, PathBuf};

use crate::errors::NoteyError;

#[cfg(target_os = "linux")]
pub mod linux;
#[cfg(target_os = "macos")]
pub mod macos;
#[cfg(target_os = "windows")]
pub mod windows;

/// Which mechanism satisfied a global-hotkey registration request.
///
/// Distinguishing the path taken lets the UI explain a degraded experience on
/// compositors where only the portal works (Story 8.6 / FR57).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HotkeyBackend {
    /// The standard Tauri global-shortcut plugin (X11, macOS, Windows).
    Standard,
    /// The XDG desktop GlobalShortcuts portal (Wayland fallback).
    WaylandPortal,
}

/// OS-specific behavior behind a single object-safe contract. Obtain the active
/// implementation via [`current`].
pub trait Platform: Send + Sync {
    /// Short platform identifier (`"linux"`, `"macos"`, `"windows"`).
    fn name(&self) -> &'static str;

    /// Per-user data directory (notes DB lives here). Story 8.5 / FR58.
    fn data_dir(&self) -> Result<PathBuf, NoteyError>;

    /// Per-user config directory (`config.toml` lives here). FR58.
    fn config_dir(&self) -> Result<PathBuf, NoteyError>;

    /// Per-user log directory. FR58.
    fn log_dir(&self) -> Result<PathBuf, NoteyError>;

    /// Per-user, owner-only IPC socket path. Story 8.5 / FR51.
    fn socket_path(&self) -> PathBuf;

    /// Register the global capture hotkey, returning which backend served it.
    /// Linux attempts [`HotkeyBackend::WaylandPortal`] when the standard plugin
    /// fails under Wayland (FR57).
    fn register_hotkey(&self, accelerator: &str) -> Result<HotkeyBackend, NoteyError>;

    /// Enable auto-start on login. Story 8.4 / FR41–FR43.
    fn autostart_enable(&self) -> Result<(), NoteyError>;

    /// Disable auto-start on login.
    fn autostart_disable(&self) -> Result<(), NoteyError>;

    /// Whether auto-start on login is currently configured.
    fn autostart_is_enabled(&self) -> Result<bool, NoteyError>;

    /// Whether the OS has granted the accessibility permission required for the
    /// global hotkey. Non-macOS platforms return `Ok(true)` (no such gate).
    /// Story 8.2 / FR54.
    fn accessibility_permission_granted(&self) -> Result<bool, NoteyError>;

    /// Open the OS settings pane where the user can grant accessibility
    /// permission. No-op on non-macOS platforms. Story 8.2.
    fn open_accessibility_settings(&self) -> Result<(), NoteyError>;
}

/// The [`Platform`] implementation for the current target OS.
pub fn current() -> Box<dyn Platform> {
    #[cfg(target_os = "linux")]
    {
        Box::new(linux::LinuxPlatform::new())
    }
    #[cfg(target_os = "macos")]
    {
        Box::new(macos::MacosPlatform::new())
    }
    #[cfg(target_os = "windows")]
    {
        Box::new(windows::WindowsPlatform::new())
    }
}

// ── Shared path resolvers (Story 8.5 / FR51 / FR58) ──────────────────────────
//
// The per-OS `data_dir`/`socket_path` impls delegate here so resolution lives in
// exactly one place. `namespace` differs per OS (`notey` vs `com.notey.app`) to
// match `services::config::config_dir`'s existing convention.

/// Resolve the per-user data directory, namespaced for this OS.
///
/// Honors the `NOTEY_DATA_DIR` env override first (the hermetic-test seam,
/// mirroring `NOTEY_SOCKET_PATH`); otherwise `dirs::data_dir()` joined with
/// `namespace` (`$XDG_DATA_HOME` / `%APPDATA%` / `~/Library/Application Support`).
/// Pure resolver — the caller creates the directory. Returns
/// [`NoteyError::Config`] when no platform data directory can be determined.
pub(crate) fn resolve_data_dir(namespace: &str) -> Result<PathBuf, NoteyError> {
    if let Ok(custom) = std::env::var("NOTEY_DATA_DIR") {
        return Ok(PathBuf::from(custom));
    }
    dirs::data_dir()
        .map(|base| base.join(namespace))
        .ok_or_else(|| {
            NoteyError::Config("Could not determine platform data directory".to_string())
        })
}

/// Default per-user Unix socket path (no override seams — those live in
/// `socket_server::socket_path`). Prefers `$XDG_RUNTIME_DIR/notey.sock` (a dir
/// that is itself `0700`), falling back to a user-scoped temp-dir path.
#[cfg(unix)]
pub(crate) fn resolve_unix_socket() -> PathBuf {
    if let Some(dir) = dirs::runtime_dir() {
        return dir.join("notey.sock");
    }
    let file_name = user_scope_token()
        .map(|token| format!("notey-{token}.sock"))
        .unwrap_or_else(|| "notey.sock".to_string());
    std::env::temp_dir().join(file_name)
}

/// Default per-user Windows named-pipe name (no override seams).
#[cfg(windows)]
pub(crate) fn resolve_windows_socket() -> PathBuf {
    PathBuf::from(
        user_scope_token()
            .map(|token| format!("notey-{token}"))
            .unwrap_or_else(|| "notey".to_string()),
    )
}

/// Derive a stable, filesystem-safe per-user token for fallback socket naming.
#[cfg(any(unix, windows))]
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
