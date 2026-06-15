//! ATDD red-phase acceptance tests — Story 8.4 (Auto-Start on Login),
//! preference-persistence + service-contract slice.
//!
//! Every test is `#[ignore = "red-phase: Story 8.4"]` against the unimplemented
//! [`tauri_app_lib::services::autostart`] scaffold. Platform-level launch-agent
//! behavior (does the OS actually start the app at login?) is verified by
//! manual/platform QA — these tests pin the persistence and idempotence contract.
//!
//!   cargo test --test autostart_tests <name> -- --ignored

use tempfile::TempDir;

use tauri_app_lib::services::autostart::{self, AutostartState};

/// AC: a fresh install has auto-start disabled.
#[test]
#[ignore = "red-phase: Story 8.4"]
fn load_defaults_to_disabled() {
    let tmp = TempDir::new().unwrap();
    let state = autostart::load(tmp.path()).expect("load must succeed on a fresh dir");
    assert_eq!(state, AutostartState { enabled: false });
}

/// AC: "the user enables auto-start … the setting is saved to config:
/// `auto_start = true`". (Scaffold persists `[autostart] enabled` — see module
/// docs; reconcile the section name at green phase.)
#[test]
#[ignore = "red-phase: Story 8.4"]
fn enable_persists_true() {
    let tmp = TempDir::new().unwrap();
    autostart::enable(tmp.path()).expect("enable must persist");
    assert!(
        autostart::load(tmp.path()).unwrap().enabled,
        "enabled preference must survive a reload"
    );
    assert!(autostart::state_file_path(tmp.path()).exists());
}

/// AC: "the user disables auto-start … the config is updated: `auto_start = false`".
#[test]
#[ignore = "red-phase: Story 8.4"]
fn disable_persists_false() {
    let tmp = TempDir::new().unwrap();
    autostart::enable(tmp.path()).unwrap();
    autostart::disable(tmp.path()).expect("disable must persist");
    assert!(!autostart::load(tmp.path()).unwrap().enabled);
}

/// Enabling twice is a no-op at the persistence layer (no duplicate launch agent).
#[test]
#[ignore = "red-phase: Story 8.4"]
fn enable_is_idempotent() {
    let tmp = TempDir::new().unwrap();
    autostart::enable(tmp.path()).unwrap();
    autostart::enable(tmp.path()).unwrap();
    assert!(autostart::load(tmp.path()).unwrap().enabled);
}

/// AC: the platform mechanism is the source of truth for the *active* state.
/// `is_enabled` reflects what the OS reports (here: disabled by default in a
/// clean test environment).
#[test]
#[ignore = "red-phase: Story 8.4"]
fn is_enabled_reports_platform_state() {
    assert!(
        !autostart::is_enabled().expect("is_enabled must query the platform"),
        "a clean test environment must report auto-start as not registered"
    );
}
