import { relaunch } from "@tauri-apps/plugin-process";
import { useUpdateStore } from "../store";

/**
 * Top-of-window banner offering to install a pending update. Renders nothing
 * until {@link checkForUpdates} finds an available build, so it is inert in the
 * common case. Non-modal: the user can dismiss it and keep capturing notes.
 *
 * "Install & restart" downloads + applies the signed artifact, then relaunches
 * onto the new build via `@tauri-apps/plugin-process`. A failure is shown inline
 * and leaves the app running on the current version.
 */
export function UpdateBanner() {
  const update = useUpdateStore((s) => s.update);
  const version = useUpdateStore((s) => s.version);
  const phase = useUpdateStore((s) => s.phase);
  const error = useUpdateStore((s) => s.error);
  const setInstalling = useUpdateStore((s) => s.setInstalling);
  const setError = useUpdateStore((s) => s.setError);
  const dismiss = useUpdateStore((s) => s.dismiss);

  if (phase === "idle" || !update) return null;

  const installing = phase === "installing";

  async function install() {
    if (!update) return;
    setInstalling();
    try {
      await update.downloadAndInstall();
      // Restarts the app onto the freshly installed version; nothing after this
      // line runs in the current process.
      await relaunch();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div
      data-testid="update-banner"
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-2) var(--space-3)",
        backgroundColor: "var(--bg-elevated)",
        color: "var(--text-primary)",
        borderBottom: "1px solid var(--border-default)",
        fontSize: "13px",
        zIndex: 60,
      }}
    >
      <span style={{ flex: 1 }}>
        {phase === "error"
          ? `Update failed: ${error}`
          : installing
            ? `Installing Notey ${version}…`
            : `Notey ${version} is available.`}
      </span>
      <button
        type="button"
        data-testid="update-install"
        onClick={install}
        disabled={installing}
        style={{
          appearance: "none",
          cursor: installing ? "default" : "pointer",
          backgroundColor: "var(--accent, #4f46e5)",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          padding: "var(--space-1) var(--space-3)",
          font: "inherit",
          fontSize: "13px",
          opacity: installing ? 0.6 : 1,
        }}
      >
        {phase === "error" ? "Retry" : "Install & restart"}
      </button>
      <button
        type="button"
        data-testid="update-dismiss"
        onClick={dismiss}
        disabled={installing}
        aria-label="Dismiss update notification"
        title="Dismiss"
        style={{
          appearance: "none",
          cursor: installing ? "default" : "pointer",
          background: "none",
          border: "none",
          color: "var(--text-secondary)",
          font: "inherit",
          fontSize: "16px",
          lineHeight: 1,
          padding: "0 var(--space-1)",
        }}
      >
        ×
      </button>
    </div>
  );
}
