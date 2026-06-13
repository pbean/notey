//! Markdown export service.
//!
//! Streams every active (non-trashed) note to an individual `.md` file in a
//! caller-supplied directory, each with YAML frontmatter followed by the note
//! body. This module has no Tauri dependency so it is unit-testable with a
//! temporary directory and an in-memory database.

use std::collections::HashSet;
use std::path::Path;

use rusqlite::Connection;

use crate::errors::NoteyError;

/// Maximum length (in `char`s) of the title-derived filename stem, leaving
/// headroom for a dedup suffix and the `.md` extension.
const MAX_FILENAME_STEM_LEN: usize = 200;
/// Common cross-platform filename byte limit for a single path segment.
const MAX_FILENAME_BYTES: usize = 255;
/// Exported notes are always written as Markdown files.
const MARKDOWN_EXTENSION: &str = ".md";

/// Characters that are illegal or unsafe in filenames across Windows, macOS,
/// and Linux. Path separators are included so a title can never escape the
/// target directory.
const RESERVED_FILENAME_CHARS: &[char] = &['/', '\\', ':', '*', '?', '"', '<', '>', '|'];

/// Windows reserved device names. A file named exactly one of these (any case)
/// is invalid on Windows, so the stem is prefixed with `_`.
const WINDOWS_RESERVED_NAMES: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// Export every active (non-trashed) note as an individual Markdown file into
/// `dir`.
///
/// Each file contains YAML frontmatter (`title`, `created_at`, `updated_at`,
/// `workspace`, `format`) followed by a blank line and the note body. Filenames
/// derive from note titles, sanitized for filesystem safety and de-duplicated
/// so no note silently overwrites another. Notes are streamed one row at a time
/// so peak memory stays bounded for very large exports; the workspace name is
/// pulled in the same query via a `LEFT JOIN`. `progress(done, total)` is
/// invoked after each file is written.
///
/// Returns the number of files written. `dir` must already exist and is the
/// caller's responsibility to confine to a user-granted location — because each
/// filename is a single path segment with no separators, writes can never
/// escape `dir`.
pub fn export_markdown_to_dir(
    conn: &Connection,
    dir: &Path,
    mut progress: impl FnMut(usize, usize),
) -> Result<usize, NoteyError> {
    // Count up front so progress callbacks report against a stable total.
    let total: usize = conn.query_row(
        "SELECT COUNT(*) FROM notes WHERE is_trashed = 0",
        [],
        |row| row.get::<_, i64>(0),
    )? as usize;
    if total > 0 {
        progress(0, total);
    }

    let mut stmt = conn.prepare(
        "SELECT n.title, n.content, n.format, n.created_at, n.updated_at, COALESCE(w.name, '')
         FROM notes n
         LEFT JOIN workspaces w ON w.id = n.workspace_id
         WHERE n.is_trashed = 0
         ORDER BY n.updated_at DESC",
    )?;

    let mut used = existing_filenames(dir)?;
    let mut rows = stmt.query([])?;
    let mut done = 0usize;

    while let Some(row) = rows.next()? {
        let title: String = row.get(0)?;
        let content: String = row.get(1)?;
        let format: String = row.get(2)?;
        let created_at: String = row.get(3)?;
        let updated_at: String = row.get(4)?;
        let workspace: String = row.get(5)?;

        let stem = sanitize_filename(&title);
        let filename = dedup_filename(&stem, &mut used);

        let mut file_body =
            build_frontmatter(&title, &created_at, &updated_at, &workspace, &format);
        // Frontmatter ends with "---\n"; a blank line separates it from the body.
        file_body.push('\n');
        file_body.push_str(&content);
        if !file_body.ends_with('\n') {
            file_body.push('\n');
        }

        std::fs::write(dir.join(&filename), file_body)?;

        done += 1;
        progress(done, total);
    }

    Ok(done)
}

