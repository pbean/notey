//! macOS [`Platform`] implementation. Accessibility-permission methods (Story 8.2)
//! and paths/hotkey-backend selection (Stories 8.5/8.6) are implemented;
//! `autostart_*` is deferred (DW-97 — owned by tauri-plugin-autostart).

use std::{io, path::PathBuf};

use crate::errors::NoteyError;
use crate::platform::{HotkeyBackend, Platform};

/// macOS platform behavior. Uses `LaunchAgent` for auto-start and gates the
/// global hotkey behind the Accessibility permission (Story 8.2 / FR54).
#[derive(Debug, Default)]
pub struct MacosPlatform;

impl MacosPlatform {
    pub fn new() -> Self {
        Self
    }
}

impl Platform for MacosPlatform {
    fn name(&self) -> &'static str {
        "macos"
    }

    fn data_dir(&self) -> Result<PathBuf, NoteyError> {
        // ~/Library/Application Support/com.notey.app, per-user (Story 8.5).
        super::resolve_data_dir("com.notey.app")
    }

    fn config_dir(&self) -> Result<PathBuf, NoteyError> {
        // ~/Library/Application Support/com.notey.app, per-user (Story 8.6).
        super::resolve_config_dir("com.notey.app")
    }

    fn log_dir(&self) -> Result<PathBuf, NoteyError> {
        // ~/Library/Logs/com.notey.app, per-user (Story 8.6). `dirs` has no
        // dedicated logs dir on macOS, so derive it from the home directory.
        dirs::home_dir()
            .map(|home| home.join("Library").join("Logs").join("com.notey.app"))
            .ok_or_else(|| {
                NoteyError::Config("Could not determine home directory for logs".to_string())
            })
    }

    fn socket_path(&self) -> PathBuf {
        // $XDG_RUNTIME_DIR/notey.sock or user-scoped temp fallback; bound 0600
        // by socket_server (Story 8.5).
        super::resolve_unix_socket()
    }

    fn register_hotkey(&self, _accelerator: &str) -> Result<HotkeyBackend, NoteyError> {
        // Story 8.6: macOS has a single global-shortcut backend (the standard
        // plugin). The actual registration happens in `lib.rs`; this only reports
        // the backend. (The Accessibility-permission gate is handled separately
        // via `accessibility_permission_granted`, Story 8.2.)
        Ok(HotkeyBackend::Standard)
    }

    fn autostart_enable(&self) -> Result<(), NoteyError> {
        // Deferred (DW-97): auto-start is owned by tauri-plugin-autostart
        // (MacosLauncher::LaunchAgent) via the Tauri AppHandle (Story 8.4). The
        // `&self` trait signature cannot reach the handle. Not called today.
        todo!("DW-97: route autostart through the Platform trait")
    }

    fn autostart_disable(&self) -> Result<(), NoteyError> {
        todo!("DW-97: route autostart through the Platform trait")
    }

    fn autostart_is_enabled(&self) -> Result<bool, NoteyError> {
        todo!("DW-97: route autostart through the Platform trait")
    }

    fn accessibility_permission_granted(&self) -> Result<bool, NoteyError> {
        // `AXIsProcessTrusted` reports whether the app is allowed to use the
        // Accessibility APIs the global hotkey depends on (Story 8.2 / FR54). It
        // returns CoreFoundation's `Boolean` (an `unsigned char`), so bind it as
        // `u8` and compare — a Rust `bool` would be UB for any byte other than
        // 0/1. The call is side-effect-free and never blocks.
        #[link(name = "ApplicationServices", kind = "framework")]
        extern "C" {
            fn AXIsProcessTrusted() -> u8;
        }
        Ok(unsafe { AXIsProcessTrusted() } != 0)
    }

    fn open_accessibility_settings(&self) -> Result<(), NoteyError> {
        // Deep-link straight to System Settings > Privacy & Security >
        // Accessibility. `open` hands the URL to LaunchServices and exits
        // quickly; wait for that short-lived helper so failures are reported and
        // the child process is reaped.
        let status = std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
            .status()
            .map_err(NoteyError::Io)?;

        if status.success() {
            Ok(())
        } else {
            Err(NoteyError::Io(io::Error::other(format!(
                "open accessibility settings exited with {status}"
            ))))
        }
    }
}
