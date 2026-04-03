---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-04-02'
inputDocuments:
  - prd.md
  - product-brief-notey-distillate.md
  - research/technical-notey-tech-stack-validation-research-2026-04-02.md
workflowType: 'architecture'
project_name: 'notey'
user_name: 'Pinkyd'
date: '2026-04-02'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
58 requirements across 12 domains: Note Capture (FR1-10), Search (FR11-15), Window Management (FR16-22), Multi-Tab (FR23-26), Command Palette (FR27-28), Workspace Management (FR29-35), CLI/IPC (FR36-38), System Integration (FR39-43), Configuration (FR44-48), Data Export (FR49-51), Onboarding (FR52-55), Cross-Platform (FR56-58).

The architectural weight is concentrated in three areas: (1) the dual-interface IPC system connecting GUI and CLI, (2) the window management lifecycle with sub-150ms summon/dismiss, and (3) workspace-aware note scoping with automatic git detection.

**Non-Functional Requirements:**
23 NFRs across 5 domains with hard numeric targets:
- **Performance (NFR1-7):** 150ms hotkey-to-visible, 500ms keystroke-to-save, 100ms search over 10K notes, 1s cold start, 80MB idle memory, 10MB installer, 50ms dismiss-to-focus-restore
- **Security (NFR8-12):** Capability-scoped IPC, scoped filesystem, CLI input validation, user-scoped sockets, zero network access
- **Reliability (NFR13-17):** Zero data loss including crash/power-loss scenarios, 30-day soft-delete recovery, atomic auto-save
- **Scalability (NFR18-20):** Sub-linear search degradation to 10K notes, <500ms startup degradation, 30s export for 10K notes
- **Accessibility (NFR21-23):** Full keyboard navigation, visible focus indicators, WCAG 2.1 AA contrast

**Scale & Complexity:**

- Primary domain: Cross-platform desktop application with system-level integration + CLI companion binary
- Complexity level: Medium (low domain complexity, medium platform/integration complexity)
- Estimated architectural components: ~15 (Tauri core, note service, search service, workspace service, clipboard service, IPC socket server, database layer, platform abstraction layer, CLI binary, editor UI, search UI, command palette, tab manager, system tray, config manager)

### Technical Constraints & Dependencies

- **Tauri v2** defines the process model (core + webview), IPC mechanism, security model, and plugin ecosystem
- **SQLite + FTS5** is the sole data store — no external services, no network dependencies
- **tauri-specta v2** enforces type safety across the IPC boundary at compile time
- **Platform WebView fragmentation** — WebKit on Linux, WebView2 on Windows — constrains CSS to conservative Tailwind baseline
- **Wayland global hotkey gap** — XWayland fallback for v1, portal integration via `ashpd` as fast-follow
- **macOS accessibility permissions** — First-run detection and guided grant flow required before hotkey works
- **Code signing** — Apple Developer ($99/yr) + Windows OV certificate ($200-400/yr) required for distribution

### Cross-Cutting Concerns Identified

1. **Platform abstraction** — Global hotkeys, IPC socket paths, config/data directory paths, autostart mechanisms, and accessibility permissions all differ per OS. Requires trait-based `Platform` abstraction with `#[cfg(target_os)]` implementations.
2. **IPC type safety** — tauri-specta generates TypeScript bindings from Rust commands. Must be set up from day one; retrofitting is expensive.
3. **Error propagation chain** — Rust services → `thiserror` enum → Tauri command serialization → TypeScript error handling. Consistent error shape across the entire stack.
4. **Performance budget enforcement** — Sub-150ms hotkey, sub-100ms search, sub-500ms save, sub-50ms dismiss. These targets constrain implementation choices at every layer (pre-created hidden window, FTS5 indexing, debounced WAL writes, focus management).
5. **Data integrity** — WAL mode, `PRAGMA synchronous = NORMAL`, debounced atomic writes, crash-safe recovery. Touches auto-save, database layer, and event feedback system.
6. **Security scoping** — Tauri v2 capability/permission ACL controls what the frontend can invoke. Must be designed per-window, not globally.

## Starter Template Evaluation

### Primary Technology Domain

Cross-platform desktop application (Tauri v2 + React) based on project requirements analysis. The stack is fully validated by the technical research — no open technology questions remain.

### Starter Options Considered

| Option | Template | Match to Stack | License | Verdict |
|---|---|---|---|---|
| Official scaffold | `create-tauri-app` React+TS | Base only — missing Tailwind, shadcn, Zustand, tauri-specta | MIT | Clean but minimal |
| kitlib/tauri-app-template | Tauri v2 + React 19 + shadcn/ui + tauri-specta | ~85% match — includes unwanted i18n, TanStack Query, custom titlebar | MIT | Close but carries bloat |
| dannysmith/tauri-template | Production-ready, comprehensive docs | ~80% match | **AGPL-3.0** | License incompatible with MIT |
| Custom from official | Official scaffold + manual additions | 100% match | MIT | Recommended |

### Selected Starter: Custom Scaffold from Official `create-tauri-app`

**Rationale for Selection:**
Notey's stack is precisely defined. Starting from the official scaffold and adding each dependency gives full control over the architecture, avoids carrying unwanted features, and ensures MIT license compliance throughout. Community templates (kitlib, dannysmith) serve as reference implementations for integration patterns.

**Initialization Command:**

```bash
npm create tauri-app@latest notey -- --template react-ts
```

**Post-scaffold additions (in order):**
1. Tailwind CSS v4 + configuration
2. shadcn/ui initialization and base components
3. Zustand for frontend state management
4. tauri-specta v2 for type-safe IPC bindings
5. rusqlite + FTS5 setup in Rust backend
6. System tray via `tray-icon` feature flag
7. Global shortcuts via `tauri-plugin-global-shortcut`
8. Auto-start via `tauri-plugin-autostart`
9. Vitest configuration for frontend testing

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
- Rust stable (backend) + TypeScript strict mode (frontend)
- React 19 with Vite dev server and hot-reload
- Tauri v2 (latest: v2.10.3) process model with Core + WebView architecture

