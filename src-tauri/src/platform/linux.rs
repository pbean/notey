//! Linux [`Platform`] implementation (X11 + Wayland). RED-PHASE STUB (Story 8.6).

use std::path::PathBuf;

use crate::errors::NoteyError;
use crate::platform::{HotkeyBackend, Platform};

/// Linux platform behavior. Hotkey registration prefers the standard plugin and
/// falls back to the XDG GlobalShortcuts portal under Wayland (FR57).
#[derive(Debug, Default)]
pub struct LinuxPlatform;

impl LinuxPlatform {
    pub fn new() -> Self {
        Self
    }
}

impl Platform for LinuxPlatform {
    fn name(&self) -> &'static str {
        "linux"
    }

    fn data_dir(&self) -> Result<PathBuf, NoteyError> {
        todo!("Story 8.5: $XDG_DATA_HOME/notey (per-user)")
    }

    fn config_dir(&self) -> Result<PathBuf, NoteyError> {
        todo!("Story 8.6: $XDG_CONFIG_HOME/notey")
    }

    fn log_dir(&self) -> Result<PathBuf, NoteyError> {
        todo!("Story 8.6: $XDG_STATE_HOME/notey/logs")
    }

    fn socket_path(&self) -> PathBuf {
        todo!("Story 8.5: $XDG_RUNTIME_DIR/notey.sock (per-user, 0600)")
    }

    fn register_hotkey(&self, accelerator: &str) -> Result<HotkeyBackend, NoteyError> {
        todo!("Story 8.6: standard plugin, Wayland portal fallback for {accelerator}")
    }

    fn autostart_enable(&self) -> Result<(), NoteyError> {
        todo!("Story 8.4: write XDG autostart .desktop entry")
    }

    fn autostart_disable(&self) -> Result<(), NoteyError> {
        todo!("Story 8.4: remove XDG autostart .desktop entry")
    }

    fn autostart_is_enabled(&self) -> Result<bool, NoteyError> {
        todo!("Story 8.4: check for the XDG autostart .desktop entry")
    }

    fn accessibility_permission_granted(&self) -> Result<bool, NoteyError> {
        // No OS-level accessibility gate on Linux (Story 8.2 is macOS-only).
        Ok(true)
    }

    fn open_accessibility_settings(&self) -> Result<(), NoteyError> {
        // No-op on Linux.
        Ok(())
    }
}
