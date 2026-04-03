---
stepsCompleted:
  - "step-01-init"
  - "step-02-discovery"
  - "step-02b-vision"
  - "step-02c-executive-summary"
  - "step-03-success"
  - "step-04-journeys"
  - "step-05-domain"
  - "step-06-innovation"
  - "step-07-project-type"
  - "step-08-scoping"
  - "step-09-functional"
  - "step-10-nonfunctional"
  - "step-11-polish"
  - "step-12-complete"
inputDocuments:
  - product-brief-notey.md
  - product-brief-notey-distillate.md
  - research/market-research-developer-productivity-tools-2026-04-02.md
  - research/market-notey-developer-notepad-research-2026-04-02.md
  - research/technical-notey-tech-stack-validation-research-2026-04-02.md
documentCounts:
  briefs: 2
  research: 3
  brainstorming: 0
  projectDocs: 0
workflowType: 'prd'
classification:
  projectType: "Cross-Platform Desktop App + CLI (Dual-Interface)"
  domain: "Developer Capture & Retrieval"
  complexity: "Domain: Low, Platform/Product: Medium"
  projectContext: "Informed Greenfield"
lastEdited: '2026-04-03'
editHistory:
  - date: '2026-04-03'
    changes: 'Post-validation fixes: 7 FR/NFR measurability issues, journey/scope inconsistencies, added CLI Interface Specification section'
---

# Product Requirements Document - Notey

**Author:** Pinkyd
**Date:** 2026-04-02

## Executive Summary

Developers lose flow state every time they need to capture a thought. The recovery cost — 15-25 minutes per interruption — makes this one of the most expensive daily friction points in software development. Existing tools force a false choice: heavyweight knowledge management apps (Obsidian, Notion) that break focus with startup latency, or ad-hoc workarounds (untitled editor tabs, self-addressed WhatsApp messages) that lose information. No tool today delivers instant, developer-grade capture without a context switch.

Notey is a floating, keyboard-driven notepad that lives one global hotkey away from any workflow. Press the shortcut, a lightweight window appears instantly, type, it auto-saves, dismiss with Esc — total interruption under 5 seconds. Built on Tauri v2 (Rust + React), Notey uses a fraction of Electron's memory footprint (30-40 MB vs 200-300 MB), starts in under 500ms, and ships as a sub-10 MB installer. Notes are stored locally in SQLite with FTS5 full-text search. No cloud, no accounts, no network requests. Open source under MIT license.

Notey targets flow-state developers — full-stack engineers, backend developers, DevOps/SRE practitioners, and anyone who lives in a terminal or IDE. Linux developers are a strategic wedge: underserved by existing tools, disproportionately influential as OSS maintainers and community voices, and hostile to the Electron bloat that defines the current competitive set.

### What Makes This Special

Notey's differentiation is the combination of five capabilities no competitor offers together:

1. **The Capture Loop** — Global hotkey summons a floating window instantly; Esc dismisses it without disturbing the underlying focus. Sub-150ms hotkey-to-visible target.
2. **CLI as First-Class Citizen** — `notey add "text"`, `docker logs | notey add --stdin`, `notey search "query"`. Notey is a Unix citizen, composable with existing tooling. This is the viral vector — the same growth path as fzf, ripgrep, and jq.
3. **Workspace-Aware Notes** — Auto-detects the active git repo or working directory and scopes notes to that project. Zero-effort organization. No existing tool does this.
4. **Native Performance** — Tauri v2 delivers 30-40 MB idle memory, <10 MB bundle, <500ms startup. Heynote (closest competitor, 5.2K GitHub stars) runs on Electron at 200+ MB with a 427 MB installer.
5. **Clipboard Capture with Project Context** *(Growth feature, post-MVP)* — Watches the clipboard and auto-captures snippets into the current workspace with optional annotation. Clipboard managers exist, but none are project-aware.

The core insight: the "WhatsApp group with just me" pattern proves developers will use absurd tools if activation energy is low enough. The bar isn't features — it's friction. Notey wins by being the lowest-friction option that's also the most capable for developers.

## Project Classification

- **Project Type:** Cross-Platform Desktop App + CLI (Dual-Interface)
- **Domain:** Developer Capture & Retrieval
- **Complexity:** Domain: Low | Platform/Product: Medium
- **Project Context:** Informed Greenfield — clean rewrite drawing on lessons from Scratch Pad (architecture decisions, scope discipline, no code carried over)

## Success Criteria

### User Success

- **Flow state preservation** — Users complete the capture loop (hotkey → type → dismiss) in under 5 seconds without losing context in their primary task
- **Daily-driver adoption** — Users make Notey their default capture tool, replacing ad-hoc workarounds (untitled tabs, self-messages, random text files)
- **Zero data loss anxiety** — Auto-save is bulletproof; users never manually save and never lose content
- **Search-first retrieval** — Users find any previous note within 10 seconds via fuzzy search, regardless of when or which workspace it was captured in
- **"It just works" CLI** — Terminal-heavy developers pipe output to `notey add --stdin` as naturally as they pipe to `grep` or `jq`

### Business Success

