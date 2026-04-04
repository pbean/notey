---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/test-artifacts/test-design/notey-handoff.md
---

# Notey - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Notey, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: User can create a new note via the GUI editor
FR2: User can create a new note via the CLI (`notey add "text"`)
FR3: User can create a new note from stdin via the CLI (`command | notey add --stdin`)
FR4: User can edit an existing note's content
FR5: User can delete a note (soft-delete to trash)
FR6: User can restore a deleted note from trash
FR7: User can permanently delete a note from trash
FR8: System auto-saves note content after each edit with visual confirmation
FR9: User can create notes in Markdown or plain text format
FR10: System renders Markdown with syntax highlighting in the editor
FR11: User can search across all notes using full-text fuzzy matching
FR12: User can search notes scoped to a specific workspace
FR13: System ranks search results by relevance
FR14: User can search notes via the CLI (`notey search "query"`)
FR15: User can list notes via the CLI (`notey list`)
FR16: User can summon the application window via a global hotkey from any context
FR17: User can configure the global hotkey shortcut
FR18: System detects and reports global hotkey conflicts with other applications
FR19: Application window appears as a floating, always-on-top overlay
FR20: Window auto-focuses the text input area on appearance
FR21: User can dismiss the window with Esc, restoring focus to the previously active application
FR22: User can switch between layout modes (floating, half-screen, full-screen)
FR23: User can open multiple notes simultaneously in tabs
FR24: User can switch between open tabs
FR25: User can close individual tabs
FR26: User can reorder tabs
FR27: User can access all application features via a command palette (Ctrl/Cmd+P)
FR28: Command palette supports fuzzy matching of command names
FR29: System auto-detects the active git repository when a note is created via CLI
FR30: System scopes notes to the detected workspace
FR31: System falls back to working directory for non-git projects
FR32: User can switch between workspaces in the UI
FR33: User can view notes filtered by workspace
FR34: User can view all notes across workspaces (unscoped view)
FR35: User can manually assign or reassign a note's workspace
FR36: CLI commands are reflected in the running desktop application in real-time
FR37: User can run CLI commands targeting their own Notey instance without affecting other users' instances on the same system
FR38: When the desktop application is not running, CLI commands exit with a non-zero exit code and print a message to stderr indicating the application is not running and how to start it
FR39: Application runs as a background daemon accessible from the system tray
FR40: User can interact with the application via the system tray icon (show/quit)
FR41: Application auto-starts on user login
FR42: User can enable or disable auto-start
FR43: Application persists across system reboots via auto-start
FR44: User can configure keyboard shortcuts for application actions
FR45: User can configure font family and size
FR46: User can switch between dark and light themes
FR47: Application stores configuration in a human-readable TOML file
FR48: User can navigate all features using keyboard only (mouse optional)
FR49: User can export all notes to individual Markdown files with YAML frontmatter
FR50: User can export all notes to a single JSON file
FR51: User can access only their own notes; the application enforces per-user data boundaries on shared systems
FR52: System detects first-run state and presents onboarding
FR53: Onboarding displays the configured capture shortcut and prompts user to try it
FR54: System detects macOS accessibility permission state and guides user through the grant flow
FR55: User can customize the global hotkey during onboarding
FR56: All functional requirements work on Windows 10/11, macOS 12+, and Linux (X11)
FR57: Application provides a fallback mechanism for global hotkeys on Linux Wayland compositors
FR58: Application uses platform-standard paths for data and configuration storage

### NonFunctional Requirements

NFR1: Global hotkey to visible window in < 150ms
NFR2: Keystroke to persisted save in < 500ms
NFR3: Full-text search returns results in < 100ms for databases with up to 10,000 notes
NFR4: Cold start to system tray ready in < 1 second
NFR5: Idle memory usage < 80MB per instance
NFR6: Installer size < 10MB
NFR7: Window dismiss (Esc) to previous app focus restoration in < 50ms
NFR8: All frontend-to-backend commands are scoped via a capabilities/permissions ACL with default-deny
NFR9: File system access is scoped to user-selected export directories only
NFR10: CLI input is validated against injection (path traversal, command injection via note content)
NFR11: CLI-to-application communication channel is user-scoped and permission-restricted
NFR12: No network requests of any kind in v1
NFR13: Zero data loss during normal operation, including abrupt window dismiss during active editing
NFR14: Database survives application crash without corruption
NFR15: Database survives system power loss without corruption
NFR16: Soft-deleted notes are recoverable for at least 30 days
NFR17: Auto-save never produces a partial or empty note state visible to the user
NFR18: Search performance degrades by no more than 2x between 1,000 and 10,000 notes
NFR19: Application startup time degrades by no more than 500ms between 100 and 10,000 notes
NFR20: Export of 10,000 notes completes within 30 seconds
NFR21: Every interactive element is reachable via keyboard (Tab/Shift+Tab, arrow keys, Enter)
NFR22: Focus indicators have a minimum 2px outline with 3:1 contrast ratio against adjacent colors on all interactive elements
NFR23: Color contrast meets WCAG 2.1 AA standards (4.5:1 for text, 3:1 for UI components) in both themes

### Additional Requirements

