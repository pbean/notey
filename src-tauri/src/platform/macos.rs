//! macOS [`Platform`] implementation. Accessibility-permission methods (Story 8.2)
//! are implemented; paths/hotkey/auto-start remain RED-PHASE stubs (Stories 8.4–8.6).

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
        // Story 8.6 (platform capstone): Story 8.4 ships auto-start via
        // tauri-plugin-autostart (MacosLauncher::LaunchAgent), not this trait.
        todo!("Story 8.6: route autostart through the Platform trait")
    }

    fn autostart_disable(&self) -> Result<(), NoteyError> {
        todo!("Story 8.6: route autostart through the Platform trait")
    }

    fn autostart_is_enabled(&self) -> Result<bool, NoteyError> {
        todo!("Story 8.6: route autostart through the Platform trait")
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
