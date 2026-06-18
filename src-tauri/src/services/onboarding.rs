//! First-run onboarding state: persistence of the "onboarding complete" flag and
//! the early-session counter that drives progressive command-palette hints.
//!
//! State is serialized to `onboarding.toml` in the platform config dir (sibling
//! to `config.toml`; see [`crate::services::config::config_dir`]) using the same
//! atomic temp-file + rename write the config service uses. A missing or corrupt
//! file resolves to the default state — onboarding never fails the app.
//!
//! The `get_onboarding_state` / `complete_onboarding` / `increment_onboarding_session`
//! Tauri commands (in `commands::onboarding`) expose this service to the frontend.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::errors::NoteyError;

/// Number of early sessions during which the "Ctrl+P for commands" status-bar hint
/// is shown before it disappears permanently (Story 8.1 progressive disclosure).
pub const COMMAND_HINT_SESSION_LIMIT: u32 = 5;

static ONBOARDING_WRITE_LOCK: Mutex<()> = Mutex::new(());

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

#[derive(Debug, Default, Serialize, Deserialize)]
struct PersistedOnboardingState {
    #[serde(default)]
    complete: bool,
    #[serde(default, alias = "sessionsSeen")]
    sessions_seen: u32,
}

impl From<PersistedOnboardingState> for OnboardingState {
    fn from(state: PersistedOnboardingState) -> Self {
        Self {
            complete: state.complete,
            sessions_seen: state.sessions_seen,
        }
    }
}

impl From<&OnboardingState> for PersistedOnboardingState {
    fn from(state: &OnboardingState) -> Self {
        Self {
            complete: state.complete,
            sessions_seen: state.sessions_seen,
        }
    }
}

/// Full path to `onboarding.toml` within the given config directory.
pub fn state_file_path(config_dir: &Path) -> PathBuf {
    config_dir.join("onboarding.toml")
}

/// Load onboarding state from disk, returning the default (not-complete, zero
/// sessions) when the file is missing or corrupt — onboarding state must never
/// fail the app.
pub fn load(config_dir: &Path) -> Result<OnboardingState, NoteyError> {
    let path = state_file_path(config_dir);
    if !path.exists() {
        return Ok(OnboardingState::default());
    }
    match fs::read_to_string(&path) {
        Ok(contents) => Ok(
            toml::from_str::<PersistedOnboardingState>(&contents).map_or_else(
                |e| {
                    eprintln!(
                        "Warning: onboarding.toml is corrupt ({e}), falling back to defaults"
                    );
                    OnboardingState::default()
                },
                OnboardingState::from,
            ),
        ),
        Err(e) => {
            eprintln!("Warning: failed to read onboarding.toml ({e}), falling back to defaults");
            Ok(OnboardingState::default())
        }
    }
}

/// Returns whether onboarding has been completed.
pub fn is_complete(config_dir: &Path) -> Result<bool, NoteyError> {
    Ok(load(config_dir)?.complete)
}

/// Mark onboarding as complete and persist atomically. Idempotent — preserves the
/// existing session counter.
pub fn mark_complete(config_dir: &Path) -> Result<(), NoteyError> {
    let _guard = ONBOARDING_WRITE_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let mut state = load(config_dir)?;
    state.complete = true;
    save(config_dir, &state)
}

/// Increment the session counter, persist, and return the new count.
pub fn increment_session(config_dir: &Path) -> Result<u32, NoteyError> {
    let _guard = ONBOARDING_WRITE_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let mut state = load(config_dir)?;
    state.sessions_seen = state.sessions_seen.saturating_add(1);
    save(config_dir, &state)?;
    Ok(state.sessions_seen)
}

/// Whether the early "Ctrl+P for commands" status-bar hint should still be shown
/// for the given state (i.e. within the first [`COMMAND_HINT_SESSION_LIMIT`]
/// sessions).
pub fn should_show_command_hint(state: &OnboardingState) -> bool {
    state.sessions_seen < COMMAND_HINT_SESSION_LIMIT
}

/// Writes onboarding state to `onboarding.toml` using an atomic temp-file + rename,
/// mirroring [`crate::services::config::save`]. Cleans up the temp file on failure.
fn save(config_dir: &Path, state: &OnboardingState) -> Result<(), NoteyError> {
    fs::create_dir_all(config_dir)?;
    let path = state_file_path(config_dir);
    let tmp_path = config_dir.join("onboarding.toml.tmp");
    let persisted = PersistedOnboardingState::from(state);
    let contents = toml::to_string_pretty(&persisted)
        .map_err(|e| NoteyError::Config(format!("Failed to serialize onboarding state: {e}")))?;
    if let Err(e) = fs::write(&tmp_path, &contents) {
        let _ = fs::remove_file(&tmp_path);
        return Err(e.into());
    }
    if let Err(e) = fs::rename(&tmp_path, &path) {
        let _ = fs::remove_file(&tmp_path);
        return Err(e.into());
    }
    Ok(())
}
