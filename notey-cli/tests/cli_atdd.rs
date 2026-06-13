//! ATDD red-phase acceptance tests for Story 6.1 — CLI Crate Scaffold & Argument Parsing.
//!
//! Every test is `#[ignore]` — the Rust analogue of `test.skip()`. They assert the
//! EXPECTED behaviour and currently FAIL (the `notey_cli` stubs `todo!()`), which is
//! the intended TDD **RED** state. During implementation, remove `#[ignore]` from the
//! scenario you are working on, watch it fail, implement the matching `todo!()`, then
//! watch it pass (GREEN).
//!
//! Scenario IDs trace to `_bmad-output/test-artifacts/test-design-epic-6.md`
//! (TEA refs: P0-UNIT-004 / 005 / 006, P0-INT-008).
//!
//! Run just these (to see they are skipped in red phase):
//!   cargo test -p notey-cli
//! Activate one during implementation:
//!   cargo test -p notey-cli -- --ignored add_parses_positional_text

use notey_cli::{
    cli_command, exit_code_for, parse_args, validate_content, validate_workspace, CliError,
    CliRequest, CliResponse, Command, CommandOutcome, Format, MAX_CONTENT_BYTES,
};
use std::{
    io::Write,
    process::{Command as ProcessCommand, Output, Stdio},
};

// ───────────────────────────────────────────────────────────────────────────
// 6.1-UNIT-001 — clap argument parsing (P0, AC1–AC5, RISK-E6-005)
// ───────────────────────────────────────────────────────────────────────────

#[test]
fn add_parses_positional_text() {
    let cmd = parse_args(["notey", "add", "hello world"]).expect("add <TEXT> should parse");
    assert_eq!(
        cmd,
        Command::Add {
            text: Some("hello world".to_string()),
            stdin: false,
            format: Format::Markdown,
        }
    );
}

#[test]
fn add_parses_stdin_flag() {
    let cmd = parse_args(["notey", "add", "--stdin"]).expect("add --stdin should parse");
    match cmd {
        Command::Add { stdin, .. } => assert!(stdin, "--stdin should set stdin=true"),
        other => panic!("expected Add, got {other:?}"),
    }
}

#[test]
fn add_format_defaults_to_markdown() {
    let cmd = parse_args(["notey", "add", "note"]).expect("should parse");
    match cmd {
        Command::Add { format, .. } => assert_eq!(format, Format::Markdown),
        other => panic!("expected Add, got {other:?}"),
    }
}

#[test]
fn add_format_plaintext_parses() {
    let cmd = parse_args(["notey", "add", "note", "--format", "plaintext"]).expect("should parse");
    match cmd {
        Command::Add { format, .. } => assert_eq!(format, Format::Plaintext),
        other => panic!("expected Add, got {other:?}"),
    }
}

#[test]
fn add_invalid_format_is_rejected() {
    let result = parse_args(["notey", "add", "note", "--format", "rtf"]);
    assert!(
        matches!(result, Err(CliError::Parse(_))),
        "invalid --format must be a parse error, got {result:?}"
    );
}

#[test]
fn list_parses_with_and_without_workspace() {
    assert_eq!(
        parse_args(["notey", "list"]).expect("list should parse"),
        Command::List { workspace: None }
    );
    assert_eq!(
        parse_args(["notey", "list", "--workspace", "notey"])
            .expect("list --workspace should parse"),
        Command::List {
            workspace: Some("notey".to_string())
        }
    );
}

#[test]
fn search_parses_query_and_workspace() {
    assert_eq!(
        parse_args(["notey", "search", "rust traits"]).expect("search <QUERY> should parse"),
        Command::Search {
            query: "rust traits".to_string(),
            workspace: None
        }
    );
    assert_eq!(
        parse_args(["notey", "search", "rust", "--workspace", "notey"])
            .expect("search --workspace should parse"),
        Command::Search {
            query: "rust".to_string(),
            workspace: Some("notey".to_string())
        }
    );
}

#[test]
fn search_without_query_is_rejected() {
    assert!(
        parse_args(["notey", "search"]).is_err(),
        "search with no query must error"
    );
}

#[test]
fn add_without_text_or_stdin_is_rejected() {
    assert!(
        parse_args(["notey", "add"]).is_err(),
        "add with neither <TEXT> nor --stdin must error"
    );
}

#[test]
fn add_with_text_and_stdin_is_rejected() {
    let result = parse_args(["notey", "add", "note", "--stdin"]);
    assert!(
        matches!(result, Err(CliError::Parse(_))),
        "add with both <TEXT> and --stdin must be a parse error, got {result:?}"
    );
}

#[test]
fn help_lists_three_subcommands() {
    let names: Vec<String> = cli_command()
        .get_subcommands()
        .map(|c| c.get_name().to_string())
        .collect();
    assert_eq!(names, vec!["add", "list", "search"]);
}

// ───────────────────────────────────────────────────────────────────────────
// 6.1-UNIT-002 — input validation (P0, RISK-E6-001 score 6 / NFR10) — security
// ───────────────────────────────────────────────────────────────────────────

#[test]
fn content_at_size_cap_is_accepted() {
    let content = vec![b'a'; MAX_CONTENT_BYTES];
    assert!(
        validate_content(&content).is_ok(),
        "exactly 1MiB must be accepted"
    );
}

#[test]
fn content_over_size_cap_is_rejected() {
    let content = vec![b'a'; MAX_CONTENT_BYTES + 1];
    assert_eq!(validate_content(&content), Err(CliError::ContentTooLarge));
}

