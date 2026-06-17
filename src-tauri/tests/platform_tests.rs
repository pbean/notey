//! ATDD red-phase acceptance tests — Stories 8.6 (Cross-Platform Verification &
//! Wayland Fallback), 8.5 (Per-User Data Isolation), and 8.2 (macOS Accessibility
//! Permission Guidance), exercised through the [`tauri_app_lib::platform`]
//! abstraction.
//!
//! Assertions are `#[cfg(target_os = ...)]`-gated so each only compiles/runs on
//! the platform it describes (the CI matrix covers all five targets). True
//! cross-user isolation and real Wayland portal behavior are verified by
//! platform QA; these pin the automatable contract.
//!
//!   cargo test --test platform_tests <name> -- --ignored

use tauri_app_lib::platform;

/// Serializes the two tests that read/mutate the process-global `NOTEY_DATA_DIR`
/// env var, so the override test cannot leak into the standard-path test when the
/// harness runs them on parallel threads.
static DATA_DIR_ENV_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

/// Serializes tests that read/mutate process-global display env vars.
#[cfg(target_os = "linux")]
static HOTKEY_ENV_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

/// Restores a process env var to its prior value, including non-Unicode values.
struct EnvVarGuard {
    key: &'static str,
    prior: Option<std::ffi::OsString>,
}

impl EnvVarGuard {
    fn set(key: &'static str, value: &str) -> Self {
        let prior = std::env::var_os(key);
        std::env::set_var(key, value);
        Self { key, prior }
    }

    fn unset(key: &'static str) -> Self {
        let prior = std::env::var_os(key);
        std::env::remove_var(key);
        Self { key, prior }
    }
}

impl Drop for EnvVarGuard {
    fn drop(&mut self) {
        match &self.prior {
            Some(value) => std::env::set_var(self.key, value),
            None => std::env::remove_var(self.key),
        }
    }
}

/// AC 8.6: `current()` resolves to the implementation for the target OS.
#[test]
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
fn data_dir_is_user_scoped_and_standard() {
    let _guard = DATA_DIR_ENV_LOCK.lock().unwrap_or_else(|p| p.into_inner());
    let _env = EnvVarGuard::unset("NOTEY_DATA_DIR");

    let dir = platform::current()
        .data_dir()
        .expect("data_dir must resolve");
    let namespace = if cfg!(target_os = "macos") {
        "com.notey.app"
    } else {
        "notey"
    };
    let expected = dirs::data_dir()
        .expect("platform data dir must resolve")
        .join(namespace);
    assert_eq!(
        dir, expected,
        "data dir must be the platform data dir plus the Notey namespace"
    );

    // macOS namespaces under the bundle identifier, mirroring config_dir.
    #[cfg(target_os = "macos")]
    assert!(
        dir.to_string_lossy().contains("com.notey.app"),
        "macOS data dir must use the bundle id namespace: {}",
        dir.display()
    );
}

/// AC 8.5: the `NOTEY_DATA_DIR` override seam (hermetic-test seam, mirroring
/// `NOTEY_SOCKET_PATH`) takes precedence over the platform-standard path.
#[test]
fn data_dir_honors_override_seam() {
    let _guard = DATA_DIR_ENV_LOCK.lock().unwrap_or_else(|p| p.into_inner());
    let _env = EnvVarGuard::set("NOTEY_DATA_DIR", "/tmp/notey-data-override");

    let resolved = platform::current()
        .data_dir()
        .expect("override data_dir must resolve");
    assert_eq!(
        resolved,
        std::path::PathBuf::from("/tmp/notey-data-override")
    );
}

/// AC 8.6/FR58: the config directory is a per-user, platform-standard path using
/// the same namespace convention as `services::config`.
#[test]
fn config_dir_is_user_scoped_and_standard() {
    let dir = platform::current()
        .config_dir()
        .expect("config_dir must resolve");
    let namespace = if cfg!(target_os = "macos") {
        "com.notey.app"
    } else {
        "notey"
    };
    let expected = dirs::config_dir()
        .expect("platform config dir must resolve")
        .join(namespace);
    assert_eq!(
        dir, expected,
        "config dir must be the platform config dir plus the Notey namespace"
    );
}

/// AC 8.6/FR58: config-path resolution has a single source of truth — the live
/// `services::config::config_dir` returns the same path as the trait method.
#[test]
fn config_dir_matches_services_config() {
    let via_service =
        tauri_app_lib::services::config::config_dir().expect("services config_dir must resolve");
    let via_trait = platform::current()
        .config_dir()
        .expect("platform config_dir must resolve");
    assert_eq!(
        via_service, via_trait,
        "services::config::config_dir must delegate to the Platform trait"
    );
}

