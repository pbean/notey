import { commands, type PartialAppConfig, type Theme } from '../../generated/bindings';
import { useEditorStore } from '../editor/store';
import { useSearchStore } from '../search/store';
import { useTabStore } from '../tabs/store';
import { useToastStore } from '../toast/store';
import { useWorkspaceStore } from '../workspace/store';
import { flushSave } from '../editor/hooks/useAutoSave';
import { normalizeLayoutMode, nextLayoutMode } from '../settings/layoutMode';
import { useSettingsStore } from '../settings/store';
import { singleflight } from '../../lib/singleflight';
import { withTimeout } from '../../lib/withTimeout';

/**
 * Create a new note, open it in a tab, and load it into the editor.
 * Flushes any pending auto-save first to avoid data loss.
 * Guarded against concurrent calls (e.g. key repeat).
 */
export async function createNewNote(): Promise<void> {
  await singleflight('create-note', async () => {
    try {
      await flushSave();
    } catch (err) {
      console.error('flushSave failed before new note:', err);
    }

    const format = useEditorStore.getState().format;
    const workspaceId = useWorkspaceStore.getState().activeWorkspaceId;

    try {
      const result = await withTimeout(commands.createNote(format, workspaceId), {
        label: 'create_note',
      });
      if (result.status === 'error') {
        console.error('createNote failed:', result.error);
        return;
      }

      const note = result.data;
      useTabStore.getState().openTab(note.id, 'New note');

      await useEditorStore.getState().loadNote(note.id);
      // loadNote sets saveStatus to 'failed' on error — close the orphaned tab
      if (useEditorStore.getState().saveStatus === 'failed') {
        const { tabs } = useTabStore.getState();
        const tabIndex = tabs.findIndex((t) => t.noteId === note.id);
        if (tabIndex !== -1) {
          useTabStore.getState().closeTab(tabIndex);
        }
      }
    } catch (error) {
      console.error('createNote threw:', error);
      return;
    }
  });
}

/**
 * Soft-delete the note in the active tab. No-op when no tab is active. Flushes
 * pending auto-save first so the trashed note keeps the latest editor content.
 * Guarded against concurrent calls to avoid duplicate trash requests and
 * contradictory toasts.
 */
export async function trashActiveNote(): Promise<void> {
  await singleflight('trash-active-note', async () => {
    const activeTab = useTabStore.getState().getActiveTab();
    if (!activeTab) return;

    try {
      await flushSave();
    } catch (err) {
      console.error('flushSave failed before trash:', err);
      useToastStore.getState().addToast("Couldn't move note to trash");
      return;
    }

    if (useEditorStore.getState().saveStatus === 'failed') {
      useToastStore.getState().addToast("Couldn't move note to trash");
      return;
    }

    const note = await useWorkspaceStore.getState().trashNote(activeTab.noteId);
    if (note) {
      useToastStore.getState().addToast('Note moved to trash');
    } else {
      useToastStore.getState().addToast("Couldn't move note to trash");
    }
  });
}

/**
 * Display dimensions the user has explicitly toggled this session. Consulted by
 * {@link applyStartupConfig} so a toggle fired during the brief boot window —
 * before the startup `getConfig` resolves — is never clobbered by the now-stale
 * startup snapshot. Sticky for the session: an explicit toggle wins over the
 * boot-time config for the rest of the run. Each dimension is tracked
 * independently so a theme toggle never suppresses layout startup application
 * (or vice versa).
 */
const userToggled = { theme: false, layoutMode: false, fontSize: false, fontFamily: false };
let settingsSaveChain = Promise.resolve();
let layoutModeChangeChain = Promise.resolve();

/**
 * True while the active theme is the OS-tracking `system` value. Consulted by
 * {@link handleSystemThemeChange} so a live `prefers-color-scheme` change
 * re-applies the resolved class only while `system` is active — an explicit
 * dark/light choice (toggle) opts the session out until the user re-selects
 * system. Set by {@link applyThemeClass} on every apply.
 */
let systemThemeActive = false;

