//! Thin Tauri command handlers for the macOS accessibility-permission flow
//! (Story 8.2 / FR54). All OS-divergent logic lives behind the [`crate::platform`]
//! abstraction; these handlers only resolve the active platform and delegate.
//! Synchronous (an FFI query / a process spawn) per the project's command
//! convention. On non-macOS platforms the underlying impls report the permission
//! as granted and the settings call is a no-op, so onboarding skips the step.

use crate::errors::NoteyError;
use crate::platform;

/// Whether the OS has granted the accessibility permission the global hotkey
/// depends on. Always `Ok(true)` off macOS (no such gate).
#[tauri::command]
#[specta::specta]
pub fn check_accessibility_permission() -> Result<bool, NoteyError> {
    platform::current().accessibility_permission_granted()
}

/// Open the OS settings pane where the user grants accessibility permission.
/// No-op off macOS.
#[tauri::command]
#[specta::specta]
pub fn open_accessibility_settings() -> Result<(), NoteyError> {
    platform::current().open_accessibility_settings()
}
