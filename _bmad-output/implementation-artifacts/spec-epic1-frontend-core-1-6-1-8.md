---
title: 'Epic 1 Frontend Core — Visual Foundation (Stories 1.6–1.8)'
type: 'feature'
created: '2026-04-03'
status: 'done'
baseline_commit: 'f5a56e7'
context:
  - '_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Notey frontend is still the create-tauri-app scaffold — no design tokens, no app shell, and no editor component. The backend CRUD commands are ready but nothing renders them.

**Approach:** Replace the scaffold with the real UI foundation: Notey CSS design tokens (dark/light), the `CaptureWindow`/`StatusBar` shell, and a CodeMirror 6 editor pane with Markdown syntax highlighting and auto-focus. Stories 1.9–1.10 (auto-save, format toggle) follow in the next spec.

## Boundaries & Constraints

**Always:**
- No barrel files; import from source paths directly
- Tauri IPC only via `commands.*` from `src/generated/bindings.ts`
- Feature structure: `src/features/editor/` with `components/`, `store.ts`
- One store: `useEditorStore` — create with `noteId`, `content`, `format` (Stories 1.9–1.10 extend it with `saveStatus`)
- Dark is the default theme — apply `dark` class to `<html>` in `main.tsx`; `:root` holds dark values (dark-first), `.light` overrides to light palette
- CodeMirror 6 only; use a `Compartment` for the language extension (enables Story 1.10 to swap without recreating the view)
- Editor auto-focuses on mount; transitions max 50ms

**Ask First:**
- If `@codemirror/lang-markdown` requires additional lezer peer packages to compile — ask before proceeding

**Never:**
- No auto-save wiring (Story 1.9), no format toggle UI (Story 1.10), no tabs/workspace selector
- No `any` types

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| App launches | Cold start | Editor renders, receives focus | — |
| User types | Keystrokes | `useEditorStore.content` updates each doc change | — |
| `.dark` class on `<html>` | Default | Dark palette tokens active | — |
| `.light` class on `<html>` | Override | Light palette tokens active | — |

</frozen-after-approval>

## Code Map

- `src/index.css` — add Notey design tokens after existing shadcn blocks
- `src/main.tsx` — entry point; add `dark` class to `<html>` before render
- `src/App.tsx` — replace scaffold; render `<CaptureWindow />`
- `src/App.css` — delete (unused)
- `src/features/editor/store.ts` — `useEditorStore`
- `src/features/editor/components/CaptureWindow.tsx` — root shell
- `src/features/editor/components/EditorPane.tsx` — CodeMirror 6 wrapper
- `src/features/editor/components/StatusBar.tsx` — 24px bottom bar
- `package.json` — add CodeMirror 6 deps

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- add `@codemirror/view`, `@codemirror/state`, `@codemirror/lang-markdown`, `@codemirror/commands`, `@codemirror/language`; run `npm install`
- [x] `src/index.css` -- append after existing shadcn blocks: (1) in `:root` add all Notey dark-theme tokens from UX-DR1: `--bg-primary: #1a1a1a`, `--bg-elevated: #242424`, `--bg-surface: #2d2d2d`, `--border-default: #3a3a3a`, `--border-subtle: #2f2f2f`, `--text-primary: #e4e4e4`, `--text-secondary: #a0a0a0`, `--text-muted: #666`, `--accent: #6b9eff`, `--accent-muted: #6b9eff20`, `--success: #4ade80`, `--warning: #fbbf24`, `--error: #f87171`, `--focus-ring: #6b9eff80`; also add `--font-mono` stack and spacing tokens `--space-1..--space-8` (4px grid); (2) add `.light { }` block with light-palette overrides from UX-DR2
- [x] `src/main.tsx` -- add `document.documentElement.classList.add('dark')` before `ReactDOM.createRoot`
- [x] `src/features/editor/store.ts` -- Zustand store: `{ noteId: number | null, content: string, format: 'markdown' | 'plaintext' }`; named actions: `setNoteId`, `setContent`, `setFormat`; defaults: `null`, `''`, `'markdown'`
- [x] `src/features/editor/components/EditorPane.tsx` -- wrap `EditorView`; `const langComp = new Compartment()` at module scope; extensions: `EditorView.lineWrapping`, `langComp.of(markdown())`, `keymap.of(defaultKeymap)`, update listener calling `setContent` when `docChanged`; `view.focus()` in mount effect; editor DOM styled with `font-family: var(--font-mono)`, `color: var(--text-primary)`, `background: var(--bg-primary)`, `height: 100%`
- [x] `src/features/editor/components/StatusBar.tsx` -- `<div role="status">` 24px, flex row, `background: var(--bg-surface)`, `border-top: 1px solid var(--border-default)`; left: "Default workspace" (`--text-secondary`); right: "Markdown" (`--text-muted`)
- [x] `src/features/editor/components/CaptureWindow.tsx` -- `h-screen w-screen flex flex-col bg-[var(--bg-primary)]`; `<EditorPane className="flex-1 min-h-0" />` above `<StatusBar />`
- [x] `src/App.tsx` -- delete scaffold; import and return `<CaptureWindow />`; remove `App.css` import
- [x] `src/App.css` -- delete file

