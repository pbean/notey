---
project_name: 'notey'
user_name: 'Pinkyd'
date: '2026-04-04'
sections_completed:
  ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 101
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

### Core Platform
- **Tauri v2.10.3** — Desktop framework (Rust backend + web frontend)
- **React 19** — UI library
- **TypeScript** — Strict mode enabled, frontend language
- **Rust nightly-2026-04-03** — Backend language (pinned in `rust-toolchain.toml`; required by `specta =2.0.0-rc.24` for `fmt::from_fn` behind `debug_closure_helpers` feature gate)
- **Vite** — Frontend bundler

### Key Dependencies
- **CodeMirror 6** — Editor (mandatory, ~150KB) — NOT Monaco, NOT Tiptap
- **Zustand** — State management (per-feature stores)
- **Tailwind CSS v4** + **shadcn/ui** — Styling and components
- **rusqlite** + **SQLite** — Database (WAL mode + FTS5 full-text search)
- **tauri-specta v2** (`=2.0.0-rc.24`) — Compile-time type-safe IPC bindings (mandatory; RC-stage, requires nightly Rust)
- **specta** (`=2.0.0-rc.24`) + **specta-typescript** (`=0.0.11`) — Type introspection and TS codegen backends for tauri-specta
- **serde** + **serde_json** — Rust serialization
- **chrono** — Date/time handling
- **thiserror** — Error type derivation
- **clap** — CLI argument parsing
- **interprocess** — Unix socket IPC (CLI ↔ App)
- **rusqlite_migration** — Database schema migrations

### Tauri Plugins
- tauri-plugin-global-shortcut, tauri-plugin-autostart, tauri-plugin-log, tray-icon

### Testing
- **Vitest** — Frontend tests
- **cargo test** — Backend tests
- **tauri-driver** / WebDriver — E2E (critical paths only)

### Linting & Formatting
- **Clippy** — Rust linting
- **ESLint** (flat config) — TypeScript linting
- **Prettier** — Code formatting
- **Trunk v1.25.0** — Meta-linter (Node 22.16.0, Python 3.10.8)

## Critical Implementation Rules

### Language-Specific Rules

#### TypeScript
- Strict mode enforced — no `any` types, no implicit returns
- NO `I` prefix on interfaces — use `Note`, not `INote`
- Import directly from source files — NO barrel files (`index.ts`) anywhere
- All Tauri IPC calls via tauri-specta generated bindings — NEVER manually type `invoke()` calls
- Generated type bindings: `src/generated/bindings.ts` — do not hand-edit
- Date display: use `Intl.DateTimeFormat` — never format dates manually
- Async/await for all Tauri command invocations

#### Rust
- All IPC boundary structs MUST have `#[serde(rename_all = "camelCase")]`
- Date/time generation: `chrono::Utc::now().to_rfc3339()` — ISO 8601 TEXT
- Never use Unix timestamps — storage and JSON are always ISO 8601 strings
- Error types via `thiserror` — `NoteyError` enum with `Serialize` derive
- Error variants: `Database`, `NotFound`, `Workspace`, `Io`, `Validation`, `Config`
- Tauri commands: thin **synchronous** handlers only — delegate all logic to service layer. Do NOT use `async fn` for commands that only do blocking work (mutex + DB). Sync commands run on Tauri's blocking thread pool; async commands run on the tokio runtime and block it.
- Platform code: trait-based `Platform` abstraction with `#[cfg(target_os)]` per-OS implementations
- Database queries: parameterized only — NEVER string interpolation/concatenation
- Use `mod.rs` pattern within module directories

#### IPC Boundary
- All JSON fields: `camelCase` — enforced by serde rename on Rust side
- Frontend must use tauri-specta generated functions, never raw `invoke("command_name")`
- Type safety is compile-time — if it compiles, the types match

### Framework-Specific Rules

#### React
- Feature-based organization: `src/features/{name}/` containing `components/`, `hooks/`, `store.ts`
- Shared UI: `src/shared/components/ui/` (shadcn/ui components)
- Component files: `PascalCase.tsx` — Hook files: `camelCase.ts` — Store files: `camelCase.ts`
- Utility files: `camelCase.ts` in appropriate feature or shared directory

#### Zustand State Management
- One store per feature: `useEditorStore`, `useSearchStore`, `useWorkspaceStore`, `useSettingsStore`
- Named actions only — never expose raw `setState` to components
- Immutable updates: `set((state) => ({ notes: [...state.notes, note] }))`
- Async data shape: `{ data: T | null, isLoading: boolean, error: string | null }`

#### Auto-Save
- 300ms debounce, reset on every keystroke
- Esc-dismiss: flush save immediately (bypass debounce), wait for confirmation before hiding window
- Never leave unsaved state — auto-save must complete before window hides

#### Tauri
- Capability ACL: default-deny, scope permissions per window in `capabilities/*.json`
- Event names: `kebab-case` — `note-saved`, `workspace-changed`
- Filesystem access: scoped only — never request broad FS permissions
- Zero network requests — app is fully offline, no telemetry, no update checks
- Tauri commands registered in `lib.rs` — commands live in `src-tauri/src/commands/`

#### Tauri Command Permission Files
- When adding a new Tauri command, the permission TOML file may NOT auto-generate
- If `cargo build` does not create `src-tauri/permissions/autogenerated/{command_name}.toml`, create it manually:
  ```toml
  # Automatically generated - DO NOT EDIT
  # This permission set is auto-generated

  [[permission]]
  identifier = "allow-{command-name-kebab-case}"
  description = "Allows the {command_name} command"

  [[permission.commands]]
  name = "{command_name_snake_case}"
  ```
