---
title: "Product Brief Distillate: Notey"
type: llm-distillate
source: "product-brief-notey.md"
created: "2026-04-02"
purpose: "Token-efficient context for downstream PRD creation"
---

# Product Brief Distillate: Notey

## Rejected Ideas & Scope Decisions

- **Enterprise security framework** (capability-based access control, per-source frequency limiting, operation source attribution) — rejected as scope creep for a single-user desktop app. Scratch Pad had IPC/CLI/Direct source limits of 10/15/100 ops/min. Notey uses sensible input validation + Tauri v2's built-in permissions model instead.
- **Performance monitoring dashboard** with predictive analytics and AI-powered optimization recommendations — rejected. Was built in Scratch Pad "Week 2b." Notey uses standard dev tooling: logging, test benchmarks for regression detection, nothing custom-built.
- **Enterprise service-oriented architecture** (trait-based dependency injection, mock frameworks with expectation builders, 99.8% TypeScript type coverage, zero `any` usage) — the old codebase was over-architected. Notey should be well-structured but pragmatic. No "enterprise patterns" for their own sake.
- **Cloud sync** — explicitly deferred. Users asked for cross-device access in Scratch Pad. Local-first is a feature, not a limitation, for v1. Sync is a future consideration if community demands it.
- **Team collaboration / multi-user editing** — explicitly deferred. Listed as upcoming in Scratch Pad. Not relevant to the solo-developer capture use case.
- **AI features** (summarization, smart search) — explicitly deferred. 84% AI tool adoption among devs creates expectation, but not for v1.
- **Dynamic plugin loading** (.so/.dll/.dylib) — deferred. Scratch Pad designed for it but never shipped it. Notey ships plugin-ready architecture (traits, extension points) but no runtime loading.
- **Custom note formats via plugins** — deferred. API structure in Scratch Pad supported it. Notey sticks to PlainText and Markdown for v1.
- **Boolean search operators (AND/OR/NOT)** — deferred from v1 UI but architecture must support adding them later without rewriting the search stack. Scratch Pad had these with complexity scoring (0-100) and query validation. v1 ships fuzzy matching only.
- **Encryption at rest** — deferred. Privacy-conscious devs may want this. Future consideration.
- **Mobile apps** — explicitly out of scope.

## Requirements Hints (captured during discovery)

- Plugin architecture must be designed from day one — "no tech debt." User was explicit: develop with plugins in mind. This means trait-based extension points, clean module boundaries, and documented internal APIs even if no plugins ship in v1.
- Security should be "solid but not theatrical" — input validation (path traversal, injection via note content/search), safe IPC. Don't build what Tauri v2 already provides.
- User wants the project "fully planned out" to avoid surprises — the whole reason for using BMad method. Scope discipline is a first-order priority.
- Open source under MIT license for v1. Freemium/plugin marketplace are future considerations that should not influence v1 architecture decisions.
- "Same" vision as Scratch Pad with the original functionality as MVP baseline.
- UI/style patterns from Scratch Pad carry over conceptually (not as code) — clean, distraction-free, monospace-friendly, dark/light themes.

## Technical Context

### Stack (confirmed)
- Tauri v2 (Rust backend, system webview frontend)
- React + TypeScript + Tailwind CSS + shadcn/ui
- SQLite + FTS5 virtual tables, WAL mode
- Zustand for state management
- Vite + Tauri CLI for builds
- Vitest (frontend) + Cargo test (backend)
- GitHub Actions CI/CD

### Scratch Pad Architecture (lessons learned, not code to carry over)
- Service-oriented Rust backend with Tauri IPC commands in `src-tauri/src/commands/`
- Database layer in `src-tauri/src/db/` with connection pooling, PRAGMA WAL mode, 10MB cache
- Search in `src-tauri/src/search/` with FTS5, pagination (max 1000 results), query complexity limits
- Frontend: React components + custom hooks + Zustand store + TypeScript types
- Plugin system: trait-based (`Plugin` trait in Rust), `PluginManager` for registration, `NoteFormat` extension point. Three example plugins existed: HelloWorldPlugin, TextProcessorPlugin, MarkdownEnhancerPlugin.
- Testing: mock repository pattern, integration tests with temp databases, performance benchmarks, security test suite (50+ attack vectors)

### Platform-Specific Details
- **Windows:** Requires WebView2 runtime (usually pre-installed on Win 10/11). MSI installer.
- **macOS:** Requires accessibility permissions for global shortcuts. Notarization needed for distribution. DMG installer. Must support both Intel and Apple Silicon.
- **Linux:** GTK3 + WebKit2GTK dependencies. DEB package + AppImage. FUSE required for AppImage.
- **Wayland:** xdg-desktop-portal GlobalShortcuts portal works on KDE, Sway, Hyprland. GNOME does NOT implement it (as of GNOME 48). Tauri v2's `global-shortcut` plugin does NOT use the portal path — falls back to X11/XWayland. Notey will need custom portal integration.

### Performance Budgets
- Hotkey to visible window: < 150ms
- Keystroke to persisted save: < 500ms
- Search results (1000 notes): < 100ms
- Cold start to system tray: < 1s
- Idle memory usage: < 80MB
- Scratch Pad targets for reference: < 50ms CRUD, < 100ms simple search, < 200ms Boolean search

