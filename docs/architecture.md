# Architecture

A high-level overview of how Notey is built. For exhaustive design records see the
planning artifacts under `_bmad-output/planning-artifacts/` (PRD, architecture
decision document, and epic breakdown).

## Stack

| Layer | Technology |
| --- | --- |
| Shell | [Tauri 2](https://tauri.app) (Wry webview) |
| Front end | React 19 + TypeScript, Vite, Tailwind CSS, Zustand |
| Editor | CodeMirror 6 |
| Back end | Rust |
| Storage | SQLite (via rusqlite) with FTS5 full-text search |
| IPC types | [tauri-specta](https://github.com/oscartbeaumont/tauri-specta) (generated TS bindings) |

## Shape

```
┌────────────────────────────────────────────┐
│  Tauri window (Wry webview)                  │
│  ┌────────────────────────────────────────┐  │
│  │ React front end (src/)                  │  │
│  │  feature modules: editor, tabs, search,  │  │
│  │  note-list, command-palette, settings,   │  │
│  │  trash, workspace, onboarding, theme …    │  │
│  └───────────────┬────────────────────────┘  │
│                  │ type-safe IPC (specta)      │
│  ┌───────────────▼────────────────────────┐  │
│  │ Rust back end (src-tauri/)              │  │
│  │  commands → services → db (SQLite/FTS5)  │  │
│  │  platform abstraction (mac/linux/win)    │  │
│  │  local socket server  ◄── notey CLI      │  │
│  └────────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

## Front end (`src/`)

Organized by **feature** rather than by file type — each feature owns its Zustand
store, components, and API calls. Shared UI primitives live in `components/ui/`.
The Rust↔TS contract is generated into `src/generated/bindings.ts`, so command and
event signatures are type-checked end to end.

## Back end (`src-tauri/`)

A layered design:

- **`commands/`** — thin `#[tauri::command]` handlers exposed to the front end.
- **`services/`** — business logic (notes, workspaces, search, config, export,
  onboarding, window layout).
- **`db/`** — SQLite schema, migrations, and the FTS5 search index.
- **`platform/`** — a trait-based abstraction isolating macOS/Linux/Windows
  specifics (data/config/socket paths, hotkey backend, accessibility).
- **`ipc/`** — a local socket server and protocol that lets the `notey` CLI drive
  the running app and emit live-sync events.

## Data & search

Notes live in a local SQLite database with WAL mode. Full-text search uses SQLite's
**FTS5** extension with BM25 ranking and an external-content table kept in sync via
triggers. Everything is local — there is no network server and no telemetry.

## IPC and the CLI

Beyond the webview↔Rust bridge, the back end runs a small **local socket server**.
The standalone `notey` CLI connects to it to add, list, and search notes; new notes
broadcast an event the desktop app listens for, so the UI updates live. See the
[CLI guide](cli.md).

## Platform integration

Notey registers a global capture hotkey, a system tray, and (optionally) auto-start
on login. The global shortcut backend is abstracted per platform; on pure Wayland
without XWayland the OS hotkey may be unavailable, in which case the window stays
reachable from the tray (a native Wayland portal is on the [roadmap](../ROADMAP.md)).
