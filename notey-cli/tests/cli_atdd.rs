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

// ───────────────────────────────────────────────────────────────────────────
// 6.1-UNIT-001 — clap argument parsing (P0, AC1–AC5, RISK-E6-005)
// ───────────────────────────────────────────────────────────────────────────

#[test]
#[ignore = "ATDD red phase (6.1-UNIT-001): parse_args not implemented"]
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
#[ignore = "ATDD red phase (6.1-UNIT-001): --stdin flag"]
fn add_parses_stdin_flag() {
    let cmd = parse_args(["notey", "add", "--stdin"]).expect("add --stdin should parse");
    match cmd {
        Command::Add { stdin, .. } => assert!(stdin, "--stdin should set stdin=true"),
        other => panic!("expected Add, got {other:?}"),
    }
}

#[test]
#[ignore = "ATDD red phase (6.1-UNIT-001): --format defaults to markdown"]
fn add_format_defaults_to_markdown() {
    let cmd = parse_args(["notey", "add", "note"]).expect("should parse");
    match cmd {
        Command::Add { format, .. } => assert_eq!(format, Format::Markdown),
        other => panic!("expected Add, got {other:?}"),
    }
}

#[test]
#[ignore = "ATDD red phase (6.1-UNIT-001): --format plaintext"]
fn add_format_plaintext_parses() {
    let cmd = parse_args(["notey", "add", "note", "--format", "plaintext"]).expect("should parse");
    match cmd {
        Command::Add { format, .. } => assert_eq!(format, Format::Plaintext),
        other => panic!("expected Add, got {other:?}"),
    }
}

#[test]
#[ignore = "ATDD red phase (6.1-UNIT-001): invalid --format rejected"]
fn add_invalid_format_is_rejected() {
    let result = parse_args(["notey", "add", "note", "--format", "rtf"]);
    assert!(
        matches!(result, Err(CliError::Parse(_))),
        "invalid --format must be a parse error, got {result:?}"
    );
}

#[test]
#[ignore = "ATDD red phase (6.1-UNIT-001): list --workspace is optional"]
fn list_parses_with_and_without_workspace() {
    assert_eq!(
        parse_args(["notey", "list"]).expect("list should parse"),
        Command::List { workspace: None }
    );
    assert_eq!(
        parse_args(["notey", "list", "--workspace", "notey"]).expect("list --workspace should parse"),
        Command::List { workspace: Some("notey".to_string()) }
    );
}

#[test]
#[ignore = "ATDD red phase (6.1-UNIT-001): search positional query + workspace"]
fn search_parses_query_and_workspace() {
    assert_eq!(
        parse_args(["notey", "search", "rust traits"]).expect("search <QUERY> should parse"),
        Command::Search { query: "rust traits".to_string(), workspace: None }
    );
    assert_eq!(
        parse_args(["notey", "search", "rust", "--workspace", "notey"])
            .expect("search --workspace should parse"),
        Command::Search { query: "rust".to_string(), workspace: Some("notey".to_string()) }
    );
}

#[test]
#[ignore = "ATDD red phase (6.1-UNIT-001): search requires a query"]
fn search_without_query_is_rejected() {
    assert!(parse_args(["notey", "search"]).is_err(), "search with no query must error");
}

#[test]
#[ignore = "ATDD red phase (6.1-UNIT-001): add requires text or --stdin"]
fn add_without_text_or_stdin_is_rejected() {
    assert!(
        parse_args(["notey", "add"]).is_err(),
        "add with neither <TEXT> nor --stdin must error"
    );
}

#[test]
#[ignore = "ATDD red phase (6.1-UNIT-001): --help exposes exactly 3 subcommands"]
fn help_lists_three_subcommands() {
    let names: Vec<String> = cli_command()
        .get_subcommands()
        .map(|c| c.get_name().to_string())
        .collect();
    for expected in ["add", "list", "search"] {
        assert!(
            names.contains(&expected.to_string()),
            "subcommand `{expected}` should exist; got {names:?}"
        );
    }
}

// ───────────────────────────────────────────────────────────────────────────
// 6.1-UNIT-002 — input validation (P0, RISK-E6-001 score 6 / NFR10) — security
// ───────────────────────────────────────────────────────────────────────────

#[test]
#[ignore = "ATDD red phase (6.1-UNIT-002): 1MiB content accepted (boundary)"]
fn content_at_size_cap_is_accepted() {
    let content = vec![b'a'; MAX_CONTENT_BYTES];
    assert!(validate_content(&content).is_ok(), "exactly 1MiB must be accepted");
}

#[test]
#[ignore = "ATDD red phase (6.1-UNIT-002): >1MiB content rejected"]
fn content_over_size_cap_is_rejected() {
    let content = vec![b'a'; MAX_CONTENT_BYTES + 1];
    assert_eq!(validate_content(&content), Err(CliError::ContentTooLarge));
}

#[test]
#[ignore = "ATDD red phase (6.1-UNIT-002): NUL / control chars rejected"]
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
#[ignore = "ATDD red phase (6.1-UNIT-002): ordinary content (newlines/tabs) passes"]
fn ordinary_content_passes_validation() {
    let content = "a normal markdown note\nwith newlines\tand tabs\r\n".as_bytes();
    assert!(validate_content(content).is_ok(), "tab/newline/CR must be allowed");
}

#[test]
#[ignore = "ATDD red phase (6.1-UNIT-002): workspace path-traversal rejected"]
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
#[ignore = "ATDD red phase (6.1-UNIT-002): ordinary workspace name accepted"]
fn ordinary_workspace_name_is_accepted() {
    assert!(validate_workspace("notey").is_ok());
}

// ───────────────────────────────────────────────────────────────────────────
// 6.1-UNIT-003 — exit codes (P0, RISK-E6-005)
// Scope note: only AC-defined codes 0/1/2 are asserted. Exit code `3`
// ("no results") and `--json` are explicitly OUT OF SCOPE for Story 6.1.
// ───────────────────────────────────────────────────────────────────────────

#[test]
#[ignore = "ATDD red phase (6.1-UNIT-003): success -> 0"]
fn exit_code_success_is_zero() {
    assert_eq!(exit_code_for(&CommandOutcome::Success), 0);
}

#[test]
#[ignore = "ATDD red phase (6.1-UNIT-003): app error -> 1"]
fn exit_code_app_error_is_one() {
    assert_eq!(exit_code_for(&CommandOutcome::AppError("boom".into())), 1);
}

#[test]
#[ignore = "ATDD red phase (6.1-UNIT-003): app not running -> 2"]
fn exit_code_not_running_is_two() {
    assert_eq!(exit_code_for(&CommandOutcome::NotRunning), 2);
}

#[test]
#[ignore = "ATDD red phase (6.1-UNIT-003): timeout -> 2"]
fn exit_code_timeout_is_two() {
    assert_eq!(exit_code_for(&CommandOutcome::Timeout), 2);
}

// ───────────────────────────────────────────────────────────────────────────
// 6.1-UNIT-004 — duplicated protocol struct round-trip / drift pin
// (P1, RISK-E6-008). The structs ARE part of the scaffold (AC6), so on
// activation these pass immediately and only fail if the wire shape later drifts.
// ───────────────────────────────────────────────────────────────────────────

#[test]
#[ignore = "ATDD red phase (6.1-UNIT-004): request shape pin {action,payload}"]
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
#[ignore = "ATDD red phase (6.1-UNIT-004): response shape pin {success,data,error}"]
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
        CliResponse { success: false, data: None, error: Some("app not running".to_string()) }
    );
}
