//! `notey` CLI — Story 6.1 red-phase ATDD scaffold.
//!
//! This crate is a **standalone binary** (`notey`) that will talk to the running
//! desktop app over a local IPC socket. Per Story 6.1 **AC6** it shares **no
//! code** with `src-tauri/`; the IPC protocol types are duplicated here as
//! simple JSON structs (see [`CliRequest`] / [`CliResponse`]).
//!
//! ## ATDD status (TDD RED phase)
//! Every *behavioural* function below is a `todo!()` stub. The acceptance tests
//! in `tests/cli_atdd.rs` are marked `#[ignore]` (the Rust analogue of
//! `test.skip()`); a developer removes `#[ignore]` task-by-task and replaces the
//! matching `todo!()` to drive each scenario from RED → GREEN.
//!
//! The protocol *data* types ([`CliRequest`] / [`CliResponse`]) are implemented,
//! because AC6 defines them as the duplicated wire contract — `6.1-UNIT-004`
//! pins their shape against silent drift from the `src-tauri` serde structs.

use std::ffi::OsString;

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

/// Build the `clap` command tree (subcommands `add` / `list` / `search`).
/// Exposed for `--help` rendering and introspection tests (`6.1-UNIT-001`).
///
/// RED phase: not implemented.
pub fn cli_command() -> clap::Command {
    todo!("Story 6.1 (6.1-UNIT-001): define clap command with add/list/search subcommands")
}

/// Parse raw CLI arguments (including `argv[0]`) into a [`Command`] (AC2–AC5).
///
/// RED phase: not implemented.
pub fn parse_args<I, T>(args: I) -> Result<Command, CliError>
where
    I: IntoIterator<Item = T>,
    T: Into<OsString> + Clone,
{
    let _ = args;
    todo!("Story 6.1 (6.1-UNIT-001): parse args via clap into Command")
}

/// Validate note content from argv or stdin: enforce the 1 MiB cap and reject
/// NUL / disallowed control characters (tab, newline and carriage return are
/// allowed). RISK-E6-001 mitigation (`6.1-UNIT-002`).
///
/// RED phase: not implemented.
pub fn validate_content(content: &[u8]) -> Result<(), CliError> {
    let _ = content;
    todo!("Story 6.1 (6.1-UNIT-002): enforce 1MiB cap + reject control/NUL chars")
}

/// Validate a `--workspace` name: reject path traversal, path separators, NUL
/// and other injection vectors. RISK-E6-001 mitigation (`6.1-UNIT-002`).
///
/// RED phase: not implemented.
pub fn validate_workspace(name: &str) -> Result<(), CliError> {
    let _ = name;
    todo!("Story 6.1 (6.1-UNIT-002): reject path traversal / separators in workspace name")
}

/// Map a terminal [`CommandOutcome`] to a process exit code (`0` / `1` / `2`).
/// Scripting contract (`6.1-UNIT-003`, RISK-E6-005).
///
/// RED phase: not implemented.
pub fn exit_code_for(outcome: &CommandOutcome) -> i32 {
    let _ = outcome;
    todo!("Story 6.1 (6.1-UNIT-003): map outcome to exit code 0/1/2")
}

/// Top-level entrypoint used by `main`: parse → validate → IPC → exit code.
/// Returns the process exit code.
///
/// RED phase: not implemented.
pub fn run<I, T>(args: I) -> i32
where
    I: IntoIterator<Item = T>,
    T: Into<OsString> + Clone,
{
    let _ = args;
    todo!("Story 6.1+: wire parse -> validate -> IPC client -> exit code")
}