**Styling Solution:**
- Tailwind CSS v4 — utility-first, conservative baseline for cross-WebView consistency
- shadcn/ui — accessible, keyboard-friendly components built on Radix UI primitives, copied into project for full control

**Build Tooling:**
- Vite for frontend bundling with hot-reload
- Cargo for Rust compilation with incremental builds
- `tauri-apps/tauri-action` for CI/CD cross-platform builds

**Testing Framework:**
- Vitest for React component and Zustand store tests
- `cargo test` for Rust service and database integration tests
- WebDriver (`tauri-driver`) for critical e2e paths

**Code Organization:**
- Feature-based frontend structure (bulletproof-react pattern)
- Domain-based Rust backend modules (commands/services/db/platform)
- Thin Tauri command handlers delegating to testable services

**Development Experience:**
- `tauri dev` for combined frontend hot-reload + Rust rebuild
- WebView DevTools (Ctrl+Shift+I) for frontend debugging
- tauri-specta compile-time type checking across IPC boundary

**Reference Templates:**
- kitlib/tauri-app-template — reference for tauri-specta wiring, system tray, global shortcuts, shadcn/ui integration
- dannysmith/tauri-template — reference for cross-platform patterns, crash recovery, logging architecture (AGPL — reference only, not for code reuse)

**Note:** Project initialization using this command should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Database schema design with FTS5 external content tables
- Editor component selection (CodeMirror 6)
- CLI ↔ App communication protocol (JSON over Unix sockets)
- Tauri capability/permission scoping per window

**Important Decisions (Shape Architecture):**
- Migration strategy (rusqlite_migration)
- Zustand store organization (per-feature slices)
- Logging strategy (tauri-plugin-log + console wrapper)
- Event naming conventions (kebab-case)
- CLI input validation approach

**Deferred Decisions (Post-MVP):**
- Code signing certificates — macOS ($99/yr) and Windows ($200-400/yr) deferred until community traction justifies the cost. Target users are developers who can bypass Gatekeeper/SmartScreen. Revisit when non-developer adoption becomes a goal.
- Dynamic plugin loading — Trait interfaces designed now; runtime loading mechanism deferred
- Encryption at rest — Future consideration based on community demand
- Cloud sync — Explicitly deferred; local-first is a feature for v1

### Data Architecture

**Database: SQLite + FTS5, WAL mode, single `Mutex<Connection>`**
- Already decided in technical research and starter evaluation
- Single connection per process — no connection pool for a single-user desktop app
- WAL mode for concurrent read/write during auto-save
- `PRAGMA synchronous = NORMAL`, `PRAGMA busy_timeout = 5000`, `PRAGMA foreign_keys = ON`, `PRAGMA cache_size = -10000`

**Schema Design:**

Core tables:
- **notes** — `id` (INTEGER PRIMARY KEY), `title` (TEXT), `content` (TEXT NOT NULL), `format` (TEXT NOT NULL DEFAULT 'markdown', CHECK IN ('markdown', 'plaintext')), `workspace_id` (INTEGER REFERENCES workspaces), `created_at` (TEXT NOT NULL), `updated_at` (TEXT NOT NULL), `deleted_at` (TEXT NULL), `is_trashed` (INTEGER NOT NULL DEFAULT 0)
- **workspaces** — `id` (INTEGER PRIMARY KEY), `name` (TEXT NOT NULL), `path` (TEXT NOT NULL UNIQUE), `created_at` (TEXT NOT NULL)
- **notes_fts** — FTS5 virtual table with `content=notes, content_rowid=id` (external content). Indexes `title` and `content` columns. Synced via SQLite triggers on INSERT, UPDATE, DELETE.

FTS5 external content approach chosen over standalone table: avoids data duplication, is the idiomatic FTS5 pattern, and keeps the database clean. Triggers handle synchronization automatically.

**Migration Strategy: `rusqlite_migration`**
- Ordered migrations applied on startup
- Schema version tracked automatically
- Each migration is a SQL string compiled into the binary
- Rationale: Purpose-built for rusqlite, minimal API, well-maintained

### Security

**Tauri v2 Capability/Permission Design:**
- Main editor window: capabilities for note CRUD, search, config, workspace, export commands
- Future settings window: config-related capabilities only
- Clipboard monitoring: scoped capability, only granted when user opts in
- File system access: scoped to user-selected export directories via Tauri's scope system
- Default-deny model — windows with no matching capability have zero IPC access

**CLI Input Validation:**
- SQL injection prevention: parameterized queries via rusqlite (native protection)
- Maximum note size: 1MB configurable limit — prevents memory issues from `cat huge_file | notey add --stdin`
- Path validation: `std::fs::canonicalize()` for all file paths to prevent path traversal
- Workspace path validation: must resolve to an existing directory

**IPC Socket Security:**
- User-scoped socket paths: `/run/user/<uid>/notey.sock` (Linux), platform equivalents elsewhere
- Socket file permissions: owner-only (0600 on Unix)
- No authentication token for v1 — socket file permissions provide user isolation on shared systems

**Zero Network (NFR12):**
- No telemetry, analytics, update checks, or any outbound connections
- CSP configured to block all external resources
- Auto-updater is user-initiated only (check for updates from UI/CLI, not automatic)

### API & Communication Patterns

**Tauri IPC (Frontend ↔ Rust Backend):**
- **Commands** (request-response): Note CRUD, search, config, workspace, export operations
- **Events** (push): Auto-save confirmation, workspace change notifications, clipboard capture events
- **Channels** (streaming): Reserved for future use (large export progress, CLI output streaming)
- Type safety enforced by tauri-specta v2 — compile-time TypeScript bindings from Rust commands