/// AC 8.6/FR58: the log directory is a per-user, platform-standard path.
#[test]
fn log_dir_is_user_scoped_and_standard() {
    let dir = platform::current().log_dir().expect("log_dir must resolve");
    #[cfg(target_os = "linux")]
    let expected = dirs::state_dir()
        .expect("platform state dir must resolve")
        .join("notey")
        .join("logs");
    #[cfg(target_os = "macos")]
    let expected = dirs::home_dir()
        .expect("home dir must resolve")
        .join("Library")
        .join("Logs")
        .join("com.notey.app");
    #[cfg(target_os = "windows")]
    let expected = dirs::data_local_dir()
        .expect("local data dir must resolve")
        .join("notey")
        .join("logs");
    assert_eq!(
        dir, expected,
        "log dir must be the platform-standard log path"
    );
}

/// AC 8.6/FR56: macOS and Windows expose a single standard global-shortcut
/// backend (no Wayland branch).
#[cfg(not(target_os = "linux"))]
#[test]
fn hotkey_uses_standard_backend() {
    let backend = platform::current()
        .register_hotkey("Ctrl+Shift+N")
        .expect("hotkey backend must resolve");
    assert_eq!(backend, platform::HotkeyBackend::Standard);
}

/// AC 8.5/FR51: the IPC socket path is user-scoped (no system-wide shared path).
#[cfg(unix)]
#[test]
fn socket_path_is_user_scoped() {
    let path = platform::current().socket_path();
    let s = path.to_string_lossy();
    assert!(
        s.contains("notey"),
        "socket path must be namespaced to notey: {s}"
    );
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
fn linux_hotkey_uses_standard_backend_on_x11() {
    let _guard = HOTKEY_ENV_LOCK.lock().unwrap_or_else(|p| p.into_inner());
    let _display = EnvVarGuard::set("DISPLAY", ":99");
    let _wayland_display = EnvVarGuard::unset("WAYLAND_DISPLAY");
    let _session_type = EnvVarGuard::set("XDG_SESSION_TYPE", "x11");

    let backend = platform::current()
        .register_hotkey("Ctrl+Shift+N")
        .expect("hotkey registration must succeed on X11");
    assert_eq!(backend, platform::HotkeyBackend::Standard);
}

/// AC 8.6/FR57: pure Wayland without XWayland degrades gracefully instead of
/// pretending the standard X11 backend is available.
#[cfg(target_os = "linux")]
#[test]
fn linux_hotkey_errors_on_pure_wayland_without_xwayland() {
    let _guard = HOTKEY_ENV_LOCK.lock().unwrap_or_else(|p| p.into_inner());
    let _display = EnvVarGuard::set("DISPLAY", "");
    let _wayland_display = EnvVarGuard::set("WAYLAND_DISPLAY", "wayland-0");
    let _session_type = EnvVarGuard::set("XDG_SESSION_TYPE", "wayland");

    let error = platform::current()
        .register_hotkey("Ctrl+Shift+N")
        .expect_err("pure Wayland without XWayland must report no standard backend");
    assert!(
        error
            .to_string()
            .contains("Wayland compositor without XWayland"),
        "unexpected pure-Wayland error: {error}"
    );
}

/// AC 8.6/FR57: when the standard plugin fails under Wayland, registration falls
/// back to the XDG GlobalShortcuts portal.
///
/// NOTE: native portal support is deferred to DW-96; this test remains ignored
/// until the ashpd-backed implementation and a Wayland harness exist.
#[cfg(target_os = "linux")]
#[test]
#[ignore = "DW-96: native Wayland portal support needs a Wayland harness"]
fn linux_hotkey_falls_back_to_wayland_portal() {
    let backend = platform::current()
        .register_hotkey("Ctrl+Shift+N")
        .expect("portal fallback must succeed under Wayland");
    assert_eq!(backend, platform::HotkeyBackend::WaylandPortal);
}

/// AC 8.2/FR54: on macOS the accessibility permission is queried during onboarding.
#[cfg(target_os = "macos")]
#[test]
fn macos_reports_accessibility_permission() {
    // Must not panic and must return a definite grant state.
    let _granted = platform::current()
        .accessibility_permission_granted()
        .expect("accessibility check must resolve on macOS");
}

/// AC 8.2: opening the accessibility settings pane is available on macOS.
#[cfg(target_os = "macos")]
#[test]
fn macos_can_open_accessibility_settings() {
    platform::current()
        .open_accessibility_settings()
        .expect("must be able to open the accessibility settings pane");
}

/// AC 8.2: "the app is NOT running on macOS … the accessibility permission step is
/// skipped entirely" — non-macOS platforms always report the permission as granted.
#[cfg(not(target_os = "macos"))]
#[test]
fn non_macos_skips_accessibility_gate() {
    assert!(
        platform::current()
            .accessibility_permission_granted()
            .expect("non-macOS accessibility check must resolve"),
        "non-macOS platforms have no accessibility gate"
    );
}
