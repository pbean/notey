---
title: "Story 6.6: Real-Time Desktop Sync on CLI Changes"
type: "feature"
created: "2026-06-13"
status: "done"
baseline_commit: "db804cf742ef6a3ee09789ee58460381465a9336"
context:
  - "{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md"
  - "{project-root}/_bmad-output/test-artifacts/test-design-epic-6.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A note created from the terminal (`notey add`) is persisted by the IPC server (Story 6.2), but the *running* desktop app never learns about it — its note list stays stale until the user manually switches workspaces or reopens, and a re-create attempt can produce a duplicate (RISK-E6-009). CLI and GUI must stay in sync in real time (FR36).

**Approach:** When the IPC server successfully handles a `create_note`, the wiring layer in `lib.rs` (which owns the `AppHandle`) emits a tauri-specta typed event `note-created` carrying `{ timestamp, data: { noteId } }`. The frontend subscribes via the generated `events.noteCreated.listen(...)` binding and refreshes the workspace store's note list through the existing `loadFilteredNotes()` — which re-queries with the active workspace filter, so a CLI note in the active workspace appears and one in another workspace does not, for free. Rapid events are debounced into a single refresh to avoid re-render storms.

## Boundaries & Constraints

**Always:**
- Event name is exactly `note-created` (kebab-case). It is produced by a `#[derive(tauri_specta::Event)]` struct named `NoteCreated` (the derive kebab-cases the struct name) — do NOT hand-name it via `#[tauri_specta(event_name=...)]`.
- Payload shape is exactly `{ "timestamp": string, "data": { "noteId": number } }` — camelCase (`#[serde(rename_all = "camelCase")]`), `timestamp` an ISO 8601 string from `chrono::Utc::now().to_rfc3339()`, `noteId` the newly created note's id (`i64` → `number`).
- The event is emitted ONLY on a successful `create_note` IPC action. A failed create, or a `list_notes`/`search_notes`/unknown action, emits nothing.
- `protocol::handle_request` stays pure and unchanged (it has no `AppHandle`). Detection of "this was a successful create, here is the new id" lives in a pure, unit-tested seam `created_note_id(raw, &IpcResponse) -> Option<i64>`; the actual emit lives in the `lib.rs` IPC handler closure that holds the `AppHandle`. Release the connection `MutexGuard` before emitting.
- A failed emit must never abort or panic the IPC response — best-effort (`let _ = ... .emit(&app_handle);`), mirroring the existing `export` progress emit.
- Register the event in the specta builder (`.events(collect_events![ipc::events::NoteCreated])`) AND call `builder.mount_events(app)` in `setup()` so the event is in the `EventRegistry` and the regenerated `bindings.ts` gains the typed `events` export. `acl_tests.rs::EXPECTED_COMMANDS` and command registration stay unchanged.
- Frontend listens via the generated `events.noteCreated.listen` (type-safe binding), not a raw hand-typed `listen("note-created")`. The listener triggers `useWorkspaceStore.getState().loadFilteredNotes()`, debounced so a burst of N events collapses to one refresh.
- Register the listener once at app startup (`App.tsx` mount effect) and unlisten on unmount. rustdoc/JSDoc on public items, clippy-clean, Conventional Commits.

**Ask First:**
- Replacing or "upgrading" the existing raw `app.emit`/`listen` export-progress events to the typed pipeline (out of scope — only `note-created` is added here).
- Emitting `note-created` from any GUI-side create path (this story is CLI-origin sync only); or adding new event kinds (`note-updated`, `note-deleted`).
- Changing `loadFilteredNotes()` semantics or the `handle_request` signature/contract.

