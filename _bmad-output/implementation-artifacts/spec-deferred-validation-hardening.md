---
title: 'Deferred validation hardening — workspace path checks & error surface'
type: 'refactor'
created: '2026-04-05'
status: 'done'
baseline_commit: '4f4e401'
context:
  - '_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `create_workspace` accepts any absolute path without verifying it exists or resolving symlinks — defense-in-depth is missing since callers may bypass `detect_workspace`. The workspace store's `workspaceError` field is set on fetch failure but never displayed, so users see stale data with no feedback. Additionally, the `loadNote` format validation deferred item is already resolved (lines 74-77 of `editor/store.ts`) and needs to be marked done.

**Approach:** Add canonicalization and existence validation to `create_workspace`. Surface `workspaceError` in `WorkspaceSelector` as an inline error message. Update `deferred-work.md` to reflect completed items.

## Boundaries & Constraints

**Always:**
- Use `std::fs::canonicalize` for path resolution (consistent with `detect_workspace`).
- Return `NoteyError::Validation` for invalid paths — never panic or silently accept.
- Display workspace errors non-intrusively (inline text in dropdown area, not a modal).

**Ask First:**
- Changing `create_workspace` to auto-create missing directories instead of rejecting.

**Never:**
- Remove the existing empty/whitespace/absolute checks.
- Block the UI on workspace load failures — stale data with an error indicator is acceptable.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valid absolute dir | `/home/user/project` (exists) | Workspace created, path stored canonicalized | N/A |
| Non-existent path | `/home/user/no-such-dir` | Rejected before DB insert | `Validation("Path does not exist: ...")` |
| Symlink path | `/tmp/link-to-project` | Resolved to canonical path, stored as target | N/A |
| Path is a file | `/home/user/file.txt` | Rejected — not a directory | `Validation("Path is not a directory: ...")` |
| Workspace fetch fails | Network/DB error on `listWorkspaces` | Error text shown in dropdown trigger area | `workspaceError` displayed, stale list retained |
| Workspace fetch recovers | Retry succeeds after previous failure | Error cleared, list updated | `workspaceError` reset to null |

</frozen-after-approval>

## Code Map

- `src-tauri/src/services/workspace_service.rs` -- Add canonicalize + is_dir validation to `create_workspace`
- `src/features/workspace/components/WorkspaceSelector.tsx` -- Read `workspaceError` and display inline
- `src-tauri/tests/workspace_tests.rs` -- Add tests for non-existent path, file path, symlink path
- `_bmad-output/implementation-artifacts/deferred-work.md` -- Mark resolved items done

## Tasks & Acceptance

**Execution:**
- [x] `src-tauri/src/services/workspace_service.rs` -- After the `is_absolute()` check, canonicalize the path with `std::fs::canonicalize` and verify `is_dir()`. Use the canonical path for DB insert. Mirror the error messages from `detect_workspace` for consistency.
- [x] `src/features/workspace/components/WorkspaceSelector.tsx` -- Subscribe to `workspaceError` from the store. When set, show it as muted error text below the trigger or as the first dropdown item.
- [x] `src-tauri/tests/workspace_tests.rs` -- Add tests: (1) non-existent path rejected, (2) file path rejected, (3) symlink resolved to canonical target (use `tempfile::TempDir` for fixtures).
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- Strike through the `loadNote format validation` item (already done). Strike through `Workspace path format validation` and `Workspace store error propagation` after implementation.

**Acceptance Criteria:**
- Given a non-existent absolute path, when `create_workspace` is called, then it returns a Validation error and no row is inserted
- Given a path pointing to a regular file, when `create_workspace` is called, then it returns a Validation error mentioning "not a directory"
- Given a symlink to a valid directory, when `create_workspace` is called, then the workspace is created with the canonicalized target path
- Given `listWorkspaces` fails, when the user opens the workspace dropdown, then an error message is visible in the UI
- Given `listWorkspaces` recovers on retry, when the dropdown is reopened, then the error is cleared and workspaces display normally

## Verification

**Commands:**
- `cd src-tauri && cargo test` -- expected: all tests pass including new path validation tests
- `cd src-tauri && cargo clippy` -- expected: no warnings
- `npm run build` -- expected: TypeScript compiles cleanly

## Suggested Review Order

**Path validation hardening (start here)**

- Canonicalize + is_dir checks added after existing is_absolute guard
  [`workspace_service.rs:31`](../../src-tauri/src/services/workspace_service.rs#L31)

- Canonical path used for DB insert and upsert lookup
  [`workspace_service.rs:42`](../../src-tauri/src/services/workspace_service.rs#L42)

**Error surface in UI**

- `workspaceError` rendered as inline alert in dropdown content
  [`WorkspaceSelector.tsx:62`](../../src/features/workspace/components/WorkspaceSelector.tsx#L62)

**Tests**

- Non-existent path, file path, and symlink canonicalization tests
  [`workspace_tests.rs:799`](../../src-tauri/tests/workspace_tests.rs#L799)

- Existing tests updated to use real TempDir fixtures
  [`workspace_tests.rs:44`](../../src-tauri/tests/workspace_tests.rs#L44)
