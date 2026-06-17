import { useToastStore } from "../store";

/**
 * Renders active toasts stacked at the bottom-right of the window.
 *
 * The container is `pointer-events-none` and never receives focus, so toasts
 * are non-blocking — the user can keep typing in the editor while one is
 * visible. Individual toasts re-enable pointer events so only the visible
 * cards, not the full overlay, can ever intercept clicks. Uses
 * `aria-live="polite"` so screen readers announce new messages without
 * interrupting. Auto-dismissal is owned by the store; clicking a toast dismisses
 * it immediately, which is the only way to clear a persistent toast (one created
 * with a non-positive duration, e.g. the hotkey-unavailable notice).
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismissToast = useToastStore((s) => s.dismissToast);

  return (
    <div
      data-testid="toaster"
      role="status"
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: "fixed",
        bottom: "var(--space-4)",
        right: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      {toasts.map((toast) => (
        <button
          type="button"
          key={toast.id}
          data-testid="toast"
          onClick={() => dismissToast(toast.id)}
          aria-label={`Dismiss notification: ${toast.message}`}
          title="Dismiss"
          style={{
            appearance: "none",
            pointerEvents: "auto",
            cursor: "pointer",
            backgroundColor: "var(--bg-elevated)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: "6px",
            padding: "var(--space-2) var(--space-3)",
            fontSize: "13px",
            font: "inherit",
            textAlign: "left",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
            maxWidth: "320px",
          }}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
