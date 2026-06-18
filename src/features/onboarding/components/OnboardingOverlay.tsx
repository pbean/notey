import { useEffect, useRef, useState } from 'react';
import { events } from '../../../generated/bindings';
import { useFocusTrap } from '../../../lib/useFocusTrap';
import { formatShortcutFromEvent } from '../../settings/shortcut';
import { checkAccessibilityPermission, openAccessibilitySettings } from '../api';
import { useOnboardingStore } from '../store';

/** How often to re-check the macOS accessibility grant while guidance is shown. */
const ACCESSIBILITY_POLL_MS = 1500;

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

/** Inline guidance shown when a captured combination is not a bindable shortcut. */
const USE_MODIFIER_MSG =
  'Use at least one modifier (Ctrl/Cmd/Shift/Alt) with a letter or number.';
/** Inline guidance shown when the backend rejects a captured shortcut. */
const CONFLICT_MSG = 'That shortcut is unavailable. Try a different combination.';

/**
 * First-run onboarding overlay (Epic 8).
 *
 * The overlay teaches the configured capture shortcut as key caps and dismisses
 * (persisting completion) on Esc or a global-hotkey press (Story 8.1). It also
 * renders the macOS accessibility-guidance state (Story 8.2) — a permission
 * message, a working "Open System Settings" button, and a "Skip for now" control —
 * auto-dismissing the guidance when a grant is detected. The Customize capture
 * state (Story 8.3) captures a new modifier+key combination, previews it live,
 * and on Save registers + persists it through the shared Settings path
 * ({@link useOnboardingStore.applyCustomHotkey}); a conflict warns inline and
 * keeps capture open so the user can retry.
 */