**CLI ↔ Desktop App Protocol: JSON over Unix Sockets / Named Pipes**
- Protocol: JSON-encoded request/response over `interprocess` local sockets
- Request format: `{ "command": "add", "args": { "content": "...", "workspace": "..." } }`
- Response format: `{ "ok": true, "data": { ... } }` or `{ "ok": false, "error": "..." }`
- Rationale: Human-readable, debuggable with standard tools, negligible performance difference at Notey's message sizes. serde_json is zero-effort in Rust.

**Event Naming Convention: kebab-case**
- Pattern: `note-saved`, `workspace-changed`, `clipboard-captured`, `search-completed`
- Rationale: Standard web/Tauri ecosystem convention, reads naturally

**Error Handling Standards:**
- Rust: `thiserror` enum (`NoteyError`) with variants for Database, NotFound, Workspace, Io, Validation
- Tauri serialization: `impl serde::Serialize for NoteyError` — errors serialize as strings to frontend
- TypeScript: Catch `invoke()` errors and display user-friendly messages via toast/notification
- CLI: Errors written to stderr with non-zero exit code

### Frontend Architecture

**Editor Component: CodeMirror 6**
- Rationale: Lightweight (~150KB), first-class Markdown support, excellent syntax highlighting, keyboard-first navigation, extensible via extensions API. Used by major projects (Obsidian, Replit). Natural fit for a developer notepad.
- Rejected alternatives: Monaco (5MB, overkill), Tiptap (rich-text oriented, not developer-grade), plain textarea (no syntax highlighting)
- Configuration: Markdown mode by default, optional language detection for code blocks, vim keybindings extension available for Phase 2

**State Management: Per-Feature Zustand Stores**
- `useEditorStore` — active tab, cursor position, unsaved state, editor configuration
- `useSearchStore` — search query, results, filters, search mode
- `useWorkspaceStore` — active workspace, workspace list, workspace switching state
- `useSettingsStore` — theme, font, shortcuts, layout mode
- Rationale: Separate stores avoid unnecessary re-renders, map cleanly to feature-based directory structure, simpler than combined store with slice pattern

**Routing: Internal View Switching (No URL Router)**
- Notey is a single-window app with views (editor, search, settings, onboarding) managed by Zustand state
- No React Router or URL-based routing — desktop apps don't have URLs
- View transitions driven by command palette, keyboard shortcuts, and UI interactions

**Component Architecture:**
- shadcn/ui as the base component library (Radix UI primitives, full keyboard accessibility)
- Feature components own their layout and behavior
- Shared components in `src/shared/components/` for cross-feature UI elements

### Infrastructure & Deployment

**Logging: `tauri-plugin-log` (Rust) + Console Wrapper (TypeScript)**
- Rust: `tauri-plugin-log` writes to platform-standard log directories with configurable log levels. Uses the `log` crate facade — all Rust code uses `log::info!()`, `log::error!()`, etc.
- TypeScript: Thin wrapper around `console.*` methods with timestamps and level prefixes. Can be disabled in production builds.
- Log location: `$XDG_DATA_HOME/notey/logs/` (Linux), platform equivalents elsewhere

**CI/CD: GitHub Actions + tauri-action**
- Matrix build: Windows x64, macOS x64 + ARM64, Linux x64 + ARM64
- Caching: `swatinem/rust-cache@v2` for Cargo builds, Node.js cache for npm
- Release automation: Conventional Commits + Release Please for version bumps and changelog
- Artifacts: MSI (Windows), DMG (macOS), DEB + AppImage (Linux) — all unsigned for v1

**Code Signing: Deferred**
- Not required for v1 launch targeting developer audience
- macOS users bypass Gatekeeper via right-click → Open or `xattr -cr`
- Windows users bypass SmartScreen via "More info" → "Run anyway"
- Revisit when adoption extends beyond developer audience or community requests it

### Decision Impact Analysis

**Implementation Sequence:**
1. Project scaffold + Tailwind + shadcn/ui + Zustand + tauri-specta (foundation)
2. SQLite database + FTS5 + migrations + note CRUD service (data layer)
3. CodeMirror 6 editor + auto-save + multi-tab (core UI)
4. Global hotkey + floating window + dismiss/focus management (capture loop)
5. Search service + FTS5 queries + search UI (retrieval)
6. CLI binary + IPC socket server + workspace detection (developer power features)
7. System tray + auto-start + command palette + configuration (system integration)
8. Onboarding + export + soft-delete + cross-platform polish (distribution readiness)

**Cross-Component Dependencies:**
- tauri-specta must be configured before any Tauri commands are written (step 1)
- Database schema must be finalized before note service, search service, and CLI can be built (step 2)
- CodeMirror 6 configuration affects auto-save debounce wiring and Zustand editor store shape (step 3)
- IPC socket protocol must be defined before both the CLI binary and the socket server can be implemented (step 6)
- Tauri capability definitions must match all implemented commands before distribution (step 8)

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
18 areas where AI agents could make different choices, organized into 5 categories: naming (6), structure (4), format (4), communication (3), process (1).

### Naming Patterns

**Database Naming Conventions:**
- Tables: `snake_case`, plural — `notes`, `workspaces`
- Columns: `snake_case` — `workspace_id`, `created_at`, `is_trashed`
- Foreign keys: `{referenced_table_singular}_id` — `workspace_id`
- Indexes: `idx_{table}_{column}` — `idx_notes_workspace_id`
- FTS table: `{table}_fts` — `notes_fts`

**Rust Naming Conventions:**
- Functions/variables/modules: `snake_case` — `create_note`, `note_service`
- Types/structs/enums: `PascalCase` — `Note`, `NoteyError`, `NoteFormat`
- Constants: `SCREAMING_SNAKE_CASE` — `MAX_NOTE_SIZE`, `DEFAULT_DEBOUNCE_MS`
- Tauri commands: `snake_case` — `#[tauri::command] fn create_note()`

**TypeScript Naming Conventions:**
- Variables/functions: `camelCase` — `createNote`, `useAutoSave`
- Components: `PascalCase` — `EditorPane`, `SearchBar`
- Types/interfaces: `PascalCase`, no `I` prefix — `Note`, `Workspace`, not `INote`
- Constants: `SCREAMING_SNAKE_CASE` — `MAX_NOTE_SIZE`
- Zustand stores: `use{Feature}Store` — `useEditorStore`, `useSearchStore`

