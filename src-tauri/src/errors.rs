use specta::Type;
use thiserror::Error;

#[derive(Debug, Error, serde::Serialize, Type)]
#[serde(tag = "type", content = "message")]
pub enum NoteyError {
    #[error("Database error: {0}")]
    Database(
        #[serde(skip)]
        #[specta(skip)]
        rusqlite::Error,
    ),

    #[error("Note not found")]
    NotFound,

    #[error("Workspace error")]
    Workspace,

    #[error("IO error: {0}")]
    Io(
        #[serde(skip)]
        #[specta(skip)]
        std::io::Error,
    ),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Config error: {0}")]
    Config(String),
}

impl From<rusqlite::Error> for NoteyError {
    fn from(err: rusqlite::Error) -> Self {
        NoteyError::Database(err)
    }
}

impl From<std::io::Error> for NoteyError {
    fn from(err: std::io::Error) -> Self {
        NoteyError::Io(err)
    }
}

impl From<rusqlite_migration::Error> for NoteyError {
    fn from(err: rusqlite_migration::Error) -> Self {
        NoteyError::Database(match err {
            rusqlite_migration::Error::RusqliteError { err, .. } => err,
            other => rusqlite::Error::SqliteFailure(
                rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_ERROR),
                Some(other.to_string()),
            ),
        })
    }
}

// P1-UNIT-007: NoteyError serializes across IPC
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_not_found_serializes_with_type_tag() {
        let val = serde_json::to_value(&NoteyError::NotFound).unwrap();
        assert_eq!(val["type"], "NotFound");
    }

    #[test]
    fn test_workspace_serializes_with_type_tag() {
        let val = serde_json::to_value(&NoteyError::Workspace).unwrap();
        assert_eq!(val["type"], "Workspace");
    }

    #[test]
    fn test_validation_serializes_with_message() {
        let err = NoteyError::Validation("bad input".to_string());
        let val = serde_json::to_value(&err).unwrap();
        assert_eq!(val["type"], "Validation");
        assert_eq!(val["message"], "bad input");
    }

    #[test]
    fn test_config_serializes_with_message() {
        let err = NoteyError::Config("invalid toml".to_string());
        let val = serde_json::to_value(&err).unwrap();
        assert_eq!(val["type"], "Config");
        assert_eq!(val["message"], "invalid toml");
    }

    #[test]
    fn test_database_skips_inner_error() {
        let inner = rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_ERROR),
            Some("test".to_string()),
        );
        let err = NoteyError::Database(inner);
        let val = serde_json::to_value(&err).unwrap();
        assert_eq!(val["type"], "Database");
        // Inner error is #[serde(skip)] so no message field
        assert!(val.get("message").is_none());
    }

    #[test]
    fn test_io_skips_inner_error() {
        let inner = std::io::Error::new(std::io::ErrorKind::NotFound, "gone");
        let err = NoteyError::Io(inner);
        let val = serde_json::to_value(&err).unwrap();
        assert_eq!(val["type"], "Io");
        assert!(val.get("message").is_none());
    }
}
