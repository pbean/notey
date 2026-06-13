//! `notey` CLI — terminal-native note capture, listing, and search.
//!
//! This crate is a **standalone binary** (`notey`) that talks to the running
//! desktop app over a local IPC socket. Per Story 6.1 **AC6** it shares **no
//! code** with `src-tauri/`; the IPC protocol types are duplicated here as
//! simple JSON structs (see [`CliRequest`] / [`CliResponse`]) and the socket
//! transport is duplicated in [`mod@client`].
//!
//! ## Story scope
//! Story 6.1 delivered the crate scaffold, `clap` argument parsing, input
//! validation ([`validate_content`] / [`validate_workspace`]), and exit-code
//! mapping ([`exit_code_for`]). Story 6.3 wires the `add` command end-to-end:
//! [`run`] collects content (argv or stdin), validates it, attaches the
//! auto-detected workspace, and round-trips a `create_note` request to the app.
//! `list` / `search` parse and validate but remain deferred to Stories 6.4 / 6.5.

use std::{
    ffi::OsString,
    io::{self, IsTerminal, Read},
};

use clap::{CommandFactory, Parser, Subcommand, ValueEnum};
use serde::{Deserialize, Serialize};

mod client;

/// Maximum accepted note-content size: 1 MiB. Content **at** this size is
/// accepted; one byte more is rejected (Story 6.1 / RISK-E6-001).
pub const MAX_CONTENT_BYTES: usize = 1024 * 1024;

/// Output format for a new note. Defaults to [`Format::Markdown`] (AC3).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Format {
    /// Markdown — the default when `--format` is omitted.
    #[default]
    Markdown,
    /// Plain text.
    Plaintext,
}

/// A fully-parsed CLI invocation, produced by [`parse_args`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Command {
    /// `notey add <TEXT> [--stdin] [--format <markdown|plaintext>]` (AC3).
    Add {
        /// Positional note content (`None` when `--stdin` supplies it).
        text: Option<String>,
        /// Read note content from stdin instead of the positional argument.
        stdin: bool,
        /// Note format; defaults to [`Format::Markdown`].
        format: Format,
    },
    /// `notey list [--workspace <name>]` (AC4).
    List {
        /// Optional workspace filter.
        workspace: Option<String>,
    },
    /// `notey search <QUERY> [--workspace <name>]` (AC5).
    Search {
        /// Positional search query.
        query: String,
        /// Optional workspace filter.
        workspace: Option<String>,
    },
}

/// Errors surfaced by the CLI. The variant feeds [`CommandOutcome`] which
/// determines the process exit code via [`exit_code_for`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CliError {
    /// Argument parsing failed (unknown subcommand, missing positional,
    /// invalid `--format`, etc.).
    Parse(String),
    /// Content exceeded [`MAX_CONTENT_BYTES`].
    ContentTooLarge,
    /// Content contained disallowed control / NUL characters.
    InvalidContent,
    /// `--workspace` value failed validation (e.g. path traversal).
    InvalidWorkspace,
}

/// Terminal outcome of running a command, mapped to a process exit code
/// (`6.1-UNIT-003`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CommandOutcome {
    /// Command succeeded → exit code `0`.
    Success,
    /// Desktop app returned an error response → exit code `1`.
    AppError(String),
    /// Desktop app is not running / socket refused → exit code `2`.
    NotRunning,
    /// Request timed out → exit code `2`.
    Timeout,
}

/// Duplicated IPC **request** envelope (AC6). Mirrors the app-side serde struct
/// without sharing code. Field casing is pinned by `6.1-UNIT-004`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CliRequest {
    /// Action verb, e.g. `"add"` / `"list"` / `"search"`.
    pub action: String,
    /// Action-specific payload.
    pub payload: serde_json::Value,
}

