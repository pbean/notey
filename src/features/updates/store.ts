import { create } from "zustand";
import type { Update } from "@tauri-apps/plugin-updater";

/**
 * Phase of the in-app update flow. `idle` covers both "no update" and "the user
 * dismissed the banner"; the banner only renders for `available`/`installing`/`error`.
 */
export type UpdatePhase = "idle" | "available" | "installing" | "error";

interface UpdateState {
  /** The pending update handle from `check()`, or null when none is available. */
  update: Update | null;
  /** Target version string (e.g. "0.2.0") for display, mirrored from `update`. */
  version: string | null;
  phase: UpdatePhase;
  /** Human-readable error shown in the banner when install fails. */
  error: string | null;
}

interface UpdateActions {
  /** Record an available update so the banner offers to install it. */
  setAvailable: (update: Update) => void;
  /** Enter the installing phase (download + apply in progress). */
  setInstalling: () => void;
  /** Record an install failure with a user-facing message. */
  setError: (message: string) => void;
  /** Dismiss the banner / clear update state back to idle. */
  dismiss: () => void;
  /** Reset all state to initial values (test cleanup only). */
  reset: () => void;
}

const initial: UpdateState = {
  update: null,
  version: null,
  phase: "idle",
  error: null,
};

/** Per-feature Zustand store backing the in-app auto-update banner. */
export const useUpdateStore = create<UpdateState & UpdateActions>((set) => ({
  ...initial,

  setAvailable: (update) =>
    set({ update, version: update.version, phase: "available", error: null }),

  setInstalling: () => set({ phase: "installing", error: null }),

  setError: (message) => set({ phase: "error", error: message }),

  dismiss: () => set({ ...initial }),

  reset: () => set({ ...initial }),
}));
