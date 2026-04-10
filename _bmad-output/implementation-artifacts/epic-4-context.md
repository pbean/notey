# Epic 4 Context: Multi-Tab Editing & Command Palette

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable users to open multiple notes simultaneously in tabs and access all application features through a VS Code-style command palette with fuzzy matching. This transforms Notey from single-note capture into a multi-document workspace while keeping every feature discoverable through a single keyboard-driven interface (Ctrl/Cmd+P).

## Stories

- Story 4.1: Tab State Management Store
- Story 4.2: TabBar Component
- Story 4.3: Tab Keyboard Navigation
- Story 4.4: Editor-Tab Integration (Multi-Instance CodeMirror)
- Story 4.5: Command Palette Core (cmdk + shadcn)
- Story 4.6: Command Palette Action Registry
- Story 4.7: Tab Reordering
- Story 4.8: Note List Panel (Slide-from-Left Browse)
- Story 4.9: Session State Persistence (Tabs, Cursor, Workspace)

## Requirements & Constraints

- FR23-26: Open multiple notes in tabs, switch between them, close individual tabs, reorder tabs
- FR27-28: Command palette accessible via Ctrl/Cmd+P with fuzzy matching of command names
- No duplicate tabs allowed — opening an already-open note activates its existing tab
- Tab close on active tab selects adjacent tab (prefer right, fallback left); closing the last tab shows empty state
- Command palette filtering must complete in <50ms (client-side only)
- Tab bar maximum height: 32px; active tab indicated by 2px bottom accent border, no background change
- Note list panel: 200px fixed width, slides from left as an overlay, dismissed after selection or Esc
- Session restore must silently skip tabs referencing deleted notes
- Accessibility: tab bar uses `role="tablist"`/`role="tab"` with `aria-selected`; command palette uses `role="combobox"`/`role="listbox"` (provided by cmdk); note list panel uses `role="navigation"` with `role="listbox"`
- data-testid attributes: `tab-bar`, `tab-{id}`, `command-palette`, `command-input`

## Technical Decisions

- Tab state lives in a dedicated `useTabStore` Zustand v5 store (not in `useEditorStore`), following the per-feature store pattern
- Tab shape: `{ noteId: number, title: string, cursorPos: number }`
- Command palette built on shadcn command component (wraps cmdk library) — install via `npx shadcn@latest add command`
- Commands grouped under headings: "Actions", "Settings", "Navigation" with platform-aware modifier display
- Keyboard shortcuts share handlers with command palette entries (single source of truth)
- View switching is Zustand-driven (no URL router) — command palette, shortcuts, and UI interactions all trigger the same state transitions
- Pending auto-save must flush immediately on tab switch before loading new tab content
- Only the active tab's content is saved by auto-save; inactive tabs are inert
- File locations: `features/editor/components/TabBar.tsx`, `features/editor/store.ts` (or new tab store), `features/command-palette/`
- Overlays don't stack — note list, search, and command palette are all Layer 1; Esc always returns to Layer 0 (editor)

## UX & Interaction Patterns

- Tab bar uses bottom-border indicator style (thin accent underline) matching VS Code convention — visually lighter than background-highlight approach
- Tab titles derived from first line of content, truncated with ellipsis at ~20 chars; untitled notes show "New note"
- Hover reveals close button; middle-click also closes
- Overflow tabs show in a "..." dropdown
- Note list panel overlays editor (dims background), shows workspace name + count in header, notes ordered by updated_at DESC with title, relative date, and format indicator
- Command palette: top-center, max 520px wide, ">" prefix in input, modal backdrop
- Keyboard shortcuts: Ctrl+Tab/Ctrl+Shift+Tab cycle tabs, Ctrl+1-9 jump to Nth tab, Ctrl+W closes active tab, arrow keys navigate within tab bar
- Focus trap in note list panel; Tab cycles within, Esc exits

## Cross-Story Dependencies

- Story 4.4 depends on 4.1 (tab store must exist before editor integration)
- Story 4.6 depends on 4.5 (registry needs palette core)
- Story 4.9 depends on 4.1 and 4.4 (persists tab/cursor state established by earlier stories)
- Epic 4 depends on Epic 1's editor infrastructure (CodeMirror setup, auto-save hooks, status bar)
- Epic 4 depends on Epic 2's workspace store (command palette wires "Switch Workspace" action)
- Epic 4 depends on Epic 3's search overlay (command palette wires "Search Notes" action)
