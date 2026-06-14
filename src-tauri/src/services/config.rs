use std::fs;
use std::path::{Path, PathBuf};

use crate::errors::NoteyError;
use crate::models::config::AppConfig;

/// Returns the platform-standard config directory for Notey.
/// Linux: `$XDG_CONFIG_HOME/notey/`, macOS: `~/Library/Application Support/com.notey.app/`,
/// Windows: `%APPDATA%\notey\`
pub fn config_dir() -> Result<PathBuf, NoteyError> {
    let base = dirs::config_dir().ok_or_else(|| {
        NoteyError::Config("Could not determine platform config directory".to_string())
    })?;

    #[cfg(target_os = "macos")]
    let dir = base.join("com.notey.app");
    #[cfg(not(target_os = "macos"))]
    let dir = base.join("notey");

    Ok(dir)
}

/// Returns the full path to config.toml within the config directory.
fn config_file_path(config_dir: &Path) -> PathBuf {
    config_dir.join("config.toml")
}

/// Loads the config from disk, or creates a default one if missing/corrupt.
pub fn load_or_create(config_dir: &Path) -> Result<AppConfig, NoteyError> {
    let path = config_file_path(config_dir);

    if path.exists() {
        let contents = fs::read_to_string(&path)?;
        match toml::from_str::<AppConfig>(&contents) {
            Ok(config) => Ok(config),
            Err(e) => {
                eprintln!(
                    "Warning: config.toml is corrupt ({}), falling back to defaults",
                    e
                );
                let config = AppConfig::default();
                save(config_dir, &config)?;
                Ok(config)
            }
        }
    } else {
        let config = AppConfig::default();
        save(config_dir, &config)?;
        Ok(config)
    }
}

/// Writes the config to disk as TOML using atomic write (temp file + rename).
/// Cleans up the temp file on any failure to avoid leaving stale partial files.
pub fn save(config_dir: &Path, config: &AppConfig) -> Result<(), NoteyError> {
    fs::create_dir_all(config_dir)?;
    let path = config_file_path(config_dir);
    let tmp_path = config_dir.join("config.toml.tmp");
    let contents = toml::to_string_pretty(config)
        .map_err(|e| NoteyError::Config(format!("Failed to serialize config: {}", e)))?;
    if let Err(e) = fs::write(&tmp_path, &contents) {
        let _ = fs::remove_file(&tmp_path);
        return Err(e.into());
    }
    if let Err(e) = fs::rename(&tmp_path, &path) {
        let _ = fs::remove_file(&tmp_path);
        return Err(e.into());
    }
    Ok(())
}

/// Merges a partial update into an existing config. Only non-None fields are overwritten.
pub fn merge_update(existing: &AppConfig, partial: &PartialAppConfig) -> AppConfig {
    let mut merged = existing.clone();

    if let Some(ref general) = partial.general {
        if let Some(ref theme) = general.theme {
            merged.general.theme = theme.clone();
        }
        if let Some(ref layout_mode) = general.layout_mode {
            merged.general.layout_mode = layout_mode.clone();
        }
    }

    if let Some(ref editor) = partial.editor {
        if let Some(font_size) = editor.font_size {
            merged.editor.font_size = font_size;
        }
        if let Some(ref font_family) = editor.font_family {
            merged.editor.font_family = font_family.clone();
        }
    }

    if let Some(ref hotkey) = partial.hotkey {
        if let Some(ref global_shortcut) = hotkey.global_shortcut {
            merged.hotkey.global_shortcut = global_shortcut.clone();
        }
    }

    if let Some(ref shortcuts) = partial.shortcuts {
        if let Some(ref v) = shortcuts.command_palette {
            merged.shortcuts.command_palette = v.clone();
        }
        if let Some(ref v) = shortcuts.search {
            merged.shortcuts.search = v.clone();
        }
        if let Some(ref v) = shortcuts.new_note {
            merged.shortcuts.new_note = v.clone();
        }
        if let Some(ref v) = shortcuts.toggle_note_list {
            merged.shortcuts.toggle_note_list = v.clone();
        }
        if let Some(ref v) = shortcuts.toggle_theme {
            merged.shortcuts.toggle_theme = v.clone();
        }
        if let Some(ref v) = shortcuts.close_tab {
            merged.shortcuts.close_tab = v.clone();
        }
    }

    merged
}

/// Partial config for updates — all fields optional.
#[derive(Debug, Clone, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PartialAppConfig {
    pub general: Option<PartialGeneralConfig>,
    pub editor: Option<PartialEditorConfig>,
    pub hotkey: Option<PartialHotkeyConfig>,
    pub shortcuts: Option<PartialShortcutConfig>,
}

/// Partial general settings for selective updates.
#[derive(Debug, Clone, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PartialGeneralConfig {
    pub theme: Option<String>,
    pub layout_mode: Option<String>,
}

