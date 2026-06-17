//! Windows [`Platform`] implementation. Paths + hotkey-backend selection are
//! implemented (Stories 8.5/8.6); `autostart_*` is deferred (DW-97 — owned by
//! tauri-plugin-autostart).

use std::path::PathBuf;

use crate::errors::NoteyError;
use crate::platform::{HotkeyBackend, Platform};

/// Windows platform behavior. Uses a Run-key/Startup-folder entry for auto-start.
#[derive(Debug, Default)]
pub struct WindowsPlatform;

impl WindowsPlatform {
    pub fn new() -> Self {
        Self
    }
}

impl Platform for WindowsPlatform {
    fn name(&self) -> &'static str {
        "windows"
    }

    fn data_dir(&self) -> Result<PathBuf, NoteyError> {
        // %APPDATA%\notey, per-user (Story 8.5).
        super::resolve_data_dir("notey")
    }

    fn config_dir(&self) -> Result<PathBuf, NoteyError> {
        // %APPDATA%\notey, per-user (Story 8.6).
        super::resolve_config_dir("notey")
    }

    fn log_dir(&self) -> Result<PathBuf, NoteyError> {
        // %LOCALAPPDATA%\notey\logs, per-user (Story 8.6).
        dirs::data_local_dir()
            .map(|base| base.join("notey").join("logs"))
            .ok_or_else(|| {
                NoteyError::Config("Could not determine local data directory for logs".to_string())
            })
    }

    fn socket_path(&self) -> PathBuf {
        // User-scoped namespaced pipe `notey-<user>` (Story 8.5).
        super::resolve_windows_socket()
    }

    fn register_hotkey(&self, _accelerator: &str) -> Result<HotkeyBackend, NoteyError> {
        // Story 8.6: Windows has a single global-shortcut backend (the standard
        // plugin). The actual registration happens in `lib.rs`; this only reports
        // the backend.
        Ok(HotkeyBackend::Standard)
    }

    fn autostart_enable(&self) -> Result<(), NoteyError> {
        // Deferred (DW-97): auto-start is owned by tauri-plugin-autostart via the
        // Tauri AppHandle (Story 8.4). The `&self` trait signature cannot reach
        // the handle. Not called today.
        todo!("DW-97: route autostart through the Platform trait")
    }

    fn autostart_disable(&self) -> Result<(), NoteyError> {
        todo!("DW-97: route autostart through the Platform trait")
    }

    fn autostart_is_enabled(&self) -> Result<bool, NoteyError> {
        todo!("DW-97: route autostart through the Platform trait")
    }

    fn accessibility_permission_granted(&self) -> Result<bool, NoteyError> {
        // No OS-level accessibility gate on Windows.
        Ok(true)
    }

    fn open_accessibility_settings(&self) -> Result<(), NoteyError> {
        // No-op on Windows.
        Ok(())
    }
}