**Cross-Boundary Serialization:**
- All Rust structs crossing IPC use `#[serde(rename_all = "camelCase")]`
- Rust `workspace_id` → TypeScript `workspaceId` automatically via serde
- tauri-specta generates TypeScript types matching the camelCase JSON shape
- Rule: Never manually write TypeScript types for Tauri command inputs/outputs — always use generated bindings

**File Naming:**
- Rust files: `snake_case.rs` — `note_service.rs`, `search_repo.rs`
- TypeScript components: `PascalCase.tsx` — `EditorPane.tsx`, `SearchBar.tsx`
- TypeScript hooks: `camelCase.ts` — `useAutoSave.ts`, `useDebounce.ts`
- TypeScript stores: `camelCase.ts` — `editorStore.ts`, `searchStore.ts`
- TypeScript utilities: `camelCase.ts` — `formatDate.ts`, `logger.ts`
- Test files: `{source}.test.ts(x)` — `EditorPane.test.tsx`, `editorStore.test.ts`

**Tauri Command Naming:**
- Rust: `snake_case` — `create_note`, `search_notes`, `get_workspace`
- TypeScript (via tauri-specta): `camelCase` — `createNote`, `searchNotes`, `getWorkspace`
- Pattern: verb_noun — `create_note`, `update_note`, `delete_note`, `search_notes`, `list_workspaces`

### Structure Patterns

**Test Organization:**
- Rust unit tests: `#[cfg(test)] mod tests` block at the bottom of each source file
- Rust integration tests: `src-tauri/tests/` directory with one file per test domain (`db_tests.rs`, `search_tests.rs`)
- TypeScript tests: co-located as `*.test.ts(x)` next to source files — `EditorPane.test.tsx` lives beside `EditorPane.tsx`
- No separate `__tests__` directories — co-location makes it obvious when tests are missing

**Rust Module Style:**
- Use `mod.rs` within directories — `commands/mod.rs` re-exports all command modules
- Each module file is focused on one domain — `commands/notes.rs` has only note commands
- `lib.rs` is the app entry point — sets up plugins, state, and command registration

**Feature Directory Convention:**
- Each feature in `src/features/{name}/` contains:
  - `components/` — React components specific to this feature
  - `hooks/` — Custom hooks for this feature
  - `store.ts` — Zustand store for this feature's state
- No `index.ts` barrel files — import directly from source files (`import { EditorPane } from '@/features/editor/components/EditorPane'`)
- Rationale: Barrel files create circular dependency risks and make tree-shaking harder

**Tauri Capability Files:**
- Location: `src-tauri/capabilities/`
- One file per window: `main-window.json`
- Naming: `{window-label}.json`
- Each capability file lists only the permissions that window needs

### Format Patterns

**Date/Time Format:**
- Storage (SQLite): ISO 8601 TEXT — `2026-04-02T22:06:31.009Z`
- JSON (IPC): ISO 8601 string — `"2026-04-02T22:06:31.009Z"`
- Rust: `chrono::Utc::now().to_rfc3339()` for generation
- TypeScript display: `Intl.DateTimeFormat` for localized formatting
- Rule: Never store Unix timestamps. Never format dates in Rust for display — formatting is a frontend concern.

**ID Strategy:**
- Integer autoincrement — `INTEGER PRIMARY KEY` (SQLite aliases to rowid)
- Not UUIDs — simpler, faster, sufficient for single-user local database
- IDs are opaque to the frontend — never assume ordering or do arithmetic on IDs

**JSON Field Naming:**
- `camelCase` in all JSON crossing the IPC boundary — enforced by `#[serde(rename_all = "camelCase")]`
- Consistent across Tauri commands, events, and CLI ↔ App socket protocol
- Example: `{ "workspaceId": 1, "createdAt": "2026-04-02T22:06:31.009Z", "isTrashed": false }`

**Null Handling:**
- Rust: `Option<T>` — `None` serializes to JSON `null`
- TypeScript: `T | null` — never use `undefined` for "no value" in data models
- Database: `NULL` columns — never use empty strings as null substitutes
- Pattern: `deletedAt: null` means not deleted. `deletedAt: "2026-04-02T..."` means soft-deleted.

### Communication Patterns

**Zustand State Update Pattern:**
- Immutable updates via object spread — `set((state) => ({ notes: [...state.notes, note] }))`
- Each action is a named function on the store — `addNote(note)`, `removeNote(id)`, `setSearchQuery(query)`
- Never expose raw `setState` to components — always use named actions
- Selectors for derived state — `useEditorStore((s) => s.activeTab)`

**Loading/Error State Shape:**
- Every store that involves async operations uses this shape:

```typescript
{
  data: T | null,
  isLoading: boolean,
  error: string | null
}
```

- `isLoading` and `error` reset to `false` / `null` at the start of each new request
- No global loading state — each feature store manages its own
- Components show loading/error UI based on their own store's state

**Tauri Event Payload Structure:**
- All events carry a typed payload: `{ timestamp: string, data: T }`
- Events with no meaningful data: `{ timestamp: string, data: null }`
- Event names: kebab-case — `note-saved`, `workspace-changed`
- Example: `emit('note-saved', { timestamp: new Date().toISOString(), data: { noteId: 42 } })`

### Process Patterns

**Auto-Save Implementation:**
- Debounce timer: 300ms, reset on each keystroke
- Flow: keystroke → reset timer → timer fires → invoke `updateNote` command → on success emit `note-saved` event → frontend shows "Saved" indicator for 2 seconds
- On error: log error via `tauri-plugin-log`, show "Save failed" indicator, no retry loop — next user keystroke triggers the next save attempt naturally
- Edge case: window dismiss (Esc) during pending save → flush immediately (bypass debounce), wait for write confirmation before hiding window