/**
 * Cached `prefers-color-scheme: dark` media query. A `MediaQueryList` is a live
 * object whose `.matches` updates on its own, so one cached instance with a
 * single `change` listener suffices. `null` when `window.matchMedia` is absent
 * (jsdom, or a degraded webview) — callers must fall back to light.
 */
let systemThemeQuery: MediaQueryList | null = null;

/** Guards {@link applyStartupConfig} against binding the `change` listener twice. */
let systemThemeListenerBound = false;

/** Detaches the current OS-theme listener so tests can reset module state cleanly. */
let systemThemeListenerCleanup: (() => void) | null = null;

/**
 * Lazily resolve the cached `prefers-color-scheme: dark` media query, or `null`
 * when `window.matchMedia` is unavailable. Feature-detected so the theme code
 * never throws in jsdom or a degraded webview.
 */
function getSystemThemeQuery(): MediaQueryList | null {
  if (systemThemeQuery) return systemThemeQuery;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  try {
    systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  } catch {
    return null;
  }
  return systemThemeQuery;
}

/** Whether the OS currently prefers a dark color scheme; `false` when unknown. */
function systemPrefersDark(): boolean {
  return getSystemThemeQuery()?.matches ?? false;
}

/**
 * Reset the per-session toggle tracking and system-theme state. Test-only — the
 * production markers are sticky by design; tests call this (via the global
 * `afterEach`) to prevent state bleeding between cases. Clearing the cached
 * query and listener flag lets each test install a fresh `matchMedia` mock.
 */
export function resetToggleTracking(): void {
  systemThemeListenerCleanup?.();
  userToggled.theme = false;
  userToggled.layoutMode = false;
  userToggled.fontSize = false;
  userToggled.fontFamily = false;
  settingsSaveChain = Promise.resolve();
  layoutModeChangeChain = Promise.resolve();
  systemThemeActive = false;
  systemThemeQuery = null;
  systemThemeListenerBound = false;
  systemThemeListenerCleanup = null;
}

/**
 * Apply the theme classes to `<html>`. Single source of truth for the theme
 * class rule, shared by startup application and the toggle.
 *
 * `.dark` and `.light` are toggled as a mutually-exclusive pair: shadcn tokens
 * are light-first in `:root` (overridden by `.dark`), while Notey's custom
 * tokens are dark-first in `:root` (overridden by `.light`). Applying only one
 * class leaves the other token system on its `:root` default, producing a mixed
 * palette — so dark needs `.dark` + no `.light`, and any non-dark value needs
 * `.light` + no `.dark`.
 *
 * Resolution: `dark` → dark; `system` → dark iff the OS prefers a dark scheme
 * (`prefers-color-scheme`); any other value (`light`, unknown, or `system` when
 * `matchMedia` is unavailable) → light.
 *
 * Sets BOTH the `.dark`/`.light` classes — the token-cascade driver — and the
 * `data-theme` attribute (the PRD/AC switch contract; Story 7.2). `data-theme`
 * always reflects the *resolved* theme (`dark`/`light`), never the `system`
 * mode name, so it describes what is actually shown.
 */
