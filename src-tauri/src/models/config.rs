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
    pub shortcuts: ShortcutConfig,
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

/// The platform default global capture shortcut. macOS follows the platform
/// convention (`Cmd+Shift+N`); every other platform uses `Ctrl+Shift+N`. This
/// is the single source of truth for both first-run config generation and the
/// settings "Reset to default" action.
pub fn default_global_shortcut() -> String {
    #[cfg(target_os = "macos")]
    {
        "Cmd+Shift+N".to_string()
    }
    #[cfg(not(target_os = "macos"))]
    {
        "Ctrl+Shift+N".to_string()
    }
}

/// In-app keyboard shortcut bindings (webview-only — never registered with the
/// OS global-shortcut plugin).
///
/// Each field is a canonical shortcut string in the Story 7.4 capture grammar
/// (`[Ctrl|Cmd]+[Shift]+[Alt]+KEY`, `KEY ∈ A–Z / 0–9`). Strings are stored with
/// the canonical `Ctrl` primary-modifier token cross-platform; the webview
/// matcher treats `Ctrl`/`Cmd` interchangeably, and the UI localizes `Ctrl`→`⌘`
/// on macOS. Serialized in `config.toml` as the `[shortcuts]` section. Every
/// field carries its own serde default so a missing key (or a missing section)
/// falls back to the shipped binding.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutConfig {
    #[serde(default = "default_command_palette_shortcut")]
    pub command_palette: String,
    #[serde(default = "default_search_shortcut")]
    pub search: String,
    #[serde(default = "default_new_note_shortcut")]
    pub new_note: String,
    #[serde(default = "default_toggle_note_list_shortcut")]
    pub toggle_note_list: String,
    #[serde(default = "default_toggle_theme_shortcut")]
    pub toggle_theme: String,
    #[serde(default = "default_close_tab_shortcut")]
    pub close_tab: String,
}

fn default_command_palette_shortcut() -> String {
    "Ctrl+P".to_string()
}
fn default_search_shortcut() -> String {
    "Ctrl+F".to_string()
}
fn default_new_note_shortcut() -> String {
    "Ctrl+N".to_string()
}
fn default_toggle_note_list_shortcut() -> String {
    "Ctrl+B".to_string()
}
fn default_toggle_theme_shortcut() -> String {
    "Ctrl+Shift+T".to_string()
}
fn default_close_tab_shortcut() -> String {
    "Ctrl+W".to_string()
}

impl Default for ShortcutConfig {
    fn default() -> Self {
        Self {
            command_palette: default_command_palette_shortcut(),
            search: default_search_shortcut(),
            new_note: default_new_note_shortcut(),
            toggle_note_list: default_toggle_note_list_shortcut(),
            toggle_theme: default_toggle_theme_shortcut(),
            close_tab: default_close_tab_shortcut(),
        }
    }
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
            // The default window mode (Story 7.5). `floating` is the always-on-top
            // 600×400 capture overlay — the app's primary form factor.
            layout_mode: "floating".to_string(),
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
            global_shortcut: default_global_shortcut(),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_shortcuts_match_ux_dr27() {
        let s = ShortcutConfig::default();
        assert_eq!(s.command_palette, "Ctrl+P");
        assert_eq!(s.search, "Ctrl+F");
        assert_eq!(s.new_note, "Ctrl+N");
        assert_eq!(s.toggle_note_list, "Ctrl+B");
        assert_eq!(s.toggle_theme, "Ctrl+Shift+T");
        assert_eq!(s.close_tab, "Ctrl+W");
    }

    #[test]
    fn app_config_default_includes_shortcut_defaults() {
        let config = AppConfig::default();
        assert_eq!(config.shortcuts.command_palette, "Ctrl+P");
        assert_eq!(config.shortcuts.close_tab, "Ctrl+W");
    }
}
