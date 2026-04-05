import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useEditorStore } from '../store';
import { useWorkspaceStore } from '../../workspace/store';
import { StatusBar } from './StatusBar';

describe('StatusBar', () => {
  beforeEach(() => {
    useEditorStore.getState().resetNote();
    useWorkspaceStore.setState({ activeWorkspaceId: null, activeWorkspaceName: null });
  });

  it('renders "No workspace" when no workspace is active', () => {
    render(<StatusBar />);
    expect(screen.getByTestId('workspace-name')).toHaveTextContent('No workspace');
  });

  it('renders workspace name from store', () => {
    useWorkspaceStore.getState().setActiveWorkspace(1, 'my-project');
    render(<StatusBar />);
    expect(screen.getByTestId('workspace-name')).toHaveTextContent('my-project');
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
