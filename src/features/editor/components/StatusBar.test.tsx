import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useEditorStore } from '../store';
import { useWorkspaceStore } from '../../workspace/store';
import { StatusBar } from './StatusBar';

const MOCK_WORKSPACES = [
  { id: 1, name: 'my-project', path: '/p', createdAt: '2026-01-01T00:00:00+00:00', noteCount: 4 },
  { id: 2, name: 'other', path: '/o', createdAt: '2026-01-02T00:00:00+00:00', noteCount: 6 },
];

describe('StatusBar', () => {
  beforeEach(() => {
    useEditorStore.getState().resetNote();
    useWorkspaceStore.setState({
      activeWorkspaceId: null,
      activeWorkspaceName: null,
      workspaces: [],
      isAllWorkspaces: false,
      filteredNotes: [],
      isLoadingNotes: false,
    });
  });

  it('renders "No workspace" when no workspace is active', () => {
    render(<StatusBar />);
    expect(screen.getByTestId('workspace-name')).toHaveTextContent('No workspace');
  });

  it('renders workspace name with note count in "[name] \u00b7 [N] notes" format', () => {
    const mockNotes = Array.from({ length: 4 }, (_, i) => ({
      id: i + 1, title: `Note ${i}`, content: '', format: 'markdown',
      workspaceId: 1, createdAt: '2026-01-01T00:00:00+00:00',
      updatedAt: '2026-01-01T00:00:00+00:00', deletedAt: null, isTrashed: false,
    }));
    useWorkspaceStore.setState({
      activeWorkspaceId: 1,
      activeWorkspaceName: 'my-project',
      workspaces: MOCK_WORKSPACES,
      filteredNotes: mockNotes,
    });
    render(<StatusBar />);
    expect(screen.getByTestId('workspace-name')).toHaveTextContent('my-project \u00b7 4 notes');
  });

  it('renders "All Workspaces" with total note count when isAllWorkspaces is true', () => {
    const mockNotes = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1, title: `Note ${i}`, content: '', format: 'markdown',
      workspaceId: i < 4 ? 1 : 2, createdAt: '2026-01-01T00:00:00+00:00',
      updatedAt: '2026-01-01T00:00:00+00:00', deletedAt: null, isTrashed: false,
    }));
    useWorkspaceStore.setState({
      isAllWorkspaces: true,
      activeWorkspaceId: null,
      activeWorkspaceName: null,
      workspaces: MOCK_WORKSPACES,
      filteredNotes: mockNotes,
    });
    render(<StatusBar />);
    expect(screen.getByTestId('workspace-name')).toHaveTextContent('All Workspaces \u00b7 10 notes');
  });

  it('renders singular "1 note" for single note count', () => {
    const singleNote = {
      id: 1, title: 'Solo', content: '', format: 'markdown',
      workspaceId: 1, createdAt: '2026-01-01T00:00:00+00:00',
      updatedAt: '2026-01-01T00:00:00+00:00', deletedAt: null, isTrashed: false,
    };
    useWorkspaceStore.setState({
      activeWorkspaceId: 1,
      activeWorkspaceName: 'my-project',
      workspaces: MOCK_WORKSPACES,
      filteredNotes: [singleNote],
    });
    render(<StatusBar />);
    expect(screen.getByTestId('workspace-name')).toHaveTextContent('my-project \u00b7 1 note');
    // Verify it's NOT "1 notes" (plural)
    expect(screen.getByTestId('workspace-name').textContent).not.toContain('1 notes');
  });

  it('workspace trigger is clickable (button element)', () => {
    useWorkspaceStore.setState({
      activeWorkspaceId: 1,
      activeWorkspaceName: 'my-project',
      workspaces: MOCK_WORKSPACES,
    });
    render(<StatusBar />);
    const trigger = screen.getByTestId('workspace-name');
    expect(trigger.tagName).toBe('BUTTON');
  });

  it('renders format toggle showing current format', () => {
    render(<StatusBar />);
    expect(screen.getByText('Markdown')).toBeDefined();
  });

  it('has status role for accessibility', () => {
    render(<StatusBar />);
    expect(screen.getByRole('status')).toBeDefined();
  });
});