/// Duplicated IPC **response** envelope (AC6). Mirrors the app-side serde struct
/// without sharing code. Field casing is pinned by `6.1-UNIT-004`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CliResponse {
    /// Whether the action succeeded.
    pub success: bool,
    /// Success payload, when present.
    pub data: Option<serde_json::Value>,
    /// Error message, when `success` is `false`.
    pub error: Option<String>,
}

// ───────────────────────────────────────────────────────────────────────────
// Private clap derive layer. The public `Command` enum is the tested contract;
// these derive types exist only to drive `clap` and are mapped onto `Command`.
// ───────────────────────────────────────────────────────────────────────────

/// Top-level clap parser. Kept private — callers use [`parse_args`] / [`run`].
#[derive(Parser)]
#[command(
    name = "notey",
    about = "Terminal-native notes for Notey",
    version,
    disable_help_subcommand = true
)]
struct Cli {
    #[command(subcommand)]
    command: CliSub,
}

/// clap subcommand tree mirroring [`Command`].
#[derive(Subcommand)]
enum CliSub {
    /// Create a note from `<TEXT>` or stdin.
    Add {
        /// Positional note content; omit when using `--stdin`.
        text: Option<String>,
        /// Read note content from stdin until EOF.
        #[arg(long)]
        stdin: bool,
        /// Note format (default `markdown`).
        #[arg(long, value_enum, default_value = "markdown")]
        format: FormatArg,
    },
    /// List notes, optionally filtered by workspace.
    List {
        /// Optional workspace filter.
        #[arg(long)]
        workspace: Option<String>,
    },
    /// Full-text search notes, optionally filtered by workspace.
    Search {
        /// Search query.
        query: String,
        /// Optional workspace filter.
        #[arg(long)]
        workspace: Option<String>,
    },
}

/// clap-facing format value-enum, converted into the public [`Format`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
enum FormatArg {
    Markdown,
    Plaintext,
}

impl From<FormatArg> for Format {
    fn from(value: FormatArg) -> Self {
        match value {
            FormatArg::Markdown => Format::Markdown,
            FormatArg::Plaintext => Format::Plaintext,
        }
    }
}

/// Build the `clap` command tree (subcommands `add` / `list` / `search`).
/// Exposed for `--help` rendering and introspection tests (`6.1-UNIT-001`).
pub fn cli_command() -> clap::Command {
    Cli::command()
}

/// Parse raw CLI arguments (including `argv[0]`) into a [`Command`] (AC2–AC5).
///
/// All `clap` failures (unknown subcommand, missing positional, invalid
/// `--format`, `--help`/`--version` requests) map to [`CliError::Parse`].
/// `add` additionally requires either `<TEXT>` or `--stdin`.
pub fn parse_args<I, T>(args: I) -> Result<Command, CliError>
where
    I: IntoIterator<Item = T>,
    T: Into<OsString> + Clone,
{
    let cli = Cli::try_parse_from(args).map_err(|e| CliError::Parse(e.to_string()))?;
    command_from_subcommand(cli.command)
}

/// True for C0 control bytes (and DEL) that are NOT permitted in note content.
/// Tab (`0x09`), newline (`0x0A`) and carriage return (`0x0D`) are allowed.
fn is_disallowed_control(byte: u8) -> bool {
    (byte < 0x20 && !matches!(byte, b'\t' | b'\n' | b'\r')) || byte == 0x7F
}

/// Validate note content from argv or stdin: enforce the 1 MiB cap and reject
/// NUL / disallowed control characters (tab, newline and carriage return are
/// allowed). RISK-E6-001 mitigation (`6.1-UNIT-002`).
pub fn validate_content(content: &[u8]) -> Result<(), CliError> {
    if content.len() > MAX_CONTENT_BYTES {
        return Err(CliError::ContentTooLarge);
    }
    if content.iter().copied().any(is_disallowed_control) {
        return Err(CliError::InvalidContent);
    }
    Ok(())
}