**Never:**
- Do NOT mutate `filteredNotes` by hand from the event payload (no client-side insert/merge by `noteId`). Re-query through `loadFilteredNotes()` so workspace filtering, ordering, and soft-delete rules stay authoritative.
- Do NOT make the emit synchronous-blocking on UI, hold the DB lock across the emit, or fork the create path.
- Do NOT add a Tauri command, broaden capabilities, add network access, or make `src-tauri` depend on `notey-cli`.
- Do NOT build the real Tauri E2E (`6.E2E-001`) here — it runs in the Nightly suite with the live runtime, consistent with Stories 6.2–6.5 shipping no E2E.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| CLI create succeeds | IPC `create_note` returns `{success:true, data:{id:42,…}}` | `note-created` emitted with `{timestamp:<rfc3339>, data:{noteId:42}}` | N/A |
| CLI create fails | `create_note` returns `{success:false}` | no event emitted | nothing emitted |
| non-create action | `list_notes` / `search_notes` / unknown action | no event emitted | nothing emitted |
| seam on success | `created_note_id(raw_create, ok_resp_with_id)` | `Some(42)` | — |
| seam on failure | `created_note_id(raw_create, err_resp)` | `None` | — |
| seam wrong action | `created_note_id(raw_list, ok_resp)` | `None` | — |
| seam missing id | success resp whose `data` lacks integer `id` | `None` | no emit, no panic |
| FE single event | listener receives one `note-created` | one debounced `loadFilteredNotes()` call | N/A |
| FE event burst | 5 events within debounce window | exactly one `loadFilteredNotes()` after the window | N/A |
| FE note in active ws | refreshed list includes the CLI note | appears in filtered view | N/A |
| FE note in other ws | refreshed list excludes it | not shown under active filter | N/A |
| emit failure | `AppHandle::emit` returns `Err` | IPC response still returned to client unchanged | error swallowed (`let _`) |

</frozen-after-approval>

## Code Map

- `src-tauri/src/ipc/events.rs` -- NEW. `NoteCreated { timestamp: String, data: NoteCreatedData }` and `NoteCreatedData { note_id: i64 }`, both `#[serde(rename_all = "camelCase")]`. `NoteCreated` derives `Serialize, Deserialize, Clone, Debug, specta::Type, tauri_specta::Event`; `NoteCreatedData` derives the same minus `Event`. Add `impl NoteCreated { pub fn now(note_id: i64) -> Self }` stamping `chrono::Utc::now().to_rfc3339()`. `#[cfg(test)]`: assert serialized JSON has `data.noteId` and a non-empty `timestamp` (camelCase shape).
- `src-tauri/src/ipc/mod.rs` -- MODIFY. Add `pub mod events;` (+ re-export if the module re-exports siblings).
- `src-tauri/src/ipc/protocol.rs` -- MODIFY. Add pure `pub fn created_note_id(raw: &[u8], response: &IpcResponse) -> Option<i64>`: `None` unless `response.success`, the request parses, and `action == "create_note"`; then `response.data["id"].as_i64()`. `handle_request` untouched. Add `#[cfg(test)]` units for the four seam rows above.
- `src-tauri/src/lib.rs` -- MODIFY. (1) In `specta_builder()` append `.events(collect_events![ipc::events::NoteCreated])` (import `tauri_specta::collect_events`). (2) In `setup()` call `builder.mount_events(app)` — move/clone the tauri-specta `builder` into setup as needed (`Builder` is `Clone`; `invoke_handler()` borrows, so clone before the `setup` closure or reorder). (3) In the IPC handler closure, after `handle_request`, drop the conn guard, then `if let Some(id) = ipc::protocol::created_note_id(raw, &response) { let _ = ipc::events::NoteCreated::now(id).emit(&app_handle); }` (import `tauri::Emitter` and `tauri_specta::Event`). Return `response` as before.
- `src/generated/bindings.ts` -- REGENERATED at build time (NEVER hand-edit). Will gain the `events` export (`events.noteCreated`) and `NoteCreated`/`NoteCreatedData` types.
- `src/features/note-list/realtimeSync.ts` -- NEW. `export async function startNoteCreatedSync(): Promise<UnlistenFn>` subscribing via `events.noteCreated.listen(...)`; on each event schedule a debounced (`~200ms`) call to `useWorkspaceStore.getState().loadFilteredNotes()`. Clear any pending timer in the returned unlisten wrapper. JSDoc.
- `src/features/note-list/realtimeSync.test.ts` -- NEW. Vitest + fake timers: mock the generated `events` and the workspace store; assert one event → one refresh after the window, and a 5-event burst → exactly one refresh (6.6-COMP-001/002).
- `src/App.tsx` -- MODIFY. In the existing mount effect, `void startNoteCreatedSync().then(fn => { unlisten = fn })` and call `unlisten?.()` in cleanup (guard against the disposed/async race like the existing auto-save teardown).
- `src/features/workspace/store.ts` -- REFERENCE ONLY. `loadFilteredNotes()` (re-queries `listNotes(activeWorkspaceId|null)`) is the refresh target — workspace-match filtering is a side effect of re-querying; do not modify.
- `src-tauri/src/commands/export.rs` -- REFERENCE ONLY. Existing best-effort `app.emit` pattern (`let _ = app.emit(...)`) to mirror for non-fatal emit.

