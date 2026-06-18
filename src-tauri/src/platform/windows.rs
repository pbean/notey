//! Windows [`Platform`] implementation. Paths + hotkey-backend selection
//! (Stories 8.5/8.6) and `autostart_*` (DW-97 — delegated to
//! `tauri-plugin-autostart`'s Run-key entry) are implemented.

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

    fn autostart_enable(&self, app: &tauri::AppHandle) -> Result<(), NoteyError> {
        // DW-97: delegate to the shared tauri-plugin-autostart helper (Story 8.4).
        super::autostart_enable(app)
    }

    fn autostart_disable(&self, app: &tauri::AppHandle) -> Result<(), NoteyError> {
        super::autostart_disable(app)
    }

    fn autostart_is_enabled(&self, app: &tauri::AppHandle) -> Result<bool, NoteyError> {
        super::autostart_is_enabled(app)
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