/// Validate a `--workspace` name: reject path traversal, path separators, NUL
/// and other injection vectors. RISK-E6-001 mitigation (`6.1-UNIT-002`).
///
/// A valid workspace name is a single, non-empty path component: no separators
/// (`/` or `\`), no `.` / `..` traversal, no absolute paths, no NUL or control
/// characters.
pub fn validate_workspace(name: &str) -> Result<(), CliError> {
    let invalid = name.is_empty()
        || name == "."
        || name == ".."
        || name.contains("..")
        || name.contains('/')
        || name.contains('\\')
        || name.bytes().any(|b| b == 0 || b.is_ascii_control());

    if invalid {
        Err(CliError::InvalidWorkspace)
    } else {
        Ok(())
    }
}

/// Map a terminal [`CommandOutcome`] to a process exit code (`0` / `1` / `2`).
/// Scripting contract (`6.1-UNIT-003`, RISK-E6-005).
pub fn exit_code_for(outcome: &CommandOutcome) -> i32 {
    match outcome {
        CommandOutcome::Success => 0,
        CommandOutcome::AppError(_) => 1,
        CommandOutcome::NotRunning | CommandOutcome::Timeout => 2,
    }
}

/// Top-level entrypoint used by `main`: parse → validate → IPC → exit code.
/// Returns the process exit code.
///
/// `--help` / `--version` / usage errors keep clap's convention (stdout + exit 0,
/// or stderr + exit 2). `add` (Story 6.3) collects its content once, validates it,
/// attaches the auto-detected workspace, and round-trips a `create_note` request
/// to the desktop app over the IPC socket. `list` / `search` parse and validate
/// but remain deferred to Stories 6.4 / 6.5, so they report the app as unreachable.
pub fn run<I, T>(args: I) -> i32
where
    I: IntoIterator<Item = T>,
    T: Into<OsString> + Clone,
{
    // Parse via clap directly so `--help` / `--version` print to stdout and exit
    // 0, while usage errors print to stderr and exit 2 (clap's convention).
    let cli = match Cli::try_parse_from(args) {
        Ok(cli) => cli,
        Err(err) => {
            let _ = err.print();
            return match err.kind() {
                clap::error::ErrorKind::DisplayHelp
                | clap::error::ErrorKind::DisplayVersion
                | clap::error::ErrorKind::DisplayHelpOnMissingArgumentOrSubcommand => 0,
                _ => 2,
            };
        }
    };

    let stderr_tty = io::stderr().is_terminal();

    let command = match command_from_subcommand(cli.command) {
        Ok(command) => command,
        Err(CliError::Parse(message)) => {
            eprintln!("{}", error_line(&message, stderr_tty));
            return 2;
        }
        Err(other) => unreachable!("unexpected parse-stage error: {other:?}"),
    };

    let outcome = match command {
        Command::Add {
            text,
            stdin,
            format,
        } => match prepare_add(text, stdin, format) {
            Ok(request) => dispatch(request),
            Err(RunValidationError::Usage(message)) => {
                eprintln!("{}", error_line(&message, stderr_tty));
                return 2;
            }
            Err(RunValidationError::Io(message)) => {
                eprintln!("{}", error_line(&message, stderr_tty));
                return 1;
            }
        },
        // `list` / `search` validate their workspace then stop short of dispatch —
        // their output/formatting lands in Stories 6.4 / 6.5.
        list_or_search => {
            if let Err(err) = validate_non_add_workspace(&list_or_search) {
                return match err {
                    RunValidationError::Usage(message) => {
                        eprintln!("{}", error_line(&message, stderr_tty));
                        2
                    }
                    RunValidationError::Io(message) => {
                        eprintln!("{}", error_line(&message, stderr_tty));
                        1
                    }
                };
            }
            CommandOutcome::NotRunning
        }
    };

    emit_outcome(&outcome)
}

