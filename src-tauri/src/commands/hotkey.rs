//! Thin Tauri command exposing the global-shortcut backend status detected at
//! startup (Story 8.6 / FR57, DW-99).
//!
//! `lib.rs` records the outcome of the startup `register_hotkey` probe in
//! managed `Mutex<HotkeyStatus>` state; the frontend pulls it on launch via this
//! command and warns the user when the hotkey is unavailable. Synchronous per the
//! project's command convention (a mutex read, no async work).

use std::sync::Mutex;

use tauri::State;

use crate::models::hotkey::HotkeyStatus;

/// Return the global-shortcut backend status for the current session.
///
/// Reads the value recorded during startup hotkey detection. A poisoned lock is
/// recovered by cloning the inner value — the status is plain data with no
/// transactional state to repair.
#[tauri::command]
#[specta::specta]
pub fn get_hotkey_status(state: State<'_, Mutex<HotkeyStatus>>) -> HotkeyStatus {
    state
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .clone()
}
