---
title: 'Epic 1 Backend Foundation (Stories 1.1–1.5)'
type: 'feature'
created: '2026-04-03'
status: 'done'
baseline_commit: 'a4f9a85'
context:
  - '_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Notey project has no code — only documentation and planning artifacts. No Tauri application, no database, no IPC layer, and no note CRUD exists.

**Approach:** Bootstrap the Tauri v2 + React 19 + TypeScript project from scratch, configure all frontend and backend tooling, establish the SQLite database with the notes schema, wire up tauri-specta IPC, and implement the four core note CRUD commands — creating a fully compilable, testable backend foundation that all subsequent stories build on.

## Boundaries & Constraints

**Always:**
- tauri-specta pins: `tauri-specta =2.0.0-rc.24`, `specta =2.0.0-rc.24`, `specta-typescript =0.0.11`
- All IPC structs use `#[serde(rename_all = "camelCase")]`
- All SQL uses parameterized queries — no string interpolation
- Dates are ISO 8601 strings (`chrono::Utc::now().to_rfc3339()`) — never Unix timestamps
- `NoteyError` variants: `Database`, `NotFound`, `Validation`, `Io`, `Config`
- DB: single `Mutex<Connection>` with WAL + pragmas (synchronous=NORMAL, busy_timeout=5000, foreign_keys=ON, cache_size=-10000)
- No barrel files (`index.ts`); import from source directly
- TypeScript strict mode (`"strict": true` in tsconfig.json)
- Tailwind v4 (uses `@import "tailwindcss"` — not legacy `@tailwind` directives)
- shadcn/ui init: `style: "new-york"`, `rsc: false`, tailwind.config blank

**Ask First:**
- If `npm create tauri-app` scaffolds a different structure than expected (e.g., different src layout), halt before modifying
- If exact version of `tauri-plugin-*` is needed for any Story 1.1–1.5 feature, halt and confirm

**Never:**
- Use `invoke("command_name", ...)` directly — always use tauri-specta generated bindings
- Hand-edit `src/generated/bindings.ts`
- Add FTS5 virtual table or workspace table in this spec (Epic 2 scope)
- Implement any UI components (Stories 1.6+ scope)
- Add migrations beyond migration 001 (notes table only)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create note | `format: "markdown"` | New note row, empty title/content, ISO8601 timestamps, returned with `id` | — |
| Get existing | valid `id` | Full note record, camelCase JSON fields | — |
| Get missing | nonexistent `id` | `NoteyError::NotFound` | Serialized to Tauri error response |
| Update note | `id`, optional fields | Only provided fields updated, `updated_at` refreshed | `NotFound` if id invalid |
| List notes | — | Non-trashed notes ordered by `updated_at DESC` | Empty array if no notes |

</frozen-after-approval>

## Code Map

- `package.json` — frontend deps (Tailwind v4, shadcn/ui, Zustand v5, Vitest)
- `vite.config.ts` — Vite + `@tailwindcss/vite` plugin + `@/*` alias
- `tsconfig.json` — strict mode, `@/*` path alias
- `src/index.css` — `@import "tailwindcss"` + `@theme inline` block
- `components.json` — shadcn/ui config
- `src/generated/bindings.ts` — tauri-specta output (auto-generated, never hand-edit)
- `src-tauri/Cargo.toml` — all Rust deps with version pins
- `src-tauri/src/lib.rs` — app setup, specta Builder, command registration, Mutex<Connection> state
- `src-tauri/src/errors.rs` — `NoteyError` enum (thiserror + Serialize)
- `src-tauri/src/models/mod.rs` — `Note` struct with serde camelCase
- `src-tauri/src/db/mod.rs` — connection init, PRAGMA setup, migration runner
- `src-tauri/src/services/notes.rs` — business logic (create/get/update/list), all parameterized SQL
- `src-tauri/src/commands/notes.rs` — thin Tauri command handlers
- `src-tauri/src/commands/mod.rs` — re-exports note commands
- `src-tauri/capabilities/default.json` — default-deny ACL with note command permissions

## Tasks & Acceptance