/// Internal validation errors surfaced by [`run`] before any IPC happens.
#[derive(Debug, PartialEq, Eq)]
enum RunValidationError {
    /// Invalid CLI usage or user-provided input.
    Usage(String),
    /// Local runtime failure while collecting input.
    Io(String),
}

/// Collect, validate, and package an `add` command's content into a `create_note`
/// IPC request. Stdin is read exactly once (it is not re-readable), so this both
/// validates and captures the bytes for the wire payload.
fn prepare_add(
    text: Option<String>,
    stdin: bool,
    format: Format,
) -> Result<CliRequest, RunValidationError> {
    let bytes = match (text, stdin) {
        (Some(text), false) => text.into_bytes(),
        (None, true) => read_stdin_bytes()
            .map_err(|err| RunValidationError::Io(format!("failed to read stdin: {err}")))?,
        _ => unreachable!("input-source conflict should be rejected during parse"),
    };

    validate_content(&bytes).map_err(map_content_validation_error)?;

    // The payload is JSON, whose strings are UTF-8; reject non-UTF-8 content as a
    // usage error rather than corrupting the request.
    let content = String::from_utf8(bytes)
        .map_err(|_| RunValidationError::Usage("note content must be valid UTF-8".to_string()))?;

    Ok(build_create_request(content, format, current_workspace_path()))
}

/// Build the `create_note` request envelope. The wire action verb is
/// `create_note` (the server dispatcher's name), not `add`; the payload is
/// camelCase to match `src-tauri`'s `CreateNotePayload`.
fn build_create_request(
    content: String,
    format: Format,
    workspace_path: Option<String>,
) -> CliRequest {
    let mut payload = serde_json::json!({
        "content": content,
        "format": format_wire_value(format),
    });
    if let Some(path) = workspace_path {
        payload["workspacePath"] = serde_json::Value::String(path);
    }
    CliRequest {
        action: "create_note".to_string(),
        payload,
    }
}

/// Wire form of [`Format`] expected by the server payload.
fn format_wire_value(format: Format) -> &'static str {
    match format {
        Format::Markdown => "markdown",
        Format::Plaintext => "plaintext",
    }
}

/// The canonicalized current working directory, sent as `workspacePath` so the
/// server resolves/dedups the workspace with the SAME Epic-2 git-detection logic
/// the GUI uses (RISK-E6-006 mitigated by delegation). Returns `None` — omitting
/// the field — if the directory cannot be determined or is not valid UTF-8;
/// `add` never fails over workspace detection.
fn current_workspace_path() -> Option<String> {
    let cwd = std::env::current_dir().ok()?;
    let resolved = std::fs::canonicalize(cwd).ok()?;
    resolved.into_os_string().into_string().ok()
}

/// Dispatch a prepared request to the desktop app and fold the result into a
/// terminal [`CommandOutcome`].
fn dispatch(request: CliRequest) -> CommandOutcome {
    match client::send_request(&request) {
        Ok(response) if response.success => CommandOutcome::Success,
        Ok(response) => {
            CommandOutcome::AppError(response.error.unwrap_or_else(|| "unknown error".to_string()))
        }
        Err(client::ClientError::NotRunning) => CommandOutcome::NotRunning,
        Err(other) => CommandOutcome::AppError(other.to_string()),
    }
}

/// Print the user-facing line for an outcome (TTY-aware) and return its exit code.
fn emit_outcome(outcome: &CommandOutcome) -> i32 {
    match outcome {
        CommandOutcome::Success => {
            println!("{}", success_line("Note created", io::stdout().is_terminal()));
        }
        CommandOutcome::AppError(message) => {
            eprintln!("{}", error_line(message, io::stderr().is_terminal()));
        }
        CommandOutcome::NotRunning => {
            eprintln!(
                "{}",
                error_line(
                    "Notey is not running. Start the application first.",
                    io::stderr().is_terminal(),
                )
            );
        }
        CommandOutcome::Timeout => {
            eprintln!(
                "{}",
                error_line("Notey did not respond in time.", io::stderr().is_terminal())
            );
        }
    }
    exit_code_for(outcome)
}

