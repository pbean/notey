//! ATDD red-phase acceptance tests — Stories 8.6 (Cross-Platform Verification &
//! Wayland Fallback), 8.5 (Per-User Data Isolation), and 8.2 (macOS Accessibility
//! Permission Guidance), exercised through the [`tauri_app_lib::platform`]
//! abstraction.
//!
//! Tests are `#[ignore = "red-phase: Story 8.x"]` against the unimplemented
//! per-OS scaffolds. Assertions are `#[cfg(target_os = ...)]`-gated so each only
//! compiles/runs on the platform it describes (the CI matrix covers all five
//! targets). True cross-user isolation and real Wayland behavior are verified by
//! platform QA; these pin the automatable contract.
//!
//!   cargo test --test platform_tests <name> -- --ignored

use tauri_app_lib::platform;

/// AC 8.6: `current()` resolves to the implementation for the target OS.
#[test]
#[ignore = "red-phase: Story 8.6"]
fn current_resolves_to_target_platform() {
    let expected = if cfg!(target_os = "linux") {
        "linux"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "windows"
    };
    assert_eq!(platform::current().name(), expected);
}

/// AC 8.5/8.6/FR58: the data directory is a per-user, platform-standard path.
#[test]
#[ignore = "red-phase: Story 8.5"]
fn data_dir_is_user_scoped_and_standard() {
    let dir = platform::current()
        .data_dir()
        .expect("data_dir must resolve");
    let s = dir.to_string_lossy();
    assert!(s.contains("notey"), "data dir must be namespaced to notey: {s}");

    #[cfg(unix)]
    {
        let home = std::env::var("HOME").unwrap_or_default();
        assert!(
            !home.is_empty() && s.starts_with(&home),
            "data dir must live under the current user's HOME ({home}): {s}"
        );
    }
}

/// AC 8.5/FR51: the IPC socket path is user-scoped (no system-wide shared path).
#[cfg(unix)]
#[test]
#[ignore = "red-phase: Story 8.5"]
fn socket_path_is_user_scoped() {
    let path = platform::current().socket_path();
    let s = path.to_string_lossy();
    assert!(s.contains("notey"), "socket path must be namespaced to notey: {s}");
    let runtime = std::env::var("XDG_RUNTIME_DIR").unwrap_or_default();
    if !runtime.is_empty() {
        assert!(
            s.starts_with(&runtime),
            "socket must live under the per-user runtime dir ({runtime}): {s}"
        );
    }
}

/// AC 8.6/FR56: on a standard X11 Linux session the global hotkey is served by the
/// standard plugin backend.
#[cfg(target_os = "linux")]
#[test]
#[ignore = "red-phase: Story 8.6"]
fn linux_hotkey_uses_standard_backend_on_x11() {
    let backend = platform::current()
        .register_hotkey("Ctrl+Shift+N")
        .expect("hotkey registration must succeed on X11");
    assert_eq!(backend, platform::HotkeyBackend::Standard);
}

/// AC 8.6/FR57: when the standard plugin fails under Wayland, registration falls
/// back to the XDG GlobalShortcuts portal.
///
/// NOTE: requires a Wayland session/harness to exercise the fallback path; until
/// then this documents the expected backend selection.
#[cfg(target_os = "linux")]
#[test]
#[ignore = "red-phase: Story 8.6 (needs Wayland harness)"]
fn linux_hotkey_falls_back_to_wayland_portal() {
    let backend = platform::current()
        .register_hotkey("Ctrl+Shift+N")
        .expect("portal fallback must succeed under Wayland");
    assert_eq!(backend, platform::HotkeyBackend::WaylandPortal);
}

/// AC 8.2/FR54: on macOS the accessibility permission is queried during onboarding.
#[cfg(target_os = "macos")]
#[test]
#[ignore = "red-phase: Story 8.2"]
fn macos_reports_accessibility_permission() {
    // Must not panic and must return a definite grant state.
    let _granted = platform::current()
        .accessibility_permission_granted()
        .expect("accessibility check must resolve on macOS");
}

/// AC 8.2: opening the accessibility settings pane is available on macOS.
#[cfg(target_os = "macos")]
#[test]
#[ignore = "red-phase: Story 8.2"]
fn macos_can_open_accessibility_settings() {
    platform::current()
        .open_accessibility_settings()
        .expect("must be able to open the accessibility settings pane");
}

/// AC 8.2: "the app is NOT running on macOS … the accessibility permission step is
/// skipped entirely" — non-macOS platforms always report the permission as granted.
#[cfg(not(target_os = "macos"))]
#[test]
#[ignore = "red-phase: Story 8.2"]
fn non_macos_skips_accessibility_gate() {
    assert!(
        platform::current()
            .accessibility_permission_granted()
            .expect("non-macOS accessibility check must resolve"),
        "non-macOS platforms have no accessibility gate"
    );
}
