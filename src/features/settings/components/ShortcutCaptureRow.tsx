import { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '../store';
import { formatShortcutFromEvent } from '../shortcut';
import {
  canonicalizeShortcut,
  displayShortcut,
  findShortcutConflict,
  INVALID_SHORTCUT_MESSAGE,
  isConfigurableShortcut,
  type ConfigurableAction,
} from '../shortcuts';

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

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-4)',
  marginBottom: 'var(--space-3)',
};

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--text-primary)',
};

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
  outline: '2px solid transparent',
  outlineOffset: '2px',
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

/** Show the focus ring on focus, hide it on blur. */
const focusRing = {
  onFocus: (e: React.FocusEvent<HTMLElement>) => {
    e.currentTarget.style.outline = '2px solid var(--focus-ring)';
  },
  onBlur: (e: React.FocusEvent<HTMLElement>) => {
    e.currentTarget.style.outline = '2px solid transparent';
  },
};

/**
 * A single Settings → Shortcuts row for one configurable in-app action. Mirrors
 * `HotkeyCaptureField`'s capture pattern: "Change" enters a capture mode that
 * listens on the window in the CAPTURE phase (so it receives the combo before
 * the Settings panel stops propagation of Ctrl/Cmd combos). The captured combo
 * is conflict-checked in the frontend against the other bindings and the
 * reserved range; a clash blocks Save with an inline warning. Persistence and
 * the live binding update happen in the store via `setShortcut`. Esc cancels
 * capture without closing the overlay.
 */
export function ShortcutCaptureRow({ action }: { action: ConfigurableAction }) {
  const binding = useSettingsStore((s) => s.bindings[action.id]);
  const bindings = useSettingsStore((s) => s.bindings);
  const setShortcut = useSettingsStore((s) => s.setShortcut);
  const resetShortcut = useSettingsStore((s) => s.resetShortcut);

  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);
  const changeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);

  const canSave = captured !== null && !blocked;

  const exitCapture = ({ clearWarning = true, restoreFocus = true } = {}) => {
    restoreFocusRef.current = restoreFocus;
    setCapturing(false);
    setCaptured(null);
    setBlocked(false);
    if (clearWarning) setWarning(null);
  };

  const handleSave = async () => {
    if (captured === null || blocked) return;
    const ok = await setShortcut(action.id, captured);
    if (ok) {
      exitCapture();
    } else {
      setWarning('That shortcut is unavailable. Try a different combination.');
      exitCapture({ clearWarning: false });
    }
  };

  // While capturing, listen on window in the CAPTURE phase (see HotkeyCaptureField).
  useEffect(() => {
    if (!capturing) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target;
      if (target instanceof HTMLButtonElement && (e.key === 'Enter' || e.key === ' ')) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Enter' && target === captureRef.current && captured !== null && !blocked) {
        void handleSave();
        return;
      }
      // Wait for a main key — ignore bare modifier presses.
      if (isModifierCode(e.code)) return;
      const combo = formatShortcutFromEvent(e);
      if (combo === null) {
        setCaptured(null);
        setBlocked(true);
        setWarning(INVALID_SHORTCUT_MESSAGE);
        return;
      }
      const canonical = canonicalizeShortcut(combo);
      if (!isConfigurableShortcut(canonical)) {
        setCaptured(null);
        setBlocked(true);
        setWarning(INVALID_SHORTCUT_MESSAGE);
        return;
      }
      const conflict = findShortcutConflict(canonical, bindings, action.id);
      setCaptured(canonical);
      if (conflict) {
        setBlocked(true);
        setWarning(`Already used by ${conflict.label}. Pick a different combination.`);
      } else {
        setBlocked(false);
        setWarning(null);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [capturing, captured, blocked, bindings]);

  // Move focus into the capture region on enter; restore to Change on exit.
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
    setBlocked(false);
    setWarning(null);
    setCapturing(true);
  };

  if (capturing) {
    return (
      <div style={rowStyle}>
        <span style={labelStyle}>{action.label}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div
              ref={captureRef}
              data-testid={`shortcut-capture-${action.id}`}
              role="textbox"
              aria-label={`Press new shortcut for ${action.label}`}
              aria-live="polite"
              tabIndex={0}
              style={{ ...kbdStyle, minWidth: '120px', textAlign: 'center', outline: '2px solid var(--focus-ring)', outlineOffset: '2px' }}
            >
              {captured !== null ? displayShortcut(captured) : 'Press new shortcut…'}
            </div>
            <button
              data-testid={`save-shortcut-${action.id}`}
              aria-label={`Save shortcut for ${action.label}`}
              disabled={!canSave}
              onClick={() => void handleSave()}
              style={{ ...buttonStyle, opacity: canSave ? 1 : 0.5, cursor: canSave ? 'pointer' : 'default' }}
              {...focusRing}
            >
              Save
            </button>
            <button
              data-testid={`cancel-capture-${action.id}`}
              aria-label="Cancel"
              onClick={() => exitCapture()}
              style={buttonStyle}
              {...focusRing}
            >
              Cancel
            </button>
          </div>
          {warning !== null && (
            <span data-testid={`shortcut-warning-${action.id}`} role="alert" style={{ fontSize: 'var(--text-xs)', color: 'var(--danger, var(--text-muted))' }}>
              {warning}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{action.label}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <kbd data-testid={`shortcut-value-${action.id}`} style={kbdStyle}>
            {displayShortcut(binding ?? action.default)}
          </kbd>
          <button
            ref={changeRef}
            data-testid={`change-shortcut-${action.id}`}
            aria-label={`Change shortcut for ${action.label}`}
            onClick={startCapture}
            style={buttonStyle}
            {...focusRing}
          >
            Change
          </button>
          <button
            data-testid={`reset-shortcut-${action.id}`}
            aria-label={`Reset ${action.label} shortcut to default`}
            onClick={() => void resetShortcut(action.id)}
            style={buttonStyle}
            {...focusRing}
          >
            Reset
          </button>
        </div>
        {warning !== null && (
          <span data-testid={`shortcut-warning-${action.id}`} role="alert" style={{ fontSize: 'var(--text-xs)', color: 'var(--danger, var(--text-muted))' }}>
            {warning}
          </span>
        )}
      </div>
    </div>
  );
}