function applyThemeClass(theme: string): void {
  systemThemeActive = theme === 'system';
  const isDark = theme === 'dark' || (theme === 'system' && systemPrefersDark());
  const root = document.documentElement;
  root.classList.toggle('dark', isDark);
  root.classList.toggle('light', !isDark);
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

/**
 * Apply the OS-resolved theme synchronously as the pre-config boot default.
 * Called from `main.tsx` before {@link applyStartupConfig} reconciles to the
 * persisted preference. Delegates to {@link applyThemeClass} so the class +
 * `data-theme` rule stays single-source; resolving `'system'` honors
 * `prefers-color-scheme` (falling back to light when `matchMedia` is absent),
 * so a fresh/light-OS user no longer flashes the opposite theme. A saved
 * manual preference still overrides this once `applyStartupConfig` resolves.
 */
export function applyBootTheme(): void {
  applyThemeClass('system');
}

/**
 * Re-apply the theme when the OS `prefers-color-scheme` changes, but only while
 * the active theme is `system`. An explicit dark/light toggle clears
 * {@link systemThemeActive}, so this no-ops once the user has opted out.
 */
function handleSystemThemeChange(_event?: MediaQueryListEvent): void {
  if (systemThemeActive) applyThemeClass('system');
}

/**
 * Subscribe once to OS `prefers-color-scheme` changes so a persisted
 * `theme: 'system'` tracks the OS appearance live. No-ops when `matchMedia` is
 * unavailable, the environment exposes neither subscription API, or the
 * listener is already bound.
 */
function bindSystemThemeListener(): void {
  if (systemThemeListenerBound) return;
  const query = getSystemThemeQuery();
  if (!query) return;
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', handleSystemThemeChange);
    systemThemeListenerCleanup = () => {
      query.removeEventListener?.('change', handleSystemThemeChange);
    };
    systemThemeListenerBound = true;
    return;
  }

  if (typeof query.addListener === 'function') {
    query.addListener(handleSystemThemeChange);
    systemThemeListenerCleanup = () => {
      query.removeListener?.(handleSystemThemeChange);
    };
    systemThemeListenerBound = true;
  }
}

/**
 * Apply a window layout mode (`floating`/`half-screen`/`full-screen`) to the main
 * window via the backend `apply_layout_mode` command. Single source of truth for
 * the window-mode apply rule, shared by startup application, the toggle, and the
 * settings setter. The raw value is normalized first, so a legacy density value
 * (`compact`/`comfortable`) resolves to `floating`. Best-effort: a transport or
 * command error is logged and reported back to the caller as `false` so the
 * caller can decide how to handle a persisted-but-not-applied outcome.
 */
async function applyLayoutModeToWindow(layoutMode: string): Promise<boolean> {
  const mode = normalizeLayoutMode(layoutMode);
  try {
    const result = await withTimeout(commands.applyLayoutMode(mode), {
      label: 'apply_layout_mode',
    });
    if (result.status === 'error') {
      console.error('applyLayoutMode failed:', result.error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('applyLayoutMode threw:', error);
    return false;
  }
}

/** Inclusive bounds for the configurable editor font size, in pixels. */
export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 24;

/** Clamp a font size into the supported {@link FONT_SIZE_MIN}–{@link FONT_SIZE_MAX} range. */
export function clampFontSize(size: number): number {
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(size)));
}

/**
 * Apply the editor base font size to `<html>` via the `--editor-font-size`
 * custom property. Single source of truth for the size apply rule, shared by
 * startup application and the settings setter. This base is the only knob: the
 * `--text-*` type scale in `index.css` is defined as `calc()` proportions of
 * `--editor-font-size`, so setting it here scales the whole type scale
 * proportionally (editor body plus app chrome), not just one element (Story 7.3).
 */
function applyFontSize(size: number): void {
  document.documentElement.style.setProperty('--editor-font-size', `${clampFontSize(size)}px`);
}

/**
 * Apply the primary font family by pointing `--font-primary` at the chosen
 * stack: `'sans'` → `var(--font-sans)`, anything else → `var(--font-mono)`.
 * Single source of truth for the family apply rule.
 */
function applyFontFamily(family: string): void {
  const stack = family === 'sans' ? 'var(--font-sans)' : 'var(--font-mono)';
  document.documentElement.style.setProperty('--font-primary', stack);
}

/**
 * Serialize explicit settings saves so rapid UI changes persist in issue order.
 * Each save logs transport/result failures and still resolves, allowing later
 * settings updates to continue through the queue.
 */
async function persistSettingsUpdate(partial: PartialAppConfig, context: string): Promise<boolean> {
  const save = async () => {
    try {
      const result = await withTimeout(commands.updateConfig(partial), {
        label: 'update_config',
      });
      if (result.status === 'error') {
        console.error(`updateConfig failed in ${context}:`, result.error);
        return false;
      }
      return true;
    } catch (error) {
      console.error(`Unexpected error updating settings in ${context}:`, error);
      return false;
    }
  };

  const pending = settingsSaveChain.then(save, save);
  settingsSaveChain = pending.then(() => undefined);
  return pending;
}

