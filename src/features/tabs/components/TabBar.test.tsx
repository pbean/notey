import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useTabStore } from '../store';
import { TabBar } from './TabBar';

/**
 * Mock getBoundingClientRect for tab elements. Each tab-{noteId} element
 * gets a rect based on its DOM order within [role="tablist"]. 100px per tab.
 * Must be installed before dragOver fires (survives React re-renders).
 */
function installTabRectMock() {
  const original = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const testId = this.getAttribute('data-testid');
    if (testId?.startsWith('tab-') && this.getAttribute('role') === 'tab') {
      const tablist = this.closest('[role="tablist"]');
      if (tablist) {
        const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
        const idx = tabs.indexOf(this);
        if (idx >= 0) {
          return {
            left: idx * 100, right: (idx + 1) * 100, width: 100,
            top: 0, bottom: 32, height: 32,
            x: idx * 100, y: 0, toJSON: () => {},
          } as DOMRect;
        }
      }
    }
    return original.call(this);
  });
}

/**
 * Create a drag event with proper clientX. jsdom has no DragEvent constructor,
 * so fireEvent.dragOver/drop produce events with undefined clientX. We create
 * a MouseEvent and attach a dataTransfer property.
 */
function dispatchDrag(el: HTMLElement, type: string, opts: { clientX: number; dataTransfer?: Record<string, unknown> }) {
  const event = new MouseEvent(type, { clientX: opts.clientX, bubbles: true, cancelable: true });
  if (opts.dataTransfer) {
    Object.defineProperty(event, 'dataTransfer', { value: opts.dataTransfer });
  }
  act(() => { el.dispatchEvent(event); });
}

