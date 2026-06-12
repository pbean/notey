import { commands } from '../../generated/bindings';
import { useEditorStore } from '../editor/store';
import { useSearchStore } from '../search/store';
import { useTabStore } from '../tabs/store';
import { useWorkspaceStore } from '../workspace/store';
import { flushSave } from '../editor/hooks/useAutoSave';

let isCreatingNote = false;

/**
 * Create a new note, open it in a tab, and load it into the editor.
 * Flushes any pending auto-save first to avoid data loss.
 * Guarded against concurrent calls (e.g. key repeat).
 */
export async function createNewNote(): Promise<void> {
  if (isCreatingNote) return;
  isCreatingNote = true;

  try {
    try {
      await flushSave();
    } catch (err) {
      console.error('flushSave failed before new note:', err);
    }

    const format = useEditorStore.getState().format;
    const workspaceId = useWorkspaceStore.getState().activeWorkspaceId;

    const result = await commands.createNote(format, workspaceId);
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
  } finally {
    isCreatingNote = false;
  }
}

let isTogglingTheme = false;
let isTogglingLayoutMode = false;

/**
 * Display dimensions the user has explicitly toggled this session. Consulted by
 * {@link applyStartupConfig} so a toggle fired during the brief boot window —
 * before the startup `getConfig` resolves — is never clobbered by the now-stale
 * startup snapshot. Sticky for the session: an explicit toggle wins over the
 * boot-time config for the rest of the run. Each dimension is tracked
 * independently so a theme toggle never suppresses layout startup application
 * (or vice versa).
 */
const userToggled = { theme: false, layoutMode: false };

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
 */
function applyThemeClass(theme: string): void {
  systemThemeActive = theme === 'system';
  const isDark = theme === 'dark' || (theme === 'system' && systemPrefersDark());
  const root = document.documentElement;
  root.classList.toggle('dark', isDark);
  root.classList.toggle('light', !isDark);
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
 * Apply the compact layout class to `<html>`. Single source of truth for the
 * layout class rule, shared by startup application and the toggle.
 * Compact is applied iff `layoutMode === 'compact'`; any other value
 * (such as `comfortable`) clears it.
 */
function applyLayoutModeClass(layoutMode: string): void {
  document.documentElement.classList.toggle('compact', layoutMode === 'compact');
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

  const general = configResult.data.general;
  const theme = general?.theme ?? 'dark';
  // Skip any dimension the user has already toggled this session: their explicit
  // choice (applied and persisted by the toggle) must not be reverted to this
  // possibly-stale boot-time snapshot. Each dimension is guarded independently.
  if (!userToggled.theme) applyThemeClass(theme);
  if (!userToggled.layoutMode) applyLayoutModeClass(general?.layoutMode ?? 'comfortable');

  // Track live OS appearance changes for the `system` theme. Bound once; the
  // handler no-ops unless `system` is the active theme.
  bindSystemThemeListener();
  if (!userToggled.theme && theme === 'system') handleSystemThemeChange();
}

/**
 * Toggle theme between dark and light. Reads current config,
 * persists the change via updateConfig, and toggles the DOM class.
 * Guarded against concurrent calls (e.g. key repeat) to avoid a
 * lost-update race on the read-modify-write.
 */
export async function toggleTheme(): Promise<void> {
  if (isTogglingTheme) return;
  isTogglingTheme = true;

  try {
    const configResult = await commands.getConfig();
    if (configResult.status === 'error') {
      console.error('getConfig failed:', configResult.error);
      return;
    }

    const current = configResult.data.general?.theme ?? 'dark';
    const next = current === 'dark' ? 'light' : 'dark';

    const updateResult = await commands.updateConfig({
      general: { theme: next, layoutMode: null },
      editor: null,
      hotkey: null,
    });
    if (updateResult.status === 'error') {
      console.error('updateConfig failed:', updateResult.error);
      return;
    }

    // Mark theme as user-controlled before applying, so a concurrent startup
    // application (still awaiting its getConfig) will skip it. Set only on the
    // success path — a failed toggle must not suppress startup application.
    userToggled.theme = true;
    applyThemeClass(next);
  } finally {
    isTogglingTheme = false;
  }
}

/** Toggle editor format between markdown and plaintext. */
export function toggleFormat(): void {
  const { format, setFormat } = useEditorStore.getState();
  setFormat(format === 'markdown' ? 'plaintext' : 'markdown');
}

/**
 * Toggle layout mode between compact and comfortable.
 * Reads current config and persists via updateConfig.
 * Guarded against concurrent calls (e.g. key repeat) to avoid a
 * lost-update race on the read-modify-write.
 */
export async function toggleLayoutMode(): Promise<void> {
  if (isTogglingLayoutMode) return;
  isTogglingLayoutMode = true;

  try {
    const configResult = await commands.getConfig();
    if (configResult.status === 'error') {
      console.error('getConfig failed:', configResult.error);
      return;
    }

    const current = configResult.data.general?.layoutMode ?? 'comfortable';
    const next = current === 'compact' ? 'comfortable' : 'compact';

    const updateResult = await commands.updateConfig({
      general: { theme: null, layoutMode: next },
      editor: null,
      hotkey: null,
    });
    if (updateResult.status === 'error') {
      console.error('updateConfig failed:', updateResult.error);
      return;
    }

    // Mark layout as user-controlled before applying (see toggleTheme). Success
    // path only, so a failed toggle does not suppress startup application.
    userToggled.layoutMode = true;
    applyLayoutModeClass(next);
  } finally {
    isTogglingLayoutMode = false;
  }
}

/** Open the search overlay. */
export function openSearch(): void {
  useSearchStore.getState().openSearch();
}

/** Log a warning for commands whose target feature is not yet built. */
export function stubAction(label: string): void {
  console.warn(`Not yet implemented: ${label}`);
}
