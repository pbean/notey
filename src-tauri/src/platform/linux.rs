//! Linux [`Platform`] implementation (X11 + Wayland). Paths + hotkey backend
//! selection are implemented (Stories 8.5/8.6); `autostart_*` is deferred (DW-97).

use std::path::PathBuf;

use crate::errors::NoteyError;
use crate::platform::{HotkeyBackend, Platform};

/// Linux platform behavior. Hotkey backend selection uses the standard plugin
/// when X11/XWayland is available and reports pure Wayland as unavailable until
/// native portal support lands in DW-96.
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
        // $XDG_DATA_HOME/notey (or ~/.local/share/notey), per-user (Story 8.5).
        super::resolve_data_dir("notey")
    }

    fn config_dir(&self) -> Result<PathBuf, NoteyError> {
        // $XDG_CONFIG_HOME/notey (or ~/.config/notey), per-user (Story 8.6).
        super::resolve_config_dir("notey")
    }

    fn log_dir(&self) -> Result<PathBuf, NoteyError> {
        // $XDG_STATE_HOME/notey/logs (or ~/.local/state/notey/logs), per-user (8.6).
        dirs::state_dir()
            .map(|base| base.join("notey").join("logs"))
            .ok_or_else(|| {
                NoteyError::Config("Could not determine platform state directory".to_string())
            })
    }

    fn socket_path(&self) -> PathBuf {
        // $XDG_RUNTIME_DIR/notey.sock (per-user; bound 0600 by socket_server). 8.5.
        super::resolve_unix_socket()
    }

    fn register_hotkey(&self, _accelerator: &str) -> Result<HotkeyBackend, NoteyError> {
        // Story 8.6 / FR57: select the hotkey backend for this Linux session. The
        // actual Tauri plugin registration stays in `lib.rs` (it needs the
        // AppHandle); this only validates which backend can serve the shortcut.
        //
        // v1 contract: XWayland is the baseline fallback. The standard
        // (X11-based) backend works on X11 natively and on Wayland whenever
        // XWayland is present (`DISPLAY` set). A pure-Wayland session with no
        // XWayland cannot use the X11 path; native portal support is a fast-follow
        // (DW-96), so report the shortcut as unavailable and let the caller notify
        // the user (FR57) rather than returning `HotkeyBackend::WaylandPortal`.
        let wayland_display = std::env::var_os("WAYLAND_DISPLAY")
            .map(|value| !value.is_empty())
            .unwrap_or(false);
        let wayland = wayland_display
            || std::env::var("XDG_SESSION_TYPE")
                .map(|t| t == "wayland")
                .unwrap_or(false);
        let xwayland = std::env::var_os("DISPLAY")
            .map(|value| !value.is_empty())
            .unwrap_or(false);
        if wayland && !xwayland {
            return Err(NoteyError::Config(
                "global shortcut unavailable: Wayland compositor without XWayland \
                 (native portal support is a fast-follow — DW-96)"
                    .to_string(),
            ));
        }
        Ok(HotkeyBackend::Standard)
    }

    fn autostart_enable(&self) -> Result<(), NoteyError> {
        // Deferred (DW-97): auto-start is owned by tauri-plugin-autostart via the
        // Tauri AppHandle (Story 8.4: commands::autostart + lib.rs). The `&self`
        // trait signature cannot reach the handle, so routing it through the trait
        // is a no-gain refactor tracked in DW-97. Not called today.
        todo!("DW-97: route autostart through the Platform trait")
    }

    fn autostart_disable(&self) -> Result<(), NoteyError> {
        todo!("DW-97: route autostart through the Platform trait")
    }

    fn autostart_is_enabled(&self) -> Result<bool, NoteyError> {
        todo!("DW-97: route autostart through the Platform trait")
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
