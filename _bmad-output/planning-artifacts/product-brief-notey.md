---
title: "Product Brief: Notey"
status: "complete"
created: "2026-04-02"
updated: "2026-04-02"
inputs:
  - /home/pinkyd/dev/scratch-pad/README.md
  - /home/pinkyd/dev/scratch-pad/docs/USER_GUIDE.md
  - /home/pinkyd/dev/scratch-pad/docs/API_REFERENCE.md
  - /home/pinkyd/dev/scratch-pad/docs/PLUGIN_API.md
  - /home/pinkyd/dev/scratch-pad/docs/DEVELOPER_ONBOARDING.md
  - /home/pinkyd/dev/scratch-pad/docs/SECURITY_TESTING.md
  - /home/pinkyd/dev/scratch-pad/docs/INSTALLATION.md
---

# Product Brief: Notey (working title)

> **Note on naming:** "Notey" is a working title. Multiple existing apps, browser extensions, and npm packages use this name, creating potential discoverability and trademark concerns. Final name TBD before public launch.

## Background

Notey is a clean rewrite of [Scratch Pad](https://github.com/paulb/scratch-pad), a developer notepad that reached v0.4.0 with a working cross-platform app, 223 passing tests, and a plugin API. No code carries over — this is a fresh build using the BMad method to plan the full scope upfront and avoid the scope creep that plagued the original. Lessons learned from Scratch Pad inform the architecture, UI patterns, and feature priorities.

## Executive Summary

Developers think faster than they can organize. During a coding session, ideas, snippets, debugging observations, and TODOs surface constantly — and vanish just as fast if there's no frictionless way to capture them. The tools that exist today force a choice: use a heavyweight knowledge management app that breaks your focus, or scatter notes across random files, chat messages, and sticky notes you'll never find again.

Notey is a floating, keyboard-driven notepad that lives one hotkey away from any workflow. Press a global shortcut, a lightweight window appears instantly, you type, it auto-saves, you dismiss it and keep working. No app switching. No startup latency. No organizational decisions required. It's the developer's capture buffer — always there, never in the way.

Your notes never leave your machine. Built on Tauri (Rust + React), Notey is open source, local-first, and cross-platform (Windows, macOS, Linux — all first-class citizens). We refuse to waste your RAM on a notes app: Tauri's native runtime uses a fraction of Electron's footprint because a capture tool should be invisible until you need it. Designed from day one with a clean plugin architecture for future extensibility — without shipping any of that complexity to v1 users.

## The Problem

Developers operate in a state of deep focus that's expensive to interrupt and slow to recover. Studies estimate 15-25 minutes to regain full context after a disruption. Yet the need to capture information during coding is constant:

- A quick fix idea for a different file surfaces while debugging something else
- A terminal command sequence worth saving for later
- A meeting note or Slack snippet that needs to survive the session
- A TODO that will be forgotten if not written down in the next 10 seconds

**How developers cope today — badly:**

- **Obsidian / Notion** — powerful but heavyweight. Opening them is a context switch. Startup latency defeats the purpose. Overkill for ephemeral scratch notes.
- **VS Code scratch files / extensions** — tied to the editor being open and focused. Can't capture from a terminal session or a browser.
- **OS built-in notes (Sticky Notes, Apple Notes)** — not developer-aware. No syntax highlighting, no search that understands code, no keyboard-first design.
- **"A WhatsApp group with just me"** — a real pattern. That's how broken this workflow is.

The cost isn't just lost notes. It's lost flow.

## The Solution

Notey is a single-purpose desktop application that does one thing exceptionally well: instant note capture and retrieval for developers.

**Core experience:**
- **Global hotkey** (default: Ctrl+Shift+N / Cmd+Shift+N) summons a floating window from anywhere on the system
- **Auto-focus on input** — you're typing within milliseconds of pressing the shortcut
- **Auto-save** with real-time visual feedback — no manual save, no data loss anxiety
- **Dismiss with Esc** — the window disappears, your previous focus is undisturbed

**Power features:**
- **Full-text fuzzy search** across all notes, architected to support Boolean operators (AND/OR/NOT) as a future power-user layer without rewriting the search stack
- **Multi-tab editing** for working with related notes simultaneously
- **Command palette** (Ctrl+P) for quick access to all features
- **Markdown support** with syntax highlighting
- **Terminal integration** — Notey is a Unix citizen, not just a GUI app. A standalone `notey` CLI binary communicates with the running app via IPC, supporting `notey add "text"`, stdin piping (`docker logs | notey add --stdin`), and `notey search "query"`. This is the single most differentiating feature for terminal-heavy developers.
- **Configurable shortcuts, fonts, layout modes** (floating, half-screen, full-screen)
- **Complete keyboard navigation** — mouse optional
- **Auto-start and system tray** — Notey runs in the background and survives reboots, always one hotkey away
- **Data portability** — export all notes to Markdown files or JSON at any time. Your data is never locked in.
- **Workspace-aware notes** — auto-detects the active git repo or working directory and scopes notes to that project. Zero-effort organization that keeps your React project notes separate from your infrastructure notes without you ever creating a folder.
- **Clipboard capture** — watches for copied snippets and auto-captures them into a timestamped stream with optional annotation. The most universal developer capture pattern is copy-paste; Notey makes it a first-class workflow.

**Under the hood:**
- **Tauri (Rust)** backend — native performance at a fraction of Electron's memory footprint
- **SQLite + FTS5** — fast, local, full-text search with no external dependencies
- **React + TypeScript + Tailwind** frontend — modern, maintainable, well-tested
- **Plugin-ready architecture** — clean extension points from day one, no tech debt when plugins ship later
- **Sensible security** — input validation, safe IPC, leveraging Tauri v2's built-in permissions model

## What Makes This Different

| | Notey | Heynote | Obsidian | VS Code Extensions | OS Notes |
|---|---|---|---|---|---|
| Instant floating window | Yes | No | No | No | Partial |
| Global hotkey capture | Yes | No | Via plugins | No | No |
| Full-text fuzzy search | Yes | No | Yes | Limited | Basic |
| Multi-tab editing | Yes | No (blocks) | Yes | Yes | No |
| Terminal CLI integration | Yes | No | No | No | No |
| Workspace-aware (git/project) | Yes | No | Vault-based | No | No |
| Clipboard capture | Yes | No | No | No | No |
| Code-aware (syntax, monospace) | Yes | Yes | Via plugins | Yes | No |
| Lightweight runtime | Tauri (~50MB) | Electron (~200MB+) | Electron | N/A | Native |
| Cross-platform | Win/Mac/Linux | Win/Mac/Linux | Win/Mac/Linux | VS Code only | Per-OS |
| Data export (Markdown/JSON) | Yes | No | Yes (files) | N/A | No |
| Open source | Yes | Yes | No | Varies | No |

**The core differentiator is the combination**, not any single feature. Plenty of tools do notes. None of them nail the specific workflow of: hotkey -> instant floating window -> type -> dismiss -> back to work, with developer-grade search, tabs, Markdown, terminal CLI, workspace-aware scoping, and clipboard capture in a lightweight, local-first package.

The closest competitor, Heynote (5.2k GitHub stars), validates the demand but lacks floating window mode, global hotkey capture, fuzzy search, and multi-tab editing — and runs on Electron.

## Who This Serves

**Primary: The flow-state developer.** They work across terminals, browsers, and editors. They think in code. They want to capture a thought in under 2 seconds and get back to what they were doing. They'd rather type a keyboard shortcut than reach for a mouse. They care about their tools being fast, local, and respectful of their attention.

This includes full-stack developers, backend engineers, DevOps/platform engineers, and anyone who lives in a terminal or IDE for most of their day. Linux developers are especially underserved — Apple Notes doesn't exist on Linux, and Electron-based alternatives are exactly the kind of bloat this audience rejects. Notey being native-feeling on Linux via Tauri is a deliberate wedge into a passionate, vocal community.

These users discover tools on Hacker News, Reddit r/programming, GitHub Trending, and in each other's dotfiles repos. They evaluate tools by trying them, not reading marketing pages.

## Success Criteria

For an open-source v1, success is measured by:

- **Adoption signals** — GitHub stars, downloads, package manager installs across all three platforms
- **Daily-driver quality** — stable enough to be the developer's default capture tool without data loss or reliability concerns
- **Community engagement** — bug reports, feature requests, and contributions from real users
- **Workflow validation** — users report that the hotkey-to-capture flow genuinely reduces friction in their daily work

## Scope

### V1 — In Scope
- Global hotkey with floating window (configurable shortcut, conflict detection)
- Note CRUD with auto-save and visual feedback
- Full-text search with fuzzy matching (architected for future Boolean operator support without rewrite)
- Multi-tab editing
- Command palette
- Markdown and plain text support with syntax highlighting
- Terminal integration (`notey` CLI binary with IPC, stdin piping, add/search commands)
- Keyboard-first navigation throughout
- Auto-start and system tray (background daemon, survives reboots)
- Configurable shortcuts, fonts, layout modes, themes
- Export to Markdown files and JSON (data portability guarantee)
- Workspace-aware notes (auto-detect active git repo/working directory, scope notes to project)
- Clipboard capture (watch clipboard, auto-capture snippets with optional annotation)
- Soft-delete / trash for deleted notes (basic data safety)
- First-run onboarding (shortcut setup, macOS accessibility permission guidance, 10-second intro)
- Cross-platform installers (Windows MSI, macOS DMG, Linux DEB/AppImage)
- Plugin-ready architecture (clean extension points, trait-based design)
- Input validation and secure IPC (Tauri v2 permissions model)
- Open source under MIT license

### V1 — Explicitly Out of Scope
- Cloud sync / cross-device access
- Team collaboration / multi-user features
- Dynamic plugin loading or plugin marketplace
- AI-powered features (summarization, smart search, etc.)
- Performance monitoring dashboards
- Mobile applications
- Encryption at rest (future consideration)

## Technical Approach

- **Runtime:** Tauri v2 (Rust backend, system webview frontend)
- **Frontend:** React + TypeScript + Tailwind CSS + shadcn/ui
- **Database:** SQLite with FTS5 virtual tables for full-text indexing, WAL mode for safe concurrent access
- **State management:** Zustand
- **Build:** Vite + Tauri CLI
- **Testing:** Vitest (frontend) + Cargo test (backend), targeting high coverage without enterprise-grade test theater
- **CI/CD:** GitHub Actions for cross-platform builds and automated testing

### Performance Targets

| Metric | Target |
|---|---|
| Hotkey to visible window | < 150ms |
| Keystroke to persisted save | < 500ms |
| Search results (1000 notes) | < 100ms |
| Cold start to system tray | < 1s |
| Idle memory usage | < 80MB |

### Known Platform Risks

- **Wayland (Linux):** Wayland's core protocol has no equivalent to X11's `XGrabKey`, but the `xdg-desktop-portal` GlobalShortcuts portal provides a stable, user-consent-mediated path. **KDE, Sway, and Hyprland** all implement the portal backend. **GNOME does not** — as of GNOME 48, `xdg-desktop-portal-gnome` has no GlobalShortcuts implementation, making GNOME-on-Wayland the primary gap. Additionally, **Tauri v2's `global-shortcut` plugin does not yet use the portal path** — it falls back to X11 mechanisms via XWayland or fails on pure Wayland. Mitigation: implement portal-based shortcut registration directly (bypassing Tauri's built-in plugin if needed), support XWayland fallback for GNOME users, and document the GNOME limitation clearly. This is a solvable engineering problem, not a dead end.
- **macOS accessibility permissions:** Global shortcuts require explicit user grant in System Settings > Privacy & Security. Mitigation: detect permission state on first run and guide the user through the grant flow before they try the hotkey and get silence.
- **WebView fragmentation:** Tauri uses the system's native WebView (WebView2 on Windows, WebKit on Linux/macOS). Different OS versions ship different WebView versions, which can cause rendering inconsistencies. Mitigation: CI testing across minimum supported OS versions, conservative CSS/JS feature usage.
