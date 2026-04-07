use std::sync::Mutex;

use tauri::State;

use crate::errors::NoteyError;
use crate::models::Note;
use crate::services;

use super::recover_poisoned_db;

#[tauri::command]
#[specta::specta]
pub fn create_note(
    state: State<'_, Mutex<rusqlite::Connection>>,
    format: String,
    workspace_id: Option<i64>,
) -> Result<Note, NoteyError> {
    let conn = state.lock().unwrap_or_else(recover_poisoned_db);
    services::notes::create_note(&conn, &format, workspace_id)
}

#[tauri::command]
#[specta::specta]
pub fn get_note(
    state: State<'_, Mutex<rusqlite::Connection>>,
    id: i64,
) -> Result<Note, NoteyError> {
    let conn = state.lock().unwrap_or_else(recover_poisoned_db);
    services::notes::get_note(&conn, id)
}

#[tauri::command]
#[specta::specta]
pub fn update_note(
    state: State<'_, Mutex<rusqlite::Connection>>,
    id: i64,
    title: Option<String>,
    content: Option<String>,
    format: Option<String>,
) -> Result<Note, NoteyError> {
    let conn = state.lock().unwrap_or_else(recover_poisoned_db);
    services::notes::update_note(&conn, id, title, content, format)
}

/// Reassign a note to a different workspace or unscope it.
#[tauri::command]
#[specta::specta]
pub fn reassign_note_workspace(
    state: State<'_, Mutex<rusqlite::Connection>>,
    id: i64,
    workspace_id: Option<i64>,
) -> Result<Note, NoteyError> {
    let conn = state.lock().unwrap_or_else(recover_poisoned_db);
    services::notes::reassign_note_workspace(&conn, id, workspace_id)
}

/// Rebuild the FTS5 index from the content table. Use for recovery if the index drifts.
#[tauri::command]
#[specta::specta]
pub fn rebuild_fts_index(
    state: State<'_, Mutex<rusqlite::Connection>>,
) -> Result<(), NoteyError> {
    let conn = state.lock().unwrap_or_else(recover_poisoned_db);
    services::notes::rebuild_fts_index(&conn)
}

#[tauri::command]
#[specta::specta]
pub fn list_notes(
    state: State<'_, Mutex<rusqlite::Connection>>,
    workspace_id: Option<i64>,
) -> Result<Vec<Note>, NoteyError> {
    let conn = state.lock().unwrap_or_else(recover_poisoned_db);
    services::notes::list_notes(&conn, workspace_id)
}
