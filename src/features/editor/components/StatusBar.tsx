import { commands } from '../../../generated/bindings';
import { useEditorStore } from '../store';
import { SaveIndicator } from './SaveIndicator';
import type { NoteFormat } from '../store';

/**
 * Fixed 24px status bar. Left: workspace name. Right: save indicator
 * and clickable format toggle (Markdown / Plain text).
 */
export function StatusBar() {
  const format = useEditorStore((s) => s.format);
  const activeNoteId = useEditorStore((s) => s.activeNoteId);
  const setFormat = useEditorStore((s) => s.setFormat);

  async function handleFormatToggle() {
    const newFormat: NoteFormat = format === 'markdown' ? 'plaintext' : 'markdown';
    setFormat(newFormat);
    if (activeNoteId !== null) {
      const result = await commands.updateNote(activeNoteId, null, null, newFormat);
      if (result.status === 'error') {
        // Revert optimistic update on failure
        setFormat(format);
        console.error('updateNote (format) failed:', result.error);
      }
    }
  }

  return (
    <div
      data-testid="status-bar"
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
      <span
        data-testid="workspace-name"
        style={{ color: 'var(--text-secondary)', fontSize: '11px' }}
      >
        Default workspace
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <SaveIndicator />
        <button
          onClick={handleFormatToggle}
          style={{
            color: 'var(--text-secondary)',
            fontSize: '11px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {format === 'markdown' ? 'Markdown' : 'Plain text'}
        </button>
      </div>
    </div>
  );
}
