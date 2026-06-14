import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../store';

/**
 * Displays live save status in the StatusBar.
 *
 * The status is rendered inside ONE persistent `aria-live="polite"` region that
 * stays mounted across every save state (empty at idle). A polite live region
 * only announces mutations that happen *after* it is in the DOM, so mounting it
 * once — rather than inserting a span on each save — is what makes a screen
 * reader reliably announce "Saved" / "Save failed". (Story 7.8, WCAG 2.1 AA.)
 *
 * - idle: region is mounted but empty — no announcement, no visible text
 * - saving: "Saving..." shown only after 200ms (hidden on fast saves)
 * - saved: "Saved" appears then fades via opacity over 2s
 * - failed: "Save failed" persists until the next successful save
 *
 * Uses `aria-live` here rather than a second `role="status"`: the StatusBar
 * already supplies `role="status"`, and this inner polite region is the nearest
 * live ancestor for the save text, so exactly one announcement results.
 */
export function SaveIndicator() {
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const [showSaving, setShowSaving] = useState(false);
  const [showFailedUntilSaved, setShowFailedUntilSaved] = useState(false);
  const savingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Manage 200ms delay before "Saving..." becomes visible
  useEffect(() => {
    if (saveStatus === 'saving') {
      savingTimerRef.current = setTimeout(() => setShowSaving(true), 200);
    } else {
      if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
      setShowSaving(false);
    }
    return () => {
      if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
    };
  }, [saveStatus]);

  useEffect(() => {
    if (saveStatus === 'failed') setShowFailedUntilSaved(true);
    if (saveStatus === 'saved' || saveStatus === 'idle') setShowFailedUntilSaved(false);
  }, [saveStatus]);

  const shouldShowFailed =
    saveStatus === 'failed' || (saveStatus === 'saving' && showFailedUntilSaved);

  return (
    <span
      data-testid="save-indicator-live"
      aria-live="polite"
      aria-atomic="true"
      style={{ fontSize: '11px' }}
    >
      {shouldShowFailed ? (
        <span
          data-testid="save-indicator"
          style={{ color: 'var(--warning)', marginRight: 'var(--space-3)' }}
        >
          Save failed
        </span>
      ) : saveStatus === 'saving' ? (
        showSaving ? (
          <span
            data-testid="save-indicator"
            style={{ color: 'var(--text-muted)', marginRight: 'var(--space-3)' }}
          >
            Saving...
          </span>
        ) : null
      ) : saveStatus === 'saved' ? (
        <span
          data-testid="save-indicator"
          className="save-indicator-saved"
          style={{ color: 'var(--success)', marginRight: 'var(--space-3)' }}
        >
          Saved
        </span>
      ) : null}
    </span>
  );
}
