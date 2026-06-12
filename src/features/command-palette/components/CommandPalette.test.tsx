import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { useCommandPaletteStore } from '../store';
import { CommandPalette } from './CommandPalette';
import { useNoteListStore } from '../../note-list/store';
import { useTrashStore } from '../../trash/store';

// cmdk uses ResizeObserver internally, which jsdom does not provide
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// cmdk calls scrollIntoView on items, which jsdom does not implement
Element.prototype.scrollIntoView = function () {};

describe('CommandPalette', () => {
  beforeEach(() => {
    useCommandPaletteStore.getState().resetCommandPalette();
    useNoteListStore.getState().resetNoteList();
    useTrashStore.getState().resetTrash();
  });

  it('does not render content when closed', () => {
    render(<CommandPalette />);
    expect(screen.queryByTestId('command-palette')).toBeNull();
  });

  it('renders with data-testid attributes when open', async () => {
    act(() => useCommandPaletteStore.getState().open());
    render(<CommandPalette />);
    await waitFor(() => {
      expect(screen.getByTestId('command-palette')).toBeDefined();
      expect(screen.getByTestId('command-input')).toBeDefined();
    });
  });

  it('renders command groups', async () => {
    act(() => useCommandPaletteStore.getState().open());
    render(<CommandPalette />);
    await waitFor(() => {
      expect(screen.getByText('Actions')).toBeDefined();
      expect(screen.getByText('Settings')).toBeDefined();
      expect(screen.getByText('Navigation')).toBeDefined();
    });
  });

  it('renders registered commands with labels', async () => {
    act(() => useCommandPaletteStore.getState().open());
    render(<CommandPalette />);
    await waitFor(() => {
      expect(screen.getByText('New Note')).toBeDefined();
      expect(screen.getByText('Search Notes')).toBeDefined();
      expect(screen.getByText('Toggle Theme')).toBeDefined();
      expect(screen.getByText('Open Note List')).toBeDefined();
      expect(screen.getByText('Toggle Format')).toBeDefined();
      expect(screen.getByText('View Trash')).toBeDefined();
    });
  });

  it('has ">" prefix in input placeholder', async () => {
    act(() => useCommandPaletteStore.getState().open());
    render(<CommandPalette />);
    await waitFor(() => {
      const input = screen.getByTestId('command-input');
      expect(input.getAttribute('placeholder')).toContain('>');
    });
  });

  it('closes when Escape is pressed', async () => {
    act(() => useCommandPaletteStore.getState().open());
    render(<CommandPalette />);
    await waitFor(() => {
      expect(screen.getByTestId('command-palette')).toBeDefined();
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(useCommandPaletteStore.getState().isOpen).toBe(false);
    });
  });

  it('opens trash and closes the palette when View Trash is selected', async () => {
    act(() => {
      useNoteListStore.getState().open();
      useCommandPaletteStore.getState().open();
    });
    render(<CommandPalette />);

    await waitFor(() => {
      expect(screen.getByText('View Trash')).toBeDefined();
    });

    fireEvent.click(screen.getByText('View Trash'));

    await waitFor(() => {
      expect(useCommandPaletteStore.getState().isOpen).toBe(false);
      expect(useNoteListStore.getState().isOpen).toBe(false);
      expect(useTrashStore.getState().isOpen).toBe(true);
    });
  });

  it('calls action and closes when a stub command is selected', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    act(() => useCommandPaletteStore.getState().open());
    render(<CommandPalette />);

    await waitFor(() => {
      expect(screen.getByText('Open Settings')).toBeDefined();
    });

    // cmdk handles selection via click on the item
    fireEvent.click(screen.getByText('Open Settings'));

    await waitFor(() => {
      expect(useCommandPaletteStore.getState().isOpen).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith('Not yet implemented: Open Settings');
    });

    warnSpy.mockRestore();
  });
});