**Error Handling Flow:**
- Rust services return `Result<T, NoteyError>`
- Tauri commands propagate errors to frontend as serialized strings
- Frontend catches errors in `try/catch` around `invoke()` calls
- User-facing errors shown via toast notification (shadcn/ui Toast component)
- Technical errors logged to `tauri-plugin-log`, not shown to user
- CLI errors written to stderr with descriptive message and non-zero exit code

**Component Loading Pattern:**
- Use Suspense boundaries at feature level, not per-component
- Skeleton loaders for content areas (search results, note list)
- No full-page spinners — the app should always feel responsive
- Initial app load: show the window immediately with empty state, populate asynchronously

### Enforcement Guidelines

**All AI Agents MUST:**
- Use tauri-specta generated types for all Tauri command invocations — never manually type `invoke()` calls
- Apply `#[serde(rename_all = "camelCase")]` on every Rust struct that crosses the IPC boundary
- Co-locate tests next to source files (TypeScript) or within `#[cfg(test)]` blocks (Rust)
- Use named Zustand actions — never raw `setState` in components
- Use parameterized queries for all database operations — never string interpolation in SQL
- Use `chrono` for all date/time operations in Rust — never manual string formatting
- Validate file paths with `std::fs::canonicalize()` before any filesystem operation

**Pattern Verification:**
- `cargo clippy` enforces Rust naming and common anti-patterns
- ESLint with TypeScript strict rules enforces frontend conventions
- tauri-specta compilation fails if Rust/TypeScript types diverge
- `cargo test` and `vitest` run in CI on every push

### Pattern Examples

**Good:**
```rust
#[derive(Debug, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: i64,
    pub title: Option<String>,
    pub content: String,
    pub workspace_id: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
    pub is_trashed: bool,
}
```

**Anti-Pattern:**
```rust
// BAD: No serde rename — TypeScript will receive snake_case fields
#[derive(Serialize)]
pub struct Note {
    pub workspace_id: i64,  // TypeScript gets "workspace_id" instead of "workspaceId"
}
```

**Good:**
```typescript
// Named action on store
const useEditorStore = create<EditorState>((set) => ({
  activeTabId: null,
  setActiveTab: (id: number) => set({ activeTabId: id }),
}))

// Component uses named action
const { setActiveTab } = useEditorStore()
```

**Anti-Pattern:**
```typescript
// BAD: Raw setState exposed to component
useEditorStore.setState({ activeTabId: 42 })
```

## Project Structure & Boundaries

### Complete Project Directory Structure

