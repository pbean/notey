import { useEffect, useRef } from 'react';
import { events } from '../../../generated/bindings';
import { useFocusTrap } from '../../../lib/useFocusTrap';
import { checkAccessibilityPermission, openAccessibilitySettings } from '../api';
import { useOnboardingStore } from '../store';

/** How often to re-check the macOS accessibility grant while guidance is shown. */
const ACCESSIBILITY_POLL_MS = 1500;

/**
 * First-run onboarding overlay (Epic 8).
 *
 * The overlay teaches the configured capture shortcut as key caps and dismisses
 * (persisting completion) on Esc or a global-hotkey press (Story 8.1). It also
 * renders the macOS accessibility-guidance state (Story 8.2) — a permission
 * message, a working "Open System Settings" button, and a "Skip for now" control —
 * auto-dismissing the guidance when a grant is detected. The Customize capture
 * state (Story 8.3) is still an inert shell.
 */
export function OnboardingOverlay() {
  const isVisible = useOnboardingStore((s) => s.isVisible);
  const hotkey = useOnboardingStore((s) => s.hotkey);
  const customizing = useOnboardingStore((s) => s.customizing);
  const accessibilityNeeded = useOnboardingStore((s) => s.accessibilityNeeded);
  const dialogRef = useRef<HTMLDivElement>(null);
  const instructionRef = useRef<HTMLParagraphElement>(null);

  useFocusTrap(dialogRef, isVisible);

  useEffect(() => {
    if (!isVisible) return;
    instructionRef.current?.focus();
  }, [accessibilityNeeded, customizing, isVisible]);

  // Dismiss on Esc. A window-level listener (not an element handler) is used
  // because focus is on the editor when the overlay first appears, so the
  // keydown does not originate inside the dialog subtree.
  useEffect(() => {
    if (!isVisible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        void useOnboardingStore.getState().dismiss();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isVisible]);

  // Dismiss on a global-hotkey press. The OS-level shortcut hides the window
  // without reloading the webview and does not reliably deliver a keydown to the
  // page, so the backend emits a typed `hotkey-pressed` event we listen for here.
  // Guarded so a missing Tauri runtime (unit tests) cannot crash the overlay.
  useEffect(() => {
    if (!isVisible) return;
    let active = true;
    let unlisten: (() => void) | null = null;
    try {
      void events.hotkeyPressed
        .listen(() => {
          void useOnboardingStore.getState().dismiss();
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
  }, [isVisible]);

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
          <p ref={instructionRef} tabIndex={-1} style={{ margin: 0 }}>
            Press your preferred shortcut…
          </p>
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
