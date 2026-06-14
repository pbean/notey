import { create } from 'zustand';
import type { AppConfig } from '../../generated/bindings';
import { commands } from '../../generated/bindings';
import { useToastStore } from '../toast/store';
import { closeOtherOverlays, registerOverlay } from '../overlays/manager';
import { normalizeLayoutMode } from './layoutMode';
import {
  clampFontSize,
  setFontFamily as applyFontFamily,
  setFontSize as applyFontSize,
  setLayoutMode as applyLayoutMode,
  setTheme as applyTheme,
} from '../command-palette/actions';

/** Settings overlay state. */
interface SettingsState {
  /** Whether the settings overlay is visible. */
  isOpen: boolean;
  /**
   * Snapshot of the current config, loaded on open and updated optimistically as
   * the user edits. Drives the form's controlled inputs. `null` until first open.
   */
  config: AppConfig | null;
}

/** Actions for managing settings state. */
interface SettingsActions {
  /** Open the overlay, loading the current config snapshot from the backend. */
  open: () => Promise<boolean>;
  /** Close the overlay. */
  close: () => void;
  /** Set theme (dark/light): updates the snapshot and persists+applies live. */
  setTheme: (theme: string) => void;
  /** Set layout mode (floating/half-screen/full-screen): snapshot + persist. */
  setLayoutMode: (layoutMode: string) => void;
  /** Set editor font size (clamped 12–24): snapshot + persist+apply live. */
  setFontSize: (size: number) => void;
  /** Set editor font family (mono/sans): snapshot + persist+apply live. */
  setFontFamily: (family: string) => void;
  /**
   * Set the global capture shortcut, conflict-checked. Unlike the live-apply
   * setters this is NOT optimistic: it awaits the backend, which registers the
   * new binding before committing. On success the snapshot is replaced with the
   * returned merged config and a confirmation toast shows; on conflict the
   * previous shortcut stays active, the snapshot is left unchanged, and a
   * 5-second conflict toast shows. Resolves `true` on success, `false` on
   * conflict/error.
   */
  setGlobalShortcut: (shortcut: string) => Promise<boolean>;
  /** Reset all settings state to initial values (test cleanup only). */
  resetSettings: () => void;
}

/** Per-feature Zustand store for the settings overlay. */
export const useSettingsStore = create<SettingsState & SettingsActions>((set, get) => ({
  isOpen: false,
  config: null,
  open: async () => {
    let result;
    try {
      result = await commands.getConfig();
    } catch (error) {
      console.error('getConfig failed opening settings:', error);
      return false;
    }
    if (result.status === 'error') {
      console.error('getConfig failed opening settings:', result.error);
      return false;
    }
    closeOtherOverlays('settings');
    set({ isOpen: true, config: result.data });
    return true;
  },
  close: () => set({ isOpen: false }),
  setTheme: (theme) => {
    const { config } = get();
    if (config) {
      set({
        config: {
          ...config,
          general: { ...config.general, theme, layoutMode: normalizeLayoutMode(config.general?.layoutMode) },
        },
      });
    }
    void applyTheme(theme);
  },
  setLayoutMode: (layoutMode) => {
    const { config } = get();
    if (config) {
      set({
        config: {
          ...config,
          general: { ...config.general, theme: config.general?.theme ?? 'dark', layoutMode: normalizeLayoutMode(layoutMode) },
        },
      });
    }
    void applyLayoutMode(layoutMode);
  },
  setFontSize: (size) => {
    const clamped = clampFontSize(size);
    const { config } = get();
    if (config) {
      set({
        config: {
          ...config,
          editor: { ...config.editor, fontSize: clamped, fontFamily: config.editor?.fontFamily ?? 'mono' },
        },
      });
    }
    void applyFontSize(clamped);
  },
  setFontFamily: (family) => {
    const { config } = get();
    if (config) {
      set({
        config: {
          ...config,
          editor: { ...config.editor, fontSize: config.editor?.fontSize ?? 14, fontFamily: family },
        },
      });
    }
    void applyFontFamily(family);
  },
  setGlobalShortcut: async (shortcut) => {
    let result;
    try {
      result = await commands.updateConfig({ general: null, editor: null, hotkey: { globalShortcut: shortcut } });
    } catch (error) {
      console.error('updateConfig threw setting global shortcut:', error);
      useToastStore
        .getState()
        .addToast('Couldn’t change the shortcut — keeping the previous one.', 5000);
      return false;
    }
    if (result.status === 'error') {
      console.error('updateConfig failed setting global shortcut:', result.error);
      const conflictMessage =
        'message' in result.error
          ? result.error.message
          : 'data' in result.error && typeof result.error.data === 'string'
            ? result.error.data
            : '';
      const isConflict =
        result.error.type === 'Config' && conflictMessage.includes('Failed to register new shortcut');
      useToastStore
        .getState()
        .addToast(
          isConflict
            ? 'Shortcut unavailable — it may be in use by another app. Keeping the previous shortcut.'
            : 'Couldn’t change the shortcut — keeping the previous one.',
          5000,
        );
      return false;
    }
    // Adopt the backend's committed config so the displayed shortcut reflects
    // what is actually registered, never an optimistic guess.
    set({ config: result.data });
    useToastStore.getState().addToast('Global shortcut updated');
    return true;
  },
  resetSettings: () => set({ isOpen: false, config: null }),
}));

registerOverlay('settings', () => useSettingsStore.getState().close());
