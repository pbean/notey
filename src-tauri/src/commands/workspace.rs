use std::sync::Mutex;

use tauri::State;

use crate::errors::NoteyError;
use crate::models::workspace::{DetectedWorkspace, Workspace, WorkspaceInfo};
use crate::services;

#[tauri::command]
#[specta::specta]
pub async fn create_workspace(
    state: State<'_, Mutex<rusqlite::Connection>>,
    name: String,
    path: String,
) -> Result<Workspace, NoteyError> {
    let conn = state.lock().unwrap_or_else(|e| e.into_inner());
    services::workspace_service::create_workspace(&conn, &name, &path)
}

#[tauri::command]
#[specta::specta]
pub async fn list_workspaces(
    state: State<'_, Mutex<rusqlite::Connection>>,
) -> Result<Vec<WorkspaceInfo>, NoteyError> {
    let conn = state.lock().unwrap_or_else(|e| e.into_inner());
    services::workspace_service::list_workspaces(&conn)
}

#[tauri::command]
#[specta::specta]
pub async fn get_workspace(
    state: State<'_, Mutex<rusqlite::Connection>>,
    id: i64,
) -> Result<WorkspaceInfo, NoteyError> {
    let conn = state.lock().unwrap_or_else(|e| e.into_inner());
    services::workspace_service::get_workspace(&conn, id)
}

#[tauri::command]
#[specta::specta]
pub async fn detect_workspace(
    path: String,
) -> Result<DetectedWorkspace, NoteyError> {
    services::workspace_service::detect_workspace(&path)
}
