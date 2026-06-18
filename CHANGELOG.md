# Changelog

All notable changes to Notey are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- In-app auto-updater: on startup Notey checks the GitHub Releases endpoint and
  shows a banner to install the new signed build and restart
  (`tauri-plugin-updater`).

### Changed
- Release workflow now signs updater artifacts and emits `latest.json`; it is also
  wired (commented) for later macOS/Windows OS code-signing. Release builds remain
  unsigned for now — see [docs/installation.md](docs/installation.md) for the
  per-OS "open anyway" steps.

## [0.1.0] - 2026-06-17

The first release of Notey — a fast, keyboard-driven, workspace-aware note-capture
desktop app built on Tauri 2, React 19, and Rust with a local SQLite store.

### Added

#### Capture & editing
- Always-on-top capture window (720×480) that launches hidden and is summoned from
  the system tray or a global hotkey.
- Global capture hotkey (default `Ctrl+Shift+N`, `Cmd+Shift+N` on macOS) that
  shows/focuses the window and toggles it away again.
- CodeMirror 6 editor with Markdown and plain-text formats and a per-note format
  toggle.
- Debounced auto-save with a live save-status indicator (idle / saving / saved /
  failed) and flush-on-dismiss.
- Multi-tab editing: open several notes at once, reorder tabs, and navigate with
  `Ctrl+Tab` / `Ctrl+Shift+Tab` / `Ctrl+1…9`.
- Session persistence — open tabs, cursor, and scroll position survive restarts.

#### Organization & discovery
- Workspaces tied to filesystem paths, with auto-detection and a status-bar
  workspace selector.
- Note list panel filtered to the active workspace or "All Workspaces".
- Full-text search (SQLite FTS5 with BM25 ranking) with match snippets, scoped to a
  workspace or global.
- Command palette (`Ctrl+P`) exposing every action with fuzzy search.

#### Lifecycle & data
- Soft-delete to trash with restore and permanent-delete, plus a configurable
  retention window (default 30 days) that auto-purges on startup.
- Export all notes to Markdown files or a single JSON document.

#### CLI integration
- A standalone `notey` CLI (`add`, `list`, `search`) that talks to the running app
  over a local IPC socket, with live desktop sync when notes are added.

#### Personalization & accessibility
- Light / dark / follow-system themes applied at boot (no flash).
- Configurable font size and family, and floating / half-screen / full-screen
  layout modes.
- Rebindable in-app shortcuts with conflict detection; settings persisted to
  `config.toml`.
- Keyboard-first navigation throughout, focus traps in overlays, and screen-reader
  announcements.

#### Platform integration
- System tray with open/quit, opt-in auto-start on login, and first-run onboarding
  (including macOS accessibility-permission guidance).
- Cross-platform builds for macOS (arm64/x64), Linux (x64/arm64), and Windows (x64).

### Known issues
- On pure Wayland sessions without XWayland, the OS-level global capture hotkey may
  be unavailable; the window remains summonable from the tray and a notice is shown.
  A native Wayland global-shortcut portal is planned (see [ROADMAP.md](ROADMAP.md)).

[Unreleased]: https://github.com/pbean/notey/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/pbean/notey/releases/tag/v0.1.0
