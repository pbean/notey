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
) -> Result<Note, NoteyError> {
    let conn = state.lock().unwrap_or_else(|e| e.into_inner());
    services::notes::create_note(&conn, &format)
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

#[tauri::command]
#[specta::specta]
pub async fn list_notes(
    state: State<'_, Mutex<rusqlite::Connection>>,
) -> Result<Vec<Note>, NoteyError> {
    let conn = state.lock().unwrap_or_else(|e| e.into_inner());
    services::notes::list_notes(&conn)
}
