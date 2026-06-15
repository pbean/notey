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
//! - Route `crate::ipc::socket_server::socket_path` and the DB/config dir helpers
//!   through this trait so per-user isolation (Story 8.5) has a single source of
//!   truth.

use std::path::PathBuf;

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