/// Format a success line. On a TTY the `✓` glyph is ANSI green; when piped the
/// line is plain text with no escape codes (UX-DR60 / UX-DR61).
fn success_line(message: &str, is_terminal: bool) -> String {
    if is_terminal {
        format!("\u{1b}[32m\u{2713}\u{1b}[0m {message}")
    } else {
        format!("\u{2713} {message}")
    }
}

/// Format an error line. On a TTY the `✕` glyph is ANSI red; when piped the line
/// is plain text with no escape codes (UX-DR60 / UX-DR61).
fn error_line(message: &str, is_terminal: bool) -> String {
    if is_terminal {
        format!("\u{1b}[31m\u{2717}\u{1b}[0m {message}")
    } else {
        format!("\u{2717} {message}")
    }
}

/// Convert a parsed clap subcommand to the public [`Command`] contract.
fn command_from_subcommand(sub: CliSub) -> Result<Command, CliError> {
    match sub {
        CliSub::Add {
            text,
            stdin,
            format,
        } => {
            if text.is_none() && !stdin {
                return Err(CliError::Parse(
                    "add requires <TEXT> or --stdin".to_string(),
                ));
            }
            if text.is_some() && stdin {
                return Err(CliError::Parse(
                    "cannot combine <TEXT> and --stdin".to_string(),
                ));
            }
            Ok(Command::Add {
                text,
                stdin,
                format: format.into(),
            })
        }
        CliSub::List { workspace } => Ok(Command::List { workspace }),
        CliSub::Search { query, workspace } => Ok(Command::Search { query, workspace }),
    }
}

/// Validate the optional `--workspace` of a `list` / `search` command. `add` is
/// handled by [`prepare_add`]; this never sees it.
fn validate_non_add_workspace(command: &Command) -> Result<(), RunValidationError> {
    match command {
        Command::List {
            workspace: Some(workspace),
        }
        | Command::Search {
            workspace: Some(workspace),
            ..
        } => validate_workspace(workspace)
            .map_err(|_| RunValidationError::Usage(format!("invalid workspace name: {workspace}"))),
        _ => Ok(()),
    }
}

fn map_content_validation_error(error: CliError) -> RunValidationError {
    match error {
        CliError::ContentTooLarge => {
            RunValidationError::Usage("note content exceeds the 1 MiB limit".to_string())
        }
        CliError::InvalidContent => RunValidationError::Usage(
            "note content contains unsupported control characters".to_string(),
        ),
        other => unreachable!("unexpected content-validation error: {other:?}"),
    }
}

fn read_stdin_bytes() -> io::Result<Vec<u8>> {
    read_bytes_capped(&mut io::stdin().lock(), MAX_CONTENT_BYTES)
}

