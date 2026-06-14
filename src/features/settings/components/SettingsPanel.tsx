import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../store';
import { clampFontSize } from '../../command-palette/actions';
import { HotkeyCaptureField } from './HotkeyCaptureField';

/** Window layout modes offered by the General section (behavior lands in Story 7.5). */
const LAYOUT_MODES = ['floating', 'half-screen', 'full-screen'] as const;

/** Restore focus to the editor when the overlay closes. */
function focusEditor(): void {
  document.querySelector<HTMLElement>('.cm-content')?.focus();
}

/** Shared style for a focusable control's focus-ring behavior. */
function withFocusRing(base: React.CSSProperties): {
  style: React.CSSProperties;
  onFocus: (e: React.FocusEvent<HTMLElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLElement>) => void;
} {
  return {
    style: { outline: '2px solid transparent', outlineOffset: '2px', ...base },
    onFocus: (e) => {
      e.currentTarget.style.outline = '2px solid var(--focus-ring)';
    },
    onBlur: (e) => {
      e.currentTarget.style.outline = '2px solid transparent';
    },
  };
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
  marginBottom: 'var(--space-3)',
};

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

const controlBase: React.CSSProperties = {
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

/**
 * Settings overlay — the host surface for all Epic 7 personalization. Renders a
 * modal with General, Editor, and Hotkey sections. Each control persists through
 * `updateConfig` (via the settings store) and applies live where supported.
 * Dismissed with Esc or the Done button; focus is trapped while open.
 */
export function SettingsPanel() {
  const config = useSettingsStore((s) => s.config);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setLayoutMode = useSettingsStore((s) => s.setLayoutMode);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const setFontFamily = useSettingsStore((s) => s.setFontFamily);
  const firstControlRef = useRef<HTMLButtonElement>(null);

  // Auto-focus the first control on mount.
  useEffect(() => {
    firstControlRef.current?.focus();
  }, []);

  // Esc closes the panel and returns focus to the editor.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        useSettingsStore.getState().close();
        focusEditor();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Prevent browser/webview command shortcuts from escaping the modal.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((!e.ctrlKey && !e.metaKey) || e.key === 'Control' || e.key === 'Meta') return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  const close = () => {
    useSettingsStore.getState().close();
    focusEditor();
  };

  /** Trap focus within the overlay — Tab cycles, Esc/Done are the only exits. */
  const handleOverlayKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const focusable = e.currentTarget.querySelectorAll<HTMLElement>(
      'input:not([disabled]), button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const theme = config?.general?.theme ?? 'dark';
  const rawLayoutMode = config?.general?.layoutMode ?? 'floating';
  // The stored value may still be a legacy density ('comfortable'/'compact');
  // show 'floating' until the user picks a window mode (reconciled in 7.5).
  const layoutMode = (LAYOUT_MODES as readonly string[]).includes(rawLayoutMode) ? rawLayoutMode : 'floating';
  const fontSize = clampFontSize(config?.editor?.fontSize ?? 14);
  const fontFamily = config?.editor?.fontFamily === 'sans' ? 'sans' : 'mono';
  const globalShortcut = config?.hotkey?.globalShortcut ?? 'Ctrl+Shift+N';

  return (
    <div
      data-testid="settings-overlay"
      onKeyDown={handleOverlayKeyDown}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Passive backdrop */}
      <div
        data-testid="settings-backdrop"
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, background: 'var(--bg-primary)', opacity: 0.8 }}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        style={{
          position: 'relative',
          zIndex: 1,
          width: 'min(440px, 90%)',
          maxHeight: '90%',
          overflowY: 'auto',
          padding: 'var(--space-6)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: '8px',
        }}
      >
        <h2 style={{ fontSize: 'var(--text-lg)', color: 'var(--text-primary)', marginBottom: 'var(--space-5)' }}>
          Settings
        </h2>

        {/* General */}
        <section style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={sectionTitleStyle}>General</h3>

          <div style={rowStyle}>
            <span style={labelStyle}>Theme</span>
            <div role="group" aria-label="Theme" style={{ display: 'flex', gap: 'var(--space-1)' }}>
              {(['system', 'dark', 'light'] as const).map((t, i) => {
                const active = theme === t;
                return (
                  <button
                    key={t}
                    ref={i === 0 ? firstControlRef : undefined}
                    data-testid={`theme-${t}`}
                    aria-pressed={active}
                    onClick={() => setTheme(t)}
                    {...withFocusRing({
                      ...controlBase,
                      textTransform: 'capitalize',
                      background: active ? 'var(--accent-muted)' : 'var(--bg-surface)',
                      color: active ? 'var(--accent)' : 'var(--text-primary)',
                      fontWeight: active ? 600 : 400,
                    })}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={rowStyle}>
            <label htmlFor="settings-layout-mode" style={labelStyle}>
              Layout mode
            </label>
            <select
              id="settings-layout-mode"
              data-testid="layout-mode-select"
              value={layoutMode}
              onChange={(e) => setLayoutMode(e.target.value)}
              {...withFocusRing(controlBase)}
            >
              {LAYOUT_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Editor */}
        <section style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={sectionTitleStyle}>Editor</h3>

          <div style={rowStyle}>
            <label htmlFor="settings-font-size" style={labelStyle}>
              Font size
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <input
                id="settings-font-size"
                data-testid="font-size-input"
                type="range"
                min={12}
                max={24}
                step={1}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                {...withFocusRing({ minHeight: '24px', cursor: 'pointer' })}
              />
              <span data-testid="font-size-value" style={{ ...labelStyle, minWidth: '40px', textAlign: 'right' }}>
                {fontSize}px
              </span>
            </div>
          </div>

          <div style={rowStyle}>
            <label htmlFor="settings-font-family" style={labelStyle}>
              Font family
            </label>
            <select
              id="settings-font-family"
              data-testid="font-family-select"
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              {...withFocusRing(controlBase)}
            >
              <option value="mono">monospace</option>
              <option value="sans">sans-serif</option>
            </select>
          </div>
        </section>

        {/* Hotkey */}
        <section style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={sectionTitleStyle}>Hotkey</h3>
          <div style={rowStyle}>
            <span style={labelStyle}>Global capture shortcut</span>
            <HotkeyCaptureField shortcut={globalShortcut} />
          </div>
        </section>

        {/* Advanced note + Done */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
            Advanced users can edit <code>config.toml</code> directly.
          </p>
          <button
            data-testid="settings-done"
            onClick={close}
            {...withFocusRing({ ...controlBase, background: 'var(--accent-muted)', color: 'var(--accent)' })}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