```
notey/
├── .github/
│   └── workflows/
│       ├── ci.yml                          # Lint, test, clippy on every push/PR
│       └── release.yml                     # Cross-platform build + GitHub Release via tauri-action
├── .gitignore
├── LICENSE                                 # MIT
├── README.md
├── package.json                            # Frontend dependencies, scripts
├── package-lock.json
├── tsconfig.json                           # TypeScript strict mode config
├── vite.config.ts                          # Vite build config with Tauri integration
├── tailwind.config.ts                      # Tailwind CSS v4 config
├── vitest.config.ts                        # Vitest test runner config
├── eslint.config.js                        # ESLint flat config with TypeScript rules
├── .prettierrc                             # Prettier formatting rules
│
├── src/                                    # React frontend
│   ├── app/
│   │   ├── App.tsx                         # Root component, provider setup
│   │   ├── App.css                         # Global styles (Tailwind imports)
│   │   └── providers.tsx                   # Zustand + Tauri context providers
│   │
│   ├── features/
│   │   ├── editor/                         # FR1-10, FR23-26: Note editing + multi-tab
│   │   │   ├── components/
│   │   │   │   ├── EditorPane.tsx          # CodeMirror 6 wrapper component
│   │   │   │   ├── EditorPane.test.tsx
│   │   │   │   ├── TabBar.tsx             # Tab strip with reorder, close
│   │   │   │   ├── TabBar.test.tsx
│   │   │   │   ├── SaveIndicator.tsx      # "Saved" / "Save failed" feedback
│   │   │   │   └── FormatToggle.tsx       # Markdown / plaintext toggle
│   │   │   ├── hooks/
│   │   │   │   ├── useAutoSave.ts         # Debounced auto-save logic
│   │   │   │   ├── useAutoSave.test.ts
│   │   │   │   └── useEditorKeymap.ts     # Editor keyboard shortcuts
│   │   │   └── store.ts                   # useEditorStore — tabs, cursor, unsaved state
│   │   │
│   │   ├── search/                         # FR11-15: Full-text search
│   │   │   ├── components/
│   │   │   │   ├── SearchOverlay.tsx       # Search modal/overlay
│   │   │   │   ├── SearchOverlay.test.tsx
│   │   │   │   ├── SearchBar.tsx          # Input with fuzzy matching
│   │   │   │   └── SearchResults.tsx      # Result list with highlighting
│   │   │   ├── hooks/
│   │   │   │   ├── useSearch.ts           # Search invocation + result handling
│   │   │   │   └── useDebounce.ts         # Generic debounce hook
│   │   │   └── store.ts                   # useSearchStore — query, results, filters
│   │   │
│   │   ├── workspace/                      # FR29-35: Workspace management
│   │   │   ├── components/
│   │   │   │   ├── WorkspaceSelector.tsx  # Workspace picker dropdown
│   │   │   │   └── WorkspaceSelector.test.tsx
│   │   │   └── store.ts                   # useWorkspaceStore — active workspace, list
│   │   │
│   │   ├── command-palette/                # FR27-28: Command palette
│   │   │   ├── components/
│   │   │   │   ├── CommandPalette.tsx     # Cmd+P fuzzy command search
│   │   │   │   └── CommandPalette.test.tsx
│   │   │   └── commands.ts               # Command registry (actions + shortcuts)
│   │   │
│   │   ├── settings/                       # FR44-48: Configuration
│   │   │   ├── components/
│   │   │   │   ├── SettingsView.tsx       # Settings panel
│   │   │   │   ├── ShortcutEditor.tsx     # Keyboard shortcut configuration
│   │   │   │   └── ThemeToggle.tsx        # Dark/light theme switch
│   │   │   └── store.ts                   # useSettingsStore — theme, font, shortcuts
│   │   │
│   │   ├── onboarding/                     # FR52-55: First-run experience
│   │   │   └── components/
│   │   │       ├── OnboardingOverlay.tsx  # First-run welcome + hotkey setup
│   │   │       └── AccessibilityGuide.tsx # macOS permission guidance
│   │   │
│   │   └── trash/                          # FR5-7: Soft-delete management
│   │       └── components/
│   │           └── TrashView.tsx          # Trashed notes list, restore/permanent delete
│   │
│   ├── shared/
│   │   ├── components/                     # Reusable UI (shadcn/ui wrappers)
│   │   │   └── ui/                        # shadcn/ui components (Button, Toast, Dialog, etc.)
│   │   ├── hooks/
│   │   │   └── useTauriEvent.ts          # Typed Tauri event listener hook
│   │   └── lib/
│   │       ├── logger.ts                  # Console wrapper with timestamps/levels
│   │       └── constants.ts               # Frontend constants
│   │
│   ├── generated/
│   │   └── bindings.ts                    # tauri-specta auto-generated TypeScript types
│   │
│   ├── main.tsx                           # React entry point
│   └── vite-env.d.ts                      # Vite type declarations
│
├── src-tauri/                              # Rust backend
│   ├── Cargo.toml                         # Rust dependencies
│   ├── Cargo.lock
│   ├── build.rs                           # Build script (tauri-specta type generation)
│   ├── tauri.conf.json                    # Tauri app configuration
│   ├── icons/                             # App icons (all platforms)
│   ├── capabilities/
│   │   └── main-window.json              # Capability/permission ACL for main window
│   │
│   ├── src/
│   │   ├── lib.rs                         # App setup: plugins, state init, command registration
│   │   ├── errors.rs                      # NoteyError enum (thiserror + Serialize)
│   │   │
│   │   ├── commands/                       # Thin Tauri command handlers
│   │   │   ├── mod.rs                     # Re-exports all command modules
│   │   │   ├── notes.rs                   # create_note, update_note, delete_note, restore_note, get_note
│   │   │   ├── search.rs                  # search_notes
│   │   │   ├── workspace.rs               # get_workspace, list_workspaces, set_workspace
│   │   │   ├── config.rs                  # get_config, update_config
│   │   │   └── export.rs                  # export_markdown, export_json
│   │   │
│   │   ├── services/                       # Business logic (testable without Tauri)
│   │   │   ├── mod.rs
│   │   │   ├── note_service.rs            # Note CRUD, auto-save, soft-delete logic
│   │   │   ├── search_service.rs          # FTS5 search, fuzzy matching, result ranking
│   │   │   ├── workspace_service.rs       # Git repo detection, workspace management
│   │   │   ├── config_service.rs          # TOML config read/write
│   │   │   ├── export_service.rs          # Markdown/JSON export generation
│   │   │   └── clipboard_service.rs       # Clipboard monitoring (Phase 2)
│   │   │
│   │   ├── db/                             # Database layer
│   │   │   ├── mod.rs                     # Connection init, PRAGMA setup, migration runner
│   │   │   ├── schema.rs                  # Table definitions, FTS5 setup, triggers
│   │   │   ├── notes_repo.rs              # Note CRUD queries (parameterized)
│   │   │   └── search_repo.rs             # FTS5 search queries
│   │   │
│   │   ├── models/                         # Shared data types (serde Serialize/Deserialize + specta::Type)
│   │   │   ├── mod.rs
│   │   │   ├── note.rs                    # Note, CreateNoteRequest, UpdateNoteRequest
│   │   │   ├── workspace.rs               # Workspace, WorkspaceInfo
│   │   │   └── config.rs                  # AppConfig, ShortcutConfig
│   │   │
│   │   ├── platform/                       # Platform-specific code behind #[cfg(target_os)]
│   │   │   ├── mod.rs                     # Platform trait + conditional module imports
│   │   │   ├── linux.rs                   # XDG paths, Wayland portal integration, Unix socket paths
│   │   │   ├── macos.rs                   # Accessibility permissions, macOS paths, NSPanel behavior
│   │   │   └── windows.rs                 # Named pipes, Registry autostart, Windows paths
│   │   │
│   │   └── ipc/                            # CLI ↔ Desktop App socket server
│   │       ├── mod.rs
│   │       ├── socket_server.rs           # Unix socket / named pipe listener
│   │       └── protocol.rs               # JSON request/response types for CLI protocol
│   │
│   └── tests/                              # Rust integration tests
│       ├── db_tests.rs                    # SQLite + FTS5 integration tests (temp database)
│       ├── search_tests.rs                # Search queries against real FTS5 index
│       └── ipc_tests.rs                   # Socket protocol integration tests
│
├── notey-cli/                              # Standalone CLI binary (separate Cargo crate)
│   ├── Cargo.toml                         # CLI-specific dependencies (clap, interprocess, serde_json)
│   └── src/
│       ├── main.rs                        # CLI entry point, argument parsing (clap)
│       └── client.rs                      # Socket client — connects to desktop app IPC
│
└── docs/                                   # Project documentation (future)
```

### Architectural Boundaries

**IPC Boundary (Frontend ↔ Rust Backend):**
- All communication via tauri-specta typed commands and events
- Frontend NEVER accesses database, filesystem, or system APIs directly
- Commands in `src-tauri/src/commands/` are the sole entry points
- Capabilities in `src-tauri/capabilities/` enforce which commands are accessible

**Service Boundary (Commands ↔ Business Logic):**
- Command handlers in `commands/` are thin — validate input, delegate to service, return result
- Services in `services/` contain all business logic, are testable without Tauri runtime
- Services accept a database connection as a parameter (dependency injection via function argument)

