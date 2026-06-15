//! ATDD red-phase acceptance tests — Story 8.1 (First-Run Detection & Onboarding
//! Overlay), backend persistence slice.
//!
//! Every test is `#[ignore = "red-phase: Story 8.1"]`: the assertions encode the
//! *expected* behavior of [`tauri_app_lib::services::onboarding`], whose functions
//! are unimplemented (`todo!`) scaffolds. The suite stays green until a developer
//! implements a function and removes the matching `#[ignore]` (TDD red → green).
//!
//! Activate one test at a time:
//!   cargo test --test onboarding_tests <name> -- --ignored

use tempfile::TempDir;

use tauri_app_lib::services::onboarding::{
    self, OnboardingState, COMMAND_HINT_SESSION_LIMIT,
};

/// AC: "the application starts for the first time (no `onboarding_complete` flag)".
/// A fresh config dir yields the default state — not complete, zero sessions.
#[test]
#[ignore = "red-phase: Story 8.1"]
fn load_returns_default_state_on_first_run() {
    let tmp = TempDir::new().unwrap();
    let state = onboarding::load(tmp.path()).expect("load must succeed on a fresh dir");
    assert_eq!(
        state,
        OnboardingState {
            complete: false,
            sessions_seen: 0
        }
    );
}

/// AC: "the overlay is visible … the user presses the configured hotkey … Then …
/// `onboarding_complete = true` is set in config". After marking complete,
/// `is_complete` reports true on a fresh read from disk.
#[test]
#[ignore = "red-phase: Story 8.1"]
fn mark_complete_persists_and_is_observed_on_reload() {
    let tmp = TempDir::new().unwrap();
    assert!(!onboarding::is_complete(tmp.path()).unwrap());

    onboarding::mark_complete(tmp.path()).expect("mark_complete must persist");

    // Re-read from disk (no in-memory cache assumption).
    assert!(
        onboarding::is_complete(tmp.path()).unwrap(),
        "onboarding_complete must survive a reload"
    );
    assert!(
        onboarding::state_file_path(tmp.path()).exists(),
        "completion must be written to onboarding.toml"
    );
}

/// AC: "the overlay is never shown again". mark_complete is idempotent — calling
/// it twice keeps `complete = true` and does not reset the session counter.
#[test]
#[ignore = "red-phase: Story 8.1"]
fn mark_complete_is_idempotent() {
    let tmp = TempDir::new().unwrap();
    onboarding::increment_session(tmp.path()).unwrap();
    onboarding::mark_complete(tmp.path()).unwrap();
    onboarding::mark_complete(tmp.path()).unwrap();

    let state = onboarding::load(tmp.path()).unwrap();
    assert!(state.complete);
    assert_eq!(state.sessions_seen, 1, "idempotent completion must not reset sessions");
}

/// AC: "the user is within their first 5 sessions". The session counter
/// increments and persists across reloads.
#[test]
#[ignore = "red-phase: Story 8.1"]
fn increment_session_counts_and_persists() {
    let tmp = TempDir::new().unwrap();
    assert_eq!(onboarding::increment_session(tmp.path()).unwrap(), 1);
    assert_eq!(onboarding::increment_session(tmp.path()).unwrap(), 2);
    assert_eq!(
        onboarding::load(tmp.path()).unwrap().sessions_seen,
        2,
        "session count must persist between loads"
    );
}

/// AC: "after 5 sessions, the hint disappears permanently". The hint shows for the
/// first `COMMAND_HINT_SESSION_LIMIT` sessions, then never again.
#[test]
#[ignore = "red-phase: Story 8.1"]
fn command_hint_retires_after_session_limit() {
    let within = OnboardingState { complete: true, sessions_seen: 0 };
    let last = OnboardingState { complete: true, sessions_seen: COMMAND_HINT_SESSION_LIMIT - 1 };
    let past = OnboardingState { complete: true, sessions_seen: COMMAND_HINT_SESSION_LIMIT };

    assert!(onboarding::should_show_command_hint(&within));
    assert!(onboarding::should_show_command_hint(&last));
    assert!(
        !onboarding::should_show_command_hint(&past),
        "hint must disappear permanently once the session limit is reached"
    );
}