- **GitHub traction (3-month):** 1,000+ stars, 50+ issues filed (signals real usage, not just curiosity)
- **Package manager presence:** Available in Homebrew, AUR, and DEB within 30 days of launch
- **Community engagement (6-month):** External contributors submitting PRs, community bug reports from all three platforms
- **Hacker News validation:** Show HN post generates meaningful discussion (200+ points target, based on Heynote's 978-point benchmark)
- **Daily active usage:** Users who install Notey are still using it 30 days later — the tool becomes muscle memory

### Technical Success

| Metric | Target | Measurement |
|---|---|---|
| Hotkey to visible window | < 150ms | Instrumented timing in app |
| Keystroke to persisted save | < 500ms | SQLite write completion |
| Search results (1,000 notes) | < 100ms | FTS5 query time |
| Cold start to system tray | < 1s | Process launch to tray icon |
| Idle memory usage | < 80MB | OS memory reporting |
| Installer size | < 10MB | Build artifact size |
| Cross-platform parity | All v1 features on Windows, macOS, Linux | CI test matrix |

### Measurable Outcomes

- **Capture friction reduction:** The time from "I need to write this down" to "it's saved" drops from 15-30 seconds (current workarounds) to under 5 seconds
- **Tool consolidation:** Users report replacing 2+ existing capture workarounds with Notey
- **Workspace adoption:** >50% of active users have notes scoped to 2+ workspaces (validates the auto-detection feature)
- **CLI adoption:** >20% of active users have used at least one CLI command (validates dual-interface strategy)

## Product Scope

### MVP Strategy

**Approach: Experience MVP** — The smallest feature set that delivers the complete capture loop and makes users say "this replaces my current hack." Not a feature demo, not a platform play — a tool that's genuinely useful on day one.

**MVP litmus test:** Can Kai pipe logs from his terminal, can Priya hotkey-capture a thought from her browser, and can Marcus install and "get it" in under 60 seconds? If yes, it's shippable.

**Resource Requirements:** Solo developer with Rust + React experience, or a small team (2-3). Primary skill bottleneck is Rust proficiency for backend services, IPC, and platform-specific integrations.

### MVP (Phase 1)

**Core journeys supported:** Kai's CLI capture, Priya's GUI capture, Marcus's first-run experience.

- Global hotkey with floating window (configurable shortcut, always-on-top, dismiss with Esc)
- Note CRUD with auto-save and visual "saved" feedback
- Full-text fuzzy search (SQLite FTS5, architected for future Boolean operators)
- Multi-tab editing
- Command palette (Ctrl/Cmd+P)
- Markdown and plain text with syntax highlighting
- CLI binary (`notey add`, `notey search`, `notey list`, stdin piping via IPC)
- Workspace-aware notes (git repo detection, project scoping)
- System tray with auto-start (background daemon, survives reboots)
- Configurable shortcuts, fonts, themes, layout modes
- Keyboard-first navigation throughout
- Soft-delete / trash
- Export to Markdown files and JSON
- First-run onboarding (shortcut setup, macOS accessibility guidance)
- Cross-platform installers (Windows MSI, macOS DMG, Linux DEB/AppImage)
- Plugin-ready architecture (trait-based extension points, no runtime loading)
- Tauri v2 permissions model for secure IPC
- MIT license

**Explicitly deferred from MVP:**
- Clipboard capture — deferred from V1 scope (product brief) to Growth phase. Privacy controls and opt-in UX require dedicated design work. First post-MVP feature
- Wayland native hotkeys — XWayland fallback works. Portal integration is a fast-follow
- Boolean search — FTS5 architecture supports it; UI ships fuzzy-only for v1
- Vim keybindings — repeatedly requested in competitor communities, not essential for core loop
- Tagging — workspace scoping provides 80% of organizational value without tags

### Growth (Phase 2 — post-launch, community-driven)

- Clipboard capture with workspace scoping and opt-in controls
- Wayland native global hotkeys via xdg-desktop-portal (KDE, Sway, Hyprland, GNOME 48+)
- Boolean search operators (AND/OR/NOT)
- Vim keybindings
- Note tagging, pinning, and favorites
- Additional package formats (Flatpak, Snap, RPM, AUR)
- Auto-updater via `tauri-plugin-updater`
- Obsidian vault export integration

### Vision (Phase 3 — 6+ months post-launch)

- Dynamic plugin loading (community plugin ecosystem)
- Encryption at rest
- Cloud sync (opt-in, privacy-preserving)
- AI-powered features (summarization, smart search) — only when developer trust improves
- Mobile companion for capture on the go

## User Journeys

### Journey 1: Kai — The Terminal Power User

**Who:** Kai, 34, Staff SRE at a mid-size fintech company. Arch Linux (Hyprland), three monitors, tmux sessions everywhere. His dotfiles repo has 200+ stars. He discovers tools by reading other people's shell configs and HN threads. He hasn't used a mouse in his terminal in years. Current capture workflow: an untitled Vim buffer that gets wiped every reboot.

**Opening Scene:** It's 2 AM during an incident. Kai is tailing logs across three Kubernetes pods, correlating timestamps. He spots a pattern — the auth service is retrying with exponentially increasing delays, but the circuit breaker threshold is wrong. He needs to capture this observation *now* before he dives into the next pod's logs. His untitled Vim buffer is in a different tmux pane, and switching there means losing his scroll position in the log tail.

**Rising Action:** Kai types `kubectl logs auth-svc-7f8d | grep "circuit_breaker" | notey add --stdin`. The logs flow directly into Notey, timestamped and scoped to the `infra-platform` workspace because that's the git repo his shell is sitting in. He doesn't leave his log tail. He doesn't switch panes. Ten seconds later, he spots another pattern and runs `notey add "retry backoff is 2^n but threshold is fixed at 5s — mismatch causes cascading failures"`.

**Climax:** The next morning, the post-incident review. Kai opens Notey with the hotkey, switches to the `infra-platform` workspace, and searches "circuit_breaker". Every observation from 2 AM is there — the piped logs, his typed annotations, all in sequence. He pastes the timeline into the incident report in under a minute. His manager asks how he remembered all that detail.

**Resolution:** Kai adds `alias klog='kubectl logs | notey add --stdin'` to his shell config. He pushes his updated dotfiles. Three colleagues see the alias, install Notey, and start using it. Within a month, `notey add` appears in the team's runbook templates. *(Growth phase adds `--tag` support, enabling Kai to tag notes like `--tag incident-2847` for structured retrieval.)*

**Requirements revealed:** CLI binary with stdin piping, workspace detection via git repo, search scoped to workspace, timestamp tracking, real-time CLI-to-desktop synchronization. *(Tagging revealed as Growth-phase requirement.)*

---

### Journey 2: Priya — The Full-Stack Multitasker

**Who:** Priya, 28, mid-level full-stack developer at a Series B startup. macOS, VS Code, 14 browser tabs, Slack always pinging. She juggles frontend (React), backend (Node), and occasional infrastructure tickets. Her current capture system: a WhatsApp group called "me" where she sends herself code snippets, and Apple Notes for meeting action items. She loses things constantly.

**Opening Scene:** Priya is debugging a CORS issue in the browser DevTools. She finds the fix — a missing header in the API gateway config — but she's currently in the frontend repo, not the infrastructure repo. She needs to remember this fix for later when she switches contexts. She starts typing it into WhatsApp, then stops. She installed Notey yesterday after seeing it on Reddit.

**Rising Action:** She presses Cmd+Shift+N. A floating window appears over her browser — no app switching, no Dock animation, no waiting. She types: "API gateway missing Access-Control-Allow-Headers for X-Request-ID — fix in nginx.conf L47". She presses Esc. The window vanishes. Her browser is exactly where she left it, DevTools still open. Total interruption: 4 seconds.

Later that afternoon, in a sprint planning meeting, the PM mentions a bug report about slow search in the dashboard. Priya remembers she saw something related last week. She presses Cmd+Shift+N, types "search" in the search bar. Fuzzy match surfaces her note from three days ago: "Dashboard search re-renders entire table on each keystroke — needs debounce." She reads it out in the meeting. The PM is impressed.

**Climax:** After two weeks, Priya realizes she hasn't messaged her WhatsApp "me" group once. Every quick thought — the CORS fix, the meeting note, the SQL query she'll need again, the deployment checklist — is in Notey, auto-organized by workspace. She opens the `startup-app` workspace and sees 23 notes she would have lost across WhatsApp, Apple Notes, and forgotten VS Code tabs.

**Resolution:** Priya exports her notes to Markdown and drops them into the project's `docs/` folder before the sprint review. The tech lead starts using Notey after seeing the exported notes. Priya's capture loop — Cmd+Shift+N → type → Esc — is muscle memory within a week.

**Requirements revealed:** Global hotkey (configurable, macOS accessibility permissions), floating always-on-top window, auto-focus on input, auto-save with visual feedback, dismiss with Esc (restore previous focus), fuzzy search across notes, workspace auto-detection, Markdown export.

---

### Journey 3: Marcus — The New User (First-Run Experience)

**Who:** Marcus, 31, backend Go developer on Ubuntu (GNOME). He saw Notey on Hacker News during lunch, skimmed the README, liked the demo GIF showing the capture loop. He's skeptical — he's tried three note apps this year and abandoned all of them within a week. His bar: if this doesn't feel faster than his current workflow (opening a new `untitled.txt` in VS Code) within 60 seconds, he's uninstalling.

**Opening Scene:** Marcus runs `sudo apt install notey`. Installation takes 8 seconds. Notey starts automatically and shows a first-run overlay: "Welcome to Notey. Your capture shortcut is **Ctrl+Shift+N**. Press it now to try." No account creation. No email. No tour carousel. One instruction.

**Rising Action:** He presses Ctrl+Shift+N. A floating window appears above his terminal. He types "testing notey — does this actually work?" and notices the small "Saved" indicator appear without him pressing anything. He presses Esc. The window disappears. His terminal is focused again. He presses Ctrl+Shift+N again. His note is there. "Huh. That was fast."

He checks `htop`. Notey is using 38 MB. His VS Code instance is at 1.2 GB. He smirks.

He opens a second project in another terminal, navigates to a different git repo. Presses the hotkey, types a note. Switches back to the first project, opens Notey — only the first project's notes show. "Wait, it knows which project I'm in?"

**Climax:** The "aha" moment: Marcus realizes he didn't create any folders, didn't configure any workspaces, didn't organize anything. Notey auto-detected his git repos and scoped notes to them. The thing he hated most about every note app — the organizational overhead before you can start capturing — simply doesn't exist.

**Resolution:** Marcus stars the repo on GitHub. He tries `notey add "test from cli"` in his terminal and sees it appear in the GUI. He reads the README section on CLI integration and adds `alias n='notey add'` to his `.bashrc`. Three days later, he hasn't opened `untitled.txt` once.

**Requirements revealed:** One-command install (DEB package), auto-start on install, first-run onboarding (minimal — one instruction, not a tour), hotkey conflict detection, workspace auto-detection without configuration, low memory footprint, system tray presence, CLI binary in PATH after install.

---

### Journey 4: Anika — The Open Source Contributor

**Who:** Anika, 26, junior developer in Berlin. Uses Notey daily. Fedora with Sway (Wayland). She's been frustrated that the global hotkey doesn't work natively on her Wayland compositor — it falls back to XWayland, which adds 200ms of latency. She's seen the open issue on GitHub and has been reading the Tauri global-hotkey crate source code.

**Opening Scene:** Anika finds issue #42: "Native Wayland global hotkey support via xdg-desktop-portal." She's been using `ashpd` (the Rust xdg-desktop-portal bindings) at her day job and realizes she can implement the portal-based shortcut registration. She forks the repo and reads the `CONTRIBUTING.md`.

**Rising Action:** She clones the repo, runs `cargo tauri dev`, and finds the codebase well-organized — the platform-specific code is isolated in `src-tauri/src/platform/linux.rs` behind a trait interface. She doesn't need to understand the entire codebase to contribute. The trait `HotkeyProvider` has two methods: `register()` and `unregister()`. She implements a `WaylandPortalProvider` alongside the existing `X11Provider`.

She writes tests against a mock portal interface, verifying that the shortcut registration request is correctly formed. The existing test infrastructure works — `cargo test` runs her new tests alongside the existing suite.

**Climax:** Her PR passes CI on all three platforms (the Wayland-specific code is behind `#[cfg(target_os = "linux")]` and only activates when the portal is available). The maintainer reviews it within 48 hours, suggests one change to the fallback logic, and merges it. Anika's commit message appears in the next release changelog.

**Resolution:** On Sway, the hotkey now registers through the portal with a system consent dialog — clean, native, no XWayland. Anika writes a blog post about contributing to Tauri apps, which gets picked up on Lemmy. Two more Wayland users submit PRs for Hyprland-specific edge cases.

**Requirements revealed:** Plugin-ready architecture with trait-based extension points, platform-specific code isolation (`#[cfg(target_os)]`), clear module boundaries, contributor-friendly codebase (documented internal APIs, tests that run without the full Tauri runtime), CI that tests all platforms, responsive issue/PR management.

---

### Journey Requirements Summary

| Capability Area | Kai (CLI Power) | Priya (GUI Capture) | Marcus (New User) | Anika (Contributor) |
|---|---|---|---|---|
| Global hotkey + floating window | | ✓ | ✓ | |
| Auto-save with feedback | | ✓ | ✓ | |
| Dismiss with Esc (restore focus) | | ✓ | ✓ | |
| Fuzzy search | | ✓ | | |
| Workspace auto-detection (git) | ✓ | ✓ | ✓ | |
| CLI binary (add, search, stdin) | ✓ | | ✓ | |
| IPC (CLI ↔ desktop app) | ✓ | | ✓ | |
| System tray + auto-start | | | ✓ | |
| First-run onboarding | | | ✓ | |
| Markdown export | | ✓ | | |
| Low memory footprint | | | ✓ | |
| Platform code isolation | | | | ✓ |
| Trait-based extension points | | | | ✓ |
| Cross-platform CI | | | | ✓ |
| Tagging *(Growth)* | ✓ | | | |
| One-command install | | | ✓ | |

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. Workspace-Aware Note Scoping (Novel — No Competitor Offers This)**

Auto-detecting the active git repository or working directory and scoping notes to that project is a completely unaddressed gap in the market. Every existing note tool requires manual organization — folders, tags, vaults, notebooks. Notey eliminates the organizational decision at capture time by inferring context from the development environment. This is a zero-configuration organizational model where notes self-organize by project without user effort.

**2. Dual-Interface Capture (GUI + CLI as Co-Equal Interfaces)**

No competitor combines a floating GUI window with a composable Unix CLI binary (`stdin` piping, scriptable commands) in a single product. Terminal tools (Thoth, Snip) lack GUI. GUI tools (Heynote, Stashpad) lack CLI. This dual-interface approach treats the desktop app and the CLI as two views into the same data store — each optimized for its context (visual capture vs. pipeline integration).

**3. The Five-Pillar Combination**

Individual features exist in isolation across competitors. The innovation is combining all five — instant floating capture, CLI composability, workspace awareness, native Tauri performance, and project-scoped clipboard capture — into a single coherent product. The competitive moat isn't any single feature; it's the integration cost a competitor would face to replicate the full set.

### Market Context & Competitive Landscape

- Heynote (5.2K stars) validates demand but is broadening toward "power users" (images, Mermaid diagrams), leaving the developer-focused capture lane open
- Hinote (Heynote's Tauri fork) validates developer demand for non-Electron alternatives
- Obsidian forum threads explicitly requesting "Obsidian Lite" confirm the gap between knowledge management and instant capture
- The "WhatsApp group with just me" pattern reveals the bar for adoption is *friction*, not features

### Validation Approach

- **Workspace awareness:** Validate that auto-detection via `git2` correctly identifies project context in >90% of developer environments (multi-repo setups, monorepos, non-git projects with fallback)
- **CLI adoption:** Track CLI vs GUI usage ratio. Target: >20% of users engage with at least one CLI command within first 30 days
- **Combination value:** Survey early adopters on which feature they'd miss most. If users cite the combination rather than individual features, the integration thesis is validated

### Risk Mitigation

| Innovation Risk | Likelihood | Mitigation |
|---|---|---|
| Workspace detection fails in edge cases (monorepos, nested repos, non-git) | Medium | Fallback to working directory; allow manual workspace pinning via UI/config |
| CLI adoption is lower than expected | Medium | CLI is a differentiator for Segment 1 (terminal power users) but not required for Segment 2 (GUI multitaskers). Product works fully without CLI |
| Competitors replicate the combination | Low-Medium | Heynote would need to add CLI + workspace awareness + port to Tauri — significant architectural changes. First-mover advantage in the combination creates muscle-memory lock-in |
| Clipboard capture feels invasive | Medium | Ship as opt-in with clear controls. Exclude password manager entries. Transparent UI showing what's captured |

## Desktop Application Requirements

### Project-Type Overview

Notey is a cross-platform desktop application with deep system integration — global hotkey registration, system tray residence, clipboard monitoring, auto-start on login, and IPC socket communication with a companion CLI binary. It operates entirely offline with local SQLite storage. Built on Tauri v2 (Rust backend, system WebView frontend), targeting Windows, macOS, and Linux as first-class citizens.

Notey is a per-user desktop application that may run as multiple concurrent instances on shared systems (RDP, VNC, terminal servers). All state — data, config, IPC sockets — is user-scoped. No system-wide paths, no shared state between users, no assumptions of exclusive system access.

### Platform Support

| Platform | Runtime | Installer | WebView | Global Hotkey | Status |
|---|---|---|---|---|---|
| **Windows 10/11** | Tauri v2 | MSI (NSIS) | WebView2 (pre-installed) | Native via Tauri plugin | First-class |
| **macOS 12+** | Tauri v2 | DMG (.app bundle) | WebKit | Native via Tauri plugin | First-class (Intel + Apple Silicon) |
| **Linux (X11)** | Tauri v2 | DEB, AppImage | WebKit2GTK 4.1+ | Native via Tauri plugin | First-class |
| **Linux (Wayland)** | Tauri v2 | DEB, AppImage | WebKit2GTK 4.1+ | XWayland fallback; portal integration planned | Supported with known gap |

**Platform-specific considerations:**
- **macOS:** Requires accessibility permissions for global shortcuts. First-run flow must detect permission state and guide user through System Settings grant before they press the hotkey
- **macOS:** Notarization required for distribution outside App Store. Apple Developer certificate ($99/yr)
- **Windows:** WebView2 is pre-installed on Win 10/11. Windows code signing (OV certificate, $200-400/yr) needed to avoid SmartScreen warnings
- **Linux:** Requires `webkit2gtk-4.1` (Ubuntu 22.04+). AppImage requires FUSE
- **Wayland:** GNOME 48+ added GlobalShortcuts portal support. Tauri's `global-hotkey` crate has PR #162 for portal integration. Mitigation: direct `ashpd` crate integration if PR hasn't landed by v1. XWayland fallback available as stopgap

### System Integration

| Integration Point | Mechanism | Platform Notes |
|---|---|---|
| **Global hotkey** | `tauri-plugin-global-shortcut` + `ashpd` (Wayland) | Default: Ctrl+Shift+N / Cmd+Shift+N. Conflict detection on registration. Per-session in RDP/VNC |
| **System tray** | `tray-icon` feature flag + `tauri-plugin-positioner` | Background daemon, tray-relative window positioning. Per-user session |
| **Auto-start** | `tauri-plugin-autostart` | Login Items (macOS), Registry (Windows), XDG autostart (Linux) |
| **Clipboard monitoring** | `tauri-plugin-clipboard` (CrossCopy community plugin) | Text, HTML, images. Opt-in with per-app filtering |
| **CLI ↔ App IPC** | `interprocess` crate (Unix domain sockets / Named pipes) | User-scoped socket: `/run/user/<uid>/notey.sock` (Linux), `\\.\pipe\notey-<user>` (Windows). Must not conflict across concurrent user sessions |
| **Workspace detection** | `git2` crate (libgit2 bindings) | `Repository::open_ext()` searches up from cwd. Fallback to working directory for non-git projects |
| **File system** | Scoped via Tauri v2 capabilities | Export writes to user-selected directories only |

### Update Strategy

- **Auto-updater:** `tauri-plugin-updater` with mandatory signature verification
- **Update channel:** GitHub Releases with static JSON manifest (v1). Dynamic update server deferred
- **Release cadence:** Semantic Versioning. Conventional Commits for automated changelog. Weekly/biweekly patches during pre-1.0, feature releases as milestones complete
- **Build pipeline:** GitHub Actions via `tauri-apps/tauri-action` — builds Windows x64, Linux x64/ARM64, macOS x64/ARM64 in a single CI run
- **Release automation:** Release Please or semantic-release for version bumps and changelog generation

### Offline Capabilities

Notey is offline-only by design. No network requests, no cloud sync, no telemetry, no analytics.

- **Storage:** SQLite database with FTS5 virtual tables, WAL mode for concurrent read/write. Each user instance has its own database file — no shared database across users
- **Data location:** Platform-standard per-user paths — `$XDG_DATA_HOME/notey/` (Linux), `~/Library/Application Support/notey/` (macOS), `%LOCALAPPDATA%/notey/` (Windows)
- **Config location:** `$XDG_CONFIG_HOME/notey/notey.toml` (Linux), platform equivalents elsewhere. TOML format for dotfiles-repo compatibility
- **Data portability:** Export all notes to Markdown files (one `.md` per note with YAML frontmatter) or JSON (full database dump). Import not required for v1
- **Backup:** Single SQLite file per user — users can copy/backup with standard file tools

### Shared System Considerations

On shared systems (RDP, VNC, terminal servers), multiple Notey instances may run concurrently on the same machine — one per user session:

- **Data isolation:** Each instance uses its own per-user SQLite database. No shared state between users. File paths use platform-standard per-user directories
- **IPC isolation:** Socket paths are user-scoped (e.g., `/run/user/<uid>/notey.sock`) to prevent cross-user conflicts
- **Hotkey registration:** Per-session, not system-wide. Multiple users can register the same hotkey in their respective sessions without conflict
- **System tray:** Each user session has its own tray icon instance
- **Resource usage:** Multiple concurrent instances must remain lightweight. The <80MB idle target is per-instance
- **File locking:** SQLite WAL mode handles single-writer per database. No cross-instance locking concerns since each user has a separate database file

### CLI Interface Specification

The CLI is a first-class interface and a primary viral vector. It must be as well-specified as the desktop GUI.

**Command Structure:**

| Command | Syntax | Description |
|---|---|---|
| `notey add` | `notey add "text"` | Create a note with the given text |
| `notey add --stdin` | `command \| notey add --stdin` | Create a note from stdin |
| `notey search` | `notey search "query"` | Search notes by full-text fuzzy match |
| `notey list` | `notey list [--workspace <name>]` | List notes, optionally filtered by workspace |

**Output Formats:**

- Default output is human-readable plain text (one note per line: timestamp, truncated content)
- `--json` flag outputs structured JSON for scripting and piping to `jq`
- `notey search` results display: note ID, workspace, timestamp, matching excerpt
- `notey list` displays: note ID, workspace, timestamp, first line of content

**Exit Codes:**

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | General error (invalid arguments, malformed input) |
| `2` | Application not running (CLI cannot connect to desktop app) |
| `3` | No results found (for `search` — distinguishes from error) |

**Error Output:**

- All errors print to stderr, never stdout (enables safe piping)
- Error messages include: what failed, why, and how to fix it
- When the desktop application is not running: `Error: Notey is not running. Start Notey or run 'notey --start' to launch it.`

**Shell Completion:**

- Shell completion scripts for bash, zsh, and fish generated at build time
- Installed automatically by package managers; manual install via `notey completions <shell>`

### Implementation Considerations

- **IPC type safety:** Use `tauri-specta` v2 from day one for compile-time TypeScript bindings from Rust commands. Eliminates type drift between backend and frontend
- **Database connection:** Single `Mutex<Connection>` per process. Each user's Notey instance is a separate process with its own database connection. Multiple instances coexist on the same machine without conflict
- **Error handling:** `thiserror` enum with `serde::Serialize` impl (Tauri constraint — all command return values must be serializable)
- **Auto-save pattern:** Debounced writes (300ms timer reset on each keystroke). WAL mode ensures writes don't block UI reads. "Saved" indicator pushed via Tauri event
- **Architecture:** Thin Tauri command handlers delegating to testable service modules. Business logic in `services/`, database access in `db/`, platform-specific code in `platform/` behind `#[cfg(target_os)]`
- **Testing:** Rust unit/integration tests (services + DB with in-memory SQLite), Vitest for React components, WebDriver for critical e2e paths (hotkey → create → save → search → dismiss). Include multi-instance smoke tests
- **CSP:** Content Security Policy must be configured for both dev mode (`http://localhost:*`) and production (`tauri://localhost`). Start the allowlist early
- **WebView fragmentation:** Conservative CSS via Tailwind baseline. CI tests on all three platforms. Accept font rendering differences across WebViews

## Risk Mitigation Strategy

**Technical Risks:**

| Risk | Severity | Mitigation |
|---|---|---|
| Wayland global hotkey gap | High | Ship with XWayland fallback. Implement portal integration via `ashpd` as fast-follow. GNOME 48+ and Tauri PR #162 are converging on a solution |
| WebView rendering inconsistencies | Medium | Conservative CSS via Tailwind baseline. CI tests on all platforms. Accept font rendering differences |
| Rust compile times slow dev velocity | Medium | `sccache`, `cargo-watch` with debouncing, split large modules. CI caching via `rust-cache@v2` |
| Auto-save data corruption | High | SQLite WAL mode, `PRAGMA synchronous = NORMAL`, debounced writes. Integration tests with crash simulation |
| Multi-instance conflicts on shared systems | Medium | User-scoped data paths, user-scoped IPC sockets, per-session hotkey registration. Smoke tests with concurrent instances |

**Market Risks:**

| Risk | Severity | Mitigation |
|---|---|---|
| Heynote adds missing features (hotkey, CLI, workspace) | Medium | Ship first. Heynote is broadening toward "power users" — unlikely to pivot back to developer focus. Muscle-memory lock-in from the capture loop |
| "Good enough" inertia (WhatsApp, untitled tabs) | High | The capture loop must be demonstrably faster in the first 30 seconds. Demo GIF is the primary conversion tool |
| Low CLI adoption undermines dual-interface thesis | Medium | CLI is a differentiator for Segment 1 but not required for Segment 2. GUI-only usage is a valid success mode |

**Resource Risks:**

| Risk | Severity | Mitigation |
|---|---|---|
| Solo maintainer burnout | Medium | Plugin-ready architecture enables community contributions without core codebase complexity. Trait-based extension points lower the contribution barrier |
| Code signing costs ($300-500/yr) | Low | Budget before public release. Without signing, macOS blocks the app and Windows shows SmartScreen warnings — this is a hard requirement, not optional |
| Cross-platform CI costs | Low | GitHub free tier includes 3,000 min/month for public repos. Tauri builds are faster than Electron builds |

## Functional Requirements

### Note Capture & Management

- **FR1:** User can create a new note via the GUI editor
- **FR2:** User can create a new note via the CLI (`notey add "text"`)
- **FR3:** User can create a new note from stdin via the CLI (`command | notey add --stdin`)
- **FR4:** User can edit an existing note's content
- **FR5:** User can delete a note (soft-delete to trash)
- **FR6:** User can restore a deleted note from trash
- **FR7:** User can permanently delete a note from trash
- **FR8:** System auto-saves note content after each edit with visual confirmation
- **FR9:** User can create notes in Markdown or plain text format
- **FR10:** System renders Markdown with syntax highlighting in the editor

### Search & Retrieval

- **FR11:** User can search across all notes using full-text fuzzy matching
- **FR12:** User can search notes scoped to a specific workspace
- **FR13:** System ranks search results by relevance
- **FR14:** User can search notes via the CLI (`notey search "query"`)
- **FR15:** User can list notes via the CLI (`notey list`)

### Window & Display Management

- **FR16:** User can summon the application window via a global hotkey from any context
- **FR17:** User can configure the global hotkey shortcut
- **FR18:** System detects and reports global hotkey conflicts with other applications
- **FR19:** Application window appears as a floating, always-on-top overlay
- **FR20:** Window auto-focuses the text input area on appearance
- **FR21:** User can dismiss the window with Esc, restoring focus to the previously active application
- **FR22:** User can switch between layout modes (floating, half-screen, full-screen)

### Multi-Tab Editing

- **FR23:** User can open multiple notes simultaneously in tabs
- **FR24:** User can switch between open tabs
- **FR25:** User can close individual tabs
- **FR26:** User can reorder tabs

### Command Palette

- **FR27:** User can access all application features via a command palette (Ctrl/Cmd+P)
- **FR28:** Command palette supports fuzzy matching of command names

### Workspace Management

- **FR29:** System auto-detects the active git repository when a note is created via CLI
- **FR30:** System scopes notes to the detected workspace
- **FR31:** System falls back to working directory for non-git projects
- **FR32:** User can switch between workspaces in the UI
- **FR33:** User can view notes filtered by workspace
- **FR34:** User can view all notes across workspaces (unscoped view)
- **FR35:** User can manually assign or reassign a note's workspace

### CLI Interface & IPC

- **FR36:** CLI commands are reflected in the running desktop application in real-time
- **FR37:** User can run CLI commands targeting their own Notey instance without affecting other users' instances on the same system
- **FR38:** When the desktop application is not running, CLI commands exit with a non-zero exit code and print a message to stderr indicating the application is not running and how to start it

### System Integration

- **FR39:** Application runs as a background daemon accessible from the system tray
- **FR40:** User can interact with the application via the system tray icon (show/quit)
- **FR41:** Application auto-starts on user login
- **FR42:** User can enable or disable auto-start
- **FR43:** Application persists across system reboots via auto-start

### Configuration & Personalization

- **FR44:** User can configure keyboard shortcuts for application actions
- **FR45:** User can configure font family and size
- **FR46:** User can switch between dark and light themes
- **FR47:** Application stores configuration in a human-readable TOML file
- **FR48:** User can navigate all features using keyboard only (mouse optional)

### Data Portability & Export

- **FR49:** User can export all notes to individual Markdown files with YAML frontmatter
- **FR50:** User can export all notes to a single JSON file
- **FR51:** User can access only their own notes; the application enforces per-user data boundaries on shared systems

### Onboarding & First-Run Experience

- **FR52:** System detects first-run state and presents onboarding
- **FR53:** Onboarding displays the configured capture shortcut and prompts user to try it
- **FR54:** System detects macOS accessibility permission state and guides user through the grant flow
- **FR55:** User can customize the global hotkey during onboarding

### Cross-Platform Support

- **FR56:** All functional requirements work on Windows 10/11, macOS 12+, and Linux (X11)
- **FR57:** Application provides a fallback mechanism for global hotkeys on Linux Wayland compositors
- **FR58:** Application uses platform-standard paths for data and configuration storage

## Non-Functional Requirements

### Performance

Performance is the core competitive differentiator. If Notey doesn't feel instant, it fails.

| NFR | Requirement | Rationale |
|---|---|---|
| **NFR1** | Global hotkey to visible window in < 150ms | Must feel instantaneous — any perceptible delay breaks the "instant capture" promise |
| **NFR2** | Keystroke to persisted save in < 500ms | Auto-save must complete fast enough that dismissing the window immediately after typing doesn't lose data |
| **NFR3** | Full-text search returns results in < 100ms for databases with up to 10,000 notes | Search must feel interactive, not batch. Users type-and-scan, not type-and-wait |
| **NFR4** | Cold start to system tray ready in < 1 second | Users expect the app to be available immediately after login/reboot |
| **NFR5** | Idle memory usage < 80MB per instance | Multiple instances may run on shared systems. A capture tool should be invisible in resource monitors |
| **NFR6** | Installer size < 10MB | Tauri's advantage over Electron. Fast download, fast install, signals lightweight philosophy |
| **NFR7** | Window dismiss (Esc) to previous app focus restoration in < 50ms | The transition back must feel like the window never existed — no flicker, no focus delay |

### Security

No sensitive data by default, but the app must not introduce attack surface. "Solid but not theatrical."

| NFR | Requirement | Rationale |
|---|---|---|
| **NFR8** | All frontend-to-backend commands are scoped via a capabilities/permissions ACL with default-deny | Frontend can only invoke explicitly granted backend functions. Default-deny model |
| **NFR9** | File system access is scoped to user-selected export directories only | No broad filesystem access. Export writes only where the user explicitly chooses |
| **NFR10** | CLI input is validated against injection (path traversal, command injection via note content) | CLI accepts arbitrary text from stdin — must sanitize before storage |
| **NFR11** | CLI-to-application communication channel is user-scoped and permission-restricted | Other users on shared systems cannot read or write to another user's Notey communication channel |
| **NFR12** | No network requests of any kind in v1 | Zero telemetry, zero analytics, zero phoning home. "A notepad should never touch the network" |

### Reliability & Data Integrity

Data loss is an instant uninstall. Auto-save must be bulletproof.

| NFR | Requirement | Rationale |
|---|---|---|
| **NFR13** | Zero data loss during normal operation, including abrupt window dismiss during active editing | SQLite WAL mode ensures writes are atomic. No "save failed" states |
| **NFR14** | Database survives application crash without corruption | WAL mode + `PRAGMA synchronous = NORMAL` provides crash-safe writes |
| **NFR15** | Database survives system power loss without corruption | SQLite's journaling guarantees durability. WAL checkpoint ensures committed data persists |
| **NFR16** | Soft-deleted notes are recoverable for at least 30 days | Users must be able to undo accidental deletion without external backup tools |
| **NFR17** | Auto-save never produces a partial or empty note state visible to the user | Debounced writes are atomic — a note is either fully saved or unchanged |

### Data Scalability

Not server scalability, but graceful handling of growing note databases.

| NFR | Requirement | Rationale |
|---|---|---|
| **NFR18** | Search performance degrades by no more than 2x between 1,000 and 10,000 notes | FTS5 indexing should keep search sub-linear. Users who adopt Notey will accumulate thousands of notes over months |
| **NFR19** | Application startup time degrades by no more than 500ms between 100 and 10,000 notes | Database size should not affect cold start perceptibly |
| **NFR20** | Export of 10,000 notes completes within 30 seconds | Bulk export must remain practical for large databases |

### Accessibility

Keyboard-first navigation is a functional requirement (FR48). These NFRs specify the quality bar.

| NFR | Requirement | Rationale |
|---|---|---|
| **NFR21** | Every interactive element is reachable via keyboard (Tab/Shift+Tab, arrow keys, Enter) | Mouse-optional is a core product promise, not a nice-to-have |
| **NFR22** | Focus indicators have a minimum 2px outline with 3:1 contrast ratio against adjacent colors on all interactive elements | Keyboard navigation requires unambiguous visual focus feedback per WCAG 2.4.7 |
| **NFR23** | Color contrast meets WCAG 2.1 AA standards (4.5:1 for text, 3:1 for UI components) in both themes | Developer tools in dark environments need readable contrast. Accessibility baseline, not certification |
