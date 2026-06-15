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
        todo!("Story 8.5: %APPDATA%\\notey (per-user)")
    }

    fn config_dir(&self) -> Result<PathBuf, NoteyError> {
        todo!("Story 8.6: %APPDATA%\\notey")
    }

    fn log_dir(&self) -> Result<PathBuf, NoteyError> {
        todo!("Story 8.6: %LOCALAPPDATA%\\notey\\logs")
    }

    fn socket_path(&self) -> PathBuf {
        todo!("Story 8.5: user-scoped named pipe")
    }

    fn register_hotkey(&self, accelerator: &str) -> Result<HotkeyBackend, NoteyError> {
        todo!("Story 8.6: standard plugin registration for {accelerator}")
    }

    fn autostart_enable(&self) -> Result<(), NoteyError> {
        todo!("Story 8.4: add HKCU Run-key entry")
    }

    fn autostart_disable(&self) -> Result<(), NoteyError> {
        todo!("Story 8.4: remove HKCU Run-key entry")
    }

    fn autostart_is_enabled(&self) -> Result<bool, NoteyError> {
        todo!("Story 8.4: check the HKCU Run-key entry")
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
