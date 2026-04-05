use std::sync::Mutex;

use tauri::State;

use crate::errors::NoteyError;
use crate::models::Note;
use crate::services;

#[tauri::command]
#[specta::specta]
pub async fn create_note(
    state: State<'_, Mutex<rusqlite::Connection>>,
    format: String,
    workspace_id: Option<i64>,
) -> Result<Note, NoteyError> {
    let conn = state.lock().unwrap_or_else(|e| e.into_inner());
    services::notes::create_note(&conn, &format, workspace_id)
}

#[tauri::command]
#[specta::specta]
pub async fn get_note(
    state: State<'_, Mutex<rusqlite::Connection>>,
    id: i64,
) -> Result<Note, NoteyError> {
    let conn = state.lock().unwrap_or_else(|e| e.into_inner());
    services::notes::get_note(&conn, id)
}

#[tauri::command]
#[specta::specta]
pub async fn update_note(
    state: State<'_, Mutex<rusqlite::Connection>>,
    id: i64,
    title: Option<String>,
    content: Option<String>,
    format: Option<String>,
) -> Result<Note, NoteyError> {
    let conn = state.lock().unwrap_or_else(|e| e.into_inner());
    services::notes::update_note(&conn, id, title, content, format)
}

/// Reassign a note to a different workspace or unscope it.
#[tauri::command]
#[specta::specta]
pub async fn reassign_note_workspace(
    state: State<'_, Mutex<rusqlite::Connection>>,
    id: i64,
    workspace_id: Option<i64>,
) -> Result<Note, NoteyError> {
    let conn = state.lock().unwrap_or_else(|e| e.into_inner());
    services::notes::reassign_note_workspace(&conn, id, workspace_id)
}

/// Rebuild the FTS5 index from the content table. Use for recovery if the index drifts.
#[tauri::command]
#[specta::specta]
pub async fn rebuild_fts_index(
    state: State<'_, Mutex<rusqlite::Connection>>,
) -> Result<(), NoteyError> {
    let conn = state.lock().unwrap_or_else(|e| e.into_inner());
    services::notes::rebuild_fts_index(&conn)
}

#[tauri::command]
#[specta::specta]
pub async fn list_notes(
    state: State<'_, Mutex<rusqlite::Connection>>,
    workspace_id: Option<i64>,
) -> Result<Vec<Note>, NoteyError> {
    let conn = state.lock().unwrap_or_else(|e| e.into_inner());
    services::notes::list_notes(&conn, workspace_id)
}