**Execution:**
- [x] `notey/` — Run `npm create tauri-app@latest notey -- --template react-ts` in parent dir; verify `src/`, `src-tauri/`, `package.json` exist; confirm `"strict": true` in tsconfig
- [x] `package.json` — Add `tailwindcss`, `@tailwindcss/vite`, `zustand` deps; run `npm install`
- [x] `vite.config.ts` — Add `@tailwindcss/vite` plugin; add `resolve.alias: { "@": path.resolve(__dirname, "./src") }`
- [x] `tsconfig.json` — Add `"paths": { "@/*": ["./src/*"] }` under `compilerOptions`
- [x] `src/index.css` — Replace content with `@import "tailwindcss";` plus empty `@theme inline {}` block
- [x] `components.json` — Run `npx shadcn@latest init` with new-york style, rsc=false, blank tailwind.config; then `npx shadcn@latest add button` to verify
- [x] `vitest.config.ts` (new) — Configure Vitest with `@vitejs/plugin-react` and `jsdom` environment; verify `npx vitest run` exits 0
- [x] `src-tauri/Cargo.toml` — Add: `rusqlite` (bundled, modern_sqlite), `chrono` (serde), `thiserror`, `tauri-specta =2.0.0-rc.24`, `specta =2.0.0-rc.24`, `specta-typescript =0.0.11`, `toml`, `dirs`, `rusqlite_migration`, `serde` (derive)
- [x] `src-tauri/src/errors.rs` — Define `NoteyError` enum with variants Database/NotFound/Validation/Io/Config; derive `thiserror::Error` + `serde::Serialize`
- [x] `src-tauri/src/models/mod.rs` — Define `Note` struct: `id: i64`, `title: String`, `content: String`, `format: String`, `workspace_id: Option<i64>`, `created_at: String`, `updated_at: String`, `deleted_at: Option<String>`, `is_trashed: bool`; add `#[serde(rename_all = "camelCase")]`
- [x] `src-tauri/src/db/mod.rs` — `init_db(app_data_dir: PathBuf) -> Result<Connection, NoteyError>`: create dir, open connection, set all 5 PRAGMAs, run `rusqlite_migration` with migration 001 (notes table DDL per Story 1.4 AC)
- [x] `src-tauri/src/services/notes.rs` — Implement `create_note`, `get_note`, `update_note`, `list_notes` using `&Connection`; parameterized SQL only; `chrono::Utc::now().to_rfc3339()` for timestamps
- [x] `src-tauri/src/commands/notes.rs` — Four thin `#[tauri::command] #[specta::specta]` handlers delegating to `services::notes`; accept `State<Mutex<Connection>>`
- [x] `src-tauri/src/lib.rs` — Initialize `Mutex<Connection>` via `db::init_db`; build specta `Builder` with `collect_commands![create_note, get_note, update_note, list_notes]`; export bindings to `../src/generated/bindings.ts` in debug; register `invoke_handler`
- [x] `src-tauri/capabilities/default.json` — Set default-deny; add permissions for `create-note`, `get-note`, `update-note`, `list-notes`
- [x] `src-tauri/tests/db_tests.rs` — Integration tests: table creation, all 5 PRAGMA values, WAL mode active, temp-file DB per test; `cargo test` passes

**Acceptance Criteria:**
- Given a fresh clone, when `npm install && cargo build` run, then both complete without errors
- Given `npm run tauri dev`, when window opens, then default React template is visible
- Given `npx vitest run`, then exits 0 (even with zero tests)
- Given `cargo build` in debug mode, then `src/generated/bindings.ts` is generated and exports `commands.createNote`, `commands.getNote`, `commands.updateNote`, `commands.listNotes`
- Given `cargo test`, then all DB integration tests pass (WAL mode, PRAGMA values, table creation)
- Given `create_note("markdown")`, then row inserted with empty title/content and ISO8601 timestamps, note returned with assigned `id`
- Given `get_note(nonexistent_id)`, then `NoteyError::NotFound` is returned
- Given `update_note` with only `content` field, then only content and `updated_at` change; `title` and `format` unchanged
- Given `list_notes`, then only rows where `is_trashed = 0` are returned, ordered `updated_at DESC`

## Spec Change Log

### Review loop 1 (2026-04-03)

**Finding 1 — intent_gap: Nightly Rust vs stable constraint**
- Trigger: `specta =2.0.0-rc.24` (frozen spec pin) requires nightly; `project-context.md` mandates stable Rust.
- Amendment: `rust-toolchain.toml` pins `nightly-2026-04-03` (specific date for reproducibility). Human approved nightly.
- Known-bad state avoided: unpinned `channel = "nightly"` is not reproducible across builds.
- KEEP: All three exact specta/tauri-specta/specta-typescript version pins must be preserved.

