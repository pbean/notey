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