**Acceptance Criteria:**
- Given `npm run build`, then TypeScript compiles with zero errors
- Given the app launches, then the CodeMirror editor is focused with cursor ready
- Given the user types, then `useEditorStore.content` updates on every doc change
- Given `<html class="dark">`, then `--bg-primary` resolves to `#1a1a1a`; given `class="light"`, then `--bg-primary` resolves to `#ffffff`
- Given the window renders, then StatusBar is visible at 24px height with "Default workspace" left and "Markdown" right
- Given the editor is visible, then it fills remaining vertical space with soft-wrap (no horizontal scroll)

## Design Notes

**Compartment for language:** `const langComp = new Compartment()` at module scope survives re-renders. Story 1.10 will call `view.dispatch({ effects: langComp.reconfigure([]) })` for plain text — preserves undo history and cursor position.

## Verification

**Commands:**
- `npm run build` -- expected: exits 0, no errors

**Manual checks:**
- `npm run tauri dev`: dark background editor, cursor auto-focused, StatusBar at bottom
- Inspect `<html>` computed CSS: `--bg-primary` = `#1a1a1a`

## Suggested Review Order

**Entry point & shell**

- Root shell: Tailwind layout, EditorPane + StatusBar composition
  [`CaptureWindow.tsx:8`](../../src/features/editor/components/CaptureWindow.tsx#L8)

- Scaffold replaced; single `<CaptureWindow />` render
  [`App.tsx:1`](../../src/App.tsx#L1)

- Dark class applied before React hydrates; dark-first init
  [`main.tsx:6`](../../src/main.tsx#L6)

**Design tokens**

- All 14 Notey color tokens; `--font-mono`; spacing scale; dark-first in `:root`
  [`index.css:157`](../../src/index.css#L157)

- Light palette override block (applied when `<html class="light">`)
  [`index.css:248`](../../src/index.css#L248)

**State**

- Store shape: `noteId`, `content`, `format`; named actions only; no raw setState
  [`store.ts:25`](../../src/features/editor/store.ts#L25)

**Editor**

- `langCompartment` at module scope — exported for Story 1.10 dynamic reconfigure
  [`EditorPane.tsx:9`](../../src/features/editor/components/EditorPane.tsx#L9)

- `EditorView` construction; extensions wired; `view.focus()` on mount
  [`EditorPane.tsx:20`](../../src/features/editor/components/EditorPane.tsx#L20)

- Update listener syncs doc changes to store on every keystroke
  [`EditorPane.tsx:36`](../../src/features/editor/components/EditorPane.tsx#L36)

**Status bar**

- 24px bar reads `format` from store; role="status" for screen readers
  [`StatusBar.tsx:1`](../../src/features/editor/components/StatusBar.tsx#L1)

**Peripherals**

- Five new `@codemirror/*` deps added
  [`package.json:14`](../../package.json#L14)