**Data Boundary (Services ↔ Database):**
- All SQL lives in `db/` repository files — services never write raw SQL
- Repository functions accept `&Connection` and return `Result<T, NoteyError>`
- All queries use parameterized statements — no string interpolation

**Platform Boundary (Core ↔ Platform-Specific):**
- `platform/mod.rs` defines traits for platform-varying behavior
- Each OS module (`linux.rs`, `macos.rs`, `windows.rs`) implements the traits
- Conditional compilation via `#[cfg(target_os)]` — only one implementation compiled per target
- Rest of the codebase is platform-agnostic

**CLI Boundary (CLI Binary ↔ Desktop App):**
- `notey-cli/` is a separate Cargo crate with its own `Cargo.toml`
- Communicates with desktop app exclusively via JSON over Unix socket / named pipe
- Shares no Rust code with `src-tauri/` — protocol types are duplicated (simple JSON structs)
- CLI works independently; graceful error when desktop app not running (FR38)

### Requirements to Structure Mapping

| FR Category | Rust Backend | Frontend | CLI |
|---|---|---|---|
| Note Capture (FR1-10) | `commands/notes.rs`, `services/note_service.rs`, `db/notes_repo.rs` | `features/editor/` | `notey-cli/` (FR2-3) |
| Search (FR11-15) | `commands/search.rs`, `services/search_service.rs`, `db/search_repo.rs` | `features/search/` | `notey-cli/` (FR14-15) |
| Window Mgmt (FR16-22) | `lib.rs` (window config), `platform/` (hotkey) | `app/App.tsx` (layout modes) | — |
| Multi-Tab (FR23-26) | — | `features/editor/components/TabBar.tsx` | — |
| Cmd Palette (FR27-28) | — | `features/command-palette/` | — |
| Workspace (FR29-35) | `commands/workspace.rs`, `services/workspace_service.rs` | `features/workspace/` | `notey-cli/` (cwd detection) |
| CLI/IPC (FR36-38) | `ipc/socket_server.rs`, `ipc/protocol.rs` | — | `notey-cli/src/` |
| System Integration (FR39-43) | `lib.rs` (tray, autostart plugins) | — | — |
| Configuration (FR44-48) | `commands/config.rs`, `services/config_service.rs` | `features/settings/` | — |
| Data Export (FR49-51) | `commands/export.rs`, `services/export_service.rs` | Export trigger in UI | — |
| Onboarding (FR52-55) | `platform/macos.rs` (accessibility check) | `features/onboarding/` | — |
| Cross-Platform (FR56-58) | `platform/linux.rs`, `macos.rs`, `windows.rs` | Conservative CSS via Tailwind | — |

**Cross-Cutting Concerns Mapping:**
- **Error handling** → `src-tauri/src/errors.rs` (Rust) + `try/catch` in each feature's hooks (TypeScript)
- **Type safety** → `src-tauri/build.rs` (generation) + `src/generated/bindings.ts` (consumption)
- **Auto-save** → `features/editor/hooks/useAutoSave.ts` (frontend debounce) + `commands/notes.rs` → `services/note_service.rs` → `db/notes_repo.rs` (backend write)
- **Logging** → `tauri-plugin-log` (Rust, configured in `lib.rs`) + `shared/lib/logger.ts` (TypeScript)
- **Security** → `src-tauri/capabilities/main-window.json` (ACL) + `services/` (input validation)

### Data Flow

```
User Keystroke (CodeMirror 6)
  → useAutoSave hook (300ms debounce)
    → invoke('updateNote', { id, content }) [tauri-specta typed]
      → commands/notes.rs::update_note() [thin handler]
        → services/note_service.rs::update() [business logic]
          → db/notes_repo.rs::update() [parameterized SQL]
            → SQLite WAL write
          → FTS5 trigger auto-syncs search index
        → emit('note-saved', { timestamp, data: { noteId } })
      → Frontend receives event
    → SaveIndicator shows "Saved" for 2s

CLI: notey add "text"
  → notey-cli/src/main.rs (clap parses args)
    → notey-cli/src/client.rs connects to Unix socket
      → JSON request: { "command": "add", "args": { "content": "text", "workspace": "/path" } }
        → ipc/socket_server.rs receives request
          → services/note_service.rs::create() [same service as GUI]
            → db/notes_repo.rs::insert()
        → JSON response: { "ok": true, "data": { "noteId": 42 } }
    → CLI prints confirmation and exits
```

### Development Workflow Integration

**Development:**
- `npm run tauri dev` — starts Vite dev server (frontend hot-reload) + Rust build (auto-recompile on changes)
- Frontend changes: instant hot-reload in WebView
- Rust changes: automatic recompile (~30-60s incremental build)
- WebView DevTools: Ctrl+Shift+I for frontend debugging
- Rust logs: visible in terminal running `tauri dev`

**Testing:**
- `npm run test` — runs Vitest (frontend component + store tests)
- `cd src-tauri && cargo test` — runs Rust unit + integration tests
- Integration tests use in-memory or temp-file SQLite databases
- CI runs both in parallel via GitHub Actions matrix

**Build & Release:**
- `npm run tauri build` — produces platform-native installer
- CI: `tauri-apps/tauri-action` builds for all 5 targets (Win x64, macOS x64/ARM64, Linux x64/ARM64)
- Release Please automates version bumps + changelog from Conventional Commits
- Artifacts uploaded as GitHub Release assets

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All technology choices validated as compatible. Tauri v2.10.3 ecosystem (React 19, TypeScript, Vite, tauri-specta v2) is a proven stack with official templates and community validation. Database stack (rusqlite + FTS5 + rusqlite_migration) and supporting crates (thiserror, chrono, git2, interprocess, toml) are all well-maintained with no version conflicts. No contradictory decisions found.

**Pattern Consistency:**
Naming conventions form a coherent system: snake_case (Rust/SQL) → camelCase (TypeScript/JSON) with `#[serde(rename_all = "camelCase")]` at the serialization boundary. Event naming (kebab-case), file naming, and test co-location patterns are internally consistent and aligned with ecosystem conventions.

