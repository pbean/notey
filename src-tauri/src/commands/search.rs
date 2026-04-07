use std::sync::Mutex;

use tauri::State;

use crate::errors::NoteyError;
use crate::models::SearchResult;
use crate::services;

use super::recover_poisoned_db;

/// Full-text search across notes, optionally filtered by workspace.
#[tauri::command]
#[specta::specta]
pub fn search_notes(
    state: State<'_, Mutex<rusqlite::Connection>>,
    query: String,
    workspace_id: Option<i64>,
) -> Result<Vec<SearchResult>, NoteyError> {
    let conn = state.lock().unwrap_or_else(recover_poisoned_db);
    services::search_service::search_notes(&conn, &query, workspace_id)
}
