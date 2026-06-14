import { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '../store';
import { formatShortcutFromEvent, platformDefaultShortcut } from '../shortcut';

/** Physical `KeyboardEvent.code` values for the modifier keys. */
const MODIFIER_CODES = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
]);

/** True when the pressed key is a bare modifier (no main key yet). */
function isModifierCode(code: string): boolean {
  return MODIFIER_CODES.has(code);
}

const buttonStyle: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-mono)',
  minHeight: '24px',
  padding: '4px 8px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: '4px',
  color: 'var(--text-primary)',
  cursor: 'pointer',
};

const kbdStyle: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-mono)',
  padding: '4px 8px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: '4px',
  color: 'var(--text-primary)',
};

/**
 * The Settings → Hotkey rebinding control. Displays the current global capture
 * shortcut with "Change" and "Reset to default" actions. "Change" enters a
 * capture mode that listens for the next modifier+key combination and offers
 * Save/Cancel; the binding is conflict-checked by the backend (it registers the
 * new shortcut before committing), so a conflict keeps the previous shortcut and
 * surfaces an inline warning plus a toast (raised by the store). Esc cancels
 * capture without closing the Settings overlay.
 */
export function HotkeyCaptureField({ shortcut }: { shortcut: string }) {
  const setGlobalShortcut = useSettingsStore((s) => s.setGlobalShortcut);
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const changeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);

  const exitCapture = ({ clearWarning = true, restoreFocus = true } = {}) => {
    restoreFocusRef.current = restoreFocus;
    setCapturing(false);
    setCaptured(null);
    if (clearWarning) setWarning(null);
  };

  // While capturing, listen on window in the CAPTURE phase. The Settings panel
  // installs its own capture-phase handler that stops propagation of Ctrl/Cmd
  // combos and a bubble-phase Esc-to-close handler; a same-target capture
  // listener still fires after that stopPropagation, and stopping propagation
  // here keeps Esc from closing the overlay while we are capturing.
  useEffect(() => {
    if (!capturing) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target;
      if (e.key === 'Tab') return;
      if (
        target instanceof HTMLButtonElement &&
        (e.key === 'Enter' || e.key === ' ')
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        exitCapture();
        return;
      }
      if (e.key === 'Enter' && target === captureRef.current && captured !== null) {
        void handleSave();
        return;
      }
      // Wait for a main key — ignore bare modifier presses.
      if (isModifierCode(e.code)) return;
      const combo = formatShortcutFromEvent(e);
      if (combo === null) {
        setCaptured(null);
        setWarning('Use at least one modifier (Ctrl/Cmd/Shift/Alt) with a letter or number.');
        return;
      }
      setCaptured(combo);
      setWarning(null);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [capturing, captured]);

  // Move focus into the capture region when capture starts (for screen readers
  // and so a visible focus target exists); restore focus to Change on exit.
  useEffect(() => {
    if (capturing) {
      captureRef.current?.focus();
      return;
    }
    if (restoreFocusRef.current) {
      changeRef.current?.focus();
      restoreFocusRef.current = false;
    }
  }, [capturing]);

  const startCapture = () => {
    setCaptured(null);
    setWarning(null);
    setCapturing(true);
  };

  const handleSave = async () => {
    if (!captured) return;
    const ok = await setGlobalShortcut(captured);
    if (ok) {
      exitCapture();
    } else {
      // Conflict/error: keep the old shortcut visible in display mode.
      setWarning('That shortcut is unavailable. Try a different combination.');
      exitCapture({ clearWarning: false });
    }
  };

  const handleReset = async () => {
    const ok = await setGlobalShortcut(platformDefaultShortcut());
    setWarning(ok ? null : 'That shortcut is unavailable. Try a different combination.');
  };

  if (capturing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div
            ref={captureRef}
            data-testid="shortcut-capture"
            role="textbox"
            aria-label="Press new shortcut"
            aria-live="polite"
            tabIndex={0}
            style={{ ...kbdStyle, minWidth: '120px', textAlign: 'center', outline: '2px solid var(--focus-ring)', outlineOffset: '2px' }}
          >
            {captured ?? 'Press new shortcut…'}
          </div>
          <button
            data-testid="save-shortcut"
            aria-label="Save shortcut"
            disabled={captured === null}
            onClick={() => void handleSave()}
            style={{ ...buttonStyle, opacity: captured === null ? 0.5 : 1, cursor: captured === null ? 'default' : 'pointer' }}          >
            Save
          </button>
          <button
            data-testid="cancel-capture"
            aria-label="Cancel"
            onClick={() => exitCapture()}
            style={buttonStyle}          >
            Cancel
          </button>
        </div>
        {warning !== null && (
          <span data-testid="shortcut-warning" role="alert" style={{ fontSize: 'var(--text-xs)', color: 'var(--danger, var(--text-muted))' }}>
            {warning}
          </span>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <kbd data-testid="global-shortcut-value" style={kbdStyle}>
          {shortcut}
        </kbd>
        <button
          ref={changeRef}
          data-testid="change-shortcut"
          aria-label="Change global shortcut"
          onClick={startCapture}
          style={buttonStyle}        >
          Change
        </button>
        <button
          data-testid="reset-shortcut"
          aria-label="Reset global shortcut to default"
          onClick={() => void handleReset()}
          style={buttonStyle}        >
          Reset to default
        </button>
      </div>
      {warning !== null && (
        <span data-testid="shortcut-warning" role="alert" style={{ fontSize: 'var(--text-xs)', color: 'var(--danger, var(--text-muted))' }}>
          {warning}
        </span>
      )}
    </div>
  );
}
