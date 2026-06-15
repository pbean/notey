---
stepsCompleted:
  ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04c-aggregate']
lastStep: 'step-04c-aggregate'
lastSaved: '2026-06-14'
storyId: '8.5'
storyKey: '8-5-per-user-data-isolation'
storyFile: '_bmad-output/planning-artifacts/epics.md (Epic 8 → Story 8.5)'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-8-5-per-user-data-isolation.md'
generatedTestFiles:
  - 'src-tauri/tests/platform_tests.rs'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/project-context.md'
---

# ATDD Checklist: Story 8.5 — Per-User Data Isolation

> **Stack adaptation.** Backend/security story. Red phase = cargo `#[ignore]` via the `Platform` abstraction. **Partial existing coverage:** the IPC socket already enforces a user-scoped path + `0600` mode (`src-tauri/src/ipc/socket_server.rs`, exercised by `ipc_tests.rs`). This story routes path resolution through `Platform` so isolation has one source of truth. True cross-user access is verified by platform QA (RISK-E6-007), not unit tests.

## Mode

AI generation (backend).

## TDD Red Phase (Current)

✅ `src-tauri/tests/platform_tests.rs` — `data_dir_is_user_scoped_and_standard`, `socket_path_is_user_scoped` (cfg unix), all `#[ignore]`

Stub surface:
- `src-tauri/src/platform/*` — `data_dir()`, `config_dir()`, `socket_path()` on the `Platform` trait

## Acceptance Criteria Coverage

| AC | Test | Level | Priority |
|---|---|---|---|
| DB path uses the current user's data dir; no system-wide shared dirs | `platform_tests::data_dir_is_user_scoped_and_standard` | unit | P1 |
| IPC socket uses user-scoped path (`/run/user/<uid>/notey.sock`) | `platform_tests::socket_path_is_user_scoped` | unit (unix) | P1 |
| Socket file permissions `0600` (owner only) | **already covered** by existing socket-server perms + `ipc_tests.rs`; re-assert via `Platform` when routed | integration | P1 |
| Two users → independent DB/config/socket; neither can access the other | **platform QA** (cross-user, not unit-automatable; RISK-E6-007) | manual | P1 |

## Red-Phase Proof (verified)

`cargo test --test platform_tests` → user-scope tests `ignored`. Activating `data_dir_is_user_scoped_and_standard` fails on `todo!`. Clippy clean.

## Green-Phase Wiring

1. Implement `Platform::data_dir/config_dir/socket_path` per OS (XDG on Linux, `~/Library/Application Support` on macOS, `%APPDATA%` on Windows).
2. **Refactor existing call sites to the trait:** `lib.rs` uses `app.path().app_data_dir()`; `services::config::config_dir()` and `ipc::socket_server::socket_path()` already implement the right behavior — make `Platform` delegate to them (or vice-versa) so there is a single source of truth. Preserve the `NOTEY_SOCKET_PATH` test seam.
3. Keep the socket `0600` + `0700` runtime-dir guarantees (already enforced); add a `Platform`-level assertion when the socket path is routed through the trait.

## Activation Steps

Implement a path method → remove its `#[ignore]` → confirm fail-then-pass → commit. File the cross-user isolation check as a platform-QA item (RISK-E6-007).