## Detailed User Scenarios

- Developer is debugging in terminal, spots a pattern worth remembering. Presses Ctrl+Shift+N, types 3 lines, presses Esc. Total interruption: ~5 seconds. Notes are auto-scoped to the current project's git repo.
- Developer copies a stack trace from browser DevTools. Notey's clipboard capture grabs it automatically. Later, developer opens Notey, finds it in the clipboard stream, adds annotation, promotes it to a full note.
- Developer is in a Zoom meeting, quickly captures action items via hotkey without switching away from the screenshare.
- DevOps engineer pipes `kubectl logs` output to `notey add --stdin --tag k8s-debug` from terminal, creating a timestamped, tagged, project-scoped note without leaving the terminal.
- Developer searching for a snippet from last week. Opens Notey, types in search bar with fuzzy matching. Finds it across workspace-scoped notes. Copies it out.
- New user installs Notey. First-run flow detects OS, explains the hotkey, handles macOS accessibility permission, lets them customize the shortcut, shows a 10-second demo of the capture loop.

## Competitive Intelligence

### Direct Competitors
- **Heynote** (5.2k GitHub stars): Open-source Electron-based dev scratchpad. Block-based editing, 25+ language syntax highlighting, math/calculator blocks. No floating mode, no global hotkey, no fuzzy search, no multi-tab, no terminal integration. A community fork "Hinote" exists to port it to Tauri — validates both the niche and the tech choice.
- **Tot** (Iconfactory): macOS/iOS only. Minimal 7-dot scratchpad. Too simple for dev workflows — no search, no code features, limited to 7 slots. One-time $20.
- **Quick Notes App** (quicknotesapp.ai): Windows-only. AI/voice focused. Not developer-targeted. Subscription pricing.

### Adjacent Solutions
- **Obsidian + QuickAdd plugin**: Can approximate quick capture via macros and Alfred/Raycast integrations, but requires heavyweight app (~200MB+), plugin configuration, and has startup latency that defeats "instant" use case.
- **VS Code Notes extensions**: nvAlt-inspired notes, GistPad for snippets. Tied to VS Code being open and focused — can't capture from terminal or browser.
- **Apple Notes / Windows Sticky Notes / GNOME Notes**: Free, pre-installed, "good enough" for many. High activation energy to adopt a replacement. Not developer-aware.

### Market Data
- 28.7M-47.2M software developers globally, 10% YoY growth
- Software dev tools market: $7.4B (2026), projected $15.7B by 2031 (16.1% CAGR)
- Developers juggle average 14 tools, 62% of engineering leaders prioritize tool consolidation
- GitHub Copilot: 248% YoY revenue growth to $400M — proves developers will pay for friction reduction
- Local-first / plain-file ownership is dominant user preference trend in note-taking

### User Sentiment (from HN threads, Reddit, forums)
- Deep frustration with scattered notes across files, tabs, apps
- "A WhatsApp group with just me" — real pattern for quick capture
- Heynote HN thread (300+ comments): strong demand for "frictionless capture without structure constraints"
- Repeated requests for: global hotkey, vim keybindings, font customization, fuzzy search
- Users clearly distinguish "knowledge management" (Obsidian/Notion) from "ephemeral scratch capture" — different use cases, not one product
- Key pain: heavyweight tools have startup latency that breaks flow. Developers want sub-200ms capture.

## Open Questions

- **Final product name:** "Notey" has collision risk with existing apps/packages. Name TBD before public launch.
- **Vim keybindings:** Repeatedly requested in competitor discussions. Not in v1 scope currently — worth evaluating during PRD.
- **GNOME Wayland story:** GNOME doesn't implement GlobalShortcuts portal. XWayland fallback works but isn't ideal. May need to accept degraded experience on GNOME-Wayland for v1 or invest in a workaround.
- **Tauri global-shortcut gap:** Tauri v2 doesn't use xdg-desktop-portal. Custom implementation needed. Scope/effort TBD during architecture.
- **Config file format:** If Notey config is a single TOML/JSON file, developers will commit it to dotfiles repos — passive distribution channel. Worth designing for.
- **Clipboard capture privacy:** Watching clipboard is powerful but sensitive. Need clear user controls (opt-in? per-app filtering? exclude password managers?). UX design needed.
- **Workspace detection method:** Git repo root detection is the obvious approach, but what about non-git projects? Fallback to working directory? Configurable project roots?

## Growth & Distribution Signals (for future reference)

- CLI virality: `notey` commands appearing in blog posts, tutorials, shell aliases, Stack Overflow answers — same growth path as jq, fzf, ripgrep
- Dotfiles distribution: single config file in dotfiles repos = passive GitHub exposure
- Plugin ecosystem flywheel: each community plugin recruits from its own community (tmux plugin -> tmux users, neovim plugin -> vim users)
- Tauri showcase: Notey could be featured as a Tauri ecosystem showcase app — sustained traffic from developers evaluating the framework
- Launch narrative: "WhatsApp group with just me" pain point is inherently shareable/meme-worthy for HN/Reddit launch
