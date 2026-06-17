//! Runtime status of the global-shortcut backend, surfaced to the frontend.
//!
//! Story 8.6 / FR57 detects, at startup, whether the session has a usable
//! global-shortcut backend (a pure Wayland session without XWayland and without
//! native portal support has none — see `lib.rs`). This model records that
//! outcome in Tauri-managed state so the frontend can pull it on launch and warn
//! the user that the hotkey will not work (DW-99).
//!
//! Pulled rather than pushed because the detection runs in the synchronous
//! `setup` hook, long before the (startup-hidden) webview attaches an event
//! listener — a `setup`-time event would be dropped.

use serde::{Deserialize, Serialize};
use specta::Type;

/// Availability of the global-shortcut backend for the current session.
///
/// Wire shape (camelCase): `{ "available": false, "reason": "<message>" }`.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyStatus {
    /// `true` when a usable global-shortcut backend was found at startup.
    pub available: bool,
    /// Human-readable reason the backend is unavailable, when `available` is
    /// `false`. `None` when the hotkey is available.
    pub reason: Option<String>,
}

impl HotkeyStatus {
    /// A status indicating the global-shortcut backend is available.
    pub fn available() -> Self {
        Self {
            available: true,
            reason: None,
        }
    }

    /// A status indicating the backend is unavailable, carrying the technical
    /// `reason` for logging (not shown verbatim to the user).
    pub fn unavailable(reason: impl Into<String>) -> Self {
        Self {
            available: false,
            reason: Some(reason.into()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn available_has_no_reason() {
        let status = HotkeyStatus::available();
        assert!(status.available);
        assert!(status.reason.is_none());
    }

    #[test]
    fn unavailable_carries_reason() {
        let status = HotkeyStatus::unavailable("no portal");
        assert!(!status.available);
        assert_eq!(status.reason.as_deref(), Some("no portal"));
    }

    #[test]
    fn serializes_camel_case_shape() {
        let value = serde_json::to_value(HotkeyStatus::unavailable("boom")).expect("serialize");
        // camelCase field names, no snake_case leakage.
        assert_eq!(value["available"].as_bool(), Some(false));
        assert_eq!(value["reason"].as_str(), Some("boom"));
        // `available` true omits the reason as JSON null.
        let ok = serde_json::to_value(HotkeyStatus::available()).expect("serialize");
        assert_eq!(ok["available"].as_bool(), Some(true));
        assert!(ok["reason"].is_null());
    }
}