## Tasks & Acceptance

**Execution:**

- [x] `src-tauri/src/ipc/events.rs` -- add `NoteCreated`/`NoteCreatedData` typed event + `NoteCreated::now(note_id)`; unit-test the camelCase JSON shape (`data.noteId`, non-empty `timestamp`).
- [x] `src-tauri/src/ipc/mod.rs` -- wire `pub mod events;`.
- [x] `src-tauri/src/ipc/protocol.rs` -- add pure `created_note_id` seam + `#[cfg(test)]` units (success→Some, failure→None, wrong-action→None, missing-id→None). Leave `handle_request` unchanged.
- [x] `src-tauri/src/lib.rs` -- register `NoteCreated` in the specta builder, `mount_events` in setup, and emit `NoteCreated::now(id)` from the IPC handler closure on a successful create (lock dropped first, best-effort). Imports: `collect_events`, `Event` (the `.emit` resolves via the `Event` trait; no `Emitter` import needed).
- [x] `src/features/note-list/realtimeSync.ts` -- `startNoteCreatedSync()` subscribing via `events.noteCreated.listen` and debounce-refreshing `loadFilteredNotes()`; returns an unlisten that also clears the pending timer.
- [x] `src/App.tsx` -- start the sync listener on mount, unlisten on unmount (disposed-race safe).
- [x] `src/features/note-list/realtimeSync.test.ts` -- vitest fake-timer tests: single event → one refresh; burst of 5 → one refresh (6.6-COMP-001/002).

### Review Findings

- [x] [Review][Patch] Close startup note-sync gap before init/restore completes [src/App.tsx:14]
- [x] [Review][Patch] Serialize realtime refreshes and catch listener-side load failures [src/features/note-list/realtimeSync.ts:13]
- [x] [Review][Patch] Prove active-workspace filtering and restore singleton store actions in sync tests [src/features/note-list/realtimeSync.test.ts:20]

#### Review Ledger (2026-06-13)

patch: Close startup note-sync gap before init/restore completes [src/App.tsx:14] — listener now starts at mount and startup backfills notes after registration
patch: Serialize realtime refreshes and catch listener-side load failures [src/features/note-list/realtimeSync.ts:13] — sync now queues overlapping event refreshes, cancels pending work on stop, and logs refresh failures
patch: Prove active-workspace filtering and restore singleton store actions in sync tests [src/features/note-list/realtimeSync.test.ts:20] — tests now assert the event path re-queries with `activeWorkspaceId` and restore the singleton action after each case
dismiss: Absolute-path diff header findings [review-input] — `git diff --no-index` labeled untracked files with absolute paths, but the repo files are in the correct locations
dismiss: Continuous-stream debounce starvation concern [src/features/note-list/realtimeSync.ts:52] — the spec requires burst debouncing, not periodic refreshes during an uninterrupted create loop
dismiss: Missing live-runtime emit test [src-tauri/src/lib.rs:281] — the story explicitly leaves live-runtime verification to Nightly `6.E2E-001`, and local build/test/clippy all passed

