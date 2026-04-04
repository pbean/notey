---
title: 'Window & Daemon — Global Hotkey, Dismiss, Tray, Config'
type: 'feature'
created: '2026-04-04'
status: 'done'
baseline_commit: '3af94034'
context:
  - '_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Notey exits on window close, has no global hotkey, no tray presence, and settings are hardcoded — it cannot function as an always-available capture tool.

**Approach:** Configure the window as a pre-created hidden surface, add Ctrl+Shift+N global hotkey toggle via `tauri-plugin-global-shortcut`, Esc-dismiss with save flush, a system tray icon with context menu, and a TOML-backed config service for persistent settings.

## Boundaries & Constraints

**Always:**
- Window hide/show lifecycle — never create/destroy. Pre-created hidden window for <150ms summon.
- Flush any pending auto-save before hiding the window on Esc dismiss.
- All new commands get `#[tauri::command]` + `#[specta::specta]` and are registered in both `specta_builder()` and `build.rs`.
- Config structs use `#[serde(rename_all = "camelCase")]` for IPC and `serde` Serialize+Deserialize for TOML.
- Save flush must complete before window hides — no data loss.

**Ask First:**
- Platform-specific code beyond Linux (macOS accessibility permission flow, Windows named pipes).
- Changing the default hotkey binding from Ctrl+Shift+N.

**Never:**
- Destroy the main window on close or Esc.
- Network requests.
- Block the main thread with synchronous config file I/O in command handlers.
- Register hotkeys from the frontend JS side — all registration in Rust `setup()`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Hotkey toggle (hidden) | Ctrl+Shift+N, window hidden | Window shows, centers, focuses; editor gets focus | Window not found: log error |
| Hotkey toggle (visible) | Ctrl+Shift+N, window visible | Window hides | — |
| Esc dismiss (pending save) | Esc pressed, debounce active | Save flushes immediately, then window hides | Save fails: hide anyway, log error |
| Esc dismiss (no pending save) | Esc pressed, no debounce | Window hides immediately | — |
| Close-requested (X button) | Window close event | Prevent close, hide instead | — |
| Tray left-click | Icon clicked | Toggle window visibility | — |
| Tray "Quit" | Menu item clicked | `app.exit(0)` — full process exit | — |
| Config missing | First launch | Default `config.toml` created at platform config dir | Dir creation fails: return Config error |
| Config corrupt | Invalid TOML | Fallback to all defaults, log warning | — |
| Partial config update | `{editor: {fontSize: 16}}` | Only `font_size` updated, rest preserved | Write fails: return Config error |

</frozen-after-approval>

## Code Map

- `src-tauri/Cargo.toml` -- Add `tauri-plugin-global-shortcut` dependency
- `src-tauri/tauri.conf.json` -- Window config: hidden, always-on-top, skip-taskbar, centered, labeled "main"
- `src-tauri/capabilities/default.json` -- Add global-shortcut permissions
- `src-tauri/build.rs` -- Register new commands: `get_config`, `update_config`, `dismiss_window`
- `src-tauri/src/lib.rs` -- Plugin init, tray setup, close-requested handler, config state, hotkey handler
- `src-tauri/src/models/mod.rs` -- Add `pub mod config`
- `src-tauri/src/models/config.rs` -- `AppConfig`, `GeneralConfig`, `EditorConfig`, `HotkeyConfig` structs
- `src-tauri/src/services/mod.rs` -- Add `pub mod config`
- `src-tauri/src/services/config.rs` -- Load/save/update TOML, defaults fallback, platform config path
- `src-tauri/src/commands/mod.rs` -- Add `pub mod config; pub mod window`
- `src-tauri/src/commands/config.rs` -- `get_config`, `update_config` Tauri commands
- `src-tauri/src/commands/window.rs` -- `dismiss_window` command (hides calling window)
- `package.json` -- Add `@tauri-apps/plugin-global-shortcut`
- `src/features/editor/hooks/useAutoSave.ts` -- Extract and export `flushSave()` for imperative use
- `src/features/editor/components/EditorPane.tsx` -- Esc keymap: flush save → dismiss window
- `src/features/editor/hooks/useWindowFocus.ts` -- Listen for window focus event, call `view.focus()`

## Tasks & Acceptance

**Execution:**
- [x] `src-tauri/Cargo.toml` -- Add `tauri-plugin-global-shortcut = "2"` to dependencies
- [x] `package.json` -- Add `@tauri-apps/plugin-global-shortcut: ^2` to dependencies
- [x] `src-tauri/tauri.conf.json` -- Set window: `visible: false`, `alwaysOnTop: true`, `skipTaskbar: true`, `center: true`, `label: "main"`, `width: 720`, `height: 480`, `title: "Notey"`
- [x] `src-tauri/capabilities/default.json` -- Add `global-shortcut:allow-register`, `global-shortcut:allow-unregister`, `global-shortcut:allow-is-registered`
- [x] `src-tauri/src/models/config.rs` -- Create `AppConfig` with `GeneralConfig` (theme, layout_mode), `EditorConfig` (font_size), `HotkeyConfig` (global_shortcut) — all with `Default`, `Serialize`, `Deserialize`, `Type`, `Clone`
- [x] `src-tauri/src/services/config.rs` -- Implement `load_or_create(config_dir)` → reads TOML or writes defaults; `save(config_dir, config)` → writes TOML; `merge_update(existing, partial)` → applies partial updates
- [x] `src-tauri/src/commands/config.rs` -- `get_config` reads from managed `Mutex<AppConfig>` state; `update_config` merges partial, saves to disk, updates state
- [x] `src-tauri/src/commands/window.rs` -- `dismiss_window(window: tauri::WebviewWindow)` calls `window.hide()`
- [x] `src-tauri/build.rs` -- Add `"get_config"`, `"update_config"`, `"dismiss_window"` to command manifest
- [x] `src-tauri/src/lib.rs` -- (1) Load config in `setup()`, manage as `Mutex<AppConfig>`. (2) Init `tauri_plugin_global_shortcut::Builder` with handler that toggles main window show/hide+center+focus. (3) Register shortcut from config. (4) Build tray with `TrayIconBuilder`: left-click toggles window, right-click menu with "Open Notey" / "Quit". (5) Intercept `CloseRequested` on main window → `prevent_close()` + hide.
- [x] `src/features/editor/hooks/useAutoSave.ts` -- Extract debounce-flush logic into exported `flushSave()` that immediately saves if content is dirty, returning a Promise
- [x] `src/features/editor/components/EditorPane.tsx` -- Add CodeMirror keymap: Esc → call `flushSave()`, then `commands.dismissWindow()`
- [x] `src/features/editor/hooks/useWindowFocus.ts` -- On window focus event (via `getCurrentWebviewWindow().listen('tauri://focus')`), call `viewRef.current?.focus()` — addresses deferred work item for `view.focus()` on hidden window

