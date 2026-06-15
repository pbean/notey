//! First-run onboarding state: persistence of the "onboarding complete" flag and
//! the early-session counter that drives progressive command-palette hints.
//!
//! **RED-PHASE STUB (Epic 8 — Stories 8.1 & 8.3).** Every function below is an
//! unimplemented scaffold (`todo!`). The acceptance tests in
//! `tests/onboarding_tests.rs` are written against this contract but marked
//! `#[ignore = "red-phase: Story 8.x"]` so the suite stays green until a developer
//! implements a function and activates its tests (TDD red → green).
//!
//! ## Green-phase wiring (do this when implementing)
//! - Persist `OnboardingState` to `onboarding.toml` in the platform config dir
//!   (sibling to `config.toml`; see [`crate::services::config::config_dir`]).
//! - Expose `get_onboarding_state` / `complete_onboarding` Tauri commands, register
//!   them in `lib.rs::specta_builder`, add their permission TOMLs + capabilities,
//!   and extend `EXPECTED_COMMANDS` in `tests/acl_tests.rs`.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::errors::NoteyError;

/// Number of early sessions during which the "Ctrl+P for commands" status-bar hint
/// is shown before it disappears permanently (Story 8.1 progressive disclosure).
pub const COMMAND_HINT_SESSION_LIMIT: u32 = 5;

/// Persisted first-run onboarding state.
///
/// Serialized to `onboarding.toml`. `complete` gates the one-time onboarding
/// overlay; `sessions_seen` counts app launches so the early command hint can
/// retire itself after [`COMMAND_HINT_SESSION_LIMIT`] sessions.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingState {
    /// `true` once the user has dismissed the onboarding overlay (by pressing the
    /// hotkey or Esc). The overlay is never shown again once this is set.
    #[serde(default)]
    pub complete: bool,
    /// How many sessions the user has started. Drives the progressive
    /// command-palette hint in the status bar.
    #[serde(default)]
    pub sessions_seen: u32,
}

/// Full path to `onboarding.toml` within the given config directory.
pub fn state_file_path(config_dir: &Path) -> PathBuf {
    config_dir.join("onboarding.toml")
}

/// Load onboarding state from disk, returning the default (not-complete, zero
/// sessions) when the file is missing or unreadable.
pub fn load(config_dir: &Path) -> Result<OnboardingState, NoteyError> {
    todo!("Story 8.1: read onboarding.toml under {config_dir:?}, default on missing/corrupt")
}

/// Returns whether onboarding has been completed.
pub fn is_complete(config_dir: &Path) -> Result<bool, NoteyError> {
    todo!("Story 8.1: return load(config_dir)?.complete for {config_dir:?}")
}

/// Mark onboarding as complete and persist atomically. Idempotent.
pub fn mark_complete(config_dir: &Path) -> Result<(), NoteyError> {
    todo!("Story 8.1: set complete=true and atomically write onboarding.toml under {config_dir:?}")
}

/// Increment the session counter, persist, and return the new count.
pub fn increment_session(config_dir: &Path) -> Result<u32, NoteyError> {
    todo!("Story 8.1: load, bump sessions_seen, persist, return new count for {config_dir:?}")
}

/// Whether the early "Ctrl+P for commands" status-bar hint should still be shown
/// for the given state (i.e. within the first [`COMMAND_HINT_SESSION_LIMIT`]
/// sessions and onboarding done).
pub fn should_show_command_hint(state: &OnboardingState) -> bool {
    todo!(
        "Story 8.1: true when sessions_seen < COMMAND_HINT_SESSION_LIMIT (state: {state:?})"
    )
}
