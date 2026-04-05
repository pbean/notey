import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useWorkspaceStore } from '../store';
import { WorkspaceSelector } from './WorkspaceSelector';

const MOCK_WORKSPACES = [
  { id: 1, name: 'alpha', path: '/a', createdAt: '2026-01-01T00:00:00+00:00', noteCount: 1 },
  { id: 2, name: 'beta', path: '/b', createdAt: '2026-01-02T00:00:00+00:00', noteCount: 7 },
];

const MOCK_FILTERED_NOTE = { id: 1, title: 'Note', content: '', format: 'markdown', workspaceId: 1, createdAt: '2026-01-01T00:00:00+00:00', updatedAt: '2026-01-01T00:00:00+00:00', deletedAt: null, isTrashed: false };

describe('WorkspaceSelector', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      activeWorkspaceId: 1,
      activeWorkspaceName: 'alpha',
      workspaces: MOCK_WORKSPACES,
      isAllWorkspaces: false,
      filteredNotes: [MOCK_FILTERED_NOTE],
      isLoadingNotes: false,
    });
  });

  it('renders active workspace name and note count', () => {
    render(<WorkspaceSelector />);
    expect(screen.getByTestId('workspace-name')).toHaveTextContent('alpha \u00b7 1 note');
  });

  it('renders "All Workspaces" with filtered note count when isAllWorkspaces is true', () => {
    useWorkspaceStore.setState({
      isAllWorkspaces: true,
      activeWorkspaceId: null,
      activeWorkspaceName: null,
      filteredNotes: [MOCK_FILTERED_NOTE, { ...MOCK_FILTERED_NOTE, id: 2 }],
    });
    render(<WorkspaceSelector />);
    expect(screen.getByTestId('workspace-name')).toHaveTextContent('All Workspaces \u00b7 2 notes');
  });

  it('renders "No workspace" when no workspace is active and not all-workspaces mode', () => {
    useWorkspaceStore.setState({ activeWorkspaceId: null, activeWorkspaceName: null, isAllWorkspaces: false, filteredNotes: [] });
    render(<WorkspaceSelector />);
    expect(screen.getByTestId('workspace-name')).toHaveTextContent('No workspace');
  });

  it('renders active workspace with 0 notes showing "0 notes"', () => {
    useWorkspaceStore.setState({
      activeWorkspaceId: 1,
      activeWorkspaceName: 'alpha',
      filteredNotes: [],
    });
    render(<WorkspaceSelector />);
    expect(screen.getByTestId('workspace-name')).toHaveTextContent('alpha \u00b7 0 notes');
  });

  it('has aria-label for accessibility', () => {
    render(<WorkspaceSelector />);
    expect(screen.getByLabelText('Workspace selector')).toBeDefined();
  });

  it('calls loadWorkspaces when dropdown opens', async () => {
    const loadSpy = vi.fn();
    useWorkspaceStore.setState({ loadWorkspaces: loadSpy });

    render(<WorkspaceSelector />);
    fireEvent.click(screen.getByTestId('workspace-name'));

    await waitFor(() => {
      expect(loadSpy).toHaveBeenCalled();
    });
  });

  it('renders all workspaces and "All Workspaces" option in dropdown with note counts', async () => {
    render(<WorkspaceSelector />);
    fireEvent.click(screen.getByTestId('workspace-name'));

    await waitFor(() => {
      const items = screen.getAllByRole('menuitem');
      expect(items.length).toBe(3); // "All Workspaces" + 2 workspaces
      expect(items[0]).toHaveTextContent('All Workspaces · 8 notes');
      expect(items[1]).toHaveTextContent('alpha · 1 note');
      expect(items[2]).toHaveTextContent('beta · 7 notes');
    });
  });

  it('shows check icon next to the active workspace in dropdown', async () => {
    render(<WorkspaceSelector />);
    fireEvent.click(screen.getByTestId('workspace-name'));

    await waitFor(() => {
      const items = screen.getAllByRole('menuitem');
      // Active workspace (alpha, id=1) should have a check icon; beta should not
      const alphaIcon = items[1].querySelector('svg');
      const betaIcon = items[2].querySelector('svg');
      expect(alphaIcon).not.toBeNull();
      expect(betaIcon).toBeNull();
    });
  });

  it('shows check icon next to "All Workspaces" when isAllWorkspaces is true', async () => {
    useWorkspaceStore.setState({ isAllWorkspaces: true, activeWorkspaceId: null, activeWorkspaceName: null, filteredNotes: [] });
    render(<WorkspaceSelector />);
    fireEvent.click(screen.getByTestId('workspace-name'));

    await waitFor(() => {
      const items = screen.getAllByRole('menuitem');
      // "All Workspaces" item should have a check icon
      const allWsIcon = items[0].querySelector('svg');
      expect(allWsIcon).not.toBeNull();
      // Individual workspaces should NOT have check icons
      const alphaIcon = items[1].querySelector('svg');
      const betaIcon = items[2].querySelector('svg');
      expect(alphaIcon).toBeNull();
      expect(betaIcon).toBeNull();
    });
  });

  it('calls setActiveWorkspace when a workspace is selected', async () => {
    const setActiveSpy = vi.fn();
    useWorkspaceStore.setState({ setActiveWorkspace: setActiveSpy });

    render(<WorkspaceSelector />);
    fireEvent.click(screen.getByTestId('workspace-name'));

    await waitFor(() => {
      expect(screen.getAllByRole('menuitem').length).toBe(3);
    });

    // Click the beta workspace menu item (index 2: "All Workspaces", alpha, beta)
    const items = screen.getAllByRole('menuitem');
    fireEvent.click(items[2]);

    await waitFor(() => {
      expect(setActiveSpy).toHaveBeenCalledWith(2);
    });
  });

  it('calls setAllWorkspaces when "All Workspaces" is selected', async () => {
    const setAllSpy = vi.fn();
    useWorkspaceStore.setState({ setAllWorkspaces: setAllSpy });

    render(<WorkspaceSelector />);
    fireEvent.click(screen.getByTestId('workspace-name'));

    await waitFor(() => {
      expect(screen.getAllByRole('menuitem').length).toBe(3);
    });

    // Click the "All Workspaces" menu item (first item)
    const items = screen.getAllByRole('menuitem');
    fireEvent.click(items[0]);

    await waitFor(() => {
      expect(setAllSpy).toHaveBeenCalled();
    });
  });
});
