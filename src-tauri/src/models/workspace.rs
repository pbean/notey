use serde::{Deserialize, Serialize};
use specta::Type;

/// A workspace maps to a project directory on disk.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub id: i64,
    pub name: String,
    pub path: String,
    pub created_at: String,
}

/// A workspace with its aggregated note count (excludes trashed notes).
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceInfo {
    pub id: i64,
    pub name: String,
    pub path: String,
    pub created_at: String,
    pub note_count: i64,
}
