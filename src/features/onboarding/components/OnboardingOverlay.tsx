import { useEffect, useRef } from 'react';
import { events } from '../../../generated/bindings';
import { useFocusTrap } from '../../../lib/useFocusTrap';
import { useOnboardingStore } from '../store';

/**
 * First-run onboarding overlay (Epic 8).
 *
 * Story 8.1 (this story) implements the complete visual shell and the first-run
 * flow: a centered accessible dialog that teaches the configured capture shortcut
 * as key caps, dismissing (and persisting completion) on Esc or a global-hotkey
 * press. It also renders — but does not wire the backends for — the Customize
 * capture state (Story 8.3) and the macOS accessibility-guidance state
 * (Story 8.2), which those stories activate.
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
                // TODO(Story 8.2): open System Settings > Privacy & Security >
                // Accessibility via a platform command.
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