**Acceptance Criteria:**
- Given the app is running and the window is hidden, when the user presses Ctrl+Shift+N, then the window appears centered with editor focused within 150ms
- Given the window is visible, when the user presses Ctrl+Shift+N again, then the window hides
- Given the editor has unsaved content with a pending debounce, when the user presses Esc, then the save completes before the window hides
- Given the window is visible, when the user clicks the X button, then the window hides (not destroyed) and the tray icon remains
- Given the tray icon is visible, when the user left-clicks it, then the window visibility toggles
- Given the tray context menu is open, when the user clicks "Quit", then the process exits
- Given no config.toml exists, when the app starts, then a default config is created at the platform config directory
- Given a valid config exists, when `get_config` is called, then the full config is returned as camelCase JSON

## Design Notes

**Hotkey parsing:** Config stores shortcuts as strings like `"Ctrl+Shift+N"`. Parse into `Modifiers` + `Code` at startup. Mapping: `Ctrl` → `CONTROL`, `Shift` → `SHIFT`, `Alt` → `ALT`, `Cmd`/`Super` → `SUPER`. Last token maps to `Code::Key{X}`. Invalid strings fall back to the default `Ctrl+Shift+N`.

**flushSave extraction:** The current `useAutoSave` hook manages debounce internally via refs. Extract the save logic into a standalone `flushSave()` function that: (1) clears the debounce timer, (2) if content differs from last save, performs the save immediately, (3) returns a Promise that resolves when the save completes or rejects on failure. The hook calls `flushSave` internally; `EditorPane` imports it for Esc handling.

**Window focus flow:** Backend shows window → OS delivers focus → frontend `tauri://focus` listener fires → CodeMirror `view.focus()`. This is more robust than a custom event because it works for all show paths (hotkey, tray click, "Open Notey" menu).

## Verification

**Commands:**
- `cd src-tauri && cargo check` -- expected: compiles with no errors
- `cd src-tauri && cargo test` -- expected: existing + new config service tests pass
- `cd src-tauri && cargo clippy` -- expected: no warnings
- `npm run build` -- expected: TypeScript compiles with specta-generated bindings including new commands
- `npm run test` -- expected: existing + new frontend tests pass

## Suggested Review Order

**App orchestration (start here)**

- Global shortcut handler, tray setup, close-requested interception — the core daemon wiring
  [`lib.rs:30`](../../src-tauri/src/lib.rs#L30)

- Shortcut string parser converts config values to Modifiers + Code enums
  [`lib.rs:48`](../../src-tauri/src/lib.rs#L48)

**Config service (TOML persistence)**

- AppConfig structs with camelCase serde — the data shape for both TOML and IPC
  [`config.rs:5`](../../src-tauri/src/models/config.rs#L5)

- Load/save/merge TOML with defaults fallback on corrupt or missing files
  [`config.rs:30`](../../src-tauri/src/services/config.rs#L30)

- get_config / update_config thin command handlers
  [`config.rs:12`](../../src-tauri/src/commands/config.rs#L12)

**Window dismiss flow (Esc → save → hide)**

- flushSave extracted as module-level function with shared createNote guard
  [`useAutoSave.ts:12`](../../src/features/editor/hooks/useAutoSave.ts#L12)

- Esc keymap wired in CodeMirror: flush → dismiss with error handling
  [`EditorPane.tsx:43`](../../src/features/editor/components/EditorPane.tsx#L43)

- dismiss_window command hides the calling WebviewWindow
  [`window.rs:4`](../../src-tauri/src/commands/window.rs#L4)

**Window focus management**

- useWindowFocus listens for tauri://focus with cleanup-safe listener registration
  [`useWindowFocus.ts:11`](../../src/features/editor/hooks/useWindowFocus.ts#L11)

**Configuration & capabilities**

- Window starts hidden, always-on-top, skip-taskbar, centered
  [`tauri.conf.json:13`](../../src-tauri/tauri.conf.json#L13)

- Capability ACL: global-shortcut + new command permissions
  [`default.json:6`](../../src-tauri/capabilities/default.json#L6)

**Tests & generated**

- Config service tests: load, save, corrupt fallback, partial merge
  [`config.rs:120`](../../src-tauri/src/services/config.rs#L120)

- Binding export test ensures specta regeneration on cargo test
  [`lib.rs:209`](../../src-tauri/src/lib.rs#L209)

- Auto-generated TypeScript bindings with new commands and config types
  [`bindings.ts:1`](../../src/generated/bindings.ts#L1)