/// Partial editor settings for selective updates.
#[derive(Debug, Clone, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PartialEditorConfig {
    pub font_size: Option<u32>,
    pub font_family: Option<String>,
}

/// Partial hotkey settings for selective updates.
#[derive(Debug, Clone, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PartialHotkeyConfig {
    pub global_shortcut: Option<String>,
}

/// Partial in-app shortcut settings for selective updates. Each rebindable
/// action is independently optional so the UI can persist a single rebind.
#[derive(Debug, Clone, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PartialShortcutConfig {
    pub command_palette: Option<String>,
    pub search: Option<String>,
    pub new_note: Option<String>,
    pub toggle_note_list: Option<String>,
    pub toggle_theme: Option<String>,
    pub close_tab: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn load_creates_default_when_missing() {
        let tmp = TempDir::new().unwrap();
        let config = load_or_create(tmp.path()).unwrap();
        assert_eq!(config.general.theme, "system");
        assert_eq!(config.general.layout_mode, "floating");
        assert_eq!(config.editor.font_size, 14);
        assert_eq!(
            config.hotkey.global_shortcut,
            crate::models::config::default_global_shortcut()
        );
        assert!(tmp.path().join("config.toml").exists());
    }

    #[test]
    fn load_reads_existing_config() {
        let tmp = TempDir::new().unwrap();
        let toml_content = r#"
[general]
theme = "light"
layoutMode = "half-screen"

[editor]
fontSize = 18

[hotkey]
globalShortcut = "Ctrl+Shift+M"
"#;
        fs::create_dir_all(tmp.path()).unwrap();
        fs::write(tmp.path().join("config.toml"), toml_content).unwrap();

        let config = load_or_create(tmp.path()).unwrap();
        assert_eq!(config.general.theme, "light");
        assert_eq!(config.general.layout_mode, "half-screen");
        assert_eq!(config.editor.font_size, 18);
        assert_eq!(config.hotkey.global_shortcut, "Ctrl+Shift+M");
    }

    #[test]
    fn default_trash_retention_is_30_days() {
        let config = AppConfig::default();
        assert_eq!(config.trash.retention_days, 30);
    }

    #[test]
    fn load_reads_trash_retention_days() {
        let tmp = TempDir::new().unwrap();
        let toml_content = r#"
[trash]
retentionDays = 7
"#;
        fs::create_dir_all(tmp.path()).unwrap();
        fs::write(tmp.path().join("config.toml"), toml_content).unwrap();

        let config = load_or_create(tmp.path()).unwrap();
        assert_eq!(config.trash.retention_days, 7);
    }

    #[test]
    fn load_defaults_trash_retention_when_section_missing() {
        let tmp = TempDir::new().unwrap();
        let toml_content = r#"
[editor]
fontSize = 18
"#;
        fs::create_dir_all(tmp.path()).unwrap();
        fs::write(tmp.path().join("config.toml"), toml_content).unwrap();

        let config = load_or_create(tmp.path()).unwrap();
        assert_eq!(
            config.trash.retention_days, 30,
            "missing [trash] section must fall back to the default"
        );
    }

    #[test]
    fn load_defaults_trash_retention_when_key_missing_in_section() {
        let tmp = TempDir::new().unwrap();
        let toml_content = r#"
[trash]
"#;
        fs::create_dir_all(tmp.path()).unwrap();
        fs::write(tmp.path().join("config.toml"), toml_content).unwrap();

        let config = load_or_create(tmp.path()).unwrap();
        assert_eq!(
            config.trash.retention_days, 30,
            "missing retentionDays key must fall back to the default"
        );
    }

    #[test]
    fn load_falls_back_on_corrupt_toml() {
        let tmp = TempDir::new().unwrap();
        fs::create_dir_all(tmp.path()).unwrap();
        fs::write(tmp.path().join("config.toml"), "{{invalid toml}}").unwrap();

        let config = load_or_create(tmp.path()).unwrap();
        assert_eq!(config.general.theme, "system");
    }

    #[test]
    fn merge_update_applies_partial_fields() {
        let existing = AppConfig::default();
        let partial = PartialAppConfig {
            general: None,
            editor: Some(PartialEditorConfig {
                font_size: Some(20),
                font_family: None,
            }),
            hotkey: None,
            shortcuts: None,
        };

        let merged = merge_update(&existing, &partial);
        assert_eq!(merged.editor.font_size, 20);
        assert_eq!(merged.editor.font_family, "mono"); // unchanged
        assert_eq!(merged.general.theme, "system"); // unchanged
        assert_eq!(
            merged.hotkey.global_shortcut,
            crate::models::config::default_global_shortcut()
        ); // unchanged
    }

    #[test]
    fn default_font_family_is_mono() {
        let config = AppConfig::default();
        assert_eq!(config.editor.font_family, "mono");
    }

    #[test]
    fn merge_update_applies_font_family() {
        let existing = AppConfig::default();
        let partial = PartialAppConfig {
            general: None,
            editor: Some(PartialEditorConfig {
                font_size: None,
                font_family: Some("sans".to_string()),
            }),
            hotkey: None,
            shortcuts: None,
        };

        let merged = merge_update(&existing, &partial);
        assert_eq!(merged.editor.font_family, "sans");
        assert_eq!(merged.editor.font_size, 14); // unchanged
    }

    #[test]
    fn load_defaults_font_family_when_key_missing() {
        let tmp = TempDir::new().unwrap();
        let toml_content = r#"
[editor]
fontSize = 18
"#;
        fs::create_dir_all(tmp.path()).unwrap();
        fs::write(tmp.path().join("config.toml"), toml_content).unwrap();

        let config = load_or_create(tmp.path()).unwrap();
        assert_eq!(
            config.editor.font_family, "mono",
            "missing fontFamily key must fall back to the default"
        );
    }

    #[test]
    fn font_family_round_trips_through_toml() {
        let tmp = TempDir::new().unwrap();
        let mut config = AppConfig::default();
        config.editor.font_family = "sans".to_string();
        save(tmp.path(), &config).unwrap();

        let loaded = load_or_create(tmp.path()).unwrap();
        assert_eq!(loaded.editor.font_family, "sans");
    }

    #[test]
    fn default_shortcuts_when_section_missing() {
        let tmp = TempDir::new().unwrap();
        let toml_content = r#"
[editor]
fontSize = 18
"#;
        fs::create_dir_all(tmp.path()).unwrap();
        fs::write(tmp.path().join("config.toml"), toml_content).unwrap();

        let config = load_or_create(tmp.path()).unwrap();
        assert_eq!(
            config.shortcuts.command_palette, "Ctrl+P",
            "missing [shortcuts] section must fall back to defaults"
        );
        assert_eq!(config.shortcuts.close_tab, "Ctrl+W");
    }

    #[test]
    fn shortcuts_round_trip_through_toml() {
        let tmp = TempDir::new().unwrap();
        let toml_content = r#"
[shortcuts]
search = "Ctrl+G"
"#;
        fs::create_dir_all(tmp.path()).unwrap();
        fs::write(tmp.path().join("config.toml"), toml_content).unwrap();

        let config = load_or_create(tmp.path()).unwrap();
        // Overridden key reflects the file…
        assert_eq!(config.shortcuts.search, "Ctrl+G");
        // …while keys absent from the section keep their defaults.
        assert_eq!(config.shortcuts.command_palette, "Ctrl+P");
    }

    #[test]
    fn merge_update_applies_partial_shortcut() {
        let existing = AppConfig::default();
        let partial = PartialAppConfig {
            general: None,
            editor: None,
            hotkey: None,
            shortcuts: Some(PartialShortcutConfig {
                command_palette: None,
                search: Some("Ctrl+G".to_string()),
                new_note: None,
                toggle_note_list: None,
                toggle_theme: None,
                close_tab: None,
            }),
        };

        let merged = merge_update(&existing, &partial);
        assert_eq!(merged.shortcuts.search, "Ctrl+G"); // changed
        assert_eq!(merged.shortcuts.new_note, "Ctrl+N"); // unchanged default
        assert_eq!(
            merged.hotkey.global_shortcut,
            crate::models::config::default_global_shortcut()
        ); // unchanged
    }

    #[test]
    fn save_creates_valid_toml() {
        let tmp = TempDir::new().unwrap();
        let config = AppConfig::default();
        save(tmp.path(), &config).unwrap();

        let contents = fs::read_to_string(tmp.path().join("config.toml")).unwrap();
        let parsed: AppConfig = toml::from_str(&contents).unwrap();
        assert_eq!(parsed.general.theme, config.general.theme);
    }

    #[test]
    fn save_is_atomic_no_temp_file_left() {
        let tmp = TempDir::new().unwrap();
        let config = AppConfig::default();
        save(tmp.path(), &config).unwrap();

        // Temp file should not remain after successful save
        assert!(!tmp.path().join("config.toml.tmp").exists());
        assert!(tmp.path().join("config.toml").exists());

        // Overwrite with different config — original is replaced atomically
        let mut updated = config;
        updated.editor.font_size = 24;
        save(tmp.path(), &updated).unwrap();

        let contents = fs::read_to_string(tmp.path().join("config.toml")).unwrap();
        let parsed: AppConfig = toml::from_str(&contents).unwrap();
        assert_eq!(parsed.editor.font_size, 24);
        assert!(!tmp.path().join("config.toml.tmp").exists());
    }
}