/// Read at most `max_bytes + 1` bytes so oversized stdin is rejected without
/// buffering an unbounded stream into memory first.
fn read_bytes_capped(reader: &mut impl Read, max_bytes: usize) -> io::Result<Vec<u8>> {
    let mut bytes = Vec::new();
    let mut chunk = [0u8; 8192];

    loop {
        let remaining = max_bytes.saturating_add(1).saturating_sub(bytes.len());
        if remaining == 0 {
            break;
        }

        let read_cap = chunk.len().min(remaining);
        let read_len = reader.read(&mut chunk[..read_cap])?;
        if read_len == 0 {
            break;
        }

        bytes.extend_from_slice(&chunk[..read_len]);
    }

    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── 6.3-UNIT-001 — TTY-aware output (UX-DR60 / UX-DR61) ──────────────────

    #[test]
    fn success_line_is_plain_when_piped() {
        let line = success_line("Note created", false);
        assert_eq!(line, "\u{2713} Note created");
        assert!(
            !line.contains('\u{1b}'),
            "piped success line must carry no ANSI escape"
        );
    }

    #[test]
    fn success_line_is_green_on_tty() {
        let line = success_line("Note created", true);
        assert!(line.starts_with("\u{1b}[32m"), "TTY success uses green");
        assert!(line.contains("\u{1b}[0m"), "TTY success resets color");
        assert!(line.ends_with("Note created"));
    }

    #[test]
    fn error_line_is_plain_when_piped() {
        let line = error_line("boom", false);
        assert_eq!(line, "\u{2717} boom");
        assert!(!line.contains('\u{1b}'));
    }

    #[test]
    fn error_line_is_red_on_tty() {
        let line = error_line("boom", true);
        assert!(line.starts_with("\u{1b}[31m"), "TTY error uses red");
        assert!(line.contains("\u{1b}[0m"));
    }

    // ── create_note request builder (wire-shape pin for Story 6.3) ───────────

    #[test]
    fn build_create_request_uses_create_note_action_and_camelcase_payload() {
        let req = build_create_request(
            "hello".to_string(),
            Format::Markdown,
            Some("/home/me/proj".to_string()),
        );
        assert_eq!(req.action, "create_note");
        assert_eq!(req.payload["content"], serde_json::json!("hello"));
        assert_eq!(req.payload["format"], serde_json::json!("markdown"));
        assert_eq!(
            req.payload["workspacePath"],
            serde_json::json!("/home/me/proj")
        );
    }

    #[test]
    fn build_create_request_omits_workspace_when_absent() {
        let req = build_create_request("x".to_string(), Format::Plaintext, None);
        assert_eq!(req.payload["format"], serde_json::json!("plaintext"));
        assert!(
            req.payload.get("workspacePath").is_none(),
            "absent workspace must not appear in the payload"
        );
    }

    #[test]
    fn format_wire_value_maps_both_variants() {
        assert_eq!(format_wire_value(Format::Markdown), "markdown");
        assert_eq!(format_wire_value(Format::Plaintext), "plaintext");
    }

    #[test]
    fn current_workspace_path_omits_uncanonicalizable_dirs() {
        let path = missing_temp_dir_path();
        std::fs::create_dir_all(&path).expect("create temp dir");
        std::fs::remove_dir_all(&path).expect("remove temp dir");

        let resolved = std::fs::canonicalize(&path).ok();
        assert!(resolved.is_none(), "test path should no longer canonicalize");
        assert!(
            workspace_path_from_cwd(path).is_none(),
            "uncanonicalizable cwd must omit workspacePath"
        );
    }

    #[test]
    fn read_bytes_capped_stops_one_byte_past_the_limit() {
        let input = vec![b'a'; MAX_CONTENT_BYTES + 1024];
        let mut cursor = io::Cursor::new(input);
        let bytes = read_bytes_capped(&mut cursor, MAX_CONTENT_BYTES).expect("read capped bytes");

        assert_eq!(bytes.len(), MAX_CONTENT_BYTES + 1);
    }

    // ── outcome → exit code wiring ───────────────────────────────────────────

    #[test]
    fn emit_outcome_returns_canonical_exit_codes() {
        assert_eq!(emit_outcome(&CommandOutcome::Success), 0);
        assert_eq!(emit_outcome(&CommandOutcome::AppError("e".into())), 1);
        assert_eq!(emit_outcome(&CommandOutcome::NotRunning), 2);
        assert_eq!(emit_outcome(&CommandOutcome::Timeout), 2);
    }

    fn workspace_path_from_cwd(cwd: std::path::PathBuf) -> Option<String> {
        let resolved = std::fs::canonicalize(cwd).ok()?;
        resolved.into_os_string().into_string().ok()
    }

    fn missing_temp_dir_path() -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "notey-cli-missing-cwd-{}",
            std::process::id()
        ))
    }
}