/**
 * Read the persisted config once at startup and apply the saved theme and
 * layout mode to the DOM. Called from `main.tsx` after the synchronous dark
 * default, so the persisted preferences are honored across restarts. Also
 * subscribes once to OS `prefers-color-scheme` changes so a persisted
 * `theme: 'system'` tracks the OS appearance live.
 * On config-read failure, the synchronous defaults are left in place.
 */
export async function applyStartupConfig(): Promise<void> {
  const configResult = await commands.getConfig();
  if (configResult.status === 'error') {
    console.error('getConfig failed at startup:', configResult.error);
    return;
  }

  // Hydrate the live in-app shortcut bindings so the always-on keyboard handlers
  // honor persisted custom bindings from the first keypress (defaults fill any
  // missing key, including a legacy config with no [shortcuts] section).
  useSettingsStore.getState().hydrateShortcuts(configResult.data);

  const general = configResult.data.general;
  const theme = general?.theme ?? 'dark';
  // Skip any dimension the user has already toggled this session: their explicit
  // choice (applied and persisted by the toggle) must not be reverted to this
  // possibly-stale boot-time snapshot. Each dimension is guarded independently.
  if (!userToggled.theme) applyThemeClass(theme);

  // Skip any font dimension the user already changed during the boot window:
  // their explicit live edit wins over this possibly-stale startup snapshot.
  const editor = configResult.data.editor;
  if (!userToggled.fontSize) applyFontSize(editor?.fontSize ?? 14);
  if (!userToggled.fontFamily) applyFontFamily(editor?.fontFamily ?? 'mono');

  // Restore the persisted window layout mode (normalized; legacy density values
  // resolve to `floating`). The window is hidden until first summon, so applying
  // it here incurs no visible flicker. Awaited so startup is deterministic.
  if (!userToggled.layoutMode) await applyLayoutModeToWindow(general?.layoutMode ?? 'floating');

  // Track live OS appearance changes for the `system` theme. Bound once; the
  // handler no-ops unless `system` is the active theme.
  bindSystemThemeListener();
  if (!userToggled.theme && theme === 'system') handleSystemThemeChange();
}

/**
 * Toggle theme between dark and light. Reads current config,
 * persists the change via updateConfig, and toggles the DOM class. A persisted
 * `system` preference toggles away from the currently resolved OS theme to the
 * opposite explicit choice (`dark` or `light`) — it does not cycle through
 * `system`.
 * Guarded against concurrent calls (e.g. key repeat) to avoid a
 * lost-update race on the read-modify-write.
 */
export async function toggleTheme(): Promise<void> {
  await singleflight('toggle-theme', async () => {
    try {
      const configResult = await withTimeout(commands.getConfig(), {
        label: 'get_config',
      });
      if (configResult.status === 'error') {
        console.error('getConfig failed:', configResult.error);
        return;
      }

      const current = configResult.data.general?.theme ?? 'dark';
      const currentIsDark = current === 'dark' || (current === 'system' && systemPrefersDark());
      const next = currentIsDark ? 'light' : 'dark';

      const updateResult = await withTimeout(
        commands.updateConfig({
          general: { theme: next, layoutMode: null },
          editor: null,
          hotkey: null,
          shortcuts: null,
        }),
        { label: 'update_config' },
      );
      if (updateResult.status === 'error') {
        console.error('updateConfig failed:', updateResult.error);
        return;
      }

      // Mark theme as user-controlled before applying, so a concurrent startup
      // application (still awaiting its getConfig) will skip it. Set only on the
      // success path — a failed toggle must not suppress startup application.
      userToggled.theme = true;
      applyThemeClass(next);
    } catch (error) {
      console.error('toggleTheme threw:', error);
      return;
    }
  });
}

/** Toggle editor format between markdown and plaintext. */
export function toggleFormat(): void {
  const { format, setFormat } = useEditorStore.getState();
  setFormat(format === 'markdown' ? 'plaintext' : 'markdown');
}

