import { commands } from '../../../generated/bindings';
import { useEditorStore } from '../store';
import { SaveIndicator } from './SaveIndicator';
import { WorkspaceSelector } from '../../workspace/components/WorkspaceSelector';
import { useOnboardingStore } from '../../onboarding/store';
import type { NoteFormat } from '../store';

/**
 * Fixed 24px status bar. Left: workspace selector dropdown. Right: save indicator
 * and clickable format toggle (Markdown / Plain text).
 */
export function StatusBar() {
  const format = useEditorStore((s) => s.format);
  const activeNoteId = useEditorStore((s) => s.activeNoteId);
  const setFormat = useEditorStore((s) => s.setFormat);
  // Progressive disclosure (Story 8.1): show a "Ctrl+P for commands" hint during
  // the user's first 5 sessions, then retire it permanently.
  const showCommandHint = useOnboardingStore((s) => s.shouldShowCommandHint());

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
      <WorkspaceSelector />
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {showCommandHint && (
          <span
            data-testid="command-hint"
            style={{
              color: 'var(--text-muted)',
              fontSize: '11px',
              marginRight: 'var(--space-3)',
            }}
          >
            Ctrl+P for commands
          </span>
        )}
        <SaveIndicator />
        <button
          onClick={() => void handleFormatToggle()}
          style={{
            color: 'var(--text-secondary)',
            fontSize: '11px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            // Use an explicit 24px target so the hit area does not depend on the
            // height of this wrapper.
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            padding: 0,
          }}
        >
          {format === 'markdown' ? 'Markdown' : 'Plain text'}
        </button>
      </div>
    </div>
  );
}
