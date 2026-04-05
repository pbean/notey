import { Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useWorkspaceStore } from '../store';

/**
 * Workspace selector dropdown for the StatusBar.
 * Shows the current workspace name + note count and opens a dropdown
 * to switch between workspaces or view all workspaces.
 */
export function WorkspaceSelector() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const activeWorkspaceName = useWorkspaceStore((s) => s.activeWorkspaceName);
  const isAllWorkspaces = useWorkspaceStore((s) => s.isAllWorkspaces);
  const filteredNotes = useWorkspaceStore((s) => s.filteredNotes);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const setAllWorkspaces = useWorkspaceStore((s) => s.setAllWorkspaces);
  const loadWorkspaces = useWorkspaceStore((s) => s.loadWorkspaces);

  const totalNoteCount = workspaces.reduce((sum, ws) => sum + ws.noteCount, 0);

  const noteLabel = (n: number) => (n === 1 ? 'note' : 'notes');

  let displayText: string;
  if (isAllWorkspaces) {
    displayText = `All Workspaces \u00b7 ${filteredNotes.length} ${noteLabel(filteredNotes.length)}`;
  } else if (activeWorkspaceName) {
    displayText = `${activeWorkspaceName} \u00b7 ${filteredNotes.length} ${noteLabel(filteredNotes.length)}`;
  } else {
    displayText = 'No workspace';
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) loadWorkspaces();
      }}
    >
      <DropdownMenuTrigger
        data-testid="workspace-name"
        aria-label="Workspace selector"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontSize: '11px',
          padding: 0,
          fontFamily: 'inherit',
        }}
      >
        {displayText}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" sideOffset={4} style={{ minWidth: '200px' }}>
        <DropdownMenuItem onClick={() => setAllWorkspaces()} aria-current={isAllWorkspaces || undefined}>
          <span style={{ width: 12, display: 'inline-flex', flexShrink: 0 }}>
            {isAllWorkspaces && <Check size={12} />}
          </span>
          All Workspaces &middot; {totalNoteCount} {noteLabel(totalNoteCount)}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {workspaces.map((ws) => {
          const isActive = ws.id === activeWorkspaceId && !isAllWorkspaces;
          return (
            <DropdownMenuItem key={ws.id} onClick={() => setActiveWorkspace(ws.id)} aria-current={isActive || undefined}>
              <span style={{ width: 12, display: 'inline-flex', flexShrink: 0 }}>
                {isActive && <Check size={12} />}
              </span>
              {ws.name} &middot; {ws.noteCount} {noteLabel(ws.noteCount)}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
