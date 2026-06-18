//! Thin Tauri command handlers for first-run onboarding state. All logic lives
//! in [`crate::services::onboarding`]; these handlers only resolve the managed
//! config directory and delegate. Synchronous (filesystem-only work) per the
//! project's command convention.

use tauri::State;

use crate::errors::NoteyError;
use crate::services::onboarding::{self, OnboardingState};

use super::config::ConfigDir;

/// Returns the persisted onboarding state (completion flag + session count).
#[tauri::command]
#[specta::specta]
pub fn get_onboarding_state(
    config_dir: State<'_, ConfigDir>,
) -> Result<OnboardingState, NoteyError> {
    onboarding::load(&config_dir.0)
}

/// Marks onboarding complete and persists it. Idempotent.
#[tauri::command]
#[specta::specta]
pub fn complete_onboarding(config_dir: State<'_, ConfigDir>) -> Result<(), NoteyError> {
    onboarding::mark_complete(&config_dir.0)
}

/// Increments the persisted session counter and returns the new count.
#[tauri::command]
#[specta::specta]
pub fn increment_onboarding_session(config_dir: State<'_, ConfigDir>) -> Result<u32, NoteyError> {
    onboarding::increment_session(&config_dir.0)
}