- Add the permission identifier (e.g., `"allow-search-notes"`) to `src-tauri/capabilities/default.json`
- Add the permission identifier to `EXPECTED_COMMANDS` in `src-tauri/tests/acl_tests.rs`
- This is a known Tauri v2 issue — the build system sometimes skips TOML generation for new commands

### Testing Rules

#### Organization
- Rust unit tests: `#[cfg(test)] mod tests` at end of source file — not in separate files
- Rust integration tests: `src-tauri/tests/*.rs` — `db_tests.rs`, `search_tests.rs`, `ipc_tests.rs`
- TypeScript tests: co-located as `*.test.ts(x)` next to source file
- NO `__tests__/` directories — tests live beside the code they test

#### Infrastructure
- Backend integration tests: use temporary SQLite databases — never share state between tests
- Frontend tests: mock the Tauri IPC layer, not Zustand stores
- E2E tests: `tauri-driver` / WebDriver — critical user paths only

#### Test Boundaries
- Service layer: unit-testable without Tauri runtime — this is the primary test target
- Command handlers: tested via integration tests (thin wrappers don't need unit tests)
- Database layer: real SQLite with temp DBs — no mocking the database
- React components: Vitest + React Testing Library

### Code Quality & Style Rules

#### Naming Conventions
- **Rust:** `snake_case` functions/vars, `PascalCase` types, `SCREAMING_SNAKE_CASE` constants
- **TypeScript:** `camelCase` functions/vars, `PascalCase` components/types, `SCREAMING_SNAKE_CASE` constants
- **Database tables:** `snake_case`, plural — `notes`, `workspaces`
- **Database columns:** `snake_case` — `workspace_id`, `created_at`, `is_trashed`
- **Database indexes:** `idx_{table}_{column}` — `idx_notes_workspace_id`
- **Tauri commands:** `snake_case` in Rust, `camelCase` when invoked from TypeScript

#### Backend File Structure (`src-tauri/src/`)
- `lib.rs` — App setup, plugins, state, command registration
- `commands/` — Thin Tauri command handlers (no business logic)
- `services/` — Business logic (testable without Tauri runtime)
- `db/` — Database layer, repositories, schema, migrations
- `models/` — Shared data types with `#[serde(rename_all = "camelCase")]`
- `platform/` — OS-specific implementations (Linux, macOS, Windows)
- `ipc/` — CLI ↔ App Unix socket server
- `errors.rs` — `NoteyError` enum with `thiserror` + `Serialize`

#### Frontend File Structure (`src/`)
- `features/{name}/` — Feature modules: `components/`, `hooks/`, `store.ts`
- `shared/components/ui/` — shadcn/ui shared components
- `generated/bindings.ts` — tauri-specta output — NEVER hand-edit

#### Documentation
- Mandatory JSDoc on all exported TypeScript functions, types, and components
- Mandatory rustdoc on all public Rust functions, structs, enums, and traits
- README and docs in `docs/` directory

### Development Workflow Rules

#### Git & CI
- Conventional Commits format for all commit messages
- Release Please for version management and changelog
- CI: `cargo test` + `vitest` + `clippy` on every push/PR (GitHub Actions)
- Release: cross-platform matrix build via `tauri-apps/tauri-action`
  - Windows x64, macOS x64 + ARM64, Linux x64 + ARM64

#### Database Migrations
- Managed via `rusqlite_migration` — embedded in binary
- Forward-only — never modify an existing migration
- New schema changes = new migration file
- SQLite pragmas set at connection open:
  - `synchronous = NORMAL`, `busy_timeout = 5000`, `foreign_keys = ON`
  - `cache_size = -10000`, `journal_mode = WAL`

#### Build
- Frontend: Vite builds to dist → Tauri bundles the output
- Backend: Cargo build via Tauri build process
- tauri-specta regenerates `src/generated/bindings.ts` at build time
- v1: unsigned artifacts (code signing deferred to post-MVP)

### Critical Don't-Miss Rules

#### Anti-Patterns — NEVER Do These
- NEVER use raw `invoke("command_name", ...)` — use tauri-specta generated bindings
- NEVER create barrel/index files (`index.ts`) — import from source directly
- NEVER use Unix timestamps anywhere — all dates are ISO 8601 TEXT strings
- NEVER put business logic in Tauri command handlers — delegate to `services/`
- NEVER use string interpolation/concatenation in SQL — parameterized queries only
- NEVER request broad filesystem permissions in Tauri capabilities
- NEVER make network requests — zero network access, fully offline app
- NEVER hard-delete notes — soft delete with `is_trashed = 1` + `deleted_at`

#### Database Gotchas
- FTS5 external content tables require SQLite triggers to stay in sync with `notes` table
  - Must create INSERT, UPDATE, DELETE triggers on `notes` → `notes_fts`
- `is_trashed` is INTEGER (0/1) — SQLite has no boolean type
- Soft delete: `is_trashed = 1`, `deleted_at = ISO 8601` — hard purge only after 30 days
- Single `Mutex<Connection>` — no connection pool, SQLite handles concurrency via WAL

#### Performance Budgets
- Hotkey-to-visible: <150ms
- Keystroke-to-save: <500ms
- Search (1K notes): <100ms
- Cold start: <1s
- Idle memory: <80MB
- Dismiss-to-focus-return: <50ms
- Search degradation to 10K notes: <2x baseline

#### Security
- Tauri capabilities: default-deny — never use `"permissions": ["*"]`
- Validate all input at IPC boundaries — injection and path traversal checks
- IPC sockets: per-user isolation, user-scoped access
- CLI search input: parameterized queries, never interpolated

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**
- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-04-04