/// Derive a filesystem-safe, single-segment filename stem from a note title.
///
/// Reserved characters and control chars become spaces, runs of whitespace
/// collapse to one, leading/trailing dots and spaces are trimmed (illegal or
/// awkward on Windows), the length is capped, an empty result falls back to
/// `untitled`, and Windows reserved device names are prefixed with `_`. The
/// result never contains a path separator, so callers can safely join it onto
/// the export directory.
fn sanitize_filename(title: &str) -> String {
    let mut out = String::with_capacity(title.len());
    let mut prev_was_space = false;
    let mut prev_was_dot = false;
    for ch in title.chars() {
        let safe = if RESERVED_FILENAME_CHARS.contains(&ch) || ch.is_control() || ch.is_whitespace()
        {
            ' '
        } else {
            ch
        };
        if safe == ' ' {
            if !prev_was_space {
                out.push(' ');
            }
            prev_was_space = true;
            prev_was_dot = false;
        } else if safe == '.' {
            if !prev_was_dot {
                out.push('.');
            }
            prev_was_space = false;
            prev_was_dot = true;
        } else {
            out.push(safe);
            prev_was_space = false;
            prev_was_dot = false;
        }
    }

    // Trim, cap length, then re-trim in case truncation left a trailing space/dot.
    let mut stem: String = out
        .trim_matches(is_trim_char)
        .chars()
        .take(MAX_FILENAME_STEM_LEN)
        .collect();
    stem = trim_filename_stem(&stem);

    if stem.is_empty() {
        return "untitled".to_string();
    }
    if is_windows_reserved_stem(&stem) {
        stem = format!("_{stem}");
        if stem.chars().count() > MAX_FILENAME_STEM_LEN {
            stem =
                trim_filename_stem(&stem.chars().take(MAX_FILENAME_STEM_LEN).collect::<String>());
        }
    }
    stem
}

/// Return a unique `<stem>.md` filename, appending ` (2)`, ` (3)`, … on
/// collision. Uniqueness is tracked case-insensitively so exports stay safe on
/// case-insensitive filesystems (macOS/Windows). The chosen name is recorded in
/// `used`.
fn dedup_filename(stem: &str, used: &mut HashSet<String>) -> String {
    let mut n = 1usize;
    loop {
        let suffix = if n == 1 {
            String::new()
        } else {
            format!(" ({n})")
        };
        let fitted_stem = fit_stem_to_filename_limits(stem, &suffix);
        let candidate = format!("{fitted_stem}{suffix}{MARKDOWN_EXTENSION}");
        let key = candidate.to_lowercase();
        if !used.contains(&key) {
            used.insert(key);
            return candidate;
        }
        n += 1;
    }
}

/// Escape a string for embedding inside a double-quoted YAML scalar.
fn yaml_escape(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for ch in value.chars() {
        match ch {
            '\\' => escaped.push_str("\\\\"),
            '"' => escaped.push_str("\\\""),
            '\n' => escaped.push_str("\\n"),
            '\r' => escaped.push_str("\\r"),
            '\t' => escaped.push_str("\\t"),
            c if c.is_control() => escaped.push_str(&format!("\\u{:04X}", c as u32)),
            c => escaped.push(c),
        }
    }
    escaped
}

fn existing_filenames(dir: &Path) -> Result<HashSet<String>, NoteyError> {
    let mut used = HashSet::new();
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        used.insert(entry.file_name().to_string_lossy().to_lowercase());
    }
    Ok(used)
}

fn fit_stem_to_filename_limits(stem: &str, suffix: &str) -> String {
    let max_stem_bytes = MAX_FILENAME_BYTES
        .saturating_sub(MARKDOWN_EXTENSION.len())
        .saturating_sub(suffix.len());

    let mut fitted = truncate_stem_to_bytes(stem, max_stem_bytes);
    if fitted.is_empty() {
        fitted = "untitled".to_string();
    }
    if is_windows_reserved_stem(&fitted) {
        fitted = truncate_stem_to_bytes(&format!("_{fitted}"), max_stem_bytes);
        if fitted.is_empty() {
            fitted = "_".to_string();
        }
    }
    fitted
}

fn truncate_stem_to_bytes(stem: &str, max_bytes: usize) -> String {
    let mut truncated = String::new();
    for ch in stem.chars() {
        if truncated.len() + ch.len_utf8() > max_bytes {
            break;
        }
        truncated.push(ch);
    }
    trim_filename_stem(&truncated)
}

fn trim_filename_stem(stem: &str) -> String {
    stem.trim_matches(is_trim_char).to_string()
}

fn is_trim_char(c: char) -> bool {
    c == ' ' || c == '.'
}

fn is_windows_reserved_stem(stem: &str) -> bool {
    let basename = stem.split('.').next().unwrap_or(stem);
    WINDOWS_RESERVED_NAMES
        .iter()
        .any(|reserved| reserved.eq_ignore_ascii_case(basename))
}

