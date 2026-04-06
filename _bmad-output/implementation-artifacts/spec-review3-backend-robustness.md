---
title: 'Backend robustness hardening — TOCTOU, mutex logging, depth limit, fallback name'
type: 'chore'
created: '2026-04-06'
status: 'done'
baseline_commit: '34ebb56'
context:
  - 'src-tauri/src/services/workspace_service.rs'
  - 'src-tauri/src/commands/'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Four low-severity robustness gaps in the Rust backend surfaced during story 3.1 code review: `upsert_workspace` has a TOCTOU gap where the directory could vanish between validation and DB insert; mutex poisoning is silently swallowed across 13 Tauri command handlers; `detect_workspace` walks to filesystem root without depth limit; and non-UTF-8/root-level `.git` directories collapse to an ambiguous "workspace" name.

**Approach:** Add a defensive `is_dir()` re-check in `upsert_workspace`, replace silent `unwrap_or_else` with `tracing::warn` + recover across all command handlers, cap `detect_workspace` traversal at 20 levels, and use a path-hash fallback name for non-UTF-8/root edge cases.

## Boundaries & Constraints

**Always:** All changes must pass existing `cargo test` and `npm run check`. Mutex pattern must remain `recover` (not `panic` or `return error`) to preserve current graceful-degradation behavior.

**Ask First:** If any existing tests fail due to these changes. If the path-hash fallback changes workspace names in existing DBs (it won't — only affects the creation edge case).

**Never:** Change the public Tauri command signatures. Introduce new dependencies beyond what's already in Cargo.toml (tracing is already present). Break the `resolve_workspace` → `detect_workspace` → `upsert_workspace` call chain.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| TOCTOU: dir deleted after canonicalize | Valid path at canonicalize time, deleted before upsert | `Validation` error: "Directory no longer exists" | Returned to caller |
| Mutex poisoned | Prior panic poisoned DB mutex | Warning logged, lock recovered, command proceeds | `tracing::warn!` emitted |
| Deep directory (>20 levels) | File nested 25 dirs deep, no `.git` anywhere | Walk stops at depth 20, falls back to directory name | No error — graceful fallback |
| Non-UTF-8 dir with `.git` | `.git` found in dir with non-UTF-8 name | Workspace named `workspace_<8-char hex hash>` | No error — deterministic name |
| Root-level `.git` | `.git` in `/` | Workspace named `workspace_<8-char hex hash>` | No error — deterministic name |

</frozen-after-approval>

## Code Map

- `src-tauri/src/services/workspace_service.rs` -- TOCTOU fix (line ~62), depth limit (line ~96), fallback name (lines ~100, ~117)
- `src-tauri/src/commands/notes.rs` -- Mutex pattern: 6 instances (lines 16, 26, 39, 51, 61, 71)
- `src-tauri/src/commands/workspace.rs` -- Mutex pattern: 4 instances (lines 16, 25, 35, 53)
- `src-tauri/src/commands/config.rs` -- Mutex pattern: 3 instances (lines 19, 54, 63)
- `src-tauri/tests/workspace_tests.rs` -- New tests for TOCTOU, depth limit, fallback name

## Tasks & Acceptance

**Execution:**
- [x] `src-tauri/src/services/workspace_service.rs` -- Add `is_dir()` re-check at top of `upsert_workspace`; return `Validation` error if directory vanished
- [x] `src-tauri/src/services/workspace_service.rs` -- Add `MAX_DEPTH: usize = 20` constant and depth counter in `detect_workspace` loop
- [x] `src-tauri/src/services/workspace_service.rs` -- Replace `unwrap_or("workspace")` fallback with `workspace_<hex8>` hash using `std::hash` of the canonical path bytes
- [x] `src-tauri/src/commands/notes.rs` -- Replace 6 `.unwrap_or_else(|e| e.into_inner())` with `eprintln!` warning + recover (tracing not available; used eprintln instead)
- [x] `src-tauri/src/commands/workspace.rs` -- Same mutex pattern fix for 4 instances
- [x] `src-tauri/src/commands/config.rs` -- Same mutex pattern fix for 3 instances
- [x] `src-tauri/tests/workspace_tests.rs` -- Add test: TOCTOU guard via resolve_workspace on deleted directory
- [x] `src-tauri/tests/workspace_tests.rs` -- Add test: `detect_workspace` respects depth limit (25-level nested temp dir)

**Acceptance Criteria:**
- Given a directory that is deleted after `create_workspace` canonicalizes it, when `upsert_workspace` executes, then it returns a `Validation` error
- Given a file 25 directories deep with no `.git`, when `detect_workspace` runs, then it stops traversal and falls back to the leaf directory name
- Given a poisoned mutex, when any Tauri command acquires the lock, then a warning is logged via `eprintln!` and the command completes normally
- Given a `.git` directory at filesystem root (where `file_name()` returns None), when `detect_workspace` runs, then it produces a deterministic `workspace_<hex8>` name (note: non-UTF-8 paths are rejected by pre-existing `path_to_str` validation before reaching the name fallback)

## Verification

**Commands:**
- `cargo test` -- expected: all tests pass including new TOCTOU and depth-limit tests
- `npm run check` -- expected: no TypeScript errors (no frontend changes in this spec)


## Suggested Review Order

**TOCTOU & workspace detection hardening**

- FNV-1a stable hash fallback + TOCTOU is_dir guard — entry point for core changes
  [`workspace_service.rs:59`](../../src-tauri/src/services/workspace_service.rs#L59)

- MAX_DETECT_DEPTH constant + depth-limited traversal loop
  [`workspace_service.rs:12`](../../src-tauri/src/services/workspace_service.rs#L12)

- Hash fallback applied in .git-found branch and no-.git fallback branch
  [`workspace_service.rs:127`](../../src-tauri/src/services/workspace_service.rs#L127)

**Mutex poisoning observability**

- Database mutex — 6 commands gain eprintln warning before recovery
  [`notes.rs:16`](../../src-tauri/src/commands/notes.rs#L16)

- Workspace mutex — 4 commands, same pattern
  [`workspace.rs:16`](../../src-tauri/src/commands/workspace.rs#L16)

- Config mutex — 3 lock sites including the split read/write in update_config
  [`config.rs:19`](../../src-tauri/src/commands/config.rs#L19)

**Tests**

- Deleted-directory rejection via resolve_workspace
  [`workspace_tests.rs:913`](../../src-tauri/tests/workspace_tests.rs#L913)

- Depth limit — .git beyond limit NOT found; .git within limit IS found
  [`workspace_tests.rs:937`](../../src-tauri/tests/workspace_tests.rs#L937)

- Updated root fallback assertion (workspace_ prefix instead of exact "workspace")
  [`workspace_tests.rs:423`](../../src-tauri/tests/workspace_tests.rs#L423)
