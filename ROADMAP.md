# Roadmap

This roadmap describes the direction of Notey. It is a statement of intent, not a
commitment to dates or ordering — priorities shift as the project and its users
evolve. For released changes see the [Changelog](CHANGELOG.md).

**Legend:** ✅ Shipped · 🚧 In progress · 🔭 Planned

## ✅ Shipped (v0.1.0)

The 0.1.0 release delivered the core product across eight areas of work:

- **Instant capture** — hidden-by-default capture window, global hotkey, tray, and
  fast dismiss.
- **Editing** — CodeMirror 6 editor, Markdown/plain-text toggle, debounced auto-save,
  multi-tab editing, and session persistence.
- **Workspaces** — path-based workspaces with detection and a status-bar selector.
- **Search & discovery** — FTS5 full-text search and a fuzzy command palette.
- **Note lifecycle** — trash, restore, retention-based auto-purge, and export to
  Markdown/JSON.
- **CLI** — `notey add / list / search` over a local socket with live desktop sync.
- **Personalization & accessibility** — themes, fonts, layout modes, rebindable
  shortcuts, and keyboard-first/screen-reader support.
- **Platform integration** — tray, auto-start, onboarding, and cross-platform release
  builds.

## 🚧 In progress

- **CLI hardening** — broadening the `notey` command surface and finishing the
  end-to-end live-sync coverage between the CLI and the desktop app.
- **Cross-platform polish** — routing auto-start through the platform abstraction and
  shoring up Windows-specific IPC verification.

## 🔭 Planned

- **Native Wayland global shortcut** — a `xdg-desktop-portal` GlobalShortcuts
  integration so the capture hotkey works on pure Wayland without relying on
  XWayland (today's baseline fallback).
- **Richer search** — query operators and result previews building on the FTS5
  foundation.
- **Editor enhancements** — Markdown niceties (link handling, lists, and live
  preview affordances) within the lightweight capture model.
- **Sync & backup** — optional mechanisms for moving notes between machines while
  staying local-first by default.

## Out of scope (for now)

Notey is deliberately small and local-first. Accounts, mandatory cloud storage, and
heavyweight knowledge-base features are not planned — the goal is a fast capture tool,
not a second brain platform.

Have an idea? Open a
[feature request](https://github.com/pbean/notey/issues/new/choose).