**Finding 2 — intent_gap: NoteyError variant list conflict**
- Trigger: Spec listed 5 variants (`Database,NotFound,Validation,Io,Config`); `project-context.md` listed different 5 (`Database,NotFound,Workspace,Io,Validation`). Implementation had 6.
- Amendment: All 6 variants kept (`Database,NotFound,Workspace,Io,Validation,Config`) per human decision [C].
- Known-bad state avoided: removing either source's variants would lose forward-compatibility.
- KEEP: Both `Workspace` and `Config` variants must be present in all future derivations.

**Finding 3 — bad_spec: capabilities/default.json baseline permissions**
- Trigger: Spec said "add permissions for 4 note commands" without accounting for mandatory Tauri baseline permissions.
- Amendment: `core:default` and `opener:default` are retained as required by the Tauri framework (window communication requires `core:default`). This is not a security breach — `core:default` does not grant filesystem access.
- Known-bad state avoided: removing `core:default` breaks all IPC.
- KEEP: `core:default` must always be present in capabilities.

**Patches applied (2026-04-03)**
- `update_note`: replaced 4 separate non-atomic UPDATEs with single COALESCE-based atomic UPDATE; `AND is_trashed = 0` in WHERE clause makes trashed-note update return NotFound.
- `commands/notes.rs`: replaced `lock().unwrap()` with `lock().unwrap_or_else(|e| e.into_inner())` to recover from poisoned Mutex.
- `lib.rs`: removed dead `export_bindings()` public function.

## Verification

**Commands:**
- `npm install` — expected: exit 0, no errors
- `cargo build --manifest-path src-tauri/Cargo.toml` — expected: exit 0, `src/generated/bindings.ts` written
- `npx vitest run` — expected: exit 0
- `cargo test --manifest-path src-tauri/Cargo.toml` — expected: all DB integration tests pass

## Suggested Review Order

**IPC Architecture (start here)**

- Single entry point wiring Specta builder, DB init, and invoke handler together
  [`lib.rs:13`](../../src-tauri/src/lib.rs#L13)

- Generated TypeScript contracts — confirms camelCase field names and union error type
  [`bindings.ts:1`](../../src/generated/bindings.ts#L1)

**Error handling**

- NoteyError: serde `tag+content` shape, `#[serde/specta(skip)]` on non-serializable inner errors
  [`errors.rs:6`](../../src-tauri/src/errors.rs#L6)

**Data model**

- Note struct: all fields, `#[serde(rename_all = "camelCase")]` enforcing camelCase at boundary
  [`models/mod.rs:5`](../../src-tauri/src/models/mod.rs#L5)

**Database layer**

- `init_db`: directory creation, 5 PRAGMAs in one batch, then migration runner
  [`db/mod.rs:23`](../../src-tauri/src/db/mod.rs#L23)

- Migration 001 DDL: notes table with CHECK constraint on format, soft-delete columns
  [`db/mod.rs:7`](../../src-tauri/src/db/mod.rs#L7)

**Business logic**

- `update_note`: single atomic COALESCE UPDATE replacing previous 4-statement approach
  [`notes.rs:53`](../../src-tauri/src/services/notes.rs#L53)

- `get_note`: `QueryReturnedNoRows` → `NotFound` mapping
  [`notes.rs:17`](../../src-tauri/src/services/notes.rs#L17)

- `list_notes`: `is_trashed = 0` filter and `updated_at DESC` ordering
  [`notes.rs:70`](../../src-tauri/src/services/notes.rs#L70)

**Command handlers**

- Thin async handlers: `unwrap_or_else(|e| e.into_inner())` for Mutex poison recovery
  [`commands/notes.rs:9`](../../src-tauri/src/commands/notes.rs#L9)

**Security**

- Capabilities: default-deny + 4 note permissions + required `core:default`
  [`default.json:1`](../../src-tauri/capabilities/default.json#L1)

**Toolchain & dependencies**

- Pinned nightly date (specta rc.24 requires it); reproducible across machines
  [`rust-toolchain.toml:1`](../../rust-toolchain.toml#L1)

- Exact version pins for specta family; rusqlite 0.34 with bundled SQLite + FTS5
  [`Cargo.toml:29`](../../src-tauri/Cargo.toml#L29)

**Tests**

- Integration tests: 10 tests covering all 5 PRAGMAs, WAL mode, CRUD, trash filter
  [`db_tests.rs:1`](../../src-tauri/tests/db_tests.rs#L1)

- Unit tests co-located in service file; include ordering and field-isolation checks
  [`notes.rs:99`](../../src-tauri/src/services/notes.rs#L99)