- Use official `create-tauri-app@latest notey -- --template react-ts` scaffold as starter template (Epic 1 Story 1)
- Post-scaffold additions required in order: Tailwind CSS v4, shadcn/ui, Zustand, tauri-specta v2, rusqlite+FTS5, tray-icon feature, global-shortcut plugin, autostart plugin, Vitest config
- Tauri v2 (v2.10.3) with React 19 + TypeScript strict mode
- Rust stable backend with rusqlite, chrono, thiserror, tauri-specta v2
- CodeMirror 6 mandatory for editor (not Monaco or Tiptap)
- SQLite with WAL mode, FTS5 external content tables, single Mutex<Connection>
- Database schema: notes table (id, title, content, format, workspace_id, created_at, updated_at, deleted_at, is_trashed), workspaces table (id, name, path, created_at), notes_fts virtual table
- FTS5 synchronization via SQLite triggers on INSERT, UPDATE, DELETE
- All dates stored as ISO8601 TEXT, never Unix timestamps
- Use rusqlite_migration for ordered migrations applied at startup
- PRAGMA configuration: synchronous=NORMAL, busy_timeout=5000, foreign_keys=ON, cache_size=-10000, WAL mode
- Main editor window MUST be created at startup and kept hidden (show/hide, not create/destroy) for 150ms hotkey target
- Auto-save: 300ms debounce, flush on Esc dismiss, event-driven feedback
- MANDATORY: Use tauri-specta v2 for compile-time TypeScript bindings from Rust commands (never manually type invoke() calls)
- JSON over Unix sockets (Linux/macOS) or named pipes (Windows) for CLI-to-app IPC
- CLI binary (notey-cli): separate Cargo crate, clap for args, interprocess crate for sockets, serde_json for protocol
- CLI shares NO Rust code with src-tauri (protocol types duplicated as simple JSON structs)
- Tauri v2 capability/permission ACL: default-deny, main window scoped capabilities
- CLI input validation: parameterized queries, max 1MB note size, path validation via std::fs::canonicalize()
- Per-feature Zustand stores: useEditorStore, useSearchStore, useWorkspaceStore, useSettingsStore
- Feature-based frontend directory structure: src/features/{name}/ with components/, hooks/, store.ts
- NO index.ts barrel files (import directly from source files)
- No URL-based routing (single-window desktop app, views managed by Zustand)
- All Rust structs crossing IPC use #[serde(rename_all = "camelCase")]
- Platform abstraction trait with #[cfg(target_os)] implementations for hotkeys, socket paths, config paths, autostart
- CI/CD via GitHub Actions + tauri-apps/tauri-action, matrix build for 5 targets
- Conventional Commits + Release Please for version management
- Unsigned artifacts for v1
- Testing: Vitest (frontend), cargo test (Rust), WebDriver for critical e2e paths
- Co-located test files (TypeScript: *.test.ts(x) beside source; Rust: #[cfg(test)] mod tests in source files)
- Error handling: thiserror enum (NoteyError) with variants for Database, NotFound, Workspace, Io, Validation
- Logging: tauri-plugin-log for Rust, console wrapper for TypeScript
- Integer autoincrement IDs (not UUIDs)
- Null handling: Option<T>/None in Rust, T | null in TypeScript, NULL in database (never empty strings)

### UX Design Requirements

UX-DR1: Implement design token system with CSS variables for dark theme colors: --bg-primary (#1a1a1a), --bg-elevated (#242424), --bg-surface (#2d2d2d), --border-default (#3a3a3a), --border-subtle (#2f2f2f), --text-primary (#e4e4e4), --text-secondary (#a0a0a0), --text-muted (#666666), --accent (#6b9eff), --accent-muted (#6b9eff20), --success (#4ade80), --warning (#fbbf24), --error (#f87171), --focus-ring (#6b9eff80)
UX-DR2: Implement design token system with CSS variables for light theme colors: --bg-primary (#ffffff), --bg-elevated (#f5f5f5), --bg-surface (#ebebeb), --border-default (#d4d4d4), --border-subtle (#e5e5e5), --text-primary (#1a1a1a), --text-secondary (#666666), --text-muted (#a0a0a0), --accent (#3b7cff), --accent-muted (#3b7cff15), --success (#16a34a), --warning (#d97706), --error (#dc2626), --focus-ring (#3b7cff60)
UX-DR3: Establish typography system with monospace-first font stack (ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace) as primary for all editor content and note text, with proportional sans-serif secondary font stack for UI chrome only
UX-DR4: Define type scale using 4:5 ratio (major third): 11px (xs), 13px (sm), 14px (base), 16px (lg), 18px (xl), 22px (2xl) with corresponding line heights and weights, with 14px as configurable base size (min 12px, max 24px)
UX-DR5: Implement spacing system using 4px base unit grid with tokens: --space-1 (4px), --space-2 (8px), --space-3 (12px), --space-4 (16px), --space-6 (24px), --space-8 (32px)
UX-DR6: Design and implement CaptureWindow component as floating window container with show/hide lifecycle, supporting three layout modes: floating (600x400px default, resizable min 400x300), half-screen (50% width, full height), and full-screen modes, with drop shadow and always-on-top positioning in floating mode
UX-DR7: Implement TabBar component with bottom-border active indicator style (2px accent underline), supporting multi-note editing with keyboard navigation (Ctrl+Tab, Ctrl+Shift+Tab, Ctrl+1-9 for tab selection), tab truncation with ellipsis at ~20 chars, and tab close functionality via hover x button or middle-click
UX-DR8: Create EditorPane component wrapping CodeMirror 6 with auto-save integration, 300ms debounce timer on keystroke, restore cursor position on tab switch or window reshow, soft-wrap enabled for no horizontal scrolling, and Markdown syntax highlighting default with format toggle capability
UX-DR9: Implement StatusBar component (24px height) displaying: left section with workspace name + note count (clickable to open workspace selector), right section with note format toggle (Markdown/Plain text) and save indicator with states (saved/saving/save-failed)
UX-DR10: Create SaveIndicator subcomponent with three states: idle (hidden), saved (green text "Saved" appearing instantly and fading after 2s opacity-only), saving (muted "Saving..." shown only if save >200ms), and failed (amber "Save failed" persisting until next successful save)
UX-DR11: Build SearchOverlay component as full-width search interface with FTS5 fuzzy matching returning results in <100ms, displaying results with title, workspace name, date, and snippet with query match highlighted in accent color + accent-muted background, keyboard-navigable with arrow keys and Enter to open
UX-DR12: Implement CommandPalette component (VS Code-style, cmdk-powered, 520px wide max, top-center positioned) with command groups ("Actions", "Settings", "Navigation"), keyboard shortcut display on right side, ">" prefix in input, fuzzy matching, and containing all commands: New Note, Search Notes, Toggle Theme, Switch Workspace, Open Note List, Export to Markdown, Export to JSON, View Trash, Open Settings, Toggle Layout Mode, Toggle Format
UX-DR13: Create NoteListPanel as ephemeral slide-from-left panel (200px fixed width, overlaying editor content) showing notes in current workspace with workspace name header, note count, and list items with title, relative date, and format indicator, dismissible via Esc or note selection, with dimmed editor background when visible
UX-DR14: Design OnboardingOverlay for first-run experience displaying single instruction ("Your capture shortcut is Ctrl+Shift+N"), hotkey key caps, "Press it now to try" text, platform-specific macOS accessibility permission guidance if needed, dismissible by pressing hotkey or Esc, never shown again via flag in config
UX-DR15: Implement workspace context visualization in StatusBar showing current workspace name + note count in format "[workspace-name] . [N] notes", clickable to open workspace selector dropdown, displaying workspace list with note counts
UX-DR16: Create visual focus indicator component (2px accent color outline with 2px offset) visible on all keyboard-focused elements across all states, using --focus-ring token, respecting prefers-reduced-motion OS setting by becoming instant when user has motion reduction enabled
UX-DR17: Design and implement color contrast audit ensuring all text/background pairs meet WCAG 2.1 AA minimum 4.5:1 ratio, UI components meet 3:1 minimum ratio, verify both dark and light themes independently, highlight matches in accent color with both color + text label to support color-blind users
UX-DR18: Build multi-monitor support ensuring floating window appears centered on active monitor when summoned, with monitor detection and positioning logic
UX-DR19: Implement display scaling support handling HiDPI/Retina displays and system-level scaling (100%-200%) through WebView built-in DPI scaling, no custom logic needed, with font sizes using px values anchored to 4px grid
UX-DR20: Create responsive layout adaptation for floating window resizing with tab bar tabs truncating progressively, overflow tabs accessible via dropdown, editor content soft-wrapping at window width, status bar content remaining fixed layout with character count hiding first at extreme narrow widths (<400px)
UX-DR21: Implement minimum window size constraint (400x300px) with graceful content truncation below this size maintaining functionality
UX-DR22: Design visual feedback system with status bar inline indicators (non-blocking, never interrupt typing) for save states, toast notifications (3-5 second auto-dismiss, bottom-right of window) for completed actions (soft-delete, restore, export), and modal confirmation dialog (centered, backdrop dimmed, "Cancel" button default-focused) only for permanent irreversible actions
UX-DR23: Create toast notification pattern showing: "Note moved to trash" (3s) for soft-delete, "Note restored" (3s) for restore, "Exported N notes to /path" (5s) for export, "Shortcut conflicts with [app]" (5s) for hotkey conflicts, with auto-dismiss and no action buttons
UX-DR24: Implement permanent delete confirmation dialog with content "Permanently delete [title]? This cannot be undone.", danger-styled "Delete Forever" button in error color, default-focused "Cancel" button, dismissible via Esc, using shadcn/ui Dialog component
UX-DR25: Design empty state pattern with instructional text (1-2 lines, muted color), keyboard icon for visual context, and "next action" hint for new install, empty workspace, search no results, and empty trash
UX-DR26: Create zero-loading-state UX with target speeds: window show <150ms (no loading state, instant), search results <100ms (no loading state), auto-save <500ms total ("Saving..." only if >200ms, rare), note list <50ms (no loading state)
UX-DR27: Implement keyboard shortcut system with global shortcut Ctrl+Shift+N / Cmd+Shift+N to toggle Notey window (configurable), application shortcuts Esc (back/hide), Ctrl/Cmd+P (command palette), Ctrl/Cmd+F (search), Ctrl/Cmd+N (new note), Ctrl/Cmd+W (close tab), Ctrl+Tab / Ctrl+Shift+Tab (tab navigation), Ctrl/Cmd+1-9 (jump to tab), Ctrl/Cmd+, (settings), Ctrl/Cmd+Shift+T (toggle theme), Ctrl/Cmd+Shift+W (switch workspace)
UX-DR28: Create overlay keyboard pattern with arrow keys for item navigation, Enter for selection/execution, Esc for dismissal, Tab for focus cycling within overlay only, with focus trapped in overlay
UX-DR29: Design Esc-as-back navigation pattern where pressing Esc backs out one layer: overlay → editor layer → hide window (return to desktop)
UX-DR30: Implement keyboard shortcut documentation pattern with every shortcut discoverable via command palette, platform-aware modifier key display
UX-DR31: Build cross-platform rendering consistency strategy using system font stacks, conservative CSS via Tailwind, custom scrollbar styling with native fallback via ScrollArea component
UX-DR32: Design scrollbar handling using Tailwind/CSS custom styling where supported via ScrollArea component, native scrollbars as fallback
UX-DR33: Implement no horizontal scrolling constraint with editor using soft-wrap, fixed-width overlays with text wrapping
UX-DR34: Create destructive action severity hierarchy with: low (close tab, no confirmation), medium (soft-delete, toast, reversible), high (permanent delete, modal confirmation, irreversible)
UX-DR35: Design tab close behavior as low-severity reversible action with no confirmation dialog
UX-DR36: Implement soft-delete with 30-day trash retention showing toast, reversible via trash view restore
UX-DR37: Create undo/redo scoping limited to editor text changes only (Ctrl+Z / Ctrl+Y within CodeMirror), note-level operations via trash mechanism
UX-DR38: Design dangerous button styling using --error color for irreversible destructive actions
UX-DR39: Build focus management system with focus trapped in overlays, focus restored to previous application on window dismiss, focus on editor on window show
UX-DR40: Implement CodeMirror 6 focus behavior with cursor auto-focus on window show, restore cursor position on tab switch or window reshow, soft-wrap enabled, Markdown syntax highlighting default
UX-DR41: Create screen reader support with aria-live="polite" on save indicator, aria-label on all interactive elements, role="status" on status bar, role="dialog"/"search" on overlays
UX-DR42: Design color-independent state indicators using text labels + colors together for all status indicators
UX-DR43: Implement tab accessibility as role="tablist" with role="tab" children, aria-selected on active tab, arrow key navigation, Enter/Space to select
UX-DR44: Create search results list accessibility with role="search" container, role="listbox" results, role="option" items, aria-selected, keyboard navigation
UX-DR45: Build command palette accessibility with role="combobox" on input, role="listbox" on results (cmdk built-in support), fuzzy matching, keyboard navigation
UX-DR46: Design note list panel accessibility with role="navigation", aria-label="Note list", role="listbox", focus trapped, Esc dismisses
UX-DR47: Implement onboarding overlay accessibility with role="dialog", aria-label="Welcome to Notey", aria-modal="true", focus on instruction text, keyboard-only dismissible
UX-DR48: Create prefers-reduced-motion support making all transitions instant (0ms) when OS setting active
UX-DR49: Build visual regression testing for cross-platform consistency with CI builds on all 3 platforms
UX-DR50: Implement theme switching as instantaneous CSS variable swap with no re-render, respecting system preference on first launch
UX-DR51: Design border radius system using minimal rounded corners (2-4px) for functional clarity
UX-DR52: Create shadow system with subtle drop shadow only on floating window, no internal shadows
UX-DR53: Implement transition timing maximum 50ms for any UI transition, opacity-only for save indicator fade-out (2s), no slide/bounce/scale animations
UX-DR54: Design interactive element minimum touch target size of 24px height
UX-DR55: Build dense information layout with editor consuming at least 85% of window vertical space, tab bar max 32px, status bar max 24px
UX-DR56: Create workspace selector component as StatusBar click trigger opening dropdown list with workspace names, note counts, "All Workspaces" option, keyboard-navigable
UX-DR57: Implement note format indicator in status bar toggling between Markdown and Plain text modes
UX-DR58: Design character count indicator in status bar, hidden first when space limited (<400px width)
UX-DR59: Create save failure recovery as non-modal with amber "Save failed" indicator, auto-retry on next keystroke
UX-DR60: Implement CLI output patterns with success format (green checkmark) to stdout, error format (red x) to stderr, exit codes 0/1/2
UX-DR61: Build ANSI color support for CLI output, enabled when stdout is TTY, disabled when piping
UX-DR62: Design modal barrier (backdrop dimming) behind centered command palette and overlays
UX-DR63: Create first-run experience flow: onboarding overlay → instruction → hotkey press → dismissed → empty editor ready
UX-DR64: Implement macOS accessibility permission guidance on first run with permission detection and guidance
UX-DR65: Build note list browse flow: command palette or shortcut → note list slides in → select note → opens in tab → panel dismisses
UX-DR66: Design workspace switch flow: command palette → workspace list → select → view updates to show filtered notes
UX-DR67: Create export flow: command palette → format choice → OS native directory picker → files written → toast confirmation
UX-DR68: Implement trash view accessed via command palette showing soft-deleted notes, restore and permanent delete options
UX-DR69: Build settings view accessible via Ctrl/Cmd+, showing global hotkey config, font settings, theme toggle, layout mode
UX-DR70: Design "Recently closed tabs" feature in command palette
UX-DR71: Create command palette category grouping: "Actions", "Settings", "Navigation" with keyboard shortcuts shown
UX-DR72: Implement workspace context preservation across sessions with last active tab, cursor position, and workspace restored
UX-DR73: Build tab overflow handling with scroll arrows or dropdown menu for hidden tabs
UX-DR74: Design untitled note tab naming as "New note" until content typed, then first line truncated at ~20 chars
UX-DR75: Create visual status of active note with 2px accent underline on active tab, primary text on active vs muted on inactive
UX-DR76: Implement search scope toggle in SearchOverlay with current workspace default and "All workspaces" toggle
UX-DR77: Design search result ranking using FTS5 rank function, limiting display to top 20 with scrollable list
UX-DR78: Build search snippet display showing matching text excerpt with highlighted query match, relative date, workspace name
UX-DR79: Create note list panel note item display with title, relative date, format indicator, keyboard selection
UX-DR80: Implement workspace name display at top of note list panel with workspace name header and note count
UX-DR81: Design note list panel scroll behavior with ScrollArea component, keyboard navigation via arrow keys
UX-DR82: Create visual focus state in command palette with accent-muted background highlight, focus ring, arrow key selection
UX-DR83: Build search results accessibility with keyboard-navigable options, snippet context, metadata
UX-DR84: Implement export dialog as native OS file picker using Tauri scoped filesystem APIs
UX-DR85: Design export format options: Markdown (one .md per note) and JSON (single file with array)
UX-DR86: Create export success feedback as toast with path and note count
UX-DR87: Build system tray integration with monochrome icon, context menu (Open, Settings, Quit), auto-start on login
UX-DR88: Design system tray icon behavior with click to toggle window, right-click for context menu
UX-DR89: Implement configuration via TOML file with settings UI alternative
UX-DR90: Create visual indication of app state in system tray with monochrome unobtrusive icon
UX-DR91: Design font rendering consistency strategy accepting platform differences as features
UX-DR92: Build scrollbar styling using CSS custom properties via ScrollArea component with native fallback
UX-DR93: Implement viewport-responsive text sizing with px units and user configuration (12-24px range)
UX-DR94: Create first-run hint pattern with "Ctrl+P for commands" shown in status bar for first 5 sessions
UX-DR95: Design status bar height at fixed 24px with left/right sections and priority hiding at narrow widths
UX-DR96: Build visual feedback for pending save with "Saving..." if >200ms, instant "Saved" on completion
UX-DR97: Implement save timing guarantee with 300ms debounce, ~800ms max total, Esc forces immediate flush
UX-DR98: Create autofocus behavior on window show with cursor in editor text area ready for typing
UX-DR99: Design focus restoration on Esc with previous application returning to focus in <50ms
UX-DR100: Build global hotkey error handling with conflict detection toast and settings reconfiguration option
UX-DR101: Implement hotkey reconfiguration in settings with current shortcut display, new binding capture, conflict detection
UX-DR102: Create command palette keyboard filter with <50ms client-side filtering, fuzzy matching, instant results
UX-DR103: Build settings UI as modal/panel accessible via Ctrl/Cmd+, with all configurable settings
UX-DR104: Design note format toggle affecting syntax highlighting, export behavior, stored per note
UX-DR105: Create layout mode toggle via command palette cycling through floating, half-screen, full-screen
UX-DR106: Implement drag-reorder for tabs with visual drag indicator and persistence
UX-DR107: Build unsaved state indicator eliminated by design with auto-save removing the concept entirely
UX-DR108: Design visual empty editor state with placeholder text and keyboard icon
UX-DR109: Create zero-loading-state UX with window pre-created hidden, FTS5 <100ms queries, no spinners
UX-DR110: Implement CodeMirror 6 integration with Markdown language support, syntax highlighting, soft-wrap, cursor persistence
UX-DR111: Build note metadata storage including timestamps, workspace identifier, format, content, FTS5 searchable
UX-DR112: Design visual consistency across all shadows with only floating window having drop shadow
UX-DR113: Create border width consistency with 1px borders, accent color for active indicators
UX-DR114: Implement visual hierarchy through size, weight, and color for text and interactive elements
UX-DR115: Build component composition hierarchy: CaptureWindow contains TabBar, EditorPane, StatusBar, Overlay layer
UX-DR116: Design visual state transitions for interactive elements with default, hover, active, focus, disabled states
UX-DR117: Create workspace visual context with workspace name always visible in status bar
UX-DR118: Implement modal backdrop dimming with semi-transparent dark overlay, click outside to dismiss
UX-DR119: Build theme consistency across both dark and light themes with same spacing/typography, only color token variation
UX-DR120: Design visual indicator for active application state with clean, distraction-free system tray icon

### FR Coverage Map

FR1: Epic 1 - Create note via GUI editor
FR2: Epic 6 - Create note via CLI
FR3: Epic 6 - Create note from stdin via CLI
FR4: Epic 1 - Edit existing note content
FR5: Epic 5 - Soft-delete note to trash
FR6: Epic 5 - Restore deleted note from trash
FR7: Epic 5 - Permanently delete note from trash
FR8: Epic 1 - Auto-save with visual confirmation
FR9: Epic 1 - Create notes in Markdown or plain text
FR10: Epic 1 - Render Markdown with syntax highlighting
FR11: Epic 3 - Full-text fuzzy search across all notes
FR12: Epic 3 - Search scoped to specific workspace
FR13: Epic 3 - Search results ranked by relevance
FR14: Epic 6 - Search notes via CLI
FR15: Epic 6 - List notes via CLI
FR16: Epic 1 - Summon window via global hotkey
FR17: Epic 7 - Configure global hotkey shortcut
FR18: Epic 7 - Detect and report hotkey conflicts
FR19: Epic 1 - Floating always-on-top overlay window
FR20: Epic 1 - Auto-focus text input on window appearance
FR21: Epic 1 - Dismiss window with Esc, restore previous app focus
FR22: Epic 7 - Switch between layout modes
FR23: Epic 4 - Open multiple notes in tabs
FR24: Epic 4 - Switch between open tabs
FR25: Epic 4 - Close individual tabs
FR26: Epic 4 - Reorder tabs
FR27: Epic 4 - Command palette access to all features
FR28: Epic 4 - Command palette fuzzy matching
FR29: Epic 2 - Auto-detect active git repository
FR30: Epic 2 - Scope notes to detected workspace
FR31: Epic 2 - Fallback to working directory for non-git projects
FR32: Epic 2 - Switch between workspaces in UI
FR33: Epic 2 - View notes filtered by workspace
FR34: Epic 2 - View all notes across workspaces
FR35: Epic 2 - Manually assign or reassign note workspace
FR36: Epic 6 - CLI commands reflected in desktop app in real-time
FR37: Epic 6 - Per-user CLI instance isolation
FR38: Epic 6 - Graceful error when desktop app not running
FR39: Epic 1 - Background daemon accessible from system tray
FR40: Epic 1 - System tray icon interaction (show/quit)
FR41: Epic 8 - Auto-start on user login
FR42: Epic 8 - Enable or disable auto-start
FR43: Epic 8 - Persist across system reboots via auto-start
FR44: Epic 7 - Configure keyboard shortcuts
FR45: Epic 7 - Configure font family and size
FR46: Epic 7 - Switch between dark and light themes
FR47: Epic 1 - Configuration stored in human-readable TOML
FR48: Epic 7 - Keyboard-only navigation for all features
FR49: Epic 5 - Export notes to individual Markdown files
FR50: Epic 5 - Export notes to single JSON file
FR51: Epic 8 - Per-user data boundaries on shared systems
FR52: Epic 8 - Detect first-run state and present onboarding
FR53: Epic 8 - Onboarding displays capture shortcut
FR54: Epic 8 - macOS accessibility permission guidance
FR55: Epic 8 - Customize global hotkey during onboarding
FR56: Epic 8 - Cross-platform support (Windows, macOS, Linux X11)
FR57: Epic 8 - Wayland fallback for global hotkeys
FR58: Epic 1 - Platform-standard paths for data and configuration

### TEA Quality Requirements

**Source:** TEA Test Design → BMAD Handoff (`_bmad-output/test-artifacts/test-design/notey-handoff.md`)

#### Epic-Level Quality Gates

- P0 tests from the epic must pass at **100%** before story completion.
- P1 tests must pass at **≥95%**.
- No open high-severity bugs in the epic's scope.
- Performance benchmarks tracked for perf-sensitive stories.
- **RISK-007 (E2E tooling constraint, Score 6):** All epics must favor unit/integration tests over E2E. Only 3 E2E journeys total across all epics.

#### Risk-to-Story Mapping

| Risk ID | Category | Score | Maps to Epic/Story | Test Type |
|---|---|---|---|---|
| RISK-001 | TECH | 6 | Epic 8 / Story 8.6 (Cross-platform) | E2E + Visual |
| RISK-002 | DATA | 6 | Epic 1 / Stories 1.4, 1.5 (Database + Note CRUD) | Integration |
| RISK-003 | DATA | 4 | Epic 3 / Stories 3.1, 3.2 (FTS5 search) | Integration |
| RISK-004 | PERF | 4 | Epic 1 / Story 1.11 (Window management / hotkey) | Benchmark |
| RISK-005 | OPS | 6 | Epic 8 / Story 8.1 (Onboarding / first-run) | E2E |
| RISK-006 | SEC | 6 | Epic 6 / Stories 6.1–6.7 (CLI binary) | Unit + Integration |
| RISK-007 | TECH | 6 | All epics (test strategy constraint) | Unit + Integration |

#### data-testid Requirements

Stories implementing UI components must include these `data-testid` attributes:

| Component Area | Attributes | Mapped Stories |
|---|---|---|
| Editor | `editor-pane`, `tab-bar`, `tab-{id}` | 1.7, 1.8, 4.2 |
| Search | `search-overlay`, `search-input`, `search-result-{id}` | 3.3 |
| Status | `status-bar`, `save-indicator`, `workspace-name` | 1.7, 1.9 |
| Command Palette | `command-palette`, `command-input` | 4.5 |
| Onboarding | `onboarding-overlay`, `hotkey-display` | 8.1 |

#### Phase Transition Quality Gates

| Transition | Gate Criteria |
|---|---|
| Epic/Story Creation → ATDD | Stories have acceptance criteria from test design |
| ATDD → Implementation | Failing acceptance tests exist for P0/P1 scenarios |
| Implementation → Test Automation | All acceptance tests pass |
| Test Automation → Release | Trace matrix shows ≥80% coverage of P0/P1 requirements |

## Epic List

### Epic 1: Instant Note Capture
Users can summon a floating window with a global hotkey from anywhere on their desktop, type a note in Markdown or plain text, and have it auto-saved instantly. The app runs as a system tray daemon.
**FRs covered:** FR1, FR4, FR8, FR9, FR10, FR16, FR19, FR20, FR21, FR39, FR40, FR47, FR58

### Epic 2: Workspace-Aware Note Organization
Notes are automatically scoped to the user's current project via git repository detection. Users can switch between workspaces, filter notes by workspace, or view all notes unscoped.
**FRs covered:** FR29, FR30, FR31, FR32, FR33, FR34, FR35

### Epic 3: Search & Discovery
Users can instantly find any note using full-text fuzzy search, scoped to the current workspace or across all workspaces, with results ranked by relevance.
**FRs covered:** FR11, FR12, FR13

### Epic 4: Multi-Tab Editing & Command Palette
Users can open multiple notes simultaneously in tabs and access all application features through a VS Code-style command palette with fuzzy matching.
**FRs covered:** FR23, FR24, FR25, FR26, FR27, FR28

### Epic 5: Note Lifecycle & Data Export
Users can soft-delete notes to a 30-day recoverable trash, restore them, permanently delete when needed, and export all notes as Markdown files or a JSON bundle.
**FRs covered:** FR5, FR6, FR7, FR49, FR50

### Epic 6: CLI Integration
Developers can capture notes and search from the terminal. CLI commands sync to the running desktop app in real-time via IPC socket.
**FRs covered:** FR2, FR3, FR14, FR15, FR36, FR37, FR38

### Epic 7: Personalization & Accessibility
Users can customize their experience with theme switching, font configuration, shortcut remapping, layout modes, and full keyboard-only navigation.
**FRs covered:** FR17, FR18, FR22, FR44, FR45, FR46, FR48

### Epic 8: Onboarding & Platform Integration
New users get a guided first-run experience. The app auto-starts on login and works reliably across Windows, macOS, and Linux with per-user data isolation.
**FRs covered:** FR41, FR42, FR43, FR51, FR52, FR53, FR54, FR55, FR56, FR57

---

## Epic 1: Instant Note Capture

Users can summon a floating window with a global hotkey from anywhere on their desktop, type a note in Markdown or plain text, and have it auto-saved instantly. The app runs as a system tray daemon.

**TEA Quality Gate:** P0 tests 100%, P1 tests ≥95%. No open high-severity bugs.
**Risk References:** RISK-002 (Data loss, Score 6) — crash recovery tests required on database and CRUD stories. RISK-004 (Window perf, Score 4) — benchmark tests for hotkey-to-visible latency.
**Test Scenarios:** P0-UNIT-001, P0-UNIT-002, P0-UNIT-003, P0-INT-001 (Note CRUD); P0-E2E-001, P1-INT-012 (Global hotkey + window management).

### Story 1.1: Tauri v2 Project Scaffold

As a developer,
I want a properly scaffolded Tauri v2 project with React 19 and TypeScript,
So that I have a working foundation to build Notey on.

**Acceptance Criteria:**

**Given** a fresh project directory
**When** the scaffold is created using `npm create tauri-app@latest notey -- --template react-ts`
**Then** the project structure includes `src/` (React frontend), `src-tauri/` (Rust backend), and `package.json`
**And** `npm install` completes without errors
**And** `cargo build` in `src-tauri/` completes without errors
**And** `npm run tauri dev` launches a window displaying the default React template
**And** TypeScript is configured with `strict: true` in `tsconfig.json`

### Story 1.2: Frontend Tooling Setup (Tailwind CSS v4 + shadcn/ui + Vitest)

As a developer,
I want the frontend tooling configured with Tailwind CSS v4, shadcn/ui, and testing infrastructure,
So that I can build styled, accessible components with test coverage.

**Acceptance Criteria:**

**Given** the scaffolded Tauri project from Story 1.1
**When** Tailwind CSS v4 is installed and configured
**Then** `tailwindcss` and `@tailwindcss/vite` are installed as dependencies
**And** `@tailwindcss/vite` is added as a Vite plugin in `vite.config.ts`
**And** the main CSS file uses `@import "tailwindcss"` (not legacy `@tailwind` directives)
**And** Tailwind utility classes (e.g., `bg-red-500`, `flex`, `p-4`) render correctly in the WebView

**Given** Tailwind CSS v4 is configured
**When** shadcn/ui is initialized with `npx shadcn@latest init`
**Then** `components.json` is created with `style: "new-york"`, `rsc: false`, `tailwind.config` left blank (v4 mode)
**And** the main CSS file includes `@theme inline` block mapping shadcn CSS variables
**And** `tw-animate-css` is installed (not legacy `tailwindcss-animate`)
**And** `npx shadcn@latest add button` installs a working Button component
**And** the path alias `@/*` resolves to `./src/*` in both `tsconfig.json` and `vite.config.ts`

**Given** shadcn/ui is configured
**When** Zustand v5 is added as a dependency
**Then** `import { create } from 'zustand'` resolves without errors

**Given** the frontend tooling is configured
**When** Vitest is set up for React component testing
**Then** `npx vitest run` executes successfully (even with zero tests)
**And** Vitest is configured with React plugin and jsdom environment

### Story 1.3: Rust Backend Dependencies & tauri-specta IPC Setup

As a developer,
I want type-safe IPC between the Rust backend and TypeScript frontend,
So that commands and types stay synchronized at compile time.

**Acceptance Criteria:**

**Given** the scaffolded Tauri project
**When** Rust dependencies are added to `src-tauri/Cargo.toml`
**Then** `rusqlite` is added with `bundled` and `modern_sqlite` features (enables FTS5)
**And** `chrono` is added with `serde` feature
**And** `thiserror` is added for error handling
**And** `tauri-specta`, `specta`, and `specta-typescript` are added with exact version pins (`=2.0.0-rc.24`, `=2.0.0-rc.24`, `=0.0.11` respectively)
**And** `toml` and `dirs` crates are added for config and platform paths

**Given** Rust dependencies are installed
**When** tauri-specta is configured in `lib.rs`
**Then** a `Builder::<tauri::Wry>::new()` is created with `collect_commands![]` and `collect_events![]`
**And** in debug builds, `builder.export(Typescript::default(), "../src/bindings.ts")` generates TypeScript bindings
**And** `builder.invoke_handler()` is passed to `tauri::Builder`

**Given** tauri-specta is configured
**When** a `NoteyError` enum is defined with `thiserror`
**Then** it has variants: `Database`, `NotFound`, `Validation`, `Io`, `Config`
**And** each variant has a descriptive error message
**And** `NoteyError` implements `serde::Serialize` for Tauri command error serialization

**Given** all backend dependencies are configured
**When** `cargo build` is run
**Then** it compiles without errors
**And** `src/bindings.ts` is generated (even if empty of commands)

### Story 1.4: SQLite Database with Notes Table & Migrations

As a developer,
I want a crash-safe SQLite database with the notes table schema,
So that notes can be reliably stored and retrieved.

**Acceptance Criteria:**

**Given** the Rust backend with rusqlite
**When** the database module initializes a connection
**Then** the database file is created at the platform-standard data directory (Linux: `$XDG_DATA_HOME/notey/notey.db`, macOS: `~/Library/Application Support/com.notey.app/notey.db`, Windows: `%APPDATA%\notey\notey.db`)
**And** the parent directory is created if it doesn't exist
**And** the connection is wrapped in `Mutex<Connection>` for thread safety

**Given** a database connection is established
**When** PRAGMAs are configured
**Then** `journal_mode = WAL` is set (crash-safe writes)
**And** `synchronous = NORMAL` is set
**And** `busy_timeout = 5000` is set
**And** `foreign_keys = ON` is set
**And** `cache_size = -10000` is set

**Given** PRAGMAs are configured
**When** rusqlite_migration runs on startup
**Then** migration 001 creates the `notes` table with columns: `id` INTEGER PRIMARY KEY, `title` TEXT NOT NULL DEFAULT '', `content` TEXT NOT NULL DEFAULT '', `format` TEXT NOT NULL DEFAULT 'markdown' CHECK(format IN ('markdown', 'plaintext')), `workspace_id` INTEGER NULL, `created_at` TEXT NOT NULL (ISO8601), `updated_at` TEXT NOT NULL (ISO8601), `deleted_at` TEXT NULL, `is_trashed` INTEGER NOT NULL DEFAULT 0
**And** the migration is idempotent (safe to run on existing database)

**Given** the database is initialized
**When** `cargo test` runs database integration tests
**Then** tests verify table creation, PRAGMA values, and WAL mode using a temp-file database

**TEA Test Scenarios:** P0-INT-001 — Database must survive application crash without corruption. Tests must verify WAL mode integrity and crash recovery behavior (RISK-002).

### Story 1.5: Note CRUD Tauri Commands

As a user,
I want to create, read, update, and list notes through the application,
So that my notes are persisted and retrievable.

**Acceptance Criteria:**

**Given** the database with notes table
**When** `create_note` command is invoked with `format` ("markdown" or "plaintext")
**Then** a new note is inserted with empty title, empty content, the specified format, and current ISO8601 timestamps for `created_at` and `updated_at`
**And** the new note (with assigned `id`) is returned as a typed response
**And** the command has both `#[tauri::command]` and `#[specta::specta]` attributes

**Given** a note exists in the database
**When** `get_note` command is invoked with a valid `id`
**Then** the full note record is returned with all fields serialized as camelCase JSON via `#[serde(rename_all = "camelCase")]`

**Given** a note ID that doesn't exist
**When** `get_note` is invoked
**Then** a `NoteyError::NotFound` error is returned

**Given** an existing note
**When** `update_note` command is invoked with `id`, optional `title`, optional `content`, optional `format`
**Then** only the provided fields are updated
**And** `updated_at` is set to the current ISO8601 timestamp
**And** the updated note is returned
**And** all queries use parameterized statements (no string interpolation)

**Given** multiple notes exist (some trashed, some not)
**When** `list_notes` command is invoked
**Then** only non-trashed notes (`is_trashed = 0`) are returned
**And** results are ordered by `updated_at` DESC

**Given** these commands are registered with tauri-specta
**When** `cargo build` completes
**Then** `src/bindings.ts` exports typed `commands.createNote()`, `commands.getNote()`, `commands.updateNote()`, `commands.listNotes()` functions
**And** the capability ACL in `src-tauri/capabilities/default.json` includes permissions for all note commands

**TEA Test Scenarios:** P0-UNIT-001 (create note), P0-UNIT-002 (update note), P0-UNIT-003 (list notes). All CRUD operations must include crash recovery assertions — no partial or empty note states visible after abrupt termination (RISK-002).

### Story 1.6: Design Token System (CSS Custom Properties)

As a user,
I want a consistent visual design with proper colors, typography, and spacing,
So that the app looks polished and is comfortable to use.

**Acceptance Criteria:**

**Given** Tailwind CSS v4 is configured
**When** design tokens are defined in the main CSS file
**Then** dark theme tokens are set as CSS custom properties on `[data-theme="dark"]`: `--bg-primary: #1a1a1a`, `--bg-elevated: #242424`, `--bg-surface: #2d2d2d`, `--border-default: #3a3a3a`, `--border-subtle: #2f2f2f`, `--text-primary: #e4e4e4`, `--text-secondary: #a0a0a0`, `--text-muted: #666666`, `--accent: #6b9eff`, `--accent-muted: #6b9eff20`, `--success: #4ade80`, `--warning: #fbbf24`, `--error: #f87171`, `--focus-ring: #6b9eff80`
**And** light theme tokens are set on `[data-theme="light"]`: `--bg-primary: #ffffff`, `--bg-elevated: #f5f5f5`, `--bg-surface: #ebebeb`, `--border-default: #d4d4d4`, `--border-subtle: #e5e5e5`, `--text-primary: #1a1a1a`, `--text-secondary: #666666`, `--text-muted: #a0a0a0`, `--accent: #3b7cff`, `--accent-muted: #3b7cff15`, `--success: #16a34a`, `--warning: #d97706`, `--error: #dc2626`, `--focus-ring: #3b7cff60`

**Given** theme color tokens are defined
**When** typography tokens are added
**Then** the primary font stack is `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`
**And** type scale tokens are defined: `--text-xs: 11px`, `--text-sm: 13px`, `--text-base: 14px`, `--text-lg: 16px`, `--text-xl: 18px`, `--text-2xl: 22px`

**Given** typography tokens are defined
**When** spacing and structural tokens are added
**Then** spacing tokens follow the 4px grid: `--space-1: 4px`, `--space-2: 8px`, `--space-3: 12px`, `--space-4: 16px`, `--space-6: 24px`, `--space-8: 32px`
**And** border radius tokens are defined: `--radius-sm: 2px`, `--radius-md: 4px`
**And** the `@theme inline` block integrates tokens with Tailwind v4 for utility class generation
**And** the `html` element has `data-theme="dark"` as default

### Story 1.7: App Shell Layout (CaptureWindow + StatusBar)

As a user,
I want a compact, focused window layout optimized for quick note capture,
So that I can write notes without visual clutter.

**Acceptance Criteria:**

**Given** the design token system is in place
**When** the CaptureWindow component renders
**Then** it displays as a container with default size 600x400px
**And** minimum window size is enforced at 400x300px
**And** the background uses `var(--bg-primary)`
**And** a subtle drop shadow is applied to the outer window only (no internal shadows)
**And** borders use 1px width with `var(--border-default)`

**Given** CaptureWindow renders
**When** the StatusBar component is rendered at the bottom
**Then** it has a fixed height of 24px
**And** it has a left section (placeholder for workspace name) and right section (placeholder for format toggle and save indicator)
**And** it uses `var(--bg-elevated)` background with a top border of `var(--border-subtle)`
**And** text uses `var(--text-secondary)` at `var(--text-xs)` size
**And** a character count indicator is shown in the right section, hidden first when window width < 400px

**Given** both components render
**When** the layout is measured
**Then** the editor area (placeholder div) occupies at least 85% of vertical space
**And** StatusBar occupies the bottom 24px
**And** no horizontal scrollbar appears at any width >= 400px

**TEA data-testid Requirements:** The editor area must include `data-testid="editor-pane"`, the status bar must include `data-testid="status-bar"`, the save indicator must include `data-testid="save-indicator"`, and the workspace name display must include `data-testid="workspace-name"`.

### Story 1.8: CodeMirror 6 Markdown Editor

As a user,
I want a Markdown editor with syntax highlighting that fills the capture window,
So that I can write formatted notes with visual feedback.

**Acceptance Criteria:**

**Given** the app shell layout with editor area placeholder
**When** CodeMirror 6 is integrated via `codemirror`, `@codemirror/lang-markdown`, and `@codemirror/language-data` packages
**Then** an `EditorPane` component renders a CodeMirror `EditorView` in the editor area
**And** the editor fills all available space between the top of the window and the StatusBar

**Given** the editor is rendered
**When** a user types Markdown content (e.g., `# Heading`, `**bold**`, `` `code` ``)
**Then** syntax highlighting is applied via `lang-markdown` with `codeLanguages: languages` for fenced code block support

**Given** the editor contains long lines
**When** text reaches the edge of the editor
**Then** soft-wrap is enabled (text wraps to next line, no horizontal scrollbar)

**Given** the editor has no content
**When** it is empty
**Then** a placeholder is displayed: "Start typing to create your first note." in `var(--text-muted)` color

**Given** the editor component mounts
**When** it becomes visible
**Then** `EditorView.focus()` is called so the cursor is in the editor ready for typing

**Given** the editor has content
**When** the content or cursor position is needed programmatically
**Then** `view.state.doc.toString()` returns the full content
**And** `view.state.selection.main.head` returns the cursor position
**And** content can be replaced via `view.dispatch({ changes: {...} })`

**TEA data-testid Requirements:** The EditorPane wrapper element must include `data-testid="editor-pane"`.

### Story 1.9: Auto-Save with Debounce & Save Indicator

As a user,
I want my notes auto-saved as I type with visual confirmation,
So that I never lose work and know my content is persisted.

**Acceptance Criteria:**

**Given** the CodeMirror editor is active
**When** a `useEditorStore` Zustand v5 store is created
**Then** it has state: `activeNoteId: number | null`, `saveStatus: 'idle' | 'saving' | 'saved' | 'failed'`, `lastSavedAt: string | null`
**And** it has named actions: `setActiveNote(id)`, `setSaveStatus(status)`, `createNewNote()`, `saveContent(content)`
**And** the store uses the curried TypeScript form: `create<EditorState>()((...) => ({...}))`

**Given** the editor is empty and no note is active (`activeNoteId` is null)
**When** the user types the first keystroke
**Then** `commands.createNote("markdown")` is invoked via tauri-specta bindings
**And** the returned note's `id` is set as `activeNoteId`
**And** subsequent keystrokes trigger the auto-save debounce on `updateNote`

**Given** a note is active in the editor
**When** the user types a keystroke
**Then** a 300ms debounce timer starts (resets on each subsequent keystroke)
**And** when the timer fires, `commands.updateNote({ id, content, title })` is invoked
**And** `title` is derived from the first line of content (truncated to 100 chars)

**Given** an auto-save is triggered
**When** the save completes successfully
**Then** `saveStatus` transitions: `idle` -> `saving` -> `saved`
**And** "Saving..." text in `var(--text-muted)` appears in StatusBar only if save takes >200ms
**And** "Saved" text in `var(--success)` color appears immediately on success and fades via opacity over 2s
**And** after 2s, the indicator returns to `idle` (hidden)

**Given** an auto-save is triggered
**When** the save fails
**Then** `saveStatus` becomes `failed`
**And** "Save failed" text in `var(--warning)` color appears in StatusBar and persists until the next successful save

**Given** save indicator transitions happen
**When** the user has `prefers-reduced-motion` enabled
**Then** the 2s opacity fade becomes instant (0ms)

### Story 1.10: Note Format Toggle (Markdown / Plain Text)

As a user,
I want to switch between Markdown and plain text editing modes,
So that I can choose the format that suits each note.

**Acceptance Criteria:**

**Given** the StatusBar right section
**When** a format indicator is rendered
**Then** it displays the current note's format ("Markdown" or "Plain text") as clickable text in `var(--text-secondary)` at `var(--text-xs)` size

**Given** the current format is "Markdown"
**When** the user clicks the format indicator
**Then** the format switches to "Plain text"
**And** CodeMirror removes the `lang-markdown` extension (no syntax highlighting)
**And** `commands.updateNote({ id, format: "plaintext" })` is invoked to persist the change

**Given** the current format is "Plain text"
**When** the user clicks the format indicator
**Then** the format switches to "Markdown"
**And** CodeMirror adds the `lang-markdown` extension (syntax highlighting active)
**And** `commands.updateNote({ id, format: "markdown" })` is invoked to persist the change

**Given** a note with format "plaintext" is loaded into the editor
**When** the editor renders
**Then** CodeMirror displays without Markdown syntax highlighting
**And** the StatusBar shows "Plain text"

### Story 1.11: Global Hotkey & Window Summon

As a user,
I want to press a keyboard shortcut from anywhere on my desktop to instantly open Notey,
So that I can capture thoughts the moment they occur.

**Acceptance Criteria:**

**Given** the application is starting up
**When** the main window is created
**Then** the window is created in a hidden state (not visible to user)
**And** the window is configured as always-on-top in floating mode
**And** the window is NOT destroyed on close (hide instead via `on_close_requested` preventing default)

**Given** the application has started
**When** `tauri-plugin-global-shortcut` (v2.3.1) is initialized
**Then** the default hotkey `Ctrl+Shift+N` (macOS: `Cmd+Shift+N`) is registered
**And** the capability ACL includes `global-shortcut:allow-register`, `global-shortcut:allow-unregister`, `global-shortcut:allow-is-registered`

**Given** the hotkey is registered and the window is hidden
**When** the user presses the hotkey from any application
**Then** the window becomes visible within 150ms (NFR1)
**And** the window appears centered on the active monitor
**And** the CodeMirror editor receives focus in the same frame as window show
**And** if a note was previously being edited, the cursor is at its last position

**Given** the window is visible
**When** the user presses the hotkey again
**Then** the window is hidden (toggle behavior)

**TEA Test Scenarios:** P0-E2E-001 (global hotkey summons window and focuses editor), P1-INT-012 (window management integration). Benchmark: hotkey-to-visible must be measured and asserted <150ms (RISK-004).

### Story 1.12: Window Dismiss & Save Flush

As a user,
I want to press Esc to instantly dismiss Notey and return to what I was doing,
So that capturing a note doesn't interrupt my workflow.

**Acceptance Criteria:**

**Given** the capture window is visible with the editor focused and no overlays open
**When** the user presses Esc
**Then** the window is hidden (not destroyed)
**And** the previously active application regains focus within 50ms (NFR7)

**Given** the user has typed content and a 300ms debounce save is pending
**When** the user presses Esc
**Then** the pending save is flushed immediately (debounce bypassed)
**And** the save write completes before the window is hidden
**And** no data is lost (NFR13)

**Given** the window was dismissed via Esc
**When** the user summons it again via hotkey
**Then** the editor state is preserved (same note, same content, same cursor position)

### Story 1.13: System Tray Icon & Context Menu

As a user,
I want Notey running in my system tray as a background process,
So that it's always available without taking up taskbar space.

**Acceptance Criteria:**

**Given** the application starts
**When** the system tray is initialized via the `tray-icon` feature flag in Cargo.toml
**Then** a monochrome icon appears in the system tray area

**Given** the system tray icon is visible
**When** the user right-clicks (or control-clicks on macOS) the icon
**Then** a context menu appears with items: "Open Notey", "Quit"

**Given** the context menu is open
**When** the user clicks "Open Notey"
**Then** the capture window becomes visible and the editor receives focus

**Given** the context menu is open
**When** the user clicks "Quit"
**Then** the application exits completely (process terminated)

**Given** the system tray icon is visible
**When** the user left-clicks the icon
**Then** the capture window visibility toggles (show if hidden, hide if visible)

**Given** the capture window is hidden
**When** the application is running
**Then** the tray icon remains visible, indicating the app is a background daemon
**And** the app is accessible via hotkey or tray icon at all times

### Story 1.14: TOML Configuration Service

As a user,
I want my settings stored in a human-readable config file,
So that I can back up and manually edit my preferences if needed.

**Acceptance Criteria:**

**Given** the application starts for the first time
**When** no config file exists
**Then** a default `config.toml` is created at the platform-standard config directory (Linux: `$XDG_CONFIG_HOME/notey/config.toml`, macOS: `~/Library/Application Support/com.notey.app/config.toml`, Windows: `%APPDATA%\notey\config.toml`)
**And** default values are written: `[general]` theme = "dark", layout_mode = "floating"; `[editor]` font_size = 14; `[hotkey]` global_shortcut = "Ctrl+Shift+N"

**Given** a config file exists
**When** the application starts
**Then** the config is loaded and parsed via `serde` + `toml` crate
**And** invalid or missing fields fall back to defaults without crashing

**Given** the config service is available
**When** `get_config` Tauri command is invoked
**Then** the full config is returned as typed JSON with camelCase serialization
**And** the command has both `#[tauri::command]` and `#[specta::specta]` attributes

**Given** a config update is needed
**When** `update_config` Tauri command is invoked with a partial config object
**Then** only the specified fields are updated in the TOML file
**And** the updated config is returned

---

## Epic 2: Workspace-Aware Note Organization

Notes are automatically scoped to the user's current project via git repository detection. Users can switch between workspaces, filter notes by workspace, or view all notes unscoped.

**TEA Quality Gate:** P0 tests 100%, P1 tests ≥95%. No open high-severity bugs.
**Test Scenarios:** P1-UNIT-003, P1-UNIT-004 (Workspace detection).

### Story 2.1: Workspaces Table & CRUD Commands

As a developer,
I want a workspaces table and backend commands for workspace management,
So that notes can be associated with project workspaces.

**Acceptance Criteria:**

**Given** the existing database with notes table
**When** a new migration is added
**Then** it creates the `workspaces` table with columns: `id` INTEGER PRIMARY KEY, `name` TEXT NOT NULL, `path` TEXT NOT NULL UNIQUE, `created_at` TEXT NOT NULL (ISO8601)
**And** an index `idx_workspaces_path` is created on the `path` column

**Given** the workspaces table exists
**When** `create_workspace` command is invoked with `name` and `path`
**Then** a new workspace is inserted and returned with its assigned `id`
**And** if a workspace with the same `path` already exists, the existing workspace is returned (upsert behavior)

**Given** workspaces exist
**When** `list_workspaces` command is invoked
**Then** all workspaces are returned with their note counts (count of non-trashed notes per workspace)
**And** results are ordered by `name` ASC

**Given** a workspace exists
**When** `get_workspace` command is invoked with a valid `id`
**Then** the workspace record is returned with its note count

**Given** all commands are registered with tauri-specta
**When** `cargo build` completes
**Then** typed TypeScript bindings are generated for all workspace commands

### Story 2.2: Git Repository Detection Service

As a developer,
I want to detect git repositories from file system paths,
So that workspaces can be automatically identified.

**Acceptance Criteria:**

**Given** a file system path
**When** `detect_workspace` Tauri command is invoked with that path
**Then** the service walks up from the given path looking for a `.git` directory
**And** if found, returns the repository root path and directory name as workspace name

**Given** a path inside a git repository (e.g., `/home/user/projects/myapp/src/`)
**When** `detect_workspace` is invoked
**Then** it returns `{ name: "myapp", path: "/home/user/projects/myapp" }`

**Given** a path that is NOT inside a git repository
**When** `detect_workspace` is invoked
**Then** it falls back to the given directory itself as the workspace (FR31)
**And** returns `{ name: "dirname", path: "/the/given/path" }`

**Given** the detected path
**When** it is validated
**Then** `std::fs::canonicalize()` is used to resolve the real path
**And** the path must resolve to an existing directory

**TEA Test Scenarios:** P1-UNIT-003 (git repo detection from nested path), P1-UNIT-004 (fallback to working directory for non-git paths).

### Story 2.3: Auto-Workspace Assignment on Note Creation

As a user,
I want my notes automatically tagged with my current project,
So that they're organized without manual effort.

**Acceptance Criteria:**

**Given** the user creates a note (via GUI or later via CLI)
**When** a workspace context is available (detected or active)
**Then** the note's `workspace_id` is set to the detected/active workspace
**And** if the workspace doesn't exist in the database, it is created first via `create_workspace`

**Given** no workspace context is available
**When** a note is created
**Then** the note's `workspace_id` is left NULL (unscoped note)

**Given** the `useEditorStore` is active
**When** a workspace is detected
**Then** `useWorkspaceStore` tracks the `activeWorkspaceId`
**And** new notes created in the GUI are assigned the active workspace

### Story 2.4: Workspace Selector in StatusBar

As a user,
I want to see which workspace I'm in and switch workspaces easily,
So that I can navigate between projects.

**Acceptance Criteria:**

**Given** a `useWorkspaceStore` Zustand v5 store is created
**When** it initializes
**Then** it has state: `workspaces: Workspace[]`, `activeWorkspaceId: number | null`, `isAllWorkspaces: boolean`
**And** it has actions: `setActiveWorkspace(id)`, `setAllWorkspaces()`, `loadWorkspaces()`

**Given** a workspace is active
**When** the StatusBar left section renders
**Then** it shows the workspace name + note count in format "[name] · [N] notes"
**And** the text is clickable

**Given** the user clicks the workspace display in StatusBar
**When** the workspace selector dropdown opens
**Then** it lists all workspaces with their note counts
**And** includes an "All Workspaces" option at the top (FR34)
**And** is keyboard-navigable (arrow keys to move, Enter to select, Esc to close)

**Given** the user selects a workspace from the dropdown
**When** the selection is confirmed
**Then** `activeWorkspaceId` updates to the selected workspace
**And** the note list filters to show only that workspace's notes (FR32)
**And** the dropdown closes
**And** the StatusBar updates to show the new workspace name + count

### Story 2.5: Workspace-Filtered Note Views

As a user,
I want to see only the notes in my current workspace,
So that I can focus on relevant notes.

**Acceptance Criteria:**

**Given** a workspace is active (`activeWorkspaceId` is set)
**When** `list_notes` command is invoked with `workspace_id` parameter
**Then** only non-trashed notes with matching `workspace_id` are returned (FR33)
**And** results are ordered by `updated_at` DESC

**Given** "All Workspaces" is selected (`isAllWorkspaces: true`)
**When** `list_notes` command is invoked without `workspace_id`
**Then** all non-trashed notes across all workspaces are returned (FR34)

**Given** the workspace filter changes
**When** the frontend receives the updated note list
**Then** any note list or count display refreshes to reflect the current scope
**And** the StatusBar note count updates accordingly

### Story 2.6: Manual Workspace Reassignment

As a user,
I want to move a note to a different workspace,
So that I can correct or change a note's organization.

**Acceptance Criteria:**

**Given** a note exists in workspace A
**When** `reassign_note_workspace` command is invoked with the note's `id` and workspace B's `id`
**Then** the note's `workspace_id` is updated to workspace B
**And** `updated_at` is refreshed
**And** the updated note is returned

**Given** the note is reassigned
**When** the workspace filter is active for workspace A
**Then** the reassigned note no longer appears in workspace A's view
**And** the note appears in workspace B's view

**Given** a note exists
**When** `reassign_note_workspace` is invoked with `workspace_id: null`
**Then** the note becomes unscoped (no workspace)
**And** it appears only in the "All Workspaces" view (FR35)

---

## Epic 3: Search & Discovery

Users can instantly find any note using full-text fuzzy search, scoped to the current workspace or across all workspaces, with results ranked by relevance.

**TEA Quality Gate:** P0 tests 100%, P1 tests ≥95%. No open high-severity bugs.
**Risk References:** RISK-003 (FTS5 data integrity, Score 4) — integration tests for index sync.
**Test Scenarios:** P0-INT-004, P0-INT-005 (FTS5 search); P1-UNIT-001, P1-UNIT-002 (search service).

### Story 3.1: FTS5 Virtual Table & Sync Triggers

As a developer,
I want a full-text search index that stays in sync with the notes table,
So that search queries return accurate, up-to-date results.

**Acceptance Criteria:**

**Given** the existing database with notes table
**When** a new migration is added
**Then** it creates the `notes_fts` virtual table using FTS5 with `external content=notes`, `content_rowid=id`, indexing `title` and `content` columns

**Given** the FTS5 table exists
**When** SQLite triggers are created
**Then** an INSERT trigger on `notes` inserts the new row into `notes_fts`
**And** an UPDATE trigger on `notes` deletes the old FTS row and inserts the updated row
**And** a DELETE trigger on `notes` removes the row from `notes_fts`

**Given** existing notes exist before the migration
**When** the migration runs
**Then** a backfill statement populates `notes_fts` from all existing `notes` rows

**Given** the triggers are active
**When** a note is created, updated, or deleted via CRUD commands
**Then** the FTS5 index reflects the change without additional application code

**TEA Test Scenarios:** P0-INT-004 (FTS5 index stays in sync after CRUD), P0-INT-005 (FTS5 backfill on migration). Integration tests must verify index consistency after create, update, and delete sequences (RISK-003).

### Story 3.2: Full-Text Search Tauri Command

As a user,
I want to search my notes and get relevant results instantly,
So that I can find information I've previously captured.

**Acceptance Criteria:**

**Given** the FTS5 index is populated
**When** `search_notes` command is invoked with a `query` string
**Then** the query is run against `notes_fts` using FTS5 MATCH syntax
**And** results are ranked by the FTS5 `rank` function (relevance ordering) (FR13)
**And** results are limited to top 50

**Given** search results are returned
**When** each result is serialized
**Then** it includes: `id`, `title`, `content` snippet (extracted via FTS5 `snippet()` with 30-char context), `workspaceName`, `updatedAt`, `format`
**And** only non-trashed notes are included

**Given** an optional `workspace_id` parameter is provided
**When** the search executes
**Then** results are filtered to only notes in the specified workspace (FR12)

**Given** a database with up to 10,000 notes
**When** a search query executes
**Then** results return in < 100ms (NFR3)

**Given** an empty query string
**When** `search_notes` is invoked
**Then** an empty result set is returned (no error)

**TEA Test Scenarios:** P1-UNIT-001 (search returns ranked results), P1-UNIT-002 (search with workspace filter). Performance assertion: <100ms for 10K notes.

### Story 3.3: SearchOverlay UI Component

As a user,
I want a search interface that shows me matching notes with context,
So that I can visually identify the note I'm looking for.

**Acceptance Criteria:**

**Given** a `useSearchStore` Zustand v5 store is created
**When** it initializes
**Then** it has state: `query: string`, `results: SearchResult[]`, `isOpen: boolean`, `selectedIndex: number`
**And** it has actions: `setQuery(q)`, `openSearch()`, `closeSearch()`, `selectNext()`, `selectPrev()`

**Given** the user opens search (via Ctrl/Cmd+F or command palette)
**When** the SearchOverlay renders
**Then** it appears as a full-width overlay over the editor content
**And** the search input is auto-focused with placeholder "Search notes..."
**And** a modal backdrop dims the editor content behind it

**Given** the user types a query
**When** the query changes
**Then** `commands.searchNotes({ query })` is invoked (no debounce needed at <100ms)
**And** results display below the input showing: title, workspace name, relative date, and snippet
**And** query matches in snippets are highlighted with `var(--accent)` text and `var(--accent-muted)` background

**Given** results are displayed
**When** there are 0 results
**Then** "No notes matching '[query]'" empty state is shown in `var(--text-muted)`

**Given** the search overlay is open
**When** the user presses Esc
**Then** the overlay closes and focus returns to the editor

**Given** search results are shown
**When** the result count is displayed
**Then** the header shows "N results · ↑↓ navigate · Enter open"

**TEA data-testid Requirements:** The search overlay container must include `data-testid="search-overlay"`, the search input must include `data-testid="search-input"`, and each search result item must include `data-testid="search-result-{id}"`.

### Story 3.4: Search Result Keyboard Navigation & Note Opening

As a user,
I want to navigate search results with my keyboard and open notes,
So that I can find and access notes without touching my mouse.

**Acceptance Criteria:**

**Given** search results are displayed
**When** the user presses the down arrow key
**Then** the next result is highlighted with `var(--accent-muted)` background
**And** `selectedIndex` increments

**Given** search results are displayed
**When** the user presses the up arrow key
**Then** the previous result is highlighted
**And** `selectedIndex` decrements

**Given** a result is highlighted
**When** the user presses Enter
**Then** the selected note opens in the editor (or in a new tab if multi-tab is implemented)
**And** the search overlay closes
**And** the editor receives focus

**Given** the search overlay is open
**When** focus state is checked
**Then** focus is trapped within the overlay (Tab cycles within, never escapes to editor)
**And** Esc is the only way to dismiss without selecting

**Given** search results include accessible markup
**When** a screen reader reads the results
**Then** the container has `role="search"`, the results list has `role="listbox"`, each result has `role="option"` with `aria-selected` on the highlighted result
**And** the input has `aria-label="Search notes"`

### Story 3.5: Workspace-Scoped Search Toggle

As a user,
I want to search within my current workspace or across all workspaces,
So that I can control the scope of my search.

**Acceptance Criteria:**

**Given** the search overlay is open and a workspace is active
**When** the search defaults render
**Then** the current workspace name is shown as the default search scope
**And** results are filtered to the active workspace

**Given** the user wants to broaden the search
**When** the user toggles the scope (via a keyboard shortcut or clickable scope indicator)
**Then** the scope switches to "All Workspaces"
**And** the search re-executes with no `workspace_id` filter
**And** the scope indicator updates to show "All Workspaces"

**Given** the user wants to narrow the search
**When** the user toggles the scope back
**Then** the scope returns to the active workspace
**And** results re-filter to the current workspace

---

## Epic 4: Multi-Tab Editing & Command Palette

Users can open multiple notes simultaneously in tabs and access all application features through a VS Code-style command palette with fuzzy matching.

**TEA Quality Gate:** P0 tests 100%, P1 tests ≥95%. No open high-severity bugs.

### Story 4.1: Tab State Management Store

As a developer,
I want a centralized tab state store,
So that tab operations are predictable and consistent.

**Acceptance Criteria:**

**Given** a `useTabStore` Zustand v5 store is created
**When** it initializes
**Then** it has state: `tabs: Tab[]` (each Tab: `{ noteId: number, title: string, cursorPos: number }`), `activeTabIndex: number`
**And** it has actions: `openTab(noteId)`, `closeTab(index)`, `switchTab(index)`, `reorderTab(fromIndex, toIndex)`, `updateTabTitle(index, title)`, `updateCursorPos(index, pos)`

**Given** `openTab` is called with a noteId
**When** that note is already open in a tab
**Then** the existing tab is activated (no duplicate tabs)

**Given** `openTab` is called with a new noteId
**When** the tab is added
**Then** it is appended to the tabs array and made active

**Given** `closeTab` is called on the active tab
**When** it is the only tab
**Then** the tab is removed and the editor shows the empty state

**Given** `closeTab` is called on the active tab
**When** other tabs exist
**Then** the adjacent tab (prefer right, then left) becomes active

### Story 4.2: TabBar Component

As a user,
I want a visual tab bar showing my open notes,
So that I can see and manage my open notes at a glance.

**Acceptance Criteria:**

**Given** the useTabStore has open tabs
**When** the TabBar component renders between the window top and the editor
**Then** it has a maximum height of 32px
**And** each tab shows the note title (first line of content, truncated with ellipsis at ~20 chars)
**And** a new untitled note shows "New note" as the label

**Given** a tab is active
**When** it renders
**Then** it has a 2px bottom border in `var(--accent)` color
**And** text uses `var(--text-primary)` color

**Given** a tab is inactive
**When** it renders
**Then** text uses `var(--text-muted)` color
**And** no accent border is shown

**Given** the user hovers over a tab
**When** the hover state activates
**Then** a close (×) button appears on the hovered tab
**And** middle-clicking the tab closes it

**Given** more tabs are open than can fit in the tab bar width
**When** the tab bar renders
**Then** tabs truncate progressively and an overflow dropdown ("...") shows hidden tabs

**Given** the tab bar is rendered
**When** accessible markup is checked
**Then** the container has `role="tablist"`, each tab has `role="tab"` with `aria-selected` on the active tab

**TEA data-testid Requirements:** The tab bar container must include `data-testid="tab-bar"` and each tab must include `data-testid="tab-{id}"` where `{id}` is the note ID.

### Story 4.3: Tab Keyboard Navigation

As a user,
I want to switch tabs with keyboard shortcuts,
So that I can navigate between notes without leaving the keyboard.

**Acceptance Criteria:**

**Given** multiple tabs are open
**When** the user presses Ctrl+Tab
**Then** the next tab (to the right) becomes active

**Given** multiple tabs are open
**When** the user presses Ctrl+Shift+Tab
**Then** the previous tab (to the left) becomes active

**Given** at least N tabs are open
**When** the user presses Ctrl+1 through Ctrl+9
**Then** the Nth tab becomes active (Ctrl+1 = first tab, Ctrl+9 = last tab or 9th)

**Given** a tab is active
**When** the user presses Ctrl+W
**Then** the active tab is closed (no confirmation dialog needed)

**Given** the tab bar has focus
**When** the user presses arrow keys
**Then** Left/Right arrows move focus between tabs
**And** Enter or Space activates the focused tab

### Story 4.4: Editor-Tab Integration (Multi-Instance CodeMirror)

As a user,
I want each tab to maintain its own editor state,
So that switching tabs preserves my cursor position and content.

**Acceptance Criteria:**

**Given** multiple tabs are open
**When** the user switches from tab A to tab B
**Then** tab A's cursor position is saved in `useTabStore`
**And** tab B's content is loaded into the CodeMirror editor
**And** tab B's cursor position is restored via `EditorSelection.cursor(pos)`

**Given** a note is already open in a tab
**When** the user opens the same note from search or note list
**Then** the existing tab is activated (no duplicate CodeMirror instances)

**Given** the active tab has unsaved changes (debounce pending)
**When** the user switches tabs
**Then** the pending save for the previous tab flushes immediately
**And** the new tab's content loads after the flush completes

**Given** a tab is open
**When** auto-save triggers for the active tab
**Then** only the active tab's content is saved (inactive tabs are not affected)
**And** the save indicator reflects the active tab's save status

### Story 4.5: Command Palette Core (cmdk + shadcn)

As a user,
I want a command palette to access all features by typing,
So that I can do anything without remembering where it is in the UI.

**Acceptance Criteria:**

**Given** shadcn command component is installed (`npx shadcn@latest add command`)
**When** the CommandPalette component renders
**Then** it is positioned top-center, max 520px wide
**And** it has a ">" prefix in the input field
**And** a modal backdrop dims the editor behind it

**Given** the command palette is closed
**When** the user presses Ctrl/Cmd+P
**Then** the command palette opens with the input focused (FR27)

**Given** the command palette is open
**When** the user types
**Then** commands are filtered by fuzzy matching across names and descriptions (FR28)
**And** filtering completes in <50ms (client-side only, no backend call)
**And** results update on each keystroke

**Given** commands are displayed
**When** they render in the list
**Then** they are grouped under headings: "Actions", "Settings", "Navigation"
**And** keyboard shortcuts are displayed right-aligned per command
**And** platform-aware modifiers are shown (⌘ on macOS, Ctrl on Windows/Linux)

**Given** the command palette is open
**When** accessible markup is checked
**Then** the input has `role="combobox"`, the results have `role="listbox"` (provided by cmdk)

**Given** the command palette is open
**When** the user presses Esc
**Then** the palette closes and focus returns to the editor

**TEA data-testid Requirements:** The command palette container must include `data-testid="command-palette"` and the input must include `data-testid="command-input"`.

### Story 4.6: Command Palette Action Registry

As a user,
I want all application features wired into the command palette,
So that every action is discoverable and executable from one place.

**Acceptance Criteria:**

**Given** the command palette is open
**When** all commands are registered
**Then** the following commands are available with their keyboard shortcuts:
- Actions group: New Note (Ctrl+N), Search Notes (Ctrl+F), Switch Workspace (Ctrl+Shift+W)
- Navigation group: Open Note List, View Trash
- Settings group: Toggle Theme (Ctrl+Shift+T), Toggle Layout Mode, Toggle Format, Open Settings (Ctrl+,), Export to Markdown, Export to JSON

**Given** the user selects a command
**When** `onSelect` fires
**Then** the command palette closes
**And** the associated action executes (e.g., "New Note" creates a note and opens it in a new tab, "Search Notes" opens the search overlay, "Toggle Theme" switches the theme)

**Given** a command has a keyboard shortcut
**When** the shortcut is pressed outside the command palette
**Then** the action executes directly (same handler as the command palette entry)

### Story 4.7: Tab Reordering

As a user,
I want to drag tabs to reorder them,
So that I can organize my open notes by priority or topic.

**Acceptance Criteria:**

**Given** multiple tabs are open
**When** the user clicks and drags a tab
**Then** a visual drag indicator shows the tab's new position
**And** releasing the tab drops it at the indicated position

**Given** a tab is dropped at a new position
**When** the reorder completes
**Then** `useTabStore.reorderTab(fromIndex, toIndex)` is called
**And** the tab bar re-renders with the new order
**And** the active tab remains active (not disrupted by reorder)

### Story 4.8: Note List Panel (Slide-from-Left Browse)

As a user,
I want to browse my notes in a side panel,
So that I can quickly find and open notes visually.

**Acceptance Criteria:**

**Given** the user triggers "Open Note List" (via command palette or keyboard shortcut)
**When** the NoteListPanel opens
**Then** it slides in from the left, 200px fixed width, overlaying editor content
**And** the editor background behind the panel is dimmed

**Given** the panel is open
**When** the note list renders
**Then** the header shows the current workspace name and note count (e.g., "my-project · 23 notes")
**And** each list item shows: title (first line), relative date (e.g., "2 days ago"), format indicator (Markdown/Plain text)
**And** notes are ordered by `updated_at` DESC

**Given** the panel is open
**When** the user navigates with arrow keys
**Then** Up/Down arrows move selection through the list
**And** Enter opens the selected note in a tab and dismisses the panel
**And** Esc dismisses the panel without opening a note

**Given** the panel is open
**When** focus state is checked
**Then** focus is trapped within the panel (Tab cycles within, Esc exits)
**And** the panel has `role="navigation"` with `aria-label="Note list"`
**And** the note list has `role="listbox"` with `role="option"` on each item

**Given** the panel is open
**When** the user clicks a note
**Then** the note opens in a tab and the panel dismisses

### Story 4.9: Session State Persistence (Tabs, Cursor, Workspace)

As a user,
I want my open tabs and workspace restored when I reopen Notey,
So that I can pick up right where I left off.

**Acceptance Criteria:**

**Given** the user has tabs open with notes
**When** the window is hidden or the app exits
**Then** the current session state is saved: open tab noteIds, active tab index, cursor positions per tab, active workspace id

**Given** session state was previously saved
**When** the app starts or the window is shown
**Then** the previous tabs are reopened with their notes loaded
**And** the active tab is restored
**And** the cursor position in the active tab is restored
**And** the active workspace is restored

**Given** a saved tab references a note that no longer exists (deleted)
**When** the session restores
**Then** that tab is silently skipped (no error shown)

**Given** no previous session state exists (first run)
**When** the app starts
**Then** the editor shows the empty state (no tabs, placeholder text)

---

## Epic 5: Note Lifecycle & Data Export

Users can soft-delete notes to a 30-day recoverable trash, restore them, permanently delete when needed, and export all notes as Markdown files or a JSON bundle.

**TEA Quality Gate:** P0 tests 100%, P1 tests ≥95%. No open high-severity bugs.
**Test Scenarios:** P1-INT-009, P1-INT-010 (Export).

### Story 5.1: Soft-Delete Note to Trash with Toast

As a user,
I want to delete notes without losing them permanently,
So that I can recover accidentally deleted notes.

**Acceptance Criteria:**

**Given** a note exists and is not trashed
**When** `trash_note` Tauri command is invoked with the note's `id`
**Then** the note's `is_trashed` is set to 1 and `deleted_at` is set to the current ISO8601 timestamp (FR5)
**And** the note disappears from active note lists

**Given** a note is trashed
**When** the UI updates
**Then** a toast notification appears at the bottom-right: "Note moved to trash" (auto-dismiss after 3s)
**And** the toast is non-blocking (user can continue typing in another note)

**Given** the trashed note was open in a tab
**When** the trash completes
**Then** the tab is closed
**And** an adjacent tab becomes active (or empty state if it was the only tab)

### Story 5.2: Trash View & Note Restoration

As a user,
I want to see my deleted notes and restore them,
So that I can recover notes I didn't mean to delete.

**Acceptance Criteria:**

**Given** the user selects "View Trash" from the command palette
**When** the trash view renders
**Then** it shows all soft-deleted notes (is_trashed = 1) ordered by `deleted_at` DESC
**And** each item shows: title, relative date of deletion (e.g., "deleted 3 days ago")

**Given** a trashed note is displayed
**When** the user clicks "Restore" on that note
**Then** `restore_note` command sets `is_trashed = 0` and `deleted_at = null` (FR6)
**And** the note returns to its original workspace
**And** a toast appears: "Note restored" (3s auto-dismiss)

**Given** the trash is empty
**When** the trash view renders
**Then** "Trash is empty." empty state is shown in `var(--text-muted)`

### Story 5.3: Permanent Delete with Confirmation Dialog

As a user,
I want to permanently delete notes from trash with a confirmation step,
So that I don't accidentally lose data forever.

**Acceptance Criteria:**

**Given** a trashed note is displayed in the trash view
**When** the user clicks "Delete Forever"
**Then** a modal confirmation dialog appears centered with backdrop dimmed
**And** the dialog shows: "Permanently delete [title]? This cannot be undone."
**And** the "Delete Forever" button is styled with `var(--error)` color
**And** the "Cancel" button is default-focused

**Given** the confirmation dialog is open
**When** the user clicks "Delete Forever"
**Then** the note is permanently deleted from the database (DELETE from `notes` and `notes_fts`) (FR7)
**And** the dialog closes and the trash view refreshes

**Given** the confirmation dialog is open
**When** the user clicks "Cancel" or presses Esc
**Then** the dialog closes with no action taken

**Given** the dialog component
**When** accessible markup is checked
**Then** it uses shadcn Dialog component with `role="alertdialog"` and `aria-modal="true"`

### Story 5.4: Trash Auto-Purge (30-Day Retention)

As a user,
I want expired trash automatically cleaned up,
So that deleted notes don't accumulate indefinitely.

**Acceptance Criteria:**

**Given** the application starts
**When** the auto-purge check runs
**Then** all notes where `deleted_at` is more than 30 days ago are permanently deleted (NFR16)
**And** the purge uses a single DELETE statement with date comparison

**Given** notes are auto-purged
**When** the purge completes
**Then** no user notification is shown (silent background operation)
**And** the FTS5 triggers handle removing entries from `notes_fts`

**Given** the 30-day threshold
**When** the config is checked
**Then** the threshold is configurable in `config.toml` (e.g., `[trash] retention_days = 30`)

### Story 5.5: Markdown Export with Native File Picker

As a user,
I want to export my notes as Markdown files,
So that I can back up or migrate my notes to other tools.

**Acceptance Criteria:**

**Given** the user selects "Export to Markdown" from the command palette
**When** the export flow begins
**Then** a native OS directory picker dialog opens via Tauri's scoped filesystem API
**And** file system access is scoped to the user-selected directory only (NFR9)

**Given** the user selects a directory
**When** the export executes via `export_markdown` Tauri command
**Then** each non-trashed note is written as an individual `.md` file (FR49)
**And** each file has YAML frontmatter with: `title`, `created_at`, `updated_at`, `workspace`, `format`
**And** the filename is derived from the note title (sanitized for filesystem safety)

**Given** the export completes
**When** the UI updates
**Then** a toast shows: "Exported N notes to /path/to/directory" (5s auto-dismiss)

**Given** the export takes longer than 2s
**When** progress is tracked
**Then** a progress toast shows: "Exporting... N/total"

**Given** 10,000 notes
**When** export runs
**Then** it completes within 30 seconds (NFR20)

**TEA Test Scenarios:** P1-INT-009 (Markdown export writes correct files with frontmatter).

### Story 5.6: JSON Export

As a user,
I want to export all my notes as a single JSON file,
So that I can programmatically process or back up my data.

**Acceptance Criteria:**

**Given** the user selects "Export to JSON" from the command palette
**When** the export flow begins
**Then** a native OS file save dialog opens

**Given** the user selects a file path
**When** the export executes via `export_json` Tauri command
**Then** all non-trashed notes are written as a single `.json` file (FR50)
**And** the file contains an array of note objects with all metadata (id, title, content, format, workspaceName, createdAt, updatedAt)
**And** JSON is formatted with 2-space indentation for readability

**Given** the export completes
**When** the UI updates
**Then** a toast shows: "Exported N notes to /path/to/file.json" (5s auto-dismiss)

**TEA Test Scenarios:** P1-INT-010 (JSON export produces valid structured file with all note metadata).

---

## Epic 6: CLI Integration

Developers can capture notes and search from the terminal. CLI commands sync to the running desktop app in real-time via IPC socket.

**TEA Quality Gate:** P0 tests 100%, P1 tests ≥95%. No open high-severity bugs.
**Risk References:** RISK-006 (CLI injection, Score 6) — input validation tests required as acceptance criteria.
**Test Scenarios:** P0-UNIT-004, P0-UNIT-005, P0-UNIT-006, P0-INT-008 (CLI binary); P0-INT-007, P1-INT-001 through P1-INT-008 (IPC socket server).

### Story 6.1: CLI Crate Scaffold & Argument Parsing

As a developer,
I want a standalone CLI binary with well-defined subcommands,
So that terminal users have a clear interface.

**Acceptance Criteria:**

**Given** a new `notey-cli/` directory is created alongside `src-tauri/`
**When** the crate is set up with its own `Cargo.toml`
**Then** dependencies include: `clap` (with derive feature), `serde_json`, `interprocess`
**And** the crate builds as a standalone binary named `notey`

**Given** the CLI binary
**When** `notey --help` is run
**Then** it shows subcommands: `add`, `list`, `search`

**Given** the `add` subcommand
**When** `notey add --help` is run
**Then** it shows: positional `<TEXT>` argument for note content, `--stdin` flag for reading from stdin, optional `--format` flag (markdown/plaintext, default markdown)

**Given** the `list` subcommand
**When** `notey list --help` is run
**Then** it shows: optional `--workspace <name>` filter

**Given** the `search` subcommand
**When** `notey search --help` is run
**Then** it shows: positional `<QUERY>` argument, optional `--workspace <name>` filter

**Given** the CLI crate
**When** its Rust code is checked
**Then** it shares NO code with `src-tauri/` (protocol types are duplicated as simple JSON structs)

**TEA Test Scenarios:** P0-UNIT-004 (CLI argument parsing), P0-UNIT-005 (CLI input validation — max 1MB, no injection), P0-UNIT-006 (CLI exit codes). Input validation tests are required acceptance criteria per RISK-006 (CLI injection, Score 6).

### Story 6.2: IPC Socket Server in Desktop App

As a developer,
I want the desktop app to listen for CLI commands via a local socket,
So that the CLI can communicate with the running app.

**Acceptance Criteria:**

**Given** the desktop application starts
**When** the IPC server initializes
**Then** it listens on a Unix socket (Linux/macOS) or named pipe (Windows)
**And** the socket path is user-scoped: `/run/user/<uid>/notey.sock` (Linux), equivalent on macOS/Windows
**And** socket file permissions are set to owner-only (0600) (NFR11)

**Given** the server is listening
**When** a client connects and sends a JSON request
**Then** the request format is: `{ "action": "string", "payload": {} }`
**And** the response format is: `{ "success": true/false, "data": {}, "error": "string or null" }`

**Given** the server supports actions
**When** action handlers are registered
**Then** supported actions include: `create_note`, `list_notes`, `search_notes`
**And** each action delegates to the existing Tauri command logic (same database operations)

**Given** the application exits
**When** cleanup runs
**Then** the socket file is removed

**TEA Test Scenarios:** P0-INT-007 (IPC socket server accepts and routes CLI commands), P0-INT-008 (IPC protocol request/response format validation), P1-INT-001 through P1-INT-008 (IPC socket integration — concurrent connections, malformed requests, timeout handling, socket permission enforcement).

### Story 6.3: CLI `add` Command (Text + Stdin)

As a developer,
I want to capture notes from the terminal,
So that I can save thoughts without switching to the GUI.

**Acceptance Criteria:**

**Given** the desktop app is running
**When** `notey add "My quick note"` is executed
**Then** a JSON request is sent to the IPC socket: `{ "action": "create_note", "payload": { "content": "My quick note", "format": "markdown" } }`
**And** the response contains the created note's id
**And** stdout prints: "✓ Note created" in green (FR2)

**Given** the desktop app is running
**When** `echo "piped content" | notey add --stdin` is executed
**Then** stdin is read until EOF and used as the note content (FR3)
**And** the note is created via IPC socket
**And** input is validated: maximum 1MB size (NFR10)

**Given** the user is in a git repository
**When** `notey add` is executed
**Then** the CLI auto-detects the git workspace from CWD (FR29)
**And** the workspace name and path are included in the create request

**Given** stdout is a TTY
**When** output is printed
**Then** ANSI colors are used (green for success) (UX-DR61)

**Given** stdout is piped to another command
**When** output is printed
**Then** plain text is used (no ANSI escape codes) (UX-DR61)

### Story 6.4: CLI `list` Command

As a developer,
I want to list my notes from the terminal,
So that I can see what I've captured without opening the GUI.

**Acceptance Criteria:**

**Given** the desktop app is running
**When** `notey list` is executed
**Then** a JSON request `{ "action": "list_notes", "payload": {} }` is sent to the IPC socket
**And** results are displayed one per line with: title (truncated to 50 chars), relative date, workspace name (FR15)

**Given** the desktop app is running
**When** `notey list --workspace my-project` is executed
**Then** the request includes workspace filter
**And** only notes in the specified workspace are returned

**Given** results are displayed
**When** the format is checked
**Then** output is clean, one line per note, suitable for piping to other commands

### Story 6.5: CLI `search` Command

As a developer,
I want to search notes from the terminal,
So that I can find information from my terminal workflow.

**Acceptance Criteria:**

**Given** the desktop app is running
**When** `notey search "deployment steps"` is executed
**Then** a JSON request `{ "action": "search_notes", "payload": { "query": "deployment steps" } }` is sent to the IPC socket (FR14)
**And** results display: title, snippet with match context (30 chars), workspace name, relative date

**Given** the desktop app is running
**When** `notey search "query" --workspace my-project` is executed
**Then** results are filtered to the specified workspace

**Given** no results match
**When** the response is empty
**Then** stdout prints: "No notes matching 'query'"

### Story 6.6: Real-Time Desktop Sync on CLI Changes

As a user,
I want notes created via CLI to appear in my desktop app immediately,
So that both interfaces stay in sync.

**Acceptance Criteria:**

**Given** the CLI creates a note via IPC socket
**When** the desktop app processes the request
**Then** a `note-created` event is emitted via tauri-specta with payload `{ timestamp: string, data: { noteId: number } }` (FR36)

**Given** the frontend is listening for `note-created` events
**When** the event fires
**Then** the note list refreshes to include the new note
**And** if the note's workspace matches the active workspace, it appears in the filtered view

**Given** multiple events occur
**When** they are processed
**Then** the UI updates are batched efficiently (no flicker or excessive re-renders)

### Story 6.7: CLI Error Handling & User Isolation

As a developer,
I want clear error messages when the CLI can't connect,
So that I know how to fix the issue.

**Acceptance Criteria:**

**Given** the desktop app is NOT running (socket doesn't exist)
**When** any CLI command is executed
**Then** the CLI exits with code 2 (FR38)
**And** stderr prints: "✕ Notey is not running. Start the application first." in red

**Given** the socket exists but the connection is refused
**When** any CLI command is executed
**Then** the CLI exits with code 2 with the same error message

**Given** a CLI command encounters a processing error
**When** the desktop app returns `{ "success": false, "error": "..." }`
**Then** the CLI exits with code 1
**And** stderr prints: "✕ [error message]" in red

**Given** multiple users on the same system
**When** each user runs `notey` CLI
**Then** each user's CLI connects to their own socket path (user-scoped) (FR37)
**And** no user can access another user's socket or data

**Given** the CLI connects to the socket
**When** the connection takes longer than 5 seconds
**Then** the CLI times out and exits with code 2 and a timeout error message

---

## Epic 7: Personalization & Accessibility

Users can customize their experience with theme switching, font configuration, shortcut remapping, layout modes, and full keyboard-only navigation.

**TEA Quality Gate:** P0 tests 100%, P1 tests ≥95%. No open high-severity bugs.

### Story 7.1: Settings View Panel

As a user,
I want a settings panel where I can customize Notey,
So that I have a central place to manage all my preferences.

**Acceptance Criteria:**

**Given** the user presses Ctrl/Cmd+, or selects "Open Settings" from the command palette
**When** the settings panel opens
**Then** it renders as a modal/overlay with sections: General, Editor, Hotkey

**Given** the General section renders
**When** the user views it
**Then** it shows: Theme toggle (dark/light), Layout mode selector (floating/half-screen/full-screen)

**Given** the Editor section renders
**When** the user views it
**Then** it shows: Font size slider/input (12-24px), Font family selector (monospace/sans-serif)

**Given** the Hotkey section renders
**When** the user views it
**Then** it shows: Current global shortcut with change option

**Given** the user changes a setting
**When** the change is applied
**Then** `commands.updateConfig()` is invoked to persist to TOML file
**And** changes that can apply immediately do so (theme, font)
**And** the settings panel can be dismissed with Esc

**Given** the settings panel
**When** the TOML file is mentioned
**Then** a note indicates advanced users can edit `config.toml` directly

### Story 7.2: Theme Switching (Dark/Light)

As a user,
I want to switch between dark and light themes,
So that I can use the app comfortably in different lighting conditions.

**Acceptance Criteria:**

**Given** the user toggles the theme (via settings, command palette "Toggle Theme", or Ctrl+Shift+T)
**When** the theme changes
**Then** the `data-theme` attribute on `html` switches between "dark" and "light"
**And** all CSS custom properties update instantly (no re-render, CSS variable swap only) (FR46)
**And** the preference is saved to `config.toml` via `update_config`

**Given** the app starts for the first time
**When** no theme preference is saved
**Then** the system preference is checked via `prefers-color-scheme` media query
**And** the matching theme is applied as default

**Given** the user has set a manual preference
**When** the app starts
**Then** the saved preference overrides system preference

**Given** both themes are applied
**When** contrast is verified
**Then** all text/background pairs meet WCAG 2.1 AA 4.5:1 ratio (NFR23)
**And** all UI components meet 3:1 ratio

### Story 7.3: Font Configuration

As a user,
I want to choose my font family and size,
So that Notey is comfortable for extended writing.

**Acceptance Criteria:**

**Given** the settings panel Editor section
**When** the user changes font size
**Then** the value is constrained to 12-24px range (FR45)
**And** the CodeMirror editor and UI text update immediately
**And** the type scale adjusts proportionally (all `--text-*` tokens scale relative to the new base)

**Given** the user selects a different font family
**When** the option is chosen
**Then** the primary font stack switches (monospace → sans-serif or back)
**And** the editor re-renders with the new font

**Given** font changes are made
**When** the config is saved
**Then** `[editor] font_size` and `font_family` are updated in `config.toml`

### Story 7.4: Global Hotkey Reconfiguration & Conflict Detection

As a user,
I want to change my capture shortcut,
So that I can avoid conflicts with other apps I use.

**Acceptance Criteria:**

**Given** the settings panel Hotkey section
**When** the user views current shortcut
**Then** the current key combination is displayed (e.g., "Ctrl+Shift+N")

**Given** the user clicks to change the shortcut
**When** capture mode activates
**Then** the UI shows "Press new shortcut..." and waits for a key combination (FR17)

**Given** the user presses a new key combination
**When** the shortcut is validated
**Then** if the shortcut conflicts with a registered system shortcut, a toast shows "Shortcut conflicts with [app]" (5s) (FR18)
**And** the old shortcut remains active

**Given** the new shortcut is valid
**When** it is applied
**Then** the old shortcut is unregistered
**And** the new shortcut is registered via `tauri-plugin-global-shortcut`
**And** the config is saved: `[hotkey] global_shortcut = "new+combo"`

**Given** the user wants to reset
**When** "Reset to default" is clicked
**Then** the shortcut reverts to Ctrl+Shift+N (Cmd+Shift+N on macOS)

### Story 7.5: Layout Mode Switching

As a user,
I want to switch between window layout modes,
So that I can use the best layout for my current task.

**Acceptance Criteria:**

**Given** the user selects "Toggle Layout Mode" from the command palette
**When** the mode cycles
**Then** it progresses: Floating → Half-screen → Full-screen → Floating (FR22)

**Given** Floating mode is active
**When** the window renders
**Then** it is 600x400px default (resizable), always-on-top, with drop shadow

**Given** Half-screen mode is active
**When** the window renders
**Then** it is 50% screen width, full height, snapped to screen edge, not always-on-top

**Given** Full-screen mode is active
**When** the window renders
**Then** it is maximized to full screen, standard window chrome, not always-on-top

**Given** the mode changes
**When** the config is saved
**Then** `[general] layout_mode` is updated in `config.toml`
**And** the mode persists across app restarts

### Story 7.6: Keyboard Shortcut Configuration

As a user,
I want to customize all keyboard shortcuts,
So that Notey fits into my existing keyboard habits.

**Acceptance Criteria:**

**Given** the settings panel (or a dedicated shortcuts section)
**When** the user views shortcuts
**Then** all application shortcuts are listed with their current bindings (FR44)
**And** default shortcuts match UX-DR27: Esc (back/hide), Ctrl+P (palette), Ctrl+F (search), Ctrl+N (new note), Ctrl+W (close tab), Ctrl+Tab (next tab), Ctrl+Shift+T (toggle theme), Ctrl+Shift+W (switch workspace), Ctrl+, (settings)

**Given** the user clicks to rebind a shortcut
**When** capture mode activates
**Then** the UI shows "Press new shortcut..." and captures the next key combination
**And** if it conflicts with another app shortcut, a warning is shown
**And** the user can confirm or cancel

**Given** shortcuts are customized
**When** saved
**Then** all bindings are stored in `config.toml` `[shortcuts]` section
**And** the app loads custom bindings on startup

### Story 7.7: Comprehensive Keyboard Navigation

As a user,
I want to use Notey entirely with my keyboard,
So that I can work efficiently without reaching for the mouse.

**Acceptance Criteria:**

**Given** any interactive element in the application
**When** the user navigates via Tab/Shift+Tab
**Then** every interactive element is reachable (FR48, NFR21)
**And** focus order follows visual layout: tab bar → editor → status bar

**Given** an interactive element has focus
**When** the focus indicator renders
**Then** it is a 2px outline in `var(--focus-ring)` color with 2px offset (NFR22)
**And** the contrast ratio of the focus indicator against adjacent colors is at least 3:1

**Given** the user has `prefers-reduced-motion` enabled
**When** focus transitions occur
**Then** they are instant (no animation)

**Given** an overlay is open (search, command palette, note list)
**When** the user presses Tab
**Then** focus is trapped within the overlay (never escapes to the editor behind it)

### Story 7.8: Accessibility Compliance Audit

As a user with assistive technology,
I want Notey to be fully accessible,
So that I can use it regardless of my abilities.

**Acceptance Criteria:**

**Given** the save indicator in the StatusBar
**When** a save completes
**Then** `aria-live="polite"` announces "Saved" without interrupting screen reader flow

**Given** all interactive elements
**When** they are inspected
**Then** every element has an `aria-label` or visible text label
**And** the StatusBar has `role="status"` for state queries

**Given** state indicators (save status, active tab, search match)
**When** they are displayed
**Then** they use text labels + color together (not color alone) for all states
**And** "Saved" is identifiable by the word, not just green color
**And** active tab is identifiable by underline + weight, not just color

**Given** interactive elements
**When** their size is measured
**Then** minimum touch/click target height is 24px

**Given** both themes
**When** color contrast is audited
**Then** all text meets WCAG 2.1 AA 4.5:1 ratio (NFR23)
**And** all UI components meet 3:1 ratio
**And** focus indicators meet 3:1 ratio

---

## Epic 8: Onboarding & Platform Integration

New users get a guided first-run experience. The app auto-starts on login and works reliably across Windows, macOS, and Linux with per-user data isolation.

**TEA Quality Gate:** P0 tests 100%, P1 tests ≥95%. No open high-severity bugs.
**Risk References:** RISK-001 (Cross-platform rendering, Score 6) — E2E + visual tests. RISK-005 (First-run onboarding, Score 6) — E2E test required.
**Test Scenarios:** P1-E2E-002 (Onboarding).

### Story 8.1: First-Run Detection & Onboarding Overlay

As a new user,
I want a quick introduction showing me how to use Notey,
So that I can start capturing notes immediately.

**Acceptance Criteria:**

**Given** the application starts for the first time (no `onboarding_complete` flag in config)
**When** the window is shown
**Then** an OnboardingOverlay renders centered over the editor (FR52)
**And** it displays: "Your capture shortcut is" followed by key cap visualization of the configured hotkey (e.g., [Ctrl] [Shift] [N]) (FR53)
**And** below, the text: "Press it now to try"

**Given** the onboarding overlay is visible
**When** the user presses the configured hotkey
**Then** the overlay dismisses (window toggles hide/show, overlay gone on re-show)
**And** `onboarding_complete = true` is set in config
**And** the overlay is never shown again

**Given** the onboarding overlay is visible
**When** the user presses Esc
**Then** the overlay dismisses and `onboarding_complete = true` is set

**Given** the overlay is rendered
**When** accessible markup is checked
**Then** it has `role="dialog"`, `aria-label="Welcome to Notey"`, `aria-modal="true"`

**Given** the user is within their first 5 sessions
**When** the StatusBar renders
**Then** a hint "Ctrl+P for commands" is shown in `var(--text-muted)` in the StatusBar (progressive disclosure)
**And** after 5 sessions, the hint disappears permanently

**TEA Test Scenarios:** P1-E2E-002 (first-run onboarding flow — overlay display, hotkey press dismissal, config persistence). This is one of the 3 permitted E2E journeys (RISK-005, RISK-007).
**TEA data-testid Requirements:** The onboarding overlay must include `data-testid="onboarding-overlay"` and the hotkey key cap visualization must include `data-testid="hotkey-display"`.

### Story 8.2: macOS Accessibility Permission Guidance

As a macOS user,
I want guidance on granting accessibility permissions,
So that the global hotkey works correctly.

**Acceptance Criteria:**

**Given** the app is running on macOS
**When** the onboarding overlay is shown
**Then** the system checks if accessibility permission is granted (FR54)

**Given** accessibility permission is NOT granted
**When** the check completes
**Then** the onboarding overlay shows additional guidance: "Notey needs Accessibility permission for the global shortcut"
**And** a button or link to open System Settings > Privacy & Security > Accessibility
**And** an option to skip with warning: "Shortcut may not work without this permission"

**Given** the user grants permission
**When** the app detects the change
**Then** the guidance is dismissed and onboarding continues normally

**Given** the app is NOT running on macOS
**When** onboarding runs
**Then** the accessibility permission step is skipped entirely

### Story 8.3: Hotkey Customization During Onboarding

As a new user,
I want to change the default hotkey during setup,
So that I can pick a shortcut that doesn't conflict with my workflow.

**Acceptance Criteria:**

**Given** the onboarding overlay is displayed
**When** the user sees the default hotkey
**Then** a "Customize" link/button is shown below the key caps (FR55)

**Given** the user clicks "Customize"
**When** capture mode activates
**Then** the UI shows "Press your preferred shortcut..."
**And** the user presses a new key combination
**And** the key caps update to show the new shortcut

**Given** the new shortcut is captured
**When** it is validated
**Then** if it conflicts, a warning is shown and the user can try again
**And** if valid, the shortcut is saved to config and registered immediately
**And** the onboarding continues with the new shortcut displayed

### Story 8.4: Auto-Start on Login

As a user,
I want Notey to start automatically when I log in,
So that it's always ready when I need it.

**Acceptance Criteria:**

**Given** `tauri-plugin-autostart` (v2.5.1) is configured
**When** the plugin initializes
**Then** it is registered with `MacosLauncher::LaunchAgent` on macOS (FR41)

**Given** the user enables auto-start (via settings or command palette)
**When** `autostart.enable()` is called
**Then** the platform-specific autostart mechanism is configured (FR42)
**And** the setting is saved to `config.toml`: `[general] auto_start = true`

**Given** the user disables auto-start
**When** `autostart.disable()` is called
**Then** the autostart mechanism is removed
**And** the config is updated: `auto_start = false`

**Given** auto-start is enabled
**When** the user reboots and logs in
**Then** Notey starts as a system tray daemon without user action (FR43)

**Given** the capability ACL
**When** permissions are checked
**Then** `autostart:allow-enable`, `autostart:allow-disable`, `autostart:allow-is-enabled` are included

### Story 8.5: Per-User Data Isolation

As a user on a shared system,
I want my notes to be private to my account,
So that other users can't see or modify my data.

**Acceptance Criteria:**

**Given** the application resolves data paths
**When** the database path is determined
**Then** it uses the current user's data directory (XDG_DATA_HOME, %APPDATA%, etc.) (FR51)
**And** no system-wide shared directories are used

**Given** the IPC socket path is resolved
**When** the socket is created
**Then** it uses user-scoped paths (e.g., `/run/user/<uid>/notey.sock`)
**And** file permissions are 0600 (owner only)

**Given** two users on the same system
**When** both run Notey
**Then** each has an independent database, config, and IPC socket
**And** neither can access the other's data or connect to the other's socket

### Story 8.6: Cross-Platform Verification & Wayland Fallback

As a user,
I want Notey to work on my platform,
So that I can use it regardless of my operating system.

**Acceptance Criteria:**

**Given** the platform abstraction module
**When** it is structured
**Then** a `Platform` trait defines methods for: data_dir(), config_dir(), log_dir(), socket_path(), register_hotkey(), autostart_enable/disable()
**And** `#[cfg(target_os)]` implementations exist in `platform/linux.rs`, `platform/macos.rs`, `platform/windows.rs`

**Given** a Linux system running Wayland
**When** the global hotkey is registered
**Then** if the standard Tauri global-shortcut plugin fails, a fallback mechanism is attempted (e.g., D-Bus portal API via ashpd crate) (FR57)
**And** if no fallback works, the user is notified that the global shortcut is not available on their compositor

**Given** all functional requirements
**When** tested on Windows 10/11, macOS 12+, and Linux X11
**Then** all FRs work correctly on each platform (FR56)
**And** platform-standard paths are used throughout (FR58)

**Given** the CI/CD pipeline
**When** builds run
**Then** artifacts are produced for all 5 targets: Windows x64, macOS x64, macOS ARM64, Linux x64, Linux ARM64
