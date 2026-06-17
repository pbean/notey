//! Typed tauri-specta events emitted by the IPC layer.
//!
//! Story 6.6 keeps CLI and desktop in sync in real time: when the IPC server
//! successfully handles a `create_note` (a `notey add` from the terminal), the
//! wiring layer in `lib.rs` emits [`NoteCreated`]. The frontend subscribes via
//! the generated `events.noteCreated.listen(...)` binding and refreshes its note
//! list.
//!
//! Unlike the legacy `export-*-progress` events (raw `app.emit` with stringly
//! names), this is a `tauri_specta::Event` so the regenerated `bindings.ts`
//! exposes a type-safe `events.noteCreated` entry. The derive kebab-cases the
//! struct name, so `NoteCreated` is emitted on the wire as `note-created`.

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri_specta::Event;

/// The `note-created` event payload.
///
/// Wire shape (camelCase): `{ "timestamp": "<ISO 8601>", "data": { "noteId": 42 } }`.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct NoteCreated {
    /// When the note was created, as an ISO 8601 / RFC 3339 string.
    pub timestamp: String,
    /// The created note's identity.
    pub data: NoteCreatedData,
}

/// Identity of a newly created note carried by [`NoteCreated`].
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct NoteCreatedData {
    /// The new note's database id.
    pub note_id: i64,
}

impl NoteCreated {
    /// Build a `note-created` event for `note_id`, stamping the current time as
    /// an ISO 8601 string (mirrors the project's `chrono::Utc::now().to_rfc3339()`
    /// date rule).
    pub fn now(note_id: i64) -> Self {
        Self {
            timestamp: chrono::Utc::now().to_rfc3339(),
            data: NoteCreatedData { note_id },
        }
    }
}

/// The `hotkey-pressed` event — emitted whenever the registered global capture
/// shortcut fires.
///
/// First-run onboarding (Story 8.1) dismisses its overlay when the user presses
/// the hotkey, but the OS-level shortcut hides the window without reloading the
/// webview, and a registered global shortcut does not reliably deliver a keydown
/// to the focused page across platforms. The shortcut handler emits this typed
/// event; the visible overlay listens via the generated `events.hotkeyPressed`
/// binding and completes onboarding. It is a marker event with no payload.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyPressed;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hotkey_pressed_event_name_is_kebab_case() {
        assert_eq!(HotkeyPressed::NAME, "hotkey-pressed");
    }

    #[test]
    fn note_created_serializes_camel_case_shape() {
        let value = serde_json::to_value(NoteCreated::now(42)).expect("serialize");
        // Nested data uses camelCase `noteId`.
        assert_eq!(value["data"]["noteId"].as_i64(), Some(42));
        // Timestamp is present and non-empty (an RFC 3339 string).
        let ts = value["timestamp"].as_str().expect("timestamp string");
        assert!(
            !ts.is_empty(),
            "timestamp must be a non-empty ISO 8601 string"
        );
        // No snake_case leakage.
        assert!(value["data"].get("note_id").is_none());
    }

    #[test]
    fn event_name_is_kebab_case() {
        assert_eq!(NoteCreated::NAME, "note-created");
    }
}
