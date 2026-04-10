import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useTabStore } from '../store';
import { TabBar } from './TabBar';

describe('TabBar', () => {
  beforeEach(() => {
    useTabStore.getState().reset();
  });

  it('returns null when no tabs are open', () => {
    const { container } = render(<TabBar />);
    expect(container.innerHTML).toBe('');
  });

  it('renders tabs with correct testids', () => {
    useTabStore.setState({
      tabs: [
        { noteId: 1, title: 'First' },
        { noteId: 2, title: 'Second' },
      ],
      activeTabIndex: 0,
    });
    render(<TabBar />);
    expect(screen.getByTestId('tab-bar')).toBeDefined();
    expect(screen.getByTestId('tab-1')).toBeDefined();
    expect(screen.getByTestId('tab-2')).toBeDefined();
  });

  it('renders tablist role on container and tab role on each tab', () => {
    useTabStore.setState({
      tabs: [{ noteId: 1, title: 'Note' }],
      activeTabIndex: 0,
    });
    render(<TabBar />);
    expect(screen.getByRole('tablist')).toBeDefined();
    expect(screen.getByRole('tab')).toBeDefined();
  });

  it('sets aria-selected on active tab only', () => {
    useTabStore.setState({
      tabs: [
        { noteId: 1, title: 'A' },
        { noteId: 2, title: 'B' },
      ],
      activeTabIndex: 1,
    });
    render(<TabBar />);
    expect(screen.getByTestId('tab-1').getAttribute('aria-selected')).toBe('false');
    expect(screen.getByTestId('tab-2').getAttribute('aria-selected')).toBe('true');
  });

  it('active tab has accent bottom border', () => {
    useTabStore.setState({
      tabs: [{ noteId: 1, title: 'Active' }],
      activeTabIndex: 0,
    });
    render(<TabBar />);
    const tab = screen.getByTestId('tab-1');
    expect(tab.style.borderBottom).toContain('var(--accent)');
  });

  it('inactive tab has transparent bottom border', () => {
    useTabStore.setState({
      tabs: [
        { noteId: 1, title: 'A' },
        { noteId: 2, title: 'B' },
      ],
      activeTabIndex: 0,
    });
    render(<TabBar />);
    const inactiveTab = screen.getByTestId('tab-2');
    expect(inactiveTab.style.borderBottom).toContain('transparent');
  });

  it('clicking a tab calls switchTab', () => {
    useTabStore.setState({
      tabs: [
        { noteId: 1, title: 'A' },
        { noteId: 2, title: 'B' },
      ],
      activeTabIndex: 0,
    });
    render(<TabBar />);
    fireEvent.click(screen.getByTestId('tab-2'));
    expect(useTabStore.getState().activeTabIndex).toBe(1);
  });

  it('close button calls closeTab and stops propagation', () => {
    useTabStore.setState({
      tabs: [
        { noteId: 1, title: 'A' },
        { noteId: 2, title: 'B' },
      ],
      activeTabIndex: 0,
    });
    render(<TabBar />);
    // Hover to reveal close button
    fireEvent.mouseEnter(screen.getByTestId('tab-2'));
    const closeBtn = screen.getByLabelText('Close B');
    fireEvent.click(closeBtn);
    // Tab should be closed, not switched to
    expect(useTabStore.getState().tabs).toHaveLength(1);
    expect(useTabStore.getState().tabs[0].noteId).toBe(1);
  });

  it('middle-click on tab closes it', () => {
    useTabStore.setState({
      tabs: [
        { noteId: 1, title: 'A' },
        { noteId: 2, title: 'B' },
      ],
      activeTabIndex: 0,
    });
    render(<TabBar />);
    fireEvent(screen.getByTestId('tab-2'), new MouseEvent('auxclick', { button: 1, bubbles: true }));
    expect(useTabStore.getState().tabs).toHaveLength(1);
    expect(useTabStore.getState().tabs[0].noteId).toBe(1);
  });

  it('displays "New note" for empty title', () => {
    useTabStore.setState({
      tabs: [{ noteId: 1, title: '' }],
      activeTabIndex: 0,
    });
    render(<TabBar />);
    expect(screen.getByText('New note')).toBeDefined();
  });

  it('truncates long titles', () => {
    useTabStore.setState({
      tabs: [{ noteId: 1, title: 'This is a very long title that exceeds twenty characters' }],
      activeTabIndex: 0,
    });
    render(<TabBar />);
    expect(screen.getByText('This is a very long ...')).toBeDefined();
  });

  it('displays "New note" for whitespace-only title', () => {
    useTabStore.setState({
      tabs: [{ noteId: 1, title: '   ' }],
      activeTabIndex: 0,
    });
    render(<TabBar />);
    expect(screen.getByText('New note')).toBeDefined();
  });

  it('renders overflow button when hasOverflow is triggered', () => {
    // Mock ResizeObserver to capture callback
    const originalRO = globalThis.ResizeObserver;
    let roCallback: ResizeObserverCallback | null = null;
    globalThis.ResizeObserver = class {
      constructor(cb: ResizeObserverCallback) { roCallback = cb; }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;

    useTabStore.setState({
      tabs: Array.from({ length: 20 }, (_, i) => ({ noteId: i + 1, title: `Tab ${i + 1}` })),
      activeTabIndex: 0,
    });
    const { container } = render(<TabBar />);

    // Simulate overflow dimensions on the inner flex container
    const tabsContainer = container.querySelector('[data-testid="tab-bar"] > div');
    if (tabsContainer) {
      Object.defineProperty(tabsContainer, 'scrollWidth', { value: 2000, configurable: true });
      Object.defineProperty(tabsContainer, 'clientWidth', { value: 500, configurable: true });
    }

    // Trigger ResizeObserver callback inside act() to flush state update
    act(() => {
      if (roCallback) {
        roCallback([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
      }
    });

    expect(screen.getByTestId('tab-overflow')).toBeDefined();

    globalThis.ResizeObserver = originalRO;
  });
});