/// Build the YAML frontmatter block (including the surrounding `---` fences and
/// a trailing newline). All five keys are always present and every value is
/// double-quoted so titles or workspace names containing `:` or quotes remain
/// valid YAML.
fn build_frontmatter(
    title: &str,
    created_at: &str,
    updated_at: &str,
    workspace: &str,
    format: &str,
) -> String {
    format!(
        "---\ntitle: \"{}\"\ncreated_at: \"{}\"\nupdated_at: \"{}\"\nworkspace: \"{}\"\nformat: \"{}\"\n---\n",
        yaml_escape(title),
        yaml_escape(created_at),
        yaml_escape(updated_at),
        yaml_escape(workspace),
        yaml_escape(format),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::notes::{create_note, trash_note, update_note};
    use rusqlite::{params, Connection};
    use std::fs;
    use tempfile::tempdir;

    fn setup_test_db() -> Connection {
        let mut conn = Connection::open_in_memory().expect("failed to open in-memory db");
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA foreign_keys=ON;",
        )
        .expect("failed to set pragmas");
        crate::db::MIGRATIONS
            .to_latest(&mut conn)
            .expect("failed to run migrations");
        conn
    }

    /// Create a note with the given title/content (and optional workspace).
    fn make_note(conn: &Connection, title: &str, content: &str, workspace_id: Option<i64>) -> i64 {
        let note = create_note(conn, "markdown", workspace_id).expect("create_note failed");
        update_note(
            conn,
            note.id,
            Some(title.to_string()),
            Some(content.to_string()),
            None,
        )
        .expect("update_note failed");
        note.id
    }

    fn make_workspace(conn: &Connection, name: &str) -> i64 {
        conn.execute(
            "INSERT INTO workspaces (name, path, created_at) VALUES (?1, ?2, ?3)",
            params![name, format!("/tmp/{name}"), "2026-01-01T00:00:00+00:00"],
        )
        .expect("insert workspace failed");
        conn.last_insert_rowid()
    }

    #[test]
    fn test_exports_one_file_per_note_with_frontmatter_and_body() {
        let conn = setup_test_db();
        let ws = make_workspace(&conn, "notey");
        make_note(&conn, "My Note", "Hello world", Some(ws));
        let dir = tempdir().unwrap();

        let count = export_markdown_to_dir(&conn, dir.path(), |_, _| {}).expect("export failed");
        assert_eq!(count, 1);

        let contents = fs::read_to_string(dir.path().join("My Note.md")).expect("file missing");
        assert!(contents.contains("title: \"My Note\""));
        assert!(contents.contains("workspace: \"notey\""));
        assert!(contents.contains("format: \"markdown\""));
        assert!(contents.contains("created_at: \""));
        assert!(contents.contains("updated_at: \""));
        assert!(contents.ends_with("Hello world\n"));
        // Frontmatter is followed by a blank line before the body.
        assert!(contents.contains("---\n\nHello world"));
    }

    #[test]
    fn test_reserved_chars_in_title_produce_safe_single_segment_filename() {
        let conn = setup_test_db();
        make_note(&conn, "a/b:c?", "body", None);
        let dir = tempdir().unwrap();

        export_markdown_to_dir(&conn, dir.path(), |_, _| {}).expect("export failed");

        let entries: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(entries.len(), 1);
        let name = &entries[0];
        assert!(name.ends_with(".md"));
        // No path separators or reserved characters survived sanitization.
        for bad in ['/', '\\', ':', '?'] {
            assert!(!name.contains(bad), "filename {name} still contains {bad}");
        }
    }

    #[test]
    fn test_empty_title_falls_back_to_untitled() {
        let conn = setup_test_db();
        make_note(&conn, "   ", "body", None);
        let dir = tempdir().unwrap();

        export_markdown_to_dir(&conn, dir.path(), |_, _| {}).expect("export failed");
        assert!(dir.path().join("untitled.md").exists());
    }

    #[test]
    fn test_duplicate_titles_get_dedup_suffix_without_overwrite() {
        let conn = setup_test_db();
        make_note(&conn, "Notes", "first", None);
        make_note(&conn, "Notes", "second", None);
        let dir = tempdir().unwrap();

        let count = export_markdown_to_dir(&conn, dir.path(), |_, _| {}).expect("export failed");
        assert_eq!(count, 2);
        assert!(dir.path().join("Notes.md").exists());
        assert!(dir.path().join("Notes (2).md").exists());
    }

    #[test]
    fn test_existing_file_is_preserved_by_deduping_against_directory_contents() {
        let conn = setup_test_db();
        make_note(&conn, "Notes", "fresh export", None);
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("Notes.md"), "existing").expect("seed file failed");

        let count = export_markdown_to_dir(&conn, dir.path(), |_, _| {}).expect("export failed");
        assert_eq!(count, 1);
        assert_eq!(
            fs::read_to_string(dir.path().join("Notes.md")).unwrap(),
            "existing"
        );
        assert!(dir.path().join("Notes (2).md").exists());
    }

    #[test]
    fn test_note_without_workspace_emits_empty_workspace() {
        let conn = setup_test_db();
        make_note(&conn, "Loose", "body", None);
        let dir = tempdir().unwrap();

        export_markdown_to_dir(&conn, dir.path(), |_, _| {}).expect("export failed");
        let contents = fs::read_to_string(dir.path().join("Loose.md")).unwrap();
        assert!(contents.contains("workspace: \"\""));
    }

    #[test]
    fn test_yaml_special_chars_are_escaped() {
        let conn = setup_test_db();
        make_note(&conn, "He said: \"hi\"", "body", None);
        let dir = tempdir().unwrap();

        export_markdown_to_dir(&conn, dir.path(), |_, _| {}).expect("export failed");
        let entries: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .map(|e| e.unwrap().path())
            .collect();
        let contents = fs::read_to_string(&entries[0]).unwrap();
        // Quotes inside the title are backslash-escaped in the quoted scalar.
        assert!(contents.contains("title: \"He said: \\\"hi\\\"\""));
    }

    #[test]
    fn test_yaml_control_chars_are_escaped() {
        let conn = setup_test_db();
        let ws = make_workspace(&conn, "line1\nline2");
        make_note(&conn, "Title", "body", Some(ws));
        let dir = tempdir().unwrap();

        export_markdown_to_dir(&conn, dir.path(), |_, _| {}).expect("export failed");
        let contents = fs::read_to_string(dir.path().join("Title.md")).unwrap();
        assert!(contents.contains("workspace: \"line1\\nline2\""));
    }

    #[test]
    fn test_trashed_notes_are_excluded() {
        let conn = setup_test_db();
        make_note(&conn, "Active", "a", None);
        let trashed = make_note(&conn, "Trashed", "t", None);
        trash_note(&conn, trashed).expect("trash failed");
        let dir = tempdir().unwrap();

        let count = export_markdown_to_dir(&conn, dir.path(), |_, _| {}).expect("export failed");
        assert_eq!(count, 1);
        assert!(dir.path().join("Active.md").exists());
        assert!(!dir.path().join("Trashed.md").exists());
    }

    #[test]
    fn test_no_active_notes_returns_zero_and_writes_nothing() {
        let conn = setup_test_db();
        let dir = tempdir().unwrap();

        let count = export_markdown_to_dir(&conn, dir.path(), |_, _| {}).expect("export failed");
        assert_eq!(count, 0);
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 0);
    }

    #[test]
    fn test_progress_callback_reports_increasing_progress_to_total() {
        let conn = setup_test_db();
        make_note(&conn, "One", "1", None);
        make_note(&conn, "Two", "2", None);
        make_note(&conn, "Three", "3", None);
        let dir = tempdir().unwrap();

        let mut updates: Vec<(usize, usize)> = Vec::new();
        export_markdown_to_dir(&conn, dir.path(), |done, total| updates.push((done, total)))
            .expect("export failed");

        assert_eq!(updates, vec![(0, 3), (1, 3), (2, 3), (3, 3)]);
    }

    #[test]
    fn test_windows_reserved_name_is_prefixed() {
        assert_eq!(sanitize_filename("CON"), "_CON");
        assert_eq!(sanitize_filename("nul"), "_nul");
        assert_eq!(sanitize_filename("Notes"), "Notes");
    }

    #[test]
    fn test_windows_reserved_name_with_extension_is_prefixed() {
        let conn = setup_test_db();
        make_note(&conn, "CON.txt", "body", None);
        let dir = tempdir().unwrap();

        export_markdown_to_dir(&conn, dir.path(), |_, _| {}).expect("export failed");
        assert!(dir.path().join("_CON.txt.md").exists());
    }

    #[test]
    fn test_internal_dotdot_sequences_are_collapsed() {
        assert_eq!(sanitize_filename("safe..name"), "safe.name");
    }

    #[test]
    fn test_multibyte_titles_are_truncated_to_common_filename_byte_limit() {
        let conn = setup_test_db();
        make_note(&conn, &"界".repeat(200), "body", None);
        let dir = tempdir().unwrap();

        export_markdown_to_dir(&conn, dir.path(), |_, _| {}).expect("export failed");
        let entries: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(entries.len(), 1);
        assert!(entries[0].as_bytes().len() <= MAX_FILENAME_BYTES);
    }
}