**Structure Alignment:**
Project directory structure directly supports all architectural decisions. Each boundary (IPC, Service, Data, Platform, CLI) has explicit directory separation. Feature-based frontend and domain-based backend both organize by functionality, making the FR-to-file mapping straightforward.

### Requirements Coverage Validation ✅

**Functional Requirements Coverage: 58/58**
All functional requirements have explicit architectural support with identified file locations. The Requirements to Structure Mapping table in the Project Structure section provides the complete FR → file mapping.

**Non-Functional Requirements Coverage: 23/23**
All NFRs are addressed by architectural decisions:
- Performance targets met through: pre-created hidden window (NFR1), debounced WAL writes (NFR2), FTS5 indexing (NFR3), Tauri lightweight runtime (NFR4-6), window hide with focus restore (NFR7)
- Security through: Tauri v2 capability ACL (NFR8), scoped filesystem (NFR9), parameterized queries (NFR10), user-scoped sockets (NFR11), zero network (NFR12)
- Reliability through: SQLite WAL + PRAGMA synchronous (NFR13-15), 30-day soft-delete (NFR16), atomic debounced writes (NFR17)
- Scalability through: FTS5 sub-linear indexing (NFR18-19), streaming export (NFR20)
- Accessibility through: shadcn/ui Radix primitives + keyboard-first design (NFR21-23)

### Implementation Readiness Validation ✅

**Decision Completeness:**
All critical and important decisions documented with specific technology versions, crate names, and rationale. Implementation patterns include concrete code examples for both good patterns and anti-patterns. Enforcement guidelines specify tooling (clippy, ESLint, tauri-specta) for automated verification.

**Structure Completeness:**
Complete project tree with ~70 files/directories explicitly defined. Every file has a comment explaining its purpose and which FRs it supports. Integration points documented via data flow diagrams.

**Pattern Completeness:**
18 conflict points identified and resolved with explicit conventions. Cross-boundary serialization (the highest-risk conflict area for a dual-language stack) has a clear, enforced pattern (serde rename_all + tauri-specta generation).

### Gap Analysis Results

**Critical Gaps:** None

**Important Gaps (1):**
- **Window Lifecycle Pattern:** The sub-150ms hotkey target requires a non-obvious implementation: the main editor window must be created at app startup and hidden (not destroyed). On hotkey press, the existing window is shown and focused — not created from scratch. On Esc, the window is hidden (not closed). This avoids window creation latency and is the standard pattern for global-hotkey-driven desktop apps. AI agents must implement show/hide, not create/destroy.

**Nice-to-Have Gaps (4):**
- Cargo workspace for shared protocol types between `src-tauri/` and `notey-cli/` — defer to post-v1 if protocol grows
- First-run detection via config file existence — implementation detail, not architectural
- GUI workspace fallback (last active workspace or unscoped view when no cwd available) — implementation detail
- CLI sidecar bundling config in `tauri.conf.json` — configuration detail

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed (58 FRs, 23 NFRs, 4 user journeys)
- [x] Scale and complexity assessed (Medium — low domain, medium platform)
- [x] Technical constraints identified (Tauri v2, WebView fragmentation, Wayland gap)
- [x] Cross-cutting concerns mapped (6 concerns: platform, type safety, errors, performance, data integrity, security)

**✅ Starter Template**
- [x] Technology domain identified (cross-platform desktop)
- [x] Starter options evaluated with license compatibility check
- [x] Selected: official scaffold + manual additions (MIT clean)
- [x] Post-scaffold addition sequence documented

**✅ Architectural Decisions**
- [x] Critical decisions documented with versions (SQLite/FTS5, CodeMirror 6, JSON/sockets, capability ACL)
- [x] Technology stack fully specified (15+ components with verified versions)
- [x] Integration patterns defined (Tauri IPC, CLI sockets, workspace detection)
- [x] Deferred decisions documented with rationale (code signing, dynamic plugins, encryption, cloud sync)

**✅ Implementation Patterns**
- [x] Naming conventions established (6 patterns: DB, Rust, TypeScript, cross-boundary, files, commands)
- [x] Structure patterns defined (4 patterns: tests, modules, features, capabilities)
- [x] Format patterns specified (4 patterns: dates, IDs, JSON fields, nulls)
- [x] Communication patterns documented (3 patterns: Zustand updates, loading/error state, event payloads)
- [x] Process patterns documented (auto-save, error handling, component loading)
- [x] Code examples provided for good patterns and anti-patterns

**✅ Project Structure**
- [x] Complete directory structure defined (~70 files/directories)
- [x] 5 architectural boundaries established (IPC, Service, Data, Platform, CLI)
- [x] FR-to-file mapping complete (12 categories → specific files)
- [x] Cross-cutting concerns mapped to locations
- [x] Data flow documented for both GUI and CLI paths

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High — all requirements covered, all decisions verified against current ecosystem data, comprehensive patterns with code examples

**Key Strengths:**
- Complete FR/NFR coverage with explicit file-to-requirement mapping
- Dual-language type safety enforced at compile time via tauri-specta
- Clear architectural boundaries prevent coupling between components
- Thin commands / thick services pattern enables testing without Tauri runtime
- Performance-critical patterns explicitly documented (window lifecycle, debounced saves, FTS5 indexing)

**Areas for Future Enhancement:**
- Cargo workspace for shared types if CLI protocol grows
- Wayland portal integration when Tauri global-hotkey PR #162 lands
- Dynamic plugin loading when community demand warrants
- Code signing when adoption extends beyond developer audience

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries — files go where the tree says they go
- Use tauri-specta generated types exclusively — never manually type IPC calls
- Refer to this document for all architectural questions before making independent decisions

**First Implementation Priority:**
```bash
npm create tauri-app@latest notey -- --template react-ts
```
Then follow the post-scaffold addition sequence from the Starter Template Evaluation section.
