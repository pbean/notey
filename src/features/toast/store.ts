import { create } from 'zustand';

/** A single transient toast notification. */
export interface Toast {
  /** Unique, monotonically-increasing id used as the React key and dismiss handle. */
  id: number;
  /** Message text shown to the user. */
  message: string;
}

/** Default auto-dismiss duration in milliseconds. */
export const DEFAULT_TOAST_DURATION_MS = 3000;

interface ToastState {
  /** Active toasts, oldest first. */
  toasts: Toast[];
}

interface ToastActions {
  /**
   * Show a toast and schedule its auto-dismissal. The toast self-expires after
   * `durationMs` regardless of which component (if any) is rendering it.
   * Returns the new toast's id so callers can dismiss it early.
   */
  addToast: (message: string, durationMs?: number) => number;
  /** Remove the toast with the given id. Idempotent — a no-op if already gone. */
  dismissToast: (id: number) => void;
  /** Reset all toast state to initial values (test cleanup only). */
  reset: () => void;
}

/** Module-level counter for stable, unique toast ids (test-friendly; no Date/Math.random). */
let nextToastId = 0;

/** Per-feature Zustand store for transient toast notifications. */
export const useToastStore = create<ToastState & ToastActions>((set, get) => ({
  toasts: [],

  addToast: (message, durationMs = DEFAULT_TOAST_DURATION_MS) => {
    const id = nextToastId++;
    set((state) => ({ toasts: [...state.toasts, { id, message }] }));
    setTimeout(() => get().dismissToast(id), durationMs);
    return id;
  },

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  reset: () => set({ toasts: [] }),
}));
