use serde::{Deserialize, Serialize};
use specta::Type;

/// Top-level application configuration, persisted as TOML.
#[derive(Debug, Default, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    #[serde(default)]
    pub general: GeneralConfig,
    #[serde(default)]
    pub editor: EditorConfig,
    #[serde(default)]
    pub hotkey: HotkeyConfig,
}

/// General application settings.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GeneralConfig {
    pub theme: String,
    pub layout_mode: String,
}

/// Editor-specific settings.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct EditorConfig {
    pub font_size: u32,
}

/// Hotkey bindings.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyConfig {
    pub global_shortcut: String,
}

impl Default for GeneralConfig {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            layout_mode: "floating".to_string(),
        }
    }
}

impl Default for EditorConfig {
    fn default() -> Self {
        Self { font_size: 14 }
    }
}

impl Default for HotkeyConfig {
    fn default() -> Self {
        Self {
            global_shortcut: "Ctrl+Shift+N".to_string(),
        }
    }
}
