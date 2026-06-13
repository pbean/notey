//! `notey` CLI — Story 6.1 implementation (scaffold, argument parsing, validation).
//!
//! This crate is a **standalone binary** (`notey`) that will talk to the running
//! desktop app over a local IPC socket. Per Story 6.1 **AC6** it shares **no
//! code** with `src-tauri/`; the IPC protocol types are duplicated here as
//! simple JSON structs (see [`CliRequest`] / [`CliResponse`]).
//!
//! ## Story scope
//! Story 6.1 owns the crate scaffold, `clap` argument parsing, input validation
//! ([`validate_content`] / [`validate_workspace`]), and exit-code mapping
//! ([`exit_code_for`]). The actual IPC round-trip in [`run`] is deferred to
//! Story 6.2 (the `interprocess` socket client); until then [`run`] parses and
//! validates, then reports that the desktop connection is unavailable.

use std::{
    ffi::OsString,
    io::{self, Read},
};

use clap::{CommandFactory, Parser, Subcommand, ValueEnum};
use serde::{Deserialize, Serialize};

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

/// Top-level entrypoint used by `main`: parse → validate → (IPC, Story 6.2) →
/// exit code. Returns the process exit code.
///
/// Story 6.1 implements parsing, validation, and `--help`/`--version`/usage
/// exit-code plumbing. The IPC dispatch is deferred to Story 6.2; once a command
/// parses and validates, this prints an actionable stderr message and returns
/// the [`CommandOutcome::NotRunning`] code, since no socket client exists yet.
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

    let command = match command_from_subcommand(cli.command) {
        Ok(command) => command,
        Err(CliError::Parse(message)) => {
            eprintln!("✕ {message}");
            return 2;
        }
        Err(other) => unreachable!("unexpected parse-stage error: {other:?}"),
    };

    match validate_command_for_run(&command) {
        Ok(()) => {}
        Err(RunValidationError::Usage(message)) => {
            eprintln!("✕ {message}");
            return 2;
        }
        Err(RunValidationError::Io(message)) => {
            eprintln!("✕ {message}");
            return 1;
        }
    }

    // IPC dispatch arrives in Story 6.2. Until then, the CLI cannot reach the
    // desktop app.
    eprintln!("✕ Notey is not running. Start the application first.");
    exit_code_for(&CommandOutcome::NotRunning)
}

/// Internal validation errors surfaced by [`run`] before any IPC happens.
#[derive(Debug, PartialEq, Eq)]
enum RunValidationError {
    /// Invalid CLI usage or user-provided input.
    Usage(String),
    /// Local runtime failure while collecting input.
    Io(String),
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

/// Apply the Story 6.1 validation contract to a parsed command.
fn validate_command_for_run(command: &Command) -> Result<(), RunValidationError> {
    match command {
        Command::Add {
            text: Some(text),
            stdin: false,
            ..
        } => validate_content(text.as_bytes()).map_err(map_content_validation_error),
        Command::Add {
            text: None,
            stdin: true,
            ..
        } => {
            let bytes = read_stdin_bytes()
                .map_err(|err| RunValidationError::Io(format!("failed to read stdin: {err}")))?;
            validate_content(&bytes).map_err(map_content_validation_error)
        }
        Command::Add { .. } => {
            unreachable!("input-source conflict should be rejected during parse")
        }
        Command::List {
            workspace: Some(workspace),
        }
        | Command::Search {
            workspace: Some(workspace),
            ..
        } => validate_workspace(workspace)
            .map_err(|_| RunValidationError::Usage(format!("invalid workspace name: {workspace}"))),
        Command::List { workspace: None }
        | Command::Search {
            workspace: None, ..
        } => Ok(()),
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
    let mut bytes = Vec::new();
    io::stdin().lock().read_to_end(&mut bytes)?;
    Ok(bytes)
}
