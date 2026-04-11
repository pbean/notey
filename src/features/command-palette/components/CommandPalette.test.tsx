import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { useCommandPaletteStore } from '../store';
import { CommandPalette } from './CommandPalette';

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

  it('calls action and closes when a command is selected', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    act(() => useCommandPaletteStore.getState().open());
    render(<CommandPalette />);

    await waitFor(() => {
      expect(screen.getByText('View Trash')).toBeDefined();
    });

    // cmdk handles selection via click on the item
    fireEvent.click(screen.getByText('View Trash'));

    await waitFor(() => {
      expect(useCommandPaletteStore.getState().isOpen).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith('Not yet implemented: View Trash');
    });

    warnSpy.mockRestore();
  });
});
