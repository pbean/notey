---
title: 'Command Palette Core (cmdk + shadcn)'
type: 'feature'
created: '2026-04-10'
status: 'done'
baseline_commit: '56fb0b3'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users have no unified way to discover or access application features by typing. Every action requires knowing its UI location or keyboard shortcut.

**Approach:** Install the shadcn command component (wraps cmdk), create a command palette store and component following the existing overlay pattern, register Ctrl/Cmd+P to toggle it, and render grouped placeholder commands to verify the shell before Story 4.6 wires real actions.

## Boundaries & Constraints

**Always:**
- Use shadcn command component installed via `npx shadcn@latest add command` — do not hand-roll fuzzy matching
- Follow existing overlay pattern: z-index 50, conditional render inside CaptureWindow's relative container, backdrop dims editor
- Mutual exclusion with search overlay — opening palette closes search and vice versa (Layer 1 rule)
- `data-testid="command-palette"` on container, `data-testid="command-input"` on input
- Esc closes palette and returns focus to `.cm-content`
- Top-center positioning, max 520px wide, ">" prefix in input
- Commands grouped under "Actions", "Settings", "Navigation" headings
- Platform-aware modifier display: detect `navigator.platform` for macOS vs others
- Keyboard shortcut display right-aligned per command item

**Ask First:**
- Custom animations or transitions beyond simple show/hide
- Changes to search overlay close/open logic

**Never:**
- Wire actual application actions — placeholder no-ops only (Story 4.6 scope)
- Create new Tauri backend commands
- Stack overlays — palette and search must never be open simultaneously

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Open palette | Ctrl/Cmd+P, palette closed | Palette opens, input focused, search closes if open | N/A |
| Close palette (Esc) | Esc pressed while palette open | Palette closes, focus returns to `.cm-content` | N/A |
| Close palette (backdrop) | Click backdrop | Palette closes, focus returns to editor | N/A |
| Filter commands | Type "new" in input | Fuzzy-match filters visible commands in <50ms | N/A |
| Select command | Enter or click on item | Palette closes (action is no-op placeholder) | N/A |
| Toggle off | Ctrl/Cmd+P while palette open | Palette closes | N/A |
| Search overlay open | Ctrl/Cmd+P while search open | Search closes, palette opens | N/A |

</frozen-after-approval>

## Code Map

- `src/components/ui/command.tsx` -- New: shadcn-generated Command primitives (CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut)
- `src/features/command-palette/store.ts` -- New: Zustand store with `isOpen`, `open()`, `close()`, `toggle()` — mirrors `useSearchStore` pattern
- `src/features/command-palette/components/CommandPalette.tsx` -- New: Renders cmdk-based palette with grouped placeholder commands, shortcut display, and ">" prefix
- `src/features/editor/components/CaptureWindow.tsx` -- Modify: add conditional render of CommandPalette, register Ctrl/Cmd+P handler, wire mutual exclusion with search

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- Install shadcn command component: `npx shadcn@latest add command` (adds cmdk + dialog deps + generates `command.tsx`)
- [x] `src/features/command-palette/store.ts` -- Create `useCommandPaletteStore` with `isOpen`, `open()` (closes search), `close()`, `toggle()`, `resetCommandPalette()` actions
- [x] `src/features/command-palette/components/CommandPalette.tsx` -- Build palette UI: CommandDialog wrapper for backdrop + centering, CommandInput with ">" prefix, three CommandGroups (Actions/Settings/Navigation) with placeholder items showing name + platform-aware shortcut
- [x] `src/features/editor/components/CaptureWindow.tsx` -- Add Ctrl/Cmd+P handler (guards: not when palette is already open unless toggle), conditionally render `<CommandPalette />`, ensure search overlay mutual exclusion
- [x] `src/features/command-palette/store.test.ts` -- Test open/close/toggle, mutual exclusion with search store, resetCommandPalette
- [x] `src/features/command-palette/components/CommandPalette.test.tsx` -- Test: renders when open, Esc closes, data-testid attributes present, groups render, input has ">" prefix

**Acceptance Criteria:**
- Given the palette is closed, when Ctrl/Cmd+P is pressed, then the palette opens with the input focused
- Given the palette is open, when the user types, then commands are fuzzy-filtered with results updating on each keystroke
- Given the palette is open, when Esc is pressed, then the palette closes and focus returns to the editor
- Given search overlay is open, when Ctrl/Cmd+P is pressed, then search closes and palette opens
- Given the palette renders, then it is top-center, max 520px wide, with ">" prefix and grouped commands

## Design Notes

**Overlay mutual exclusion:** `open()` in `useCommandPaletteStore` calls `useSearchStore.getState().closeSearch()` to enforce the Layer 1 rule. The Ctrl/Cmd+F handler in CaptureWindow should also close the palette when opening search.

**Platform detection helper:**
```ts
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl';
```

**Placeholder commands (for UI verification, replaced in 4.6):**
- Actions: "New Note" (mod+N), "Search Notes" (mod+F)
- Settings: "Toggle Theme" (mod+Shift+T)
- Navigation: "Open Note List"

**shadcn command styling:** The generated `command.tsx` uses Tailwind classes with CSS variables. Override positioning via the CommandDialog wrapper — set `max-width: 520px`, center horizontally, attach at top with small offset.

## Verification

**Commands:**
- `npx vitest run src/features/command-palette/` -- expected: all store and component tests pass
- `npx tsc --noEmit` -- expected: no type errors
- `npx vitest run` -- expected: full suite passes (no regressions)

## Spec Change Log

- **Review patch 1:** Guarded `navigator.platform` access with lazy evaluation and `typeof navigator` check for SSR/test safety.
- **Review patch 2:** Added command palette guard to `useTabKeyboardNav` — tab shortcuts (Ctrl+Tab, Ctrl+W, Ctrl+1-9) now suppressed when palette is open.

## Suggested Review Order

**State management: command palette store**

- Zustand store with Layer 1 mutual exclusion — `open()` closes search overlay
  [`store.ts:25`](../../src/features/command-palette/store.ts#L25)

**UI: command palette component**

- Platform-safe lazy detection for modifier symbols (⌘ vs Ctrl)
  [`CommandPalette.tsx:14`](../../src/features/command-palette/components/CommandPalette.tsx#L14)

- Grouped placeholder commands with shortcut display, portal-based dialog
  [`CommandPalette.tsx:48`](../../src/features/command-palette/components/CommandPalette.tsx#L48)

**Integration: CaptureWindow wiring**

- Ctrl/Cmd+P shortcut registration with toggle behavior
  [`CaptureWindow.tsx:33`](../../src/features/editor/components/CaptureWindow.tsx#L33)

- Ctrl/Cmd+F handler updated to close palette (bidirectional exclusion)
  [`CaptureWindow.tsx:24`](../../src/features/editor/components/CaptureWindow.tsx#L24)

**Guard fix: tab keyboard nav**

- Added command palette guard alongside existing search overlay guard
  [`useTabKeyboardNav.ts:15`](../../src/features/tabs/hooks/useTabKeyboardNav.ts#L15)

**Tests**

- Store tests: open/close/toggle, mutual exclusion with search, reset
  [`store.test.ts:1`](../../src/features/command-palette/store.test.ts#L1)

- Component tests: render, Esc close, testid attrs, groups, ">" prefix
  [`CommandPalette.test.tsx:1`](../../src/features/command-palette/components/CommandPalette.test.tsx#L1)
