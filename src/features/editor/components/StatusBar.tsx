import { useEditorStore } from '../store';

/**
 * Fixed 24px status bar showing workspace context (left) and
 * note format label (right). Save indicator added in Story 1.9.
 */
export function StatusBar() {
  const format = useEditorStore((s) => s.format);

  return (
    <div
      role="status"
      style={{
        height: '24px',
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-3)',
        flexShrink: 0,
      }}
    >
      <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
        Default workspace
      </span>
      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
        {format === 'markdown' ? 'Markdown' : 'Plain text'}
      </span>
    </div>
  );
}
