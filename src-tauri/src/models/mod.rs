pub mod config;
pub mod hotkey;
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

/// A note row enriched with its workspace name for terminal listing.
///
/// Returned by [`crate::services::notes::list_notes_with_workspace`] and surfaced
/// over IPC to the `notey list` CLI command (Story 6.4). Unlike [`Note`] it carries
/// the workspace *name* (via a `LEFT JOIN`, like [`SearchResult`]) rather than the
/// raw `workspace_id`, so the CLI can print it without a second lookup.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct NoteListItem {
    pub id: i64,
    pub title: String,
    pub workspace_name: Option<String>,
    pub updated_at: String,
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