export function OnboardingOverlay() {
  const isVisible = useOnboardingStore((s) => s.isVisible);
  const hotkey = useOnboardingStore((s) => s.hotkey);
  const customizing = useOnboardingStore((s) => s.customizing);
  const accessibilityNeeded = useOnboardingStore((s) => s.accessibilityNeeded);
  const dialogRef = useRef<HTMLDivElement>(null);
  const instructionRef = useRef<HTMLParagraphElement>(null);
  const saveInFlightRef = useRef(false);
  // Story 8.3 capture state: the combo captured so far (null until a valid one)
  // and any inline warning (invalid combination or a registration conflict).
  const [captured, setCaptured] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useFocusTrap(dialogRef, isVisible);

  useEffect(() => {
    if (!isVisible) return;
    instructionRef.current?.focus();
  }, [accessibilityNeeded, customizing, isVisible]);

  // Dismiss on Esc. A window-level listener (not an element handler) is used
  // because focus is on the editor when the overlay first appears, so the
  // keydown does not originate inside the dialog subtree. Disabled while
  // customizing — there Esc cancels capture (the capture-phase handler below
  // stops propagation so this never fires), not onboarding.
  useEffect(() => {
    if (!isVisible || customizing) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        void useOnboardingStore.getState().dismiss();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isVisible, customizing]);

  // Dismiss on a global-hotkey press. The OS-level shortcut hides the window
  // without reloading the webview and does not reliably deliver a keydown to the
  // page, so the backend emits a typed `hotkey-pressed` event we listen for here.
  // Guarded so a missing Tauri runtime (unit tests) cannot crash the overlay.
  // Suppressed while customizing so a stray press of the still-registered old
  // shortcut cannot complete onboarding mid-capture.
  useEffect(() => {
    if (!isVisible || customizing) return;
    let active = true;
    let unlisten: (() => void) | null = null;
    try {
      void events.hotkeyPressed
        .listen(() => {
          if (!active) return;
          const state = useOnboardingStore.getState();
          if (!state.isVisible || state.customizing) return;
          void state.dismiss();
        })
        .then((u) => {
          if (active) unlisten = u;
          else u();
        })
        .catch((e) => console.error('hotkey-pressed listen failed:', e));
    } catch (e) {
      console.error('hotkey-pressed listen failed:', e);
    }
    return () => {
      active = false;
      unlisten?.();
    };
  }, [isVisible, customizing]);

  // Story 8.3 capture: while customizing, listen for the next modifier+key combo
  // on the window in the CAPTURE phase, stopping propagation so Esc cancels
  // capture (not onboarding) and the combo never leaks to the editor. Bare
  // modifiers are ignored until a main key arrives; an unbindable combination
  // surfaces an inline warning instead of being captured.
  useEffect(() => {
    if (!isVisible || !customizing) return;
    saveInFlightRef.current = false;
    setCaptured(null);
    setWarning(null);
    setIsSaving(false);
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Tab') return;
      const target = e.target;
      const targetButton =
        target instanceof HTMLElement ? target.closest('button') : null;
      if (
        targetButton !== null &&
        (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar')
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (saveInFlightRef.current) return;
      if (e.key === 'Escape') {
        useOnboardingStore.getState().cancelCustomize();
        return;
      }
      if (MODIFIER_CODES.has(e.code)) return;
      const combo = formatShortcutFromEvent(e);
      if (combo === null) {
        setCaptured(null);
        setWarning(USE_MODIFIER_MSG);
        return;
      }
      setCaptured(combo);
      setWarning(null);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isVisible, customizing]);

  // While the macOS accessibility guidance is shown, re-check the grant so the
  // guidance auto-dismisses once the user enables the permission. macOS emits no
  // change event, so we poll on an interval and on window focus (the user
  // returning from System Settings). Guarded so a missing Tauri runtime (unit
  // tests) cannot crash. Off macOS this branch never runs (guidance is not shown).
  useEffect(() => {
    if (!isVisible || !accessibilityNeeded) return;
    let active = true;
    const recheck = () => {
      checkAccessibilityPermission()
        .then((granted) => {
          if (active && granted) {
            useOnboardingStore.getState().setAccessibilityNeeded(false);
          }
        })
        .catch((e) => console.error('accessibility re-check failed:', e));
    };
    const interval = window.setInterval(recheck, ACCESSIBILITY_POLL_MS);
    window.addEventListener('focus', recheck);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', recheck);
    };
  }, [isVisible, accessibilityNeeded]);

  if (!isVisible) return null;

  const keyCaps = hotkey
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);

  // Register + persist the captured shortcut via the shared Epic 7 path. On a
  // conflict the store keeps capture mode open; surface an inline warning so the
  // user can try another combination.
  const handleSaveCustom = async () => {
    if (captured === null || saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setIsSaving(true);
    try {
      const ok = await useOnboardingStore.getState().applyCustomHotkey(captured);
      if (!ok) {
        setCaptured(null);
        setWarning(CONFLICT_MSG);
      }
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'color-mix(in srgb, var(--bg-primary) 70%, transparent)',
        zIndex: 50,
      }}
    >
      <div
        ref={dialogRef}
        data-testid="onboarding-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to Notey"
        tabIndex={-1}
        style={{
          fontFamily: 'var(--font-sans, sans-serif)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: '8px',
          padding: 'var(--space-6, 24px)',
          maxWidth: '420px',
          textAlign: 'center',
          color: 'var(--text-primary)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        }}
      >
        <h2 style={{ margin: '0 0 var(--space-4, 16px)', fontSize: '18px' }}>
          Welcome to Notey
        </h2>

        {accessibilityNeeded ? (
          <div>
            <p
              ref={instructionRef}
              tabIndex={-1}
              style={{ margin: '0 0 var(--space-3, 12px)' }}
            >
              Notey needs accessibility permission for the global shortcut to
              work.
            </p>
            <button
              type="button"
              onClick={() => {
                void openAccessibilitySettings().catch((e) =>
                  console.error('openAccessibilitySettings failed:', e),
                );
              }}
              style={onboardingButtonStyle}
            >
              Open System Settings
            </button>
            <p
              style={{
                margin: 'var(--space-3, 12px) 0 0',
                color: 'var(--text-muted)',
                fontSize: '12px',
              }}
            >
              You can skip this, but the shortcut may not work without this
              permission.
            </p>
            <button
              type="button"
              onClick={() =>
                useOnboardingStore.getState().setAccessibilityNeeded(false)
              }
              style={{
                ...onboardingButtonStyle,
                marginTop: 'var(--space-3, 12px)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '12px',
              }}
            >
              Skip for now
            </button>
          </div>
        ) : customizing ? (
          <div>
            <p
              ref={instructionRef}
              tabIndex={-1}
              style={{ margin: '0 0 var(--space-3, 12px)' }}
            >
              Press your preferred shortcut…
            </p>
            <div
              data-testid="hotkey-capture"
              aria-live="polite"
              style={{
                display: 'flex',
                gap: 'var(--space-2, 8px)',
                justifyContent: 'center',
                minHeight: '28px',
                alignItems: 'center',
              }}
            >
              {captured === null ? (
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                  Waiting for a key combination…
                </span>
              ) : (
                captured
                  .split('+')
                  .map((part) => part.trim())
                  .filter(Boolean)
                  .map((cap) => (
                    <kbd
                      key={cap}
                      style={{
                        padding: '4px 10px',
                        border: '1px solid var(--border-default)',
                        borderRadius: '4px',
                        background: 'var(--bg-primary)',
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: '13px',
                      }}
                    >
                      {cap}
                    </kbd>
                  ))
              )}
            </div>
            {warning !== null && (
              <p
                data-testid="hotkey-warning"
                role="alert"
                style={{
                  margin: 'var(--space-3, 12px) 0 0',
                  color: 'var(--danger, var(--text-muted))',
                  fontSize: '12px',
                }}
              >
                {warning}
              </p>
            )}
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-2, 8px)',
                justifyContent: 'center',
                marginTop: 'var(--space-4, 16px)',
              }}
            >
              <button
                type="button"
                data-testid="save-custom-hotkey"
                disabled={captured === null || isSaving}
                onClick={() => void handleSaveCustom()}
                style={{
                  ...onboardingButtonStyle,
                  opacity: captured === null || isSaving ? 0.5 : 1,
                  cursor: captured === null || isSaving ? 'default' : 'pointer',
                }}
              >
                Save
              </button>
              <button
                type="button"
                data-testid="cancel-custom-hotkey"
                disabled={isSaving}
                onClick={() => useOnboardingStore.getState().cancelCustomize()}
                style={{
                  ...onboardingButtonStyle,
                  opacity: isSaving ? 0.5 : 1,
                  cursor: isSaving ? 'default' : 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p
              ref={instructionRef}
              tabIndex={-1}
              style={{ margin: '0 0 var(--space-3, 12px)' }}
            >
              Your capture shortcut is
            </p>
            <div
              data-testid="hotkey-display"
              style={{
                display: 'flex',
                gap: 'var(--space-2, 8px)',
                justifyContent: 'center',
              }}
            >
              {keyCaps.map((cap) => (
                <kbd
                  key={cap}
                  style={{
                    padding: '4px 10px',
                    border: '1px solid var(--border-default)',
                    borderRadius: '4px',
                    background: 'var(--bg-primary)',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '13px',
                  }}
                >
                  {cap}
                </kbd>
              ))}
            </div>
            <p style={{ margin: 'var(--space-4, 16px) 0 0', fontSize: '13px' }}>
              Press it now to try
            </p>
            <button
              type="button"
              onClick={() => useOnboardingStore.getState().startCustomize()}
              style={{
                ...onboardingButtonStyle,
                marginTop: 'var(--space-4, 16px)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '12px',
              }}
            >
              Customize
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const onboardingButtonStyle = {
  cursor: 'pointer',
  color: 'var(--text-secondary)',
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: '4px',
  padding: '6px 12px',
  fontSize: '13px',
} as const;
