# CodeMirror 6 Multi-Instance Research

Research document for Epic 4 / Story 4.4: Editor-Tab Integration (Multi-Instance CodeMirror).

**Source:** [CodeMirror 6 System Guide](https://codemirror.net/docs/guide/), [EditorView API](https://codemirror.net/docs/ref/#view.EditorView), [EditorState API](https://codemirror.net/docs/ref/#state.EditorState), [Configuration Examples](https://codemirror.net/examples/config/), [Split View Example](https://codemirror.net/examples/split/)

---

## 1. Architectural Decision: Single View with State Swap vs Multiple Views

### Three possible strategies

| Strategy | Mechanism | Use Case |
|----------|-----------|----------|
| **A. Single view + `setState()`** | One `EditorView`, swap `EditorState` on tab switch | Tab editor where only one tab is visible at a time |
| **B. Multiple views (one per tab)** | N `EditorView` instances, show/hide DOM | Side-by-side editing, or when instant tab switching with zero redraw is critical |
| **C. Destroy/recreate view per switch** | Destroy `EditorView` on switch, create new one | Simplest, but worst UX (DOM churn, focus loss, scroll reset) |

### Recommendation for notey: Strategy A — Single View + State Swap

**Why:**

1. **Memory efficiency.** Each `EditorView` creates DOM subtrees, mutation observers, global event handlers, and view plugins. With strategy B, opening 20 tabs means 20 sets of all of these — most of which are invisible and idle. Strategy A keeps exactly one active view.

2. **CodeMirror is designed for this.** The `EditorView.setState(newState)` method exists specifically for the "swap to a completely different document" use case. The docs state: *"This should only be used when the new state isn't derived from the old state"* — which is exactly what a tab switch is.

3. **Matches notey's current architecture.** The codebase already has a single `EditorView` in `EditorPane.tsx` and a single `useEditorStore`. Strategy A requires the least refactoring — extend the existing pattern rather than rewrite it.

4. **State serialization is built in.** `EditorState.toJSON()` and `EditorState.fromJSON()` handle cursor position, selection, and document content. This directly satisfies Story 4.4's AC: *"tab B's cursor position is restored via `EditorSelection.cursor(pos)`"*.

**Trade-off:** `setState()` causes a **full document redraw** and reinitializes all view plugins. This means a brief flash on tab switch. For a note-taking app with typical document sizes (not a live-coding IDE with heavy syntax trees), this is expected to be imperceptible — CodeMirror 6's virtual rendering only renders the visible viewport, not the full document. Verify with a benchmark during Story 4.4 implementation if concerned.

### When strategy A breaks down

Strategy A is wrong if notey ever needs **simultaneous visible editors** (split pane, diff view). In that case, strategy B would be needed for the simultaneously visible panes. This does not affect Epic 4 — the tab bar shows one editor at a time.

---

## 2. EditorState Lifecycle for Tabs

### Creating state per tab

When a note opens in a new tab, create an `EditorState` and store it:

```typescript
import { EditorState } from '@codemirror/state';

const state = EditorState.create({
  doc: noteContent,
  extensions: buildExtensions(format), // shared extension builder
  selection: { anchor: 0 },           // cursor at start for new tabs
});
```

### Storing state on tab switch

Before switching away from a tab, capture the current state:

```typescript
// In tab switch handler, before setState:
const currentState = view.state;
tabStore.saveState(activeTabIndex, currentState);
```

`EditorState` is **immutable** — safe to store directly without cloning. Each transaction creates a new state object; the stored reference is a snapshot of the state at the moment of switch.

### Restoring state on tab switch

When switching to a tab that already has a stored state:

```typescript
const savedState = tabStore.getState(targetTabIndex);
view.setState(savedState);
```

This replaces the entire view state — document, selection, extensions, scroll position — in a single operation.

### First-time tab activation (no stored state)

When a tab is activated for the first time (just opened), create a fresh `EditorState`:

```typescript
const newState = EditorState.create({
  doc: noteContent,
  extensions: buildExtensions(format),
  selection: { anchor: cursorPos },
});
view.setState(newState);
```

---

## 3. State Serialization for Session Persistence

### `toJSON()` / `fromJSON()` for session restore (Story 4.9)

CodeMirror provides built-in serialization:

```typescript
// Serialize
const json = state.toJSON();
// json = { doc: "...", selection: { ranges: [...], main: 0 } }

// Deserialize
const restored = EditorState.fromJSON(json, {
  extensions: buildExtensions(format),
});
```

**Critical:** `fromJSON()` requires `extensions` to be provided — they are **not serialized**. The extensions config must be rebuilt from stored metadata (note format, user preferences). The optional third argument `fields` is required if any state fields define custom `toJSON`/`fromJSON` methods (e.g., `history()` — see Section 8.5). Omitting it silently drops serialized state field data.

### What is serialized

| Field | Serialized | Notes |
|-------|-----------|-------|
| Document text | Yes | Full content |
| Selection / cursor | Yes | All selection ranges + main index |
| Scroll position | **No** | Must be saved separately (see Section 6) |
| Extensions | **No** | Must be rebuilt |
| State fields with `toJSON` | Yes | If the field defines `toJSON`/`fromJSON` |

### Practical approach for notey

For tab switching within a session, store the `EditorState` object directly — no serialization needed (it's immutable and in-memory). Reserve `toJSON()`/`fromJSON()` for **session persistence** (Story 4.9) where state must survive app restart.

```typescript
// Session save (app exit / window hide)
const sessionData = tabs.map(tab => ({
  noteId: tab.noteId,
  stateJson: tab.editorState?.toJSON(),
  scrollTop: tab.scrollTop,
  format: tab.format,
}));
// Storage mechanism TBD — see note below
persistSession(sessionData);

// Session restore (app start)
const sessionData = loadSession();
const tabs = sessionData.map(tab => ({
  noteId: tab.noteId,
  editorState: tab.stateJson
    ? EditorState.fromJSON(tab.stateJson, { extensions: buildExtensions(tab.format) })
    : null, // will be created on first activation
  scrollTop: tab.scrollTop,
  format: tab.format,
}));
```

**Storage mechanism note:** `localStorage` in a Tauri app is scoped to the webview and may be cleared on webview recreation. The idiomatic Tauri approach is to use the filesystem via Tauri API or `tauri-plugin-store`. The storage backend is a Story 4.9 decision — the serialization format above is storage-agnostic.

---

## 4. Extension Management with Compartments

### Current state in notey

`EditorPane.tsx` uses a **module-scoped** `Compartment` singleton for dynamic language switching:

```typescript
// Module scope (EditorPane.tsx line 13) — shared across all renders
export const langCompartment = new Compartment();

// In EditorState.create:
langCompartment.of(format === 'markdown' ? markdown() : [])

// On format change:
view.dispatch({
  effects: langCompartment.reconfigure(format === 'markdown' ? markdown() : []),
});
```

**Multi-tab implication:** The singleton compartment works for a single editor, but for multi-tab each tab needs its own `Compartment` instance so that format changes in one tab don't affect another. This is a net-new pattern — the current module-scoped approach must be refactored to per-tab compartments created inside `buildExtensions()`.

### Extension builder for multi-tab

Each tab may have a different format (markdown vs plaintext). The extension array must be built per-tab:

```typescript
function buildExtensions(
  format: 'markdown' | 'plaintext',
  langCompartment: Compartment,
  onUpdate: (update: ViewUpdate) => void,
): Extension[] {
  return [
    EditorView.lineWrapping,
    langCompartment.of(format === 'markdown' ? markdown() : []),
    keymap.of(defaultKeymap),
    EditorView.updateListener.of(onUpdate),
    EditorView.theme({ /* ... */ }),
    // ... custom keybindings
  ];
}
```

### Compartment per-tab persistence

When `setState()` is called, **all extensions in the new state take effect** — including compartment state. If tab A has markdown enabled and tab B has plaintext, switching from A to B via `setState()` automatically applies the correct language. No manual `reconfigure()` is needed on switch.

**However:** If the user changes format while a tab is active (via StatusBar toggle), that change is captured in the state via `dispatch({ effects: langCompartment.reconfigure(...) })`. The next time we `saveState()`, the reconfigured state is stored. This means format changes persist per-tab automatically.

---

## 5. Auto-Save Integration with Tab Switching

### Current auto-save architecture

- `useAutoSave.ts` debounces content changes (300ms)
- `flushSave()` bypasses debounce for immediate save
- `sharedDebounceRef` is module-scoped (singleton timer)

### Required changes for multi-tab

The auto-save hook needs **tab awareness**:

1. **Flush on tab switch.** Before switching away from a tab, flush any pending save. This satisfies Story 4.4 AC: *"the pending save for the previous tab flushes immediately."*

```typescript
// Tab switch handler (pseudocode)
async function switchTab(targetIndex: number) {
  const flushResult = await flushSave();       // flush pending save for current tab
  if (flushResult === 'failed') {
    // Save failed — warn user before abandoning dirty state
    // Options: block switch, show warning, or switch anyway
    // Decision: Story 4.4 AC doesn't specify — recommend warning + switch
    console.warn('Save failed for current tab before switch');
  }
  const currentState = view.state;
  tabStore.saveState(activeTabIndex, currentState); // snapshot editor state
  tabStore.setActiveTab(targetIndex);
  const targetState = tabStore.getState(targetIndex);
  view.setState(targetState);                  // swap to target tab's state
}
```

**Save failure handling:** If `flushSave()` fails (IPC error, disk full), the tab switch should still proceed — the editor state is saved in-memory via `saveState()` and the content is not lost. The user should see a save-failed indicator (existing `saveStatus: 'failed'` mechanism). A retry can happen when the user switches back. Blocking tab switch on save failure would be a worse UX than a visible error state.

2. **Only save the active tab.** The auto-save hook already operates on the active view — since there's only one `EditorView` (strategy A), this is inherently correct. The `activeNoteId` in `useEditorStore` must be updated to the new tab's note ID on switch.

3. **Cancel debounce on switch.** When `flushSave()` is called, it already cancels the pending timer via `clearTimeout(sharedDebounceRef.current)`. No additional logic needed.

### Hydration flag interaction

The `isHydrating` flag currently prevents auto-save feedback loops when loading a note. Tab switching via `setState()` does **not** trigger the `updateListener` (it's a full state replacement, not a transaction). However, any custom logic that watches `state.doc` changes must account for the switch.

**Safe pattern:** Set `isHydrating = true` before `setState()`, then clear it after the state has settled. This reuses the existing guard mechanism.

---

## 6. Scroll Position Preservation

### The problem

`EditorView.setState()` resets scroll to the top. Scroll position is a **view-level** property, not serialized in `EditorState`.

### Solution: Manual scroll save/restore

```typescript
// Save before switch
const scrollTop = view.scrollDOM.scrollTop;
tabStore.saveScrollPos(activeTabIndex, scrollTop);

// Restore after switch
view.setState(targetState);
// Must defer scroll restore to after DOM update
requestAnimationFrame(() => {
  view.scrollDOM.scrollTop = tabStore.getScrollPos(targetIndex);
});
```

**Why `requestAnimationFrame`:** After `setState()`, CodeMirror schedules a DOM update. The scroll restore must happen after this update completes, otherwise the DOM dimensions aren't ready and the scroll position is clamped to 0.

### Alternative: `scrollIntoView` effect

CodeMirror provides a `scrollIntoView` state effect that can be dispatched after `setState()`:

```typescript
import { EditorView } from '@codemirror/view';

view.setState(targetState);
view.dispatch({
  effects: EditorView.scrollIntoView(targetState.selection.main.head),
});
```

This scrolls to make the cursor visible but doesn't restore the exact scroll offset. For a note-taking app, this may be sufficient — the user sees their cursor in context. The exact pixel offset approach is more precise but more complex.

**Recommendation:** Start with `scrollIntoView` (simpler, cursor-centric). Upgrade to pixel-precise restore in Story 4.9 if users report issues.

---

## 7. Duplicate Tab Prevention

### Story 4.4 AC

*"Given a note is already open in a tab, When the user opens the same note from search or note list, Then the existing tab is activated (no duplicate CodeMirror instances)."*

### Implementation

This is a `useTabStore` concern, not a CodeMirror concern. Before creating a new tab:

```typescript
function openTab(noteId: number) {
  const existingIndex = tabs.findIndex(t => t.noteId === noteId);
  if (existingIndex !== -1) {
    switchTab(existingIndex); // activate existing tab
    return;
  }
  // ... create new tab
}
```

Since strategy A uses a single `EditorView`, there is never more than one CodeMirror instance regardless. The check prevents duplicate **tabs**, not duplicate **views**.

---

## 8. Gotchas and Edge Cases

### 8.1 `setState()` reinitializes view plugins

`setState()` destroys all current view plugins and creates new ones from the new state's extensions. This means:

- Any view plugin that holds state (e.g., tooltip position, completion menu) is reset.
- The update listener is replaced — ensure the new state's listener references the correct tab's save handler.

**Mitigation:** Since all tabs share the same extension builder, the view plugins are functionally identical across tabs. The reset is invisible to the user.

### 8.2 Race condition: save flush + tab switch

If `flushSave()` is async (it calls `commands.updateNote()` via IPC), a fast tab switch could:

1. Start flush for tab A
2. Switch to tab B before flush completes
3. Flush callback writes tab A's content with tab B's `activeNoteId`

**Mitigation:** `flushSave()` must capture `noteId` at call time, not at callback time. The current implementation in `useAutoSave.ts` reads `activeNoteId` via `useEditorStore.getState()` synchronously and assigns it to a local variable (`noteId`) before any async work begins (line 34). This local variable protects the immediate flush path. However, the **debounced save path** (inside the `setTimeout` callback, ~line 110) re-reads `activeNoteId` via `getState()` at callback-fire time — if a tab switch changes `activeNoteId` between debounce-set and debounce-fire, the wrong note ID could be used. The `flushSave()` call before tab switch mitigates this by canceling the pending debounce, but this must be verified during Story 4.4 implementation.

### 8.3 `updateListener` behavior on `setState()` — VERIFY EMPIRICALLY

The CodeMirror docs do not specify whether `updateListener` fires after `setState()`. The `setState()` method triggers an internal view update cycle (it must redraw the DOM), but whether this cycle invokes `updateListener` callbacks and what `ViewUpdate.docChanged` returns is **unverified**.

**VERIFY THIS** during Story 4.4 implementation with a simple test:

```typescript
// Quick empirical check:
const listener = EditorView.updateListener.of((update) => {
  console.log('updateListener fired:', { docChanged: update.docChanged });
});
// Create view with listener, then call view.setState(differentState)
// Check console output
```

**If updateListener DOES fire:** Set `isHydrating = true` before `setState()` to block auto-save, then clear after:

```typescript
setIsHydrating(true);
view.setState(targetState);
// updateListener may fire here — isHydrating blocks auto-save
clearIsHydrating();
```

**If updateListener does NOT fire:** The `isHydrating` guard is unnecessary for tab switching (though it may still be needed for other hydration paths).

### 8.4 Memory: stored EditorState objects

Each `EditorState` holds the full document text (as a `Text` tree), selection, and state field values. For a note-taking app with typical documents (1-100KB), storing 20 states in memory is negligible (~2MB worst case). This is not a concern.

For extreme cases (hundreds of tabs), states could be serialized to `toJSON()` and evicted from memory after a timeout, then restored from JSON on reactivation. This is an optimization for later — not needed for Epic 4.

### 8.5 Undo history is per-state

Each `EditorState` that includes the `history()` extension has its own undo/redo stack. When switching tabs, undo history is preserved in the saved state and restored on switch. This is correct behavior — undoing in tab B should not affect tab A.

**Prerequisite:** notey does **not** currently use the `history()` extension. The current extension array in `EditorPane.tsx` includes `defaultKeymap` (which provides basic editing commands) but not `history()` from `@codemirror/commands`. This means undo/redo currently relies on browser-native behavior (which may or may not work correctly inside a Tauri webview). Adding `history()` to the extension builder is a prerequisite for Story 4.4 — without it, undo/redo will not persist across tab switches. When added, the `historyField` state field has built-in `toJSON`/`fromJSON` support, so session persistence (Story 4.9) will need to pass it in the `fields` argument to `EditorState.fromJSON()`.

**Note:** If two tabs open the same note (prevented by duplicate check), they would have independent undo histories that could diverge. The duplicate prevention in Section 7 eliminates this scenario.

### 8.6 Focus management after `setState()`

After `setState()`, the editor view retains DOM focus (it's the same DOM element). However, the cursor position changes to the restored state's selection. If the view was not focused (e.g., user clicked a tab button), focus must be explicitly set:

```typescript
view.setState(targetState);
view.focus();
```

The existing `useWindowFocus` hook calls `view.focus()` on window focus events. Tab switch focus handling is separate — it should call `view.focus()` after `setState()`.

### 8.8 TypeScript naming collision: `EditorState`

The Zustand store in `src/features/editor/store.ts` defines an `interface EditorState` (line 10) for the store shape. This collides with `import { EditorState } from '@codemirror/state'` if both are used in the same file. Any file that references both must alias one:

```typescript
import { EditorState as CMEditorState } from '@codemirror/state';
```

Or rename the Zustand interface (e.g., `EditorStoreState`). This is a minor refactor but will cause confusing TypeScript errors if overlooked.

### 8.9 Theme and font changes are global

The `EditorView.theme()` extension defines CSS for the editor. Since all tabs share the same theme, this is not an issue. If notey ever supports per-note themes, each tab's state would need its own theme compartment.

---

## 9. Integration with notey Codebase

### 9.1 Files to modify

| File | Change |
|------|--------|
| `src/features/editor/store.ts` | Extract `activeNoteId`, `content`, `format` per-tab. Add `EditorState` storage per tab. |
| `src/features/editor/components/EditorPane.tsx` | Replace hydration-via-dispatch with `setState()`. Accept tab switch events. |
| `src/features/editor/hooks/useAutoSave.ts` | Add `flushSave()` call before tab switch. Ensure `noteId` is captured at flush-start. |
| `src/features/editor/hooks/useNoteHydration.ts` | May be replaced by `setState()` — hydration becomes "set the new tab's state on the view." |
| New: `src/features/tabs/store.ts` | `useTabStore` — tab array, active index, `EditorState` per tab, scroll positions. |

### 9.2 Store architecture

**Current (single editor):**
```
useEditorStore: { activeNoteId, content, format, saveStatus, ... }
```

**Proposed (multi-tab):**
```
useTabStore: {
  tabs: Tab[],            // { noteId, title, editorState?, scrollTop, format }
  activeTabIndex: number,
  openTab(noteId),
  closeTab(index),
  switchTab(index),
  ...
}
useEditorStore: {          // now represents the ACTIVE tab only
  saveStatus,
  lastSavedAt,
  isHydrating,
  ...
}
```

The `useEditorStore` becomes a "view into the active tab" rather than the source of truth for note identity. The `useTabStore` owns which note is active.

**Dual source of truth risk:** The current `useEditorStore.content` field is read by `useAutoSave` and other consumers. With multi-tab, the canonical content is inside the CodeMirror `EditorState` stored per-tab in `useTabStore`. Options:
1. **Remove `content` from `useEditorStore`** — migrate all consumers to read from CodeMirror state or receive content via callback. Cleanest, but requires touching all consumers.
2. **Keep `content` as a derived mirror** — the `updateListener` continues writing to `useEditorStore.content` for the active tab only. Consumers don't change. Risk: if sync breaks, auto-save could write stale content. Guard with an assertion in `flushSave()` that `store.content === view.state.doc.toString()`.

**Recommendation:** Option 2 for Story 4.4 (minimize blast radius), with a TODO to migrate to option 1 when consumers are refactored.

### 9.3 Extension builder extraction

The extension array in `EditorPane.tsx` (lines 45-79) should be extracted into a shared `buildExtensions()` function. This function is called:

1. When creating a new tab's initial `EditorState`
2. When restoring a tab from JSON (session restore)

The `langCompartment` must be created **per-tab** (each tab needs independent language reconfiguration). The `updateListener` callback must reference the active tab's note ID.

**Entanglement note:** The current extension array includes an inline Escape key handler that calls `flushSave()` then `commands.dismissWindow()`. This is app-level behavior (hide the window), not a per-tab concern. During extraction, this handler should remain outside `buildExtensions()` and be added separately at the `EditorView` level, since it applies regardless of which tab is active.

### 9.4 Hydration simplification

The current hydration flow is:
```
loadNote() → set isHydrating → useNoteHydration watches → dispatch(changes) → clearHydrating
```

With `setState()`, this simplifies to:
```
openTab(noteId) → fetch note → create EditorState → setState() → done
```

The `useNoteHydration` hook may be removable if all note loading goes through the tab store. The `isHydrating` flag still protects against `updateListener` firing during `setState()`.

---

## 10. Recommended Implementation Sequence

Based on Story 4.4's dependencies and the refactoring needed:

1. **Story 4.1** — Create `useTabStore` with tab CRUD operations. No CodeMirror integration yet — just data structures.
2. **Story 4.2** — `TabBar` component consumes `useTabStore`. Visual only.
3. **Story 4.3** — Keyboard navigation on `TabBar`. Still no CodeMirror changes.
4. **Story 4.4** — Wire `EditorPane` to `useTabStore`:
   a. Extract `buildExtensions()` from `EditorPane.tsx`
   b. Add `EditorState` storage to `useTabStore`
   c. Implement `switchTab()` with `flushSave()` → `saveState()` → `setState()`
   d. Update `useAutoSave` to use tab-aware `noteId`
   e. Evaluate whether `useNoteHydration` can be removed

This sequence matches the epic's story ordering — Stories 4.1-4.3 are safe to implement without this research. Story 4.4 is where this research becomes critical.

---

## Sources

- [CodeMirror 6 System Guide](https://codemirror.net/docs/guide/) — EditorView/EditorState creation, transaction model, extension system
- [EditorView API Reference](https://codemirror.net/docs/ref/#view.EditorView) — `setState()`, `destroy()`, `dispatch()`, `scrollDOM`
- [EditorState API Reference](https://codemirror.net/docs/ref/#state.EditorState) — `create()`, `toJSON()`, `fromJSON()`, state fields
- [Configuration Examples](https://codemirror.net/examples/config/) — Compartments, dynamic reconfiguration, `StateEffect.reconfigure`
- [Split View Example](https://codemirror.net/examples/split/) — Multi-view synchronization via custom dispatch