describe('TabBar', () => {
  beforeEach(() => {
    useTabStore.getState().reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  // --- Drag-and-drop tests ---

  it('tabs have draggable="true" when multiple tabs are open', () => {
    useTabStore.setState({
      tabs: [
        { noteId: 1, title: 'A' },
        { noteId: 2, title: 'B' },
      ],
      activeTabIndex: 0,
    });
    render(<TabBar />);
    expect(screen.getByTestId('tab-1').getAttribute('draggable')).toBe('true');
    expect(screen.getByTestId('tab-2').getAttribute('draggable')).toBe('true');
  });

  it('single tab has draggable="false"', () => {
    useTabStore.setState({
      tabs: [{ noteId: 1, title: 'Solo' }],
      activeTabIndex: 0,
    });
    render(<TabBar />);
    expect(screen.getByTestId('tab-1').getAttribute('draggable')).toBe('false');
  });

  it('dragStart sets dragged tab to reduced opacity', () => {
    useTabStore.setState({
      tabs: [
        { noteId: 1, title: 'A' },
        { noteId: 2, title: 'B' },
        { noteId: 3, title: 'C' },
      ],
      activeTabIndex: 0,
    });
    render(<TabBar />);
    const tab1 = screen.getByTestId('tab-1');

    fireEvent.dragStart(tab1, {
      dataTransfer: { effectAllowed: '', setData: () => {} },
    });

    expect(tab1.style.opacity).toBe('0.5');
  });

  it('drop calls reorderTabs with correct indices', () => {
    useTabStore.setState({
      tabs: [
        { noteId: 1, title: 'A' },
        { noteId: 2, title: 'B' },
        { noteId: 3, title: 'C' },
      ],
      activeTabIndex: 0,
    });
    render(<TabBar />);

    const tabBar = screen.getByTestId('tab-bar');
    const container = tabBar.firstElementChild as HTMLElement;
    installTabRectMock();

    const tab1 = screen.getByTestId('tab-1');

    // Start drag from index 0
    fireEvent.dragStart(tab1, {
      dataTransfer: { effectAllowed: '', setData: () => {} },
    });

    // Drag over — cursor past midpoint of tab-3 (index 2, midpoint at 250px)
    dispatchDrag(container, 'dragover', { clientX: 260, dataTransfer: { dropEffect: '' } });

    // Drop — provide getData returning the source index
    dispatchDrag(container, 'drop', { clientX: 260, dataTransfer: { dropEffect: '', getData: () => '0' } });

    // Tab A (noteId 1) should have moved to end: [B, C, A]
    const newTabs = useTabStore.getState().tabs;
    expect(newTabs[0].noteId).toBe(2);
    expect(newTabs[2].noteId).toBe(1);
  });

  it('dragEnd clears drop indicator', () => {
    useTabStore.setState({
      tabs: [
        { noteId: 1, title: 'A' },
        { noteId: 2, title: 'B' },
      ],
      activeTabIndex: 0,
    });
    render(<TabBar />);

    const tabBar = screen.getByTestId('tab-bar');
    const container = tabBar.firstElementChild as HTMLElement;
    installTabRectMock();

    const tab1 = screen.getByTestId('tab-1');

    fireEvent.dragStart(tab1, {
      dataTransfer: { effectAllowed: '', setData: () => {} },
    });

    dispatchDrag(container, 'dragover', { clientX: 150, dataTransfer: { dropEffect: '' } });

    // Indicator should be visible during drag
    expect(screen.queryByTestId('tab-drop-indicator')).not.toBeNull();

    // End drag
    fireEvent.dragEnd(tab1);

    // Indicator should be gone
    expect(screen.queryByTestId('tab-drop-indicator')).toBeNull();
  });

  it('same-position drop does not reorder', () => {
    useTabStore.setState({
      tabs: [
        { noteId: 1, title: 'A' },
        { noteId: 2, title: 'B' },
        { noteId: 3, title: 'C' },
      ],
      activeTabIndex: 0,
    });
    render(<TabBar />);

    const tabBar = screen.getByTestId('tab-bar');
    const container = tabBar.firstElementChild as HTMLElement;
    installTabRectMock();

    const tab2 = screen.getByTestId('tab-2');

    // Start drag from index 1
    fireEvent.dragStart(tab2, {
      dataTransfer: { effectAllowed: '', setData: () => {} },
    });

    // Drag over same position (index 1, midpoint at 150px — cursor in left half)
    dispatchDrag(container, 'dragover', { clientX: 140, dataTransfer: { dropEffect: '' } });

    // Drop at same position
    dispatchDrag(container, 'drop', { clientX: 140, dataTransfer: { dropEffect: '', getData: () => '1' } });

    // Order should be unchanged
    const tabs = useTabStore.getState().tabs;
    expect(tabs[0].noteId).toBe(1);
    expect(tabs[1].noteId).toBe(2);
    expect(tabs[2].noteId).toBe(3);
  });

  it('active tab stays active after being dragged to new position', () => {
    useTabStore.setState({
      tabs: [
        { noteId: 1, title: 'A' },
        { noteId: 2, title: 'B' },
        { noteId: 3, title: 'C' },
      ],
      activeTabIndex: 0,
    });
    render(<TabBar />);

    const tabBar = screen.getByTestId('tab-bar');
    const container = tabBar.firstElementChild as HTMLElement;
    installTabRectMock();

    const tab1 = screen.getByTestId('tab-1');

    // Start drag from index 0 (active tab)
    fireEvent.dragStart(tab1, {
      dataTransfer: { effectAllowed: '', setData: () => {} },
    });

    // Drag past all tabs (cursor at 350px, past tab-3's right edge at 300px)
    dispatchDrag(container, 'dragover', { clientX: 350, dataTransfer: { dropEffect: '' } });

    // Drop — provide getData returning the source index
    dispatchDrag(container, 'drop', { clientX: 350, dataTransfer: { dropEffect: '', getData: () => '0' } });

    // Active tab should follow noteId 1
    const state = useTabStore.getState();
    const activeTab = state.tabs[state.activeTabIndex!];
    expect(activeTab.noteId).toBe(1);
  });

  it('click-to-switch still works alongside draggable', () => {
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
    // Story 7.8 (WCAG 2.1 AA): the overflow trigger must expose an accessible
    // name and present a ≥24px-tall target.
    const overflow = screen.getByTestId('tab-overflow');
    expect(overflow.getAttribute('aria-label')).toBe('More tabs');
    expect(overflow.style.minHeight).toBe('24px');

    globalThis.ResizeObserver = originalRO;
  });

  describe('accessibility targets & affordances (Story 7.8)', () => {
    it('close button presents a ≥24px-tall target', () => {
      useTabStore.setState({
        tabs: [{ noteId: 1, title: 'A' }],
        activeTabIndex: 0,
      });
      render(<TabBar />);
      const closeBtn = screen.getByLabelText('Close A') as HTMLButtonElement;
      expect(closeBtn.style.height).toBe('24px');
      expect(closeBtn.style.display).toBe('flex');
    });

    it('active tab is distinguished by border + aria-selected, not color alone', () => {
      useTabStore.setState({
        tabs: [
          { noteId: 1, title: 'A' },
          { noteId: 2, title: 'B' },
        ],
        activeTabIndex: 0,
      });
      render(<TabBar />);
      const active = screen.getByTestId('tab-1');
      // Non-color affordance: a visible bottom border distinguishes the active tab.
      expect(active.style.borderBottom).toContain('2px solid');
      expect(active.style.borderBottom).toContain('var(--accent)');
      expect(active.getAttribute('aria-selected')).toBe('true');
      // Inactive tab carries neither affordance.
      const inactive = screen.getByTestId('tab-2');
      expect(inactive.style.borderBottom).toContain('transparent');
      expect(inactive.getAttribute('aria-selected')).toBe('false');
    });
  });

  describe('keyboard navigation (Story 7.7)', () => {
    const threeTabs = () =>
      useTabStore.setState({
        tabs: [
          { noteId: 1, title: 'A' },
          { noteId: 2, title: 'B' },
          { noteId: 3, title: 'C' },
        ],
        activeTabIndex: 1,
      });

    it('roving tabindex: only the active tab is in the Tab sequence', () => {
      threeTabs();
      render(<TabBar />);
      expect(screen.getByTestId('tab-1').getAttribute('tabindex')).toBe('-1');
      expect(screen.getByTestId('tab-2').getAttribute('tabindex')).toBe('0');
      expect(screen.getByTestId('tab-3').getAttribute('tabindex')).toBe('-1');
    });

    it('ArrowRight moves focus to the next tab without activating it', () => {
      threeTabs();
      render(<TabBar />);
      const active = screen.getByTestId('tab-2');
      active.focus();
      fireEvent.keyDown(active, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(screen.getByTestId('tab-3'));
      expect(useTabStore.getState().activeTabIndex).toBe(1);
      expect(screen.getByTestId('tab-3').getAttribute('tabindex')).toBe('0');
    });

    it('ArrowLeft moves focus to the previous tab without activating it', () => {
      threeTabs();
      render(<TabBar />);
      const active = screen.getByTestId('tab-2');
      active.focus();
      fireEvent.keyDown(active, { key: 'ArrowLeft' });
      expect(document.activeElement).toBe(screen.getByTestId('tab-1'));
      expect(useTabStore.getState().activeTabIndex).toBe(1);
    });

    it('ArrowRight wraps from the last tab to the first', () => {
      useTabStore.setState({
        tabs: [
          { noteId: 1, title: 'A' },
          { noteId: 2, title: 'B' },
        ],
        activeTabIndex: 1,
      });
      render(<TabBar />);
      const last = screen.getByTestId('tab-2');
      last.focus();
      fireEvent.keyDown(last, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(screen.getByTestId('tab-1'));
      expect(useTabStore.getState().activeTabIndex).toBe(1);
    });

    it('Home and End jump to the first and last tab', () => {
      threeTabs();
      render(<TabBar />);
      const active = screen.getByTestId('tab-2');
      active.focus();
      fireEvent.keyDown(active, { key: 'End' });
      expect(document.activeElement).toBe(screen.getByTestId('tab-3'));
      expect(useTabStore.getState().activeTabIndex).toBe(1);
      fireEvent.keyDown(screen.getByTestId('tab-3'), { key: 'Home' });
      expect(document.activeElement).toBe(screen.getByTestId('tab-1'));
      expect(useTabStore.getState().activeTabIndex).toBe(1);
    });

    it('Enter activates the focused tab', () => {
      threeTabs();
      render(<TabBar />);
      const active = screen.getByTestId('tab-2');
      active.focus();
      fireEvent.keyDown(active, { key: 'ArrowRight' });
      fireEvent.keyDown(screen.getByTestId('tab-3'), { key: 'Enter' });
      expect(useTabStore.getState().activeTabIndex).toBe(2);
    });

    it('Delete closes the focused tab and keeps focus in the tablist', () => {
      threeTabs();
      render(<TabBar />);
      const active = screen.getByTestId('tab-2');
      active.focus();
      fireEvent.keyDown(active, { key: 'ArrowRight' });
      fireEvent.keyDown(screen.getByTestId('tab-3'), { key: 'Delete' });
      expect(useTabStore.getState().tabs.map((t) => t.noteId)).toEqual([1, 2]);
      expect(document.activeElement).toBe(screen.getByTestId('tab-2'));
    });

    it('the close button is excluded from the Tab sequence', () => {
      threeTabs();
      render(<TabBar />);
      const closeBtn = screen.getByLabelText('Close B');
      expect(closeBtn.getAttribute('tabindex')).toBe('-1');
    });

    it('the active tab exposes its close button without hovering', () => {
      threeTabs();
      render(<TabBar />);
      const closeBtn = screen.getByLabelText('Close B') as HTMLButtonElement;
      expect(closeBtn.style.visibility).toBe('visible');
    });

    it('scrolls the newly focused tab into view during roving navigation', () => {
      threeTabs();
      const scrollSpy = vi.fn();
      Object.defineProperty(Element.prototype, 'scrollIntoView', {
        configurable: true,
        value: scrollSpy,
      });
      render(<TabBar />);
      const active = screen.getByTestId('tab-2');
      active.focus();
      fireEvent.keyDown(active, { key: 'ArrowRight' });
      expect(scrollSpy).toHaveBeenCalled();
    });
  });
});
