import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../store';

/**
 * Displays live save status in the StatusBar.
 *
 * - idle: renders nothing
 * - saving: "Saving..." shown only after 200ms (hidden on fast saves)
 * - saved: "Saved" appears then fades via opacity over 2s
 * - failed: "Save failed" persists until the next successful save
 */
export function SaveIndicator() {
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const [showSaving, setShowSaving] = useState(false);
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

  if (saveStatus === 'idle') return null;

  if (saveStatus === 'saving') {
    return showSaving ? (
      <span
        data-testid="save-indicator"
        style={{ color: 'var(--text-muted)', fontSize: '11px' }}
      >
        Saving...
      </span>
    ) : null;
  }

  if (saveStatus === 'saved') {
    return (
      <span
        data-testid="save-indicator"
        className="save-indicator-saved"
        style={{ color: 'var(--success)', fontSize: '11px' }}
      >
        Saved
      </span>
    );
  }

  // failed
  return (
    <span
      data-testid="save-indicator"
      style={{ color: 'var(--warning)', fontSize: '11px' }}
    >
      Save failed
    </span>
  );
}
