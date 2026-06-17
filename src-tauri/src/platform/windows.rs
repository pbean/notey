//! Windows [`Platform`] implementation. RED-PHASE STUB (Story 8.6).

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
        todo!("Story 8.6: %APPDATA%\\notey")
    }

    fn log_dir(&self) -> Result<PathBuf, NoteyError> {
        todo!("Story 8.6: %LOCALAPPDATA%\\notey\\logs")
    }

    fn socket_path(&self) -> PathBuf {
        // User-scoped namespaced pipe `notey-<user>` (Story 8.5).
        super::resolve_windows_socket()
    }

    fn register_hotkey(&self, accelerator: &str) -> Result<HotkeyBackend, NoteyError> {
        todo!("Story 8.6: standard plugin registration for {accelerator}")
    }

    fn autostart_enable(&self) -> Result<(), NoteyError> {
        // Story 8.6 (platform capstone): Story 8.4 ships auto-start via
        // tauri-plugin-autostart (app.autolaunch()), not this trait method.
        todo!("Story 8.6: route autostart through the Platform trait")
    }

    fn autostart_disable(&self) -> Result<(), NoteyError> {
        todo!("Story 8.6: route autostart through the Platform trait")
    }

    fn autostart_is_enabled(&self) -> Result<bool, NoteyError> {
        todo!("Story 8.6: route autostart through the Platform trait")
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
