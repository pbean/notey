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
    #[serde(default)]
    pub trash: TrashConfig,
}

/// General application settings.
///
/// `theme` is one of `"system"` (the default — follow the OS
/// `prefers-color-scheme` until the user picks a theme), `"dark"`, or `"light"`.
/// A saved manual `dark`/`light` preference overrides the OS setting on restart.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GeneralConfig {
    pub theme: String,
    pub layout_mode: String,
}

/// Editor-specific settings.
///
/// `font_family` selects the primary font stack: `"mono"` (monospace, the
/// default) or `"sans"` (sans-serif). Serialized in `config.toml` as
/// `[editor] fontFamily`.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct EditorConfig {
    pub font_size: u32,
    #[serde(default = "default_font_family")]
    pub font_family: String,
}

fn default_font_family() -> String {
    "mono".to_string()
}

/// Hotkey bindings.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyConfig {
    pub global_shortcut: String,
}

/// Trash retention settings.
///
/// `retention_days` controls how long soft-deleted notes remain recoverable
/// before the startup auto-purge removes them for good. The default of 30 days
/// upholds the product's "recoverable for at least 30 days" guarantee. Serialized
/// in `config.toml` as `[trash] retentionDays`.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TrashConfig {
    #[serde(default = "default_trash_retention_days")]
    pub retention_days: u32,
}

const fn default_trash_retention_days() -> u32 {
    30
}

impl Default for GeneralConfig {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            layout_mode: "comfortable".to_string(),
        }
    }
}

impl Default for EditorConfig {
    fn default() -> Self {
        Self {
            font_size: 14,
            font_family: "mono".to_string(),
        }
    }
}

impl Default for HotkeyConfig {
    fn default() -> Self {
        Self {
            global_shortcut: "Ctrl+Shift+N".to_string(),
        }
    }
}

impl Default for TrashConfig {
    fn default() -> Self {
        Self {
            retention_days: default_trash_retention_days(),
        }
    }
}
