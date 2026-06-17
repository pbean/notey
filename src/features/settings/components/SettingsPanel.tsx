import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../store';
import { clampFontSize } from '../../command-palette/actions';
import { WINDOW_LAYOUT_MODES, normalizeLayoutMode } from '../layoutMode';
import { HotkeyCaptureField } from './HotkeyCaptureField';
import { ShortcutCaptureRow } from './ShortcutCaptureRow';
import { CONFIGURABLE_ACTIONS, RESERVED_ACTIONS, displayShortcut } from '../shortcuts';
import { useFocusTrap } from '../../../lib/useFocusTrap';

/** Restore focus to the editor when the overlay closes. */
function focusEditor(): void {
  document.querySelector<HTMLElement>('.cm-content')?.focus();
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
  const setAutostart = useSettingsStore((s) => s.setAutostart);
  const overlayRef = useRef<HTMLDivElement>(null);
  const firstControlRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(overlayRef, true);

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

  const theme = config?.general?.theme ?? 'dark';
  // Legacy density values ('comfortable'/'compact') normalize to 'floating'.
  const layoutMode = normalizeLayoutMode(config?.general?.layoutMode);
  const fontSize = clampFontSize(config?.editor?.fontSize ?? 14);
  const fontFamily = config?.editor?.fontFamily === 'sans' ? 'sans' : 'mono';
  const globalShortcut = config?.hotkey?.globalShortcut ?? 'Ctrl+Shift+N';
  const autoStart = config?.general?.autoStart ?? false;

  return (
    <div
      ref={overlayRef}
      data-testid="settings-overlay"
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
                    style={{
                      ...controlBase,
                      textTransform: 'capitalize',
                      background: active ? 'var(--accent-muted)' : 'var(--bg-surface)',
                      color: active ? 'var(--accent)' : 'var(--text-primary)',
                      fontWeight: active ? 600 : 400,
                    }}
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
              style={controlBase}
            >
              {WINDOW_LAYOUT_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div style={rowStyle}>
            <span id="settings-autostart-label" style={labelStyle}>
              Start on login
            </span>
            <button
              type="button"
              role="switch"
              data-testid="autostart-toggle"
              aria-checked={autoStart}
              aria-labelledby="settings-autostart-label"
              onClick={() => void setAutostart(!autoStart)}
              style={{
                ...controlBase,
                background: autoStart ? 'var(--accent-muted)' : 'var(--bg-surface)',
                color: autoStart ? 'var(--accent)' : 'var(--text-primary)',
                fontWeight: autoStart ? 600 : 400,
              }}
            >
              {autoStart ? 'On' : 'Off'}
            </button>
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
                style={{ minHeight: '24px', cursor: 'pointer' }}
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
              style={controlBase}
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

        {/* Shortcuts */}
        <section style={{ marginBottom: 'var(--space-6)' }} aria-label="Keyboard shortcuts">
          <h3 style={sectionTitleStyle}>Shortcuts</h3>
          {CONFIGURABLE_ACTIONS.map((action) => (
            <ShortcutCaptureRow key={action.id} action={action} />
          ))}
          {RESERVED_ACTIONS.map((reserved) => (
            <div key={reserved.id} style={rowStyle}>
              <span style={labelStyle}>{reserved.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <kbd
                  data-testid={`reserved-shortcut-${reserved.id}`}
                  style={{ ...controlBase, cursor: 'default' }}
                >
                  {displayShortcut(reserved.binding)}
                </kbd>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Reserved</span>
              </div>
            </div>
          ))}
        </section>

        {/* Advanced note + Done */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
            Advanced users can edit <code>config.toml</code> directly.
          </p>
          <button
            data-testid="settings-done"
            onClick={close}
            style={{ ...controlBase, background: 'var(--accent-muted)', color: 'var(--accent)' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
