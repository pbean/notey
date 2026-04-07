pub mod config;
pub mod workspace;

use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: i64,
    pub title: String,
    pub content: String,
    pub format: String,
    pub workspace_id: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
    pub is_trashed: bool,
}

/// A single search result with a content snippet and workspace context.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub id: i64,
    pub title: String,
    pub snippet: String,
    pub workspace_name: Option<String>,
    pub updated_at: String,
    pub format: String,
}