/**
 * Cycle the window layout mode Floating → Half-screen → Full-screen → Floating.
 * Reads current config, persists the next mode via updateConfig, and applies it
 * to the window. A legacy/unknown stored value is treated as `floating` (so the
 * next step is `half-screen`). Guarded against concurrent calls (e.g. key repeat)
 * to avoid a lost-update race on the read-modify-write.
 */
export async function toggleLayoutMode(): Promise<void> {
  await singleflight('toggle-layout-mode', async () => {
    try {
      const configResult = await withTimeout(commands.getConfig(), {
        label: 'get_config',
      });
      if (configResult.status === 'error') {
        console.error('getConfig failed:', configResult.error);
        return;
      }

      const next = nextLayoutMode(configResult.data.general?.layoutMode);

      const updateResult = await withTimeout(
        commands.updateConfig({
          general: { theme: null, layoutMode: next },
          editor: null,
          hotkey: null,
          shortcuts: null,
        }),
        { label: 'update_config' },
      );
      if (updateResult.status === 'error') {
        console.error('updateConfig failed:', updateResult.error);
        return;
      }

      // Mark layout as user-controlled before applying (see toggleTheme). Success
      // path only, so a failed toggle does not suppress startup application.
      userToggled.layoutMode = true;
      await applyLayoutModeToWindow(next);
    } catch (error) {
      console.error('toggleLayoutMode threw:', error);
      return;
    }
  });
}

/**
 * Set the theme to an explicit value (from the settings panel). Applies the
 * class live, then persists. Unlike {@link toggleTheme} no `getConfig` pre-read
 * is needed — the value is explicit and `updateConfig` merges server-side.
 * Marks the dimension user-controlled so a concurrent startup apply skips it.
 */
export async function setTheme(theme: Theme): Promise<void> {
  userToggled.theme = true;
  applyThemeClass(theme);
  await persistSettingsUpdate({
    general: { theme, layoutMode: null },
    editor: null,
    hotkey: null,
    shortcuts: null,
  }, 'setTheme');
}

/**
 * Set the window layout mode to an explicit value (from the settings panel),
 * persist it, then apply it live to the window. Calls are serialized so rapid
 * select changes complete in issue order rather than racing each other.
 */
export async function setLayoutMode(layoutMode: string): Promise<void> {
  const mode = normalizeLayoutMode(layoutMode);
  const change = async () => {
    const persisted = await persistSettingsUpdate({
      general: { theme: null, layoutMode: mode },
      editor: null,
      hotkey: null,
      shortcuts: null,
    }, 'setLayoutMode');
    if (!persisted) return;

    // Mark the dimension user-controlled only after the new value is committed,
    // so a failed save never suppresses startup restoration later in the session.
    userToggled.layoutMode = true;
    await applyLayoutModeToWindow(mode);
  };

  const pending = layoutModeChangeChain.then(change, change);
  layoutModeChangeChain = pending.then(() => undefined);
  await pending;
}

/**
 * Set the editor font size (from the settings panel), clamped to the supported
 * range, applied live, then persisted.
 */
export async function setFontSize(size: number): Promise<void> {
  const clamped = clampFontSize(size);
  userToggled.fontSize = true;
  applyFontSize(clamped);
  await persistSettingsUpdate({
    general: null,
    editor: { fontSize: clamped, fontFamily: null },
    hotkey: null,
    shortcuts: null,
  }, 'setFontSize');
}

/**
 * Set the editor font family (from the settings panel), applied live, then
 * persisted.
 */
export async function setFontFamily(family: string): Promise<void> {
  userToggled.fontFamily = true;
  applyFontFamily(family);
  await persistSettingsUpdate({
    general: null,
    editor: { fontSize: null, fontFamily: family },
    hotkey: null,
    shortcuts: null,
  }, 'setFontFamily');
}

/** Open the search overlay. */
export function openSearch(): void {
  useSearchStore.getState().openSearch();
}

/** Log a warning for commands whose target feature is not yet built. */
export function stubAction(label: string): void {
  console.warn(`Not yet implemented: ${label}`);
}
