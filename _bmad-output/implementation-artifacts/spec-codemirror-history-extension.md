---
title: 'Add CodeMirror history() extension for undo/redo'
type: 'chore'
created: '2026-04-10'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** notey's CodeMirror setup did not include the `history()` extension from `@codemirror/commands`. Undo/redo relied on browser-native behavior, which won't persist per-tab when Story 4.4 (multi-tab) introduces separate `EditorState` instances.

**Approach:** Add `history()` and `historyKeymap` to the EditorPane extensions array. The package (`@codemirror/commands`) was already installed.

## Suggested Review Order

- Import and extension registration — `history()` before `historyKeymap`, both before `defaultKeymap`
  [`EditorPane.tsx:5`](../../src/features/editor/components/EditorPane.tsx#L5)

- Extension placement in the extensions array
  [`EditorPane.tsx:64`](../../src/features/editor/components/EditorPane.tsx#L64)
