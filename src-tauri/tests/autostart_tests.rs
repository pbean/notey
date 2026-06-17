//! Acceptance tests — Story 8.4 (Auto-Start on Login), preference-persistence
//! slice.
//!
//! The user's auto-start preference is the single source of truth at `config.toml`
//! `[general] auto_start` (serde key `autoStart`). These tests pin the persistence
//! and idempotence contract through the config service, hermetically against a
//! `TempDir`. Platform-level launch-agent behavior (does the OS actually start the
//! app at login?) is owned by `tauri-plugin-autostart` and verified by
//! manual/platform QA — it is not exercised here.
//!
//!   cargo test --test autostart_tests

use tempfile::TempDir;

use tauri_app_lib::models::config::AppConfig;
use tauri_app_lib::services::config;

/// Persist a preference exactly as the `set_autostart` command does: set the field
/// on the loaded config and save through the config service.
fn persist(config_dir: &std::path::Path, enabled: bool) {
    let mut cfg = config::load_or_create(config_dir).expect("load config");
    cfg.general.auto_start = enabled;
    config::save(config_dir, &cfg).expect("save config");
}

fn load_enabled(config_dir: &std::path::Path) -> bool {
    config::load_or_create(config_dir)
        .expect("load config")
        .general
        .auto_start
}

/// AC: a fresh install has auto-start disabled.
#[test]
fn fresh_install_defaults_to_disabled() {
    let tmp = TempDir::new().unwrap();
    assert!(!load_enabled(tmp.path()));
    assert!(!AppConfig::default().general.auto_start);
}

/// AC: enabling auto-start saves `[general] auto_start = true` to config.toml.
#[test]
fn enable_persists_true() {
    let tmp = TempDir::new().unwrap();
    persist(tmp.path(), true);
    assert!(load_enabled(tmp.path()), "preference must survive a reload");
    assert!(tmp.path().join("config.toml").exists());
}

/// AC: disabling auto-start updates the config to `auto_start = false`.
#[test]
fn disable_persists_false() {
    let tmp = TempDir::new().unwrap();
    persist(tmp.path(), true);
    persist(tmp.path(), false);
    assert!(!load_enabled(tmp.path()));
}

/// Enabling twice is a no-op at the persistence layer (no divergent state).
#[test]
fn enable_is_idempotent() {
    let tmp = TempDir::new().unwrap();
    persist(tmp.path(), true);
    persist(tmp.path(), true);
    assert!(load_enabled(tmp.path()));
}

/// A config file predating Story 8.4 (no `autoStart` key) loads as disabled.
#[test]
fn missing_key_loads_as_disabled() {
    let tmp = TempDir::new().unwrap();
    std::fs::write(
        tmp.path().join("config.toml"),
        "[general]\ntheme = \"dark\"\nlayoutMode = \"floating\"\n",
    )
    .unwrap();
    assert!(!load_enabled(tmp.path()));
}
