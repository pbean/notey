//! macOS [`Platform`] implementation. RED-PHASE STUB (Stories 8.2, 8.6).

use std::path::PathBuf;

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
        todo!("Story 8.5: ~/Library/Application Support/com.notey.app (per-user)")
    }

    fn config_dir(&self) -> Result<PathBuf, NoteyError> {
        todo!("Story 8.6: ~/Library/Application Support/com.notey.app")
    }

    fn log_dir(&self) -> Result<PathBuf, NoteyError> {
        todo!("Story 8.6: ~/Library/Logs/com.notey.app")
    }

    fn socket_path(&self) -> PathBuf {
        todo!("Story 8.5: user-scoped temp-dir socket (per-user, 0600)")
    }

    fn register_hotkey(&self, accelerator: &str) -> Result<HotkeyBackend, NoteyError> {
        todo!("Story 8.6: standard plugin registration for {accelerator}")
    }

    fn autostart_enable(&self) -> Result<(), NoteyError> {
        todo!("Story 8.4: install LaunchAgent plist")
    }

    fn autostart_disable(&self) -> Result<(), NoteyError> {
        todo!("Story 8.4: remove LaunchAgent plist")
    }

    fn autostart_is_enabled(&self) -> Result<bool, NoteyError> {
        todo!("Story 8.4: check for the LaunchAgent plist")
    }

    fn accessibility_permission_granted(&self) -> Result<bool, NoteyError> {
        todo!("Story 8.2: query AXIsProcessTrusted()")
    }

    fn open_accessibility_settings(&self) -> Result<(), NoteyError> {
        todo!(
            "Story 8.2: open x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
        )
    }
}
