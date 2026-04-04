---
title: 'Deferred work cleanup — store reset, server timestamps, config hardening'
type: 'refactor'
created: '2026-04-04'
status: 'done'
baseline_commit: '40b0139'
context:
  - '_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Six deferred items from previous story reviews remain unresolved: the editor store lacks a null-reset action, auto-save uses client timestamps instead of server-side ones, and the config service has four hardening gaps (no hotkey re-registration, non-atomic writes, mutex held across I/O, no shortcut validation).

**Approach:** Add `resetNote()` to the editor store, switch `lastSavedAt` to server `updatedAt`, and harden `update_config` with shortcut validation, atomic writes, mutex scoping, and live hotkey re-registration.

## Boundaries & Constraints

**Always:**
- Atomic config write via write-to-temp-then-rename in the same directory.
- Validate shortcut strings via `parse_shortcut` before persisting — return `Validation` error for invalid strings.
- Drop the `Mutex<AppConfig>` lock before any filesystem I/O.

**Ask First:**
- Changing the hotkey re-registration to also update the tray tooltip or menu items.

**Never:**
- Hold a mutex across blocking I/O.
- Persist invalid/unparseable shortcut strings to config.toml.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Reset note | `resetNote()` called | activeNoteId → null, content → '', saveStatus → 'idle', lastSavedAt → null | N/A |
| Server timestamp | Successful save | `lastSavedAt` set to `updateResult.data.updatedAt` | N/A |
| Valid hotkey update | `{hotkey: {globalShortcut: "Ctrl+Shift+M"}}` | Old shortcut unregistered, new registered, config saved | Registration fails: return error, keep old shortcut |
| Invalid hotkey update | `{hotkey: {globalShortcut: "!!!"}}` | Rejected before save | Validation error returned |
| Atomic write crash | Process killed mid-write | Temp file left, original config intact | Next load ignores orphaned temp file |
| Concurrent config reads during write | `get_config` during `update_config` I/O | Returns previous config (lock released) | N/A |

</frozen-after-approval>

## Code Map

- `src/features/editor/store.ts` -- Add `resetNote()` action
- `src/features/editor/hooks/useAutoSave.ts` -- Switch `lastSavedAt` to server `updatedAt`
- `src-tauri/src/services/config.rs` -- Atomic write (temp+rename), make `parse_shortcut` public
- `src-tauri/src/lib.rs` -- Move `parse_shortcut` to services/config or make pub(crate)
- `src-tauri/src/commands/config.rs` -- Validate shortcut, drop mutex before I/O, hotkey re-registration via AppHandle

## Tasks & Acceptance

**Execution:**
- [x] `src/features/editor/store.ts` -- Add `resetNote()` action that sets `activeNoteId: null, content: '', format: 'markdown', saveStatus: 'idle', lastSavedAt: null`
- [x] `src/features/editor/hooks/useAutoSave.ts` -- In both `flushSave` and the debounce callback, replace `new Date().toISOString()` with `updateResult.data.updatedAt` in the `markSaved` call
- [x] `src-tauri/src/lib.rs` -- Make `parse_shortcut` `pub(crate)` so it can be used from commands
- [x] `src-tauri/src/services/config.rs` -- Change `save()` to write to a `.tmp` file in the same dir, then `fs::rename` to the final path (atomic on same filesystem)
- [x] `src-tauri/src/commands/config.rs` -- (1) If `partial.hotkey.global_shortcut` is present, validate via `parse_shortcut` — return `Validation` error if invalid. (2) Clone config under lock, drop lock, save to disk, re-acquire lock to update in-memory state. (3) If hotkey changed, unregister old shortcut and register new one via `AppHandle` + `GlobalShortcutExt`.
- [x] `src-tauri/src/services/config.rs` -- Add test for atomic write (write, verify, overwrite, verify)

**Acceptance Criteria:**
- Given the store has an active note, when `resetNote()` is called, then all editor state resets to initial values
- Given auto-save completes, when the save succeeds, then `lastSavedAt` equals the server's `updatedAt` timestamp (not client clock)
- Given a valid new hotkey string, when `update_config` is called, then the old hotkey is unregistered and the new one is active immediately
- Given an invalid hotkey string, when `update_config` is called, then the request is rejected with a Validation error and config is unchanged
- Given `save()` is called, when the write completes, then the original file is atomically replaced (no partial writes visible)
- Given `update_config` is running, when a concurrent `get_config` arrives, then it returns immediately (not blocked by I/O)

## Verification

**Commands:**
- `cd src-tauri && cargo test` -- expected: all tests pass including new atomic write test
- `cd src-tauri && cargo clippy` -- expected: no warnings
- `npm run build` -- expected: TypeScript compiles cleanly

## Suggested Review Order

**Config service hardening (start here)**

- Validation, mutex scoping, hotkey re-registration with rollback on failure
  [`config.rs:26`](../../src-tauri/src/commands/config.rs#L26)

- Atomic write via temp+rename with cleanup on error
  [`config.rs:51`](../../src-tauri/src/services/config.rs#L51)

- Handler no longer matches specific shortcut — supports re-registration
  [`lib.rs:138`](../../src-tauri/src/lib.rs#L138)

- `parse_shortcut` made `pub(crate)` for use from commands
  [`lib.rs:49`](../../src-tauri/src/lib.rs#L49)

**Frontend fixes**

- `lastSavedAt` now uses server `updatedAt` instead of client clock
  [`useAutoSave.ts:58`](../../src/features/editor/hooks/useAutoSave.ts#L58)

- `resetNote()` action resets all editor state to initial values
  [`store.ts:49`](../../src/features/editor/store.ts#L49)

**Tests**

- Atomic write test: write, verify, overwrite, verify no temp file left
  [`config.rs:197`](../../src-tauri/src/services/config.rs#L197)
