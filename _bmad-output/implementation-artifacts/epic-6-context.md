# Epic 6 Context: CLI Integration

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Give developers a terminal-native way to capture, list, and search notes without leaving their workflow. A standalone `notey` CLI binary talks to the running desktop app over a local IPC socket (Unix socket / named pipe), and any change made via the CLI is reflected in the desktop UI in real time. The CLI works per-user (isolated sockets on shared systems) and fails gracefully with clear messaging and proper exit codes when the desktop app is not running. This epic delivers the "developer power features" that differentiate Notey from a pure GUI notepad, while enforcing strict input-validation and isolation guarantees (RISK-006, CLI injection, Score 6).

## Stories

- Story 6.1: CLI Crate Scaffold & Argument Parsing
- Story 6.2: IPC Socket Server in Desktop App
- Story 6.3: CLI `add` Command (Text + Stdin)
- Story 6.4: CLI `list` Command
- Story 6.5: CLI `search` Command
- Story 6.6: Real-Time Desktop Sync on CLI Changes
- Story 6.7: CLI Error Handling & User Isolation

## Requirements & Constraints

**Functional scope (FR2, FR3, FR14, FR15, FR36, FR37, FR38):**
- Create notes from terminal: `notey add "text"` and `command | notey add --stdin`.
- List notes (`notey list`) and search notes (`notey search "query"`), each with an optional `--workspace <name>` filter.
- CLI-originated changes appear in the running desktop app in real time.
- Each user's CLI targets only their own Notey instance/data; no cross-user access on shared systems.
- When the desktop app is not running, the CLI exits non-zero and prints actionable guidance to stderr.

**Non-functional / security constraints:**
- CLI input validation is a mandatory acceptance criterion (RISK-006): parameterized queries only (no string interpolation), max 1MB note size (guards `cat hugefile | notey add --stdin`), path validation via `std::fs::canonicalize()`, workspace path must resolve to an existing directory.
- IPC channel is user-scoped and permission-restricted (NFR11): socket file permissions owner-only (0600 on Unix). No auth token in v1 — file permissions are the isolation mechanism.
- Zero network access (NFR12) — the CLI makes no outbound connections.

**Success criteria / quality gates:**
- P0 tests pass 100%, P1 tests ≥95%, no open high-severity bugs.
- Favor unit/integration tests over E2E (RISK-007). Key scenarios: P0-UNIT-004 (arg parsing), P0-UNIT-005 (input validation — 1MB cap, no injection), P0-UNIT-006 (exit codes), P0-INT-007 (socket accepts/routes commands), P0-INT-008 (protocol request/response validation), P1-INT-001..008 (concurrent connections, malformed requests, timeout, permission enforcement).

## Technical Decisions

**CLI crate (`notey-cli/`):**
- Separate, standalone Cargo crate alongside `src-tauri/` — NOT part of a workspace, and shares NO Rust code with `src-tauri/`. Protocol types are duplicated as simple JSON structs on the CLI side.
- Dependencies: `clap` (derive feature) for argument parsing, `serde_json` for protocol, `interprocess` for the local socket client. Binary is named `notey`.
- Structure: `src/main.rs` (entry point + clap parsing), `src/client.rs` (socket client that connects to the desktop app).
- CLI auto-detects the git workspace from CWD and includes workspace name + path in create requests (ties into Epic 2 workspace detection logic, reimplemented CLI-side).

**IPC socket server (in `src-tauri/`):**
- Lives in `src-tauri/src/ipc/`: `socket_server.rs` (Unix socket / named pipe listener), `protocol.rs` (JSON request/response types).
- Listens on a user-scoped path: `/run/user/<uid>/notey.sock` on Linux, platform equivalents on macOS/Windows (named pipes on Windows). Resolve socket/pipe paths through the platform abstraction layer (`platform/{linux,macos,windows}.rs`).
- Socket created at app startup, removed on app exit (cleanup).
- Action handlers delegate to the SAME database logic backing the Tauri commands (`create_note`, `list_notes`, `search_notes`) — do not fork persistence logic.

**Protocol (authoritative form per story acceptance criteria):**
- Request: `{ "action": "<string>", "payload": { ... } }`. Supported actions: `create_note`, `list_notes`, `search_notes`.
- Response: `{ "success": true|false, "data": { ... }, "error": "<string>|null" }`.
- Note: the architecture doc shows an earlier `{command,args}` / `{ok,data}` shape — the story-level `{action,payload}` / `{success,data,error}` form above governs.
- All JSON crossing the boundary uses camelCase (`#[serde(rename_all = "camelCase")]`); dates are ISO 8601 strings.

**Real-time sync (Story 6.6):**
- On a CLI-driven change, the backend emits a tauri-specta event `note-created` with payload `{ timestamp: string, data: { noteId: number } }` (kebab-case event name).
- Frontend listens and refreshes the note list; if the new note's workspace matches the active workspace it appears in the filtered view. Batch UI updates to avoid flicker / excessive re-renders.

**Error handling & exit codes (Story 6.7):**
- App not running OR connection refused → exit code 2, stderr: "✕ Notey is not running. Start the application first."
- Connection attempt exceeding 5s → timeout, exit code 2 with a timeout message.
- App returns `{ "success": false, "error": "..." }` → exit code 1, stderr: "✕ [error message]".
- Success → exit code 0.

## UX & Interaction Patterns

- CLI output: success → green checkmark to stdout; error → red ✕ to stderr (UX-DR60).
- ANSI colors enabled only when stdout is a TTY; when piped, emit plain text with no escape codes (UX-DR61).
- `add` success prints "✓ Note created".
- `list` prints one note per line — title (truncated ~50 chars), relative date, workspace name — clean and pipe-friendly.
- `search` prints title, snippet with ~30-char match context, workspace name, relative date; empty result prints `No notes matching '<query>'`.
- `--help` must surface subcommands (`add`, `list`, `search`) and per-command flags (`add`: positional `<TEXT>`, `--stdin`, `--format` markdown|plaintext default markdown; `list`/`search`: `--workspace <name>`; `search`: positional `<QUERY>`).

## Cross-Story Dependencies

- The IPC socket protocol (Story 6.2) must be defined before both the CLI client (6.3–6.5) and the server fully work — it is the shared contract.
- Stories 6.3–6.6 depend on the socket server (6.2) existing and on the desktop app's note CRUD + search logic (Epic 1 note commands, Epic 3 search) being in place.
- CLI workspace detection (6.3) mirrors Epic 2's git-repository workspace detection but is implemented independently CLI-side (no shared code with `src-tauri/`).
- Story 6.6 depends on the tauri-specta event pipeline and the frontend note-list feature (Epic 1 / Epic 2) to consume `note-created`.