**Acceptance Criteria:**

- Given the IPC server processes a successful `notey add`, when the create commits, then a `note-created` event fires exactly once carrying `{ timestamp:<ISO 8601>, data:{ noteId:<new id> } }` (camelCase), and no event fires for a failed create or for `list_notes`/`search_notes` (6.6-UNIT-001 / AC1 / FR36).
- Given the `created_note_id` seam, when called with a successful create request+response it returns `Some(id)`, and it returns `None` for a failed response, a non-create action, or a response whose `data` lacks an integer `id` — never panicking.
- Given the desktop app is listening, when a `note-created` event arrives, then the note list refreshes via `loadFilteredNotes()`, and a note in the active workspace appears while one in a different workspace does not (active-workspace filter preserved) (6.6-COMP-001 / AC2).
- Given multiple `note-created` events arrive within the debounce window, when they are processed, then `loadFilteredNotes()` runs exactly once (batched — no per-event re-render storm) (6.6-COMP-002 / AC3).
- Given the full build, when `cargo test`/`cargo clippy --all-targets` run in `src-tauri/` and `vitest` runs the new FE test, then all prior Epic 1–6 tests stay green, there are no warnings, `acl_tests.rs::EXPECTED_COMMANDS` is unchanged, and the regenerated `bindings.ts` exposes `events.noteCreated`.

## Design Notes

**Why the emit lives in `lib.rs`, not `protocol.rs`.** `handle_request` is the shared, socket-agnostic, `AppHandle`-free dispatcher (frozen by Story 6.2 and reused by integration tests over a bare `Arc<Mutex<Connection>>`). Only the production wiring closure in `lib.rs` holds an `AppHandle`. So the pure decision ("was this a successful create, and what id?") is factored into `created_note_id` (unit-testable without a socket or a Tauri runtime), and the impure side effect (emit) stays in the one place that can do it. This is why `6.6-UNIT-001` targets the seam + payload shape rather than a live `app.emit` — emitting through a real `AppHandle` is GUI-runtime-bound and is covered by the Nightly `6.E2E-001`.

**Typed event vs. the export raw-emit precedent.** The `export` feature emits via raw `app.emit("export-markdown-progress", …)` with a `Type`-deriving struct. Story 6.6's AC says "via tauri-specta", and a domain sync event benefits from the generated, type-safe `events.noteCreated.listen` binding — so this story adds the typed `Event` pipeline (`collect_events!` + `mount_events`) rather than another stringly-typed emit. The export events are intentionally left as-is.

**Refresh by re-query, not by merge.** The event payload carries `noteId`, but the listener does not splice that note into `filteredNotes`. It calls `loadFilteredNotes()`, which re-runs `listNotes(activeWorkspaceId|null)` — so the active-workspace filter, newest-first ordering, and `is_trashed` exclusion remain the single source of truth and the AC2 workspace-match behavior falls out automatically.

## Verification

**Commands:**

- `cargo test --manifest-path src-tauri/Cargo.toml -- ipc::` -- expected: new `events` shape test + `created_note_id` seam tests pass; all prior IPC/protocol tests green.
- `cargo test --manifest-path src-tauri/Cargo.toml` -- expected: full backend suite green, including the `export_bindings` and `acl_tests` (EXPECTED_COMMANDS unchanged).
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets` -- expected: warning-clean.
- `cargo build --manifest-path src-tauri/Cargo.toml` -- expected: compiles and regenerates `src/generated/bindings.ts` with an `events.noteCreated` export.
- `npx vitest run src/features/note-list/realtimeSync.test.ts` -- expected: single-event and burst-batching tests pass.

**Manual checks:**

- With the app running, `notey add "live sync check"` in the active workspace → the note appears in the desktop list within ~1s without manual refresh (mirrors Nightly `6.E2E-001`).