#[test]
fn content_with_control_chars_is_rejected() {
    assert_eq!(
        validate_content(b"valid\0byte"),
        Err(CliError::InvalidContent),
        "NUL byte must be rejected"
    );
    assert_eq!(
        validate_content(b"bell\x07here"),
        Err(CliError::InvalidContent),
        "BEL control char must be rejected"
    );
}

#[test]
fn ordinary_content_passes_validation() {
    let content = "a normal markdown note\nwith newlines\tand tabs\r\n".as_bytes();
    assert!(
        validate_content(content).is_ok(),
        "tab/newline/CR must be allowed"
    );
}

#[test]
fn workspace_path_traversal_is_rejected() {
    for bad in ["../../etc/passwd", "..", "foo/bar", "/abs/path", "a\0b"] {
        assert_eq!(
            validate_workspace(bad),
            Err(CliError::InvalidWorkspace),
            "`{bad}` must be rejected"
        );
    }
}

#[test]
fn ordinary_workspace_name_is_accepted() {
    assert!(validate_workspace("notey").is_ok());
}

// ───────────────────────────────────────────────────────────────────────────
// 6.1-UNIT-003 — exit codes (P0, RISK-E6-005)
// Scope note: only AC-defined codes 0/1/2 are asserted. Exit code `3`
// ("no results") and `--json` are explicitly OUT OF SCOPE for Story 6.1.
// ───────────────────────────────────────────────────────────────────────────

#[test]
fn exit_code_success_is_zero() {
    assert_eq!(exit_code_for(&CommandOutcome::Success), 0);
}

#[test]
fn exit_code_app_error_is_one() {
    assert_eq!(exit_code_for(&CommandOutcome::AppError("boom".into())), 1);
}

#[test]
fn exit_code_not_running_is_two() {
    assert_eq!(exit_code_for(&CommandOutcome::NotRunning), 2);
}

#[test]
fn exit_code_timeout_is_two() {
    assert_eq!(exit_code_for(&CommandOutcome::Timeout), 2);
}

// ───────────────────────────────────────────────────────────────────────────
// 6.1-UNIT-004 — duplicated protocol struct round-trip / drift pin
// (P1, RISK-E6-008). The structs ARE part of the scaffold (AC6), so on
// activation these pass immediately and only fail if the wire shape later drifts.
// ───────────────────────────────────────────────────────────────────────────

#[test]
fn request_serializes_to_action_payload_shape() {
    let req = CliRequest {
        action: "add".to_string(),
        payload: serde_json::json!({ "text": "hi", "format": "markdown" }),
    };
    let value = serde_json::to_value(&req).expect("serialize");
    let obj = value.as_object().expect("request must be a JSON object");
    assert_eq!(obj.len(), 2, "request has exactly action + payload");
    assert!(obj.contains_key("action") && obj.contains_key("payload"));
    assert_eq!(obj["action"], serde_json::json!("add"));

    let round: CliRequest = serde_json::from_value(value).expect("deserialize");
    assert_eq!(round, req, "request must round-trip");
}

#[test]
fn response_round_trips_success_data_error_shape() {
    let resp = CliResponse {
        success: true,
        data: Some(serde_json::json!({ "id": 1 })),
        error: None,
    };
    let value = serde_json::to_value(&resp).expect("serialize");
    let obj = value.as_object().expect("response must be a JSON object");
    assert!(obj.contains_key("success"), "must carry `success`");
    assert_eq!(obj["success"], serde_json::json!(true));

    let round: CliResponse = serde_json::from_value(serde_json::json!({
        "success": false,
        "data": null,
        "error": "app not running"
    }))
    .expect("deserialize");
    assert_eq!(
        round,
        CliResponse {
            success: false,
            data: None,
            error: Some("app not running".to_string())
        }
    );
}

fn run_notey(args: &[&str], stdin: Option<&[u8]>) -> Output {
    let mut child = ProcessCommand::new(env!("CARGO_BIN_EXE_notey"))
        .args(args)
        .stdin(if stdin.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn notey binary");

    if let Some(stdin_bytes) = stdin {
        child
            .stdin
            .as_mut()
            .expect("stdin pipe should exist")
            .write_all(stdin_bytes)
            .expect("write stdin");
    }

    child.wait_with_output().expect("wait for notey")
}

#[test]
fn binary_help_lists_only_story_subcommands() {
    let output = run_notey(&["--help"], None);
    assert_eq!(output.status.code(), Some(0));

    let stdout = String::from_utf8(output.stdout).expect("stdout should be UTF-8");
    assert!(stdout.contains("  add"));
    assert!(stdout.contains("  list"));
    assert!(stdout.contains("  search"));
    assert!(
        !stdout.contains("\n  help    "),
        "generated help subcommand must be hidden: {stdout}"
    );
}

#[test]
fn binary_invalid_workspace_exits_two_before_not_running() {
    let output = run_notey(&["list", "--workspace", "a/b"], None);
    assert_eq!(output.status.code(), Some(2));

    let stderr = String::from_utf8(output.stderr).expect("stderr should be UTF-8");
    assert!(stderr.contains("invalid workspace name: a/b"));
    assert!(
        !stderr.contains("Notey is not running"),
        "local validation should fail before the deferred IPC path: {stderr}"
    );
}

#[test]
fn binary_oversized_stdin_exits_two_before_not_running() {
    let oversized = vec![b'a'; MAX_CONTENT_BYTES + 1];
    let output = run_notey(&["add", "--stdin"], Some(&oversized));
    assert_eq!(output.status.code(), Some(2));

    let stderr = String::from_utf8(output.stderr).expect("stderr should be UTF-8");
    assert!(stderr.contains("note content exceeds the 1 MiB limit"));
    assert!(
        !stderr.contains("Notey is not running"),
        "stdin validation should run before the deferred IPC path: {stderr}"
    );
}
