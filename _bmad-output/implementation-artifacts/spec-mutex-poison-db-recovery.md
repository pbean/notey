---
title: 'Mutex poison recovery — ROLLBACK stale transactions on DB connection reuse'
type: 'refactor'
created: '2026-04-06'
status: 'done'
baseline_commit: 'b68b4d1'
context:
  - '_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When a panic poisons the `Mutex<rusqlite::Connection>`, the 10 DB command handlers recover via `e.into_inner()` but reuse the connection without clearing potentially open transactions. In WAL/autocommit mode, a mid-operation panic could leave the connection in an undefined transaction state, causing subsequent operations to silently execute inside a stale transaction or fail with constraint violations.

**Approach:** Extract a shared `recover_poisoned_db` helper that logs the warning, calls `into_inner()`, and issues a `ROLLBACK` (no-op if autocommit). Replace all 10 inline DB poison-recovery closures with calls to this helper.

## Boundaries & Constraints

**Always:** Keep the existing `eprintln!` warning. The `ROLLBACK` must be fire-and-forget (`let _ = ...`) since it is expected to error when no transaction is open. Only touch DB mutex instances — the 3 `AppConfig` mutex instances in `config.rs` are out of scope.

**Ask First:** Changing from `Mutex` to a connection pool or other concurrency strategy.

**Never:** Add `PRAGMA integrity_check` (too expensive for every recovery). Don't change the poison-recovery policy itself (continue recovering, not panicking). Don't touch service-layer code.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No active transaction | Connection in autocommit after poison | `ROLLBACK` returns error, ignored; connection usable | `let _ =` discards error |
| Open transaction from panic | Connection mid-transaction after poison | `ROLLBACK` succeeds, connection returns to autocommit | N/A |
| Connection fully corrupted | Connection unusable after poison | `ROLLBACK` fails, next service call returns `NoteyError` | Existing error propagation handles it |

</frozen-after-approval>

## Code Map

- `src-tauri/src/commands/mod.rs` -- Add `recover_poisoned_db` helper function
- `src-tauri/src/commands/notes.rs` -- 6 inline closures → helper calls (lines 16-18, 29-31, 45-47, 60-62, 73-75, 86-88)
- `src-tauri/src/commands/workspace.rs` -- 4 inline closures → helper calls (lines 16-18, 28-30, 41-43, 62-64)

## Tasks & Acceptance

**Execution:**
- [x] `src-tauri/src/commands/mod.rs` -- Add `recover_poisoned_db(e: PoisonError<MutexGuard<Connection>>) -> MutexGuard<Connection>` that logs, extracts inner, and issues fire-and-forget `ROLLBACK`
- [x] `src-tauri/src/commands/notes.rs` -- Replace 6 inline poison-recovery closures with `recover_poisoned_db` calls
- [x] `src-tauri/src/commands/workspace.rs` -- Replace 4 inline poison-recovery closures with `recover_poisoned_db` calls

**Acceptance Criteria:**
- Given a poisoned DB mutex, when any command acquires the connection, then `ROLLBACK` is issued before the connection is used
- Given a poisoned DB mutex with no open transaction, when recovery runs, then the `ROLLBACK` error is silently discarded and the command proceeds normally
- Given all 10 DB command handlers, when inspected, then none contain inline poison-recovery logic — all delegate to `recover_poisoned_db`

## Verification

**Commands:**
- `cd src-tauri && cargo check` -- expected: compiles without errors or warnings
- `cd src-tauri && cargo test` -- expected: all existing tests pass
- `cd src-tauri && cargo clippy -- -D warnings` -- expected: no new warnings

## Suggested Review Order

- Shared recovery helper — logs, extracts inner, issues fire-and-forget ROLLBACK
  [`mod.rs:14`](../../src-tauri/src/commands/mod.rs#L14)

- First consumer — `create_note` shows the one-liner pattern replacing the 3-line closure
  [`notes.rs:18`](../../src-tauri/src/commands/notes.rs#L18)

- Remaining 5 note commands — identical mechanical replacement
  [`notes.rs:30`](../../src-tauri/src/commands/notes.rs#L30)

- All 4 workspace commands — same pattern, confirms no DB handler was missed
  [`workspace.rs:18`](../../src-tauri/src/commands/workspace.rs#L18)

- Untouched AppConfig handlers — verify config.rs was correctly left alone
  [`config.rs:19`](../../src-tauri/src/commands/config.rs#L19)
