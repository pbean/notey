use serde_json::Value;

const CAPABILITY_JSON: &str = include_str!("../capabilities/default.json");

/// All commands the app registers in lib.rs::specta_builder().
const EXPECTED_COMMANDS: &[&str] = &[
    "allow-create-note",
    "allow-get-note",
    "allow-update-note",
    "allow-list-notes",
    "allow-get-config",
    "allow-update-config",
    "allow-dismiss-window",
    "allow-create-workspace",
    "allow-list-workspaces",
    "allow-get-workspace",
    "allow-detect-workspace",
    "allow-resolve-workspace",
    "allow-get-current-dir",
];

// P0-INT-006: Tauri ACL rejects unauthorized commands
// These tests validate the capability configuration is correctly scoped.
// A properly configured ACL means the Tauri runtime rejects any command
// not explicitly listed here.

#[test]
fn test_capability_has_no_wildcard_permissions() {
    let cap: Value = serde_json::from_str(CAPABILITY_JSON).expect("invalid capability JSON");
    let permissions = cap["permissions"].as_array().expect("permissions should be an array");

    for perm in permissions {
        let perm_str = perm.as_str().expect("permission should be a string");
        assert!(
            !perm_str.contains('*'),
            "wildcard permission found: {perm_str} — capabilities must be explicit"
        );
    }
}

#[test]
fn test_capability_scoped_to_main_window_only() {
    let cap: Value = serde_json::from_str(CAPABILITY_JSON).expect("invalid capability JSON");
    let windows = cap["windows"].as_array().expect("windows should be an array");

    assert_eq!(windows.len(), 1, "should have exactly one window scope");
    assert_eq!(windows[0], "main", "capability should be scoped to 'main' window");
}

#[test]
fn test_all_registered_commands_are_permitted() {
    let cap: Value = serde_json::from_str(CAPABILITY_JSON).expect("invalid capability JSON");
    let permissions: Vec<&str> = cap["permissions"]
        .as_array()
        .expect("permissions should be an array")
        .iter()
        .map(|v| v.as_str().expect("permission should be a string"))
        .collect();

    for cmd in EXPECTED_COMMANDS {
        assert!(
            permissions.contains(cmd),
            "registered command {cmd} is missing from capability permissions"
        );
    }
}

#[test]
fn test_no_unexpected_custom_commands() {
    let cap: Value = serde_json::from_str(CAPABILITY_JSON).expect("invalid capability JSON");
    let permissions: Vec<&str> = cap["permissions"]
        .as_array()
        .expect("permissions should be an array")
        .iter()
        .map(|v| v.as_str().expect("permission should be a string"))
        .collect();

    // Custom commands start with "allow-" (not namespaced like "core:" or "opener:")
    let custom: Vec<&&str> = permissions
        .iter()
        .filter(|p| p.starts_with("allow-"))
        .collect();

    for cmd in &custom {
        assert!(
            EXPECTED_COMMANDS.contains(cmd),
            "unexpected custom command in capability: {cmd} — add to EXPECTED_COMMANDS if intentional"
        );
    }

    assert_eq!(
        custom.len(),
        EXPECTED_COMMANDS.len(),
        "custom command count mismatch — capability has {} but {} are registered",
        custom.len(),
        EXPECTED_COMMANDS.len()
    );
}
