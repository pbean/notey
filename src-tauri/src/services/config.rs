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
                eprintln!("Warning: config.toml is corrupt ({}), falling back to defaults", e);
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
    }

    if let Some(ref hotkey) = partial.hotkey {
        if let Some(ref global_shortcut) = hotkey.global_shortcut {
            merged.hotkey.global_shortcut = global_shortcut.clone();
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
}

/// Partial hotkey settings for selective updates.
#[derive(Debug, Clone, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PartialHotkeyConfig {
    pub global_shortcut: Option<String>,
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
        assert_eq!(config.general.theme, "dark");
        assert_eq!(config.editor.font_size, 14);
        assert_eq!(config.hotkey.global_shortcut, "Ctrl+Shift+N");
        assert!(tmp.path().join("config.toml").exists());
    }

    #[test]
    fn load_reads_existing_config() {
        let tmp = TempDir::new().unwrap();
        let toml_content = r#"
[general]
theme = "light"
layoutMode = "floating"

[editor]
fontSize = 18

[hotkey]
globalShortcut = "Ctrl+Shift+M"
"#;
        fs::create_dir_all(tmp.path()).unwrap();
        fs::write(tmp.path().join("config.toml"), toml_content).unwrap();

        let config = load_or_create(tmp.path()).unwrap();
        assert_eq!(config.general.theme, "light");
        assert_eq!(config.editor.font_size, 18);
        assert_eq!(config.hotkey.global_shortcut, "Ctrl+Shift+M");
    }

    #[test]
    fn load_falls_back_on_corrupt_toml() {
        let tmp = TempDir::new().unwrap();
        fs::create_dir_all(tmp.path()).unwrap();
        fs::write(tmp.path().join("config.toml"), "{{invalid toml}}").unwrap();

        let config = load_or_create(tmp.path()).unwrap();
        assert_eq!(config.general.theme, "dark");
    }

    #[test]
    fn merge_update_applies_partial_fields() {
        let existing = AppConfig::default();
        let partial = PartialAppConfig {
            general: None,
            editor: Some(PartialEditorConfig {
                font_size: Some(20),
            }),
            hotkey: None,
        };

        let merged = merge_update(&existing, &partial);
        assert_eq!(merged.editor.font_size, 20);
        assert_eq!(merged.general.theme, "dark"); // unchanged
        assert_eq!(merged.hotkey.global_shortcut, "Ctrl+Shift+N"); // unchanged
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
