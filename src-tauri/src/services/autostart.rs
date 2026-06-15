//! Auto-start-on-login service: enable/disable the platform launch agent and
//! persist the user's preference.
//!
//! **RED-PHASE STUB (Epic 8 — Story 8.4).** Unimplemented scaffold. Acceptance
//! tests live in `tests/autostart_tests.rs`, marked `#[ignore = "red-phase:
//! Story 8.4"]`.
//!
//! ## Green-phase wiring (do this when implementing)
//! - Add `tauri-plugin-autostart` (verify the current 2.x version on crates.io —
//!   do not pin from memory) initialized with `MacosLauncher::LaunchAgent`.
//! - Delegate `enable`/`disable`/`is_enabled` to the plugin via the [`Platform`]
//!   abstraction (see [`crate::platform`]).
//! - Persist the preference as `[autostart] enabled = <bool>`. NOTE: AC 8.4 names
//!   the key `[general] auto_start`; this scaffold keeps a dedicated section to
//!   avoid a ~50-site TypeScript ripple from changing `GeneralConfig` during the
//!   red phase. Reconcile the section name at green phase.
//! - Add the capability ACL entries `autostart:allow-enable`,
//!   `autostart:allow-disable`, `autostart:allow-is-enabled`.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::errors::NoteyError;

/// Persisted auto-start preference (`autostart.toml`).
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AutostartState {
    #[serde(default)]
    pub enabled: bool,
}

/// Full path to `autostart.toml` within the given config directory.
pub fn state_file_path(config_dir: &Path) -> PathBuf {
    config_dir.join("autostart.toml")
}

/// Load the persisted preference, defaulting to disabled when missing.
pub fn load(config_dir: &Path) -> Result<AutostartState, NoteyError> {
    todo!("Story 8.4: read autostart.toml under {config_dir:?}, default to disabled")
}

/// Enable auto-start: register the platform launch agent AND persist
/// `enabled = true`. Idempotent.
pub fn enable(config_dir: &Path) -> Result<(), NoteyError> {
    todo!("Story 8.4: register platform autostart + persist enabled=true under {config_dir:?}")
}

/// Disable auto-start: remove the platform launch agent AND persist
/// `enabled = false`. Idempotent.
pub fn disable(config_dir: &Path) -> Result<(), NoteyError> {
    todo!("Story 8.4: remove platform autostart + persist enabled=false under {config_dir:?}")
}

/// Whether auto-start is currently enabled at the platform level.
pub fn is_enabled() -> Result<bool, NoteyError> {
    todo!("Story 8.4: query the platform autostart mechanism")
}
