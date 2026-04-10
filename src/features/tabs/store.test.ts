import { describe, it, expect, beforeEach } from 'vitest';
import { useTabStore } from './store';

describe('useTabStore', () => {
  beforeEach(() => {
    useTabStore.getState().reset();
  });

  it('starts with empty state', () => {
    const state = useTabStore.getState();
    expect(state.tabs).toEqual([]);
    expect(state.activeTabIndex).toBeNull();
  });

  // --- openTab ---

  it('openTab adds a new tab and makes it active', () => {
    useTabStore.getState().openTab(5, 'Note Five');
    const state = useTabStore.getState();
    expect(state.tabs).toEqual([{ noteId: 5, title: 'Note Five' }]);
    expect(state.activeTabIndex).toBe(0);
  });

  it('openTab activates existing tab instead of duplicating', () => {
    useTabStore.getState().openTab(1, 'First');
    useTabStore.getState().openTab(2, 'Second');
    useTabStore.getState().openTab(3, 'Third');

    // Open note 1 again — should activate index 0, not add a 4th tab
    useTabStore.getState().openTab(1, 'First');
    const state = useTabStore.getState();
    expect(state.tabs).toHaveLength(3);
    expect(state.activeTabIndex).toBe(0);
  });

  it('openTab updates title when activating existing tab with new title', () => {
    useTabStore.getState().openTab(1, 'Old Title');
    useTabStore.getState().openTab(1, 'New Title');
    const state = useTabStore.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].title).toBe('New Title');
    expect(state.activeTabIndex).toBe(0);
  });

  it('openTab appends new tab after existing tabs', () => {
    useTabStore.getState().openTab(1, 'First');
    useTabStore.getState().openTab(2, 'Second');
    const state = useTabStore.getState();
    expect(state.tabs).toHaveLength(2);
    expect(state.activeTabIndex).toBe(1);
    expect(state.tabs[1].noteId).toBe(2);
  });

  // --- closeTab ---

  it('closeTab on active tab selects right neighbor', () => {
    useTabStore.getState().openTab(1, 'A');
    useTabStore.getState().openTab(2, 'B');
    useTabStore.getState().openTab(3, 'C');
    useTabStore.getState().switchTab(1); // B is active

    useTabStore.getState().closeTab(1); // close B
    const state = useTabStore.getState();
    expect(state.tabs).toHaveLength(2);
    expect(state.activeTabIndex).toBe(1); // was C at index 2, now at index 1
    expect(state.tabs[state.activeTabIndex!].noteId).toBe(3);
  });

  it('closeTab on active rightmost tab falls back to left', () => {
    useTabStore.getState().openTab(1, 'A');
    useTabStore.getState().openTab(2, 'B');
    useTabStore.getState().openTab(3, 'C');
    // C is active at index 2 (last openTab)

    useTabStore.getState().closeTab(2); // close C
    const state = useTabStore.getState();
    expect(state.tabs).toHaveLength(2);
    expect(state.activeTabIndex).toBe(1); // B
    expect(state.tabs[state.activeTabIndex!].noteId).toBe(2);
  });

  it('closeTab on last remaining tab results in empty state', () => {
    useTabStore.getState().openTab(1, 'Only');

    useTabStore.getState().closeTab(0);
    const state = useTabStore.getState();
    expect(state.tabs).toEqual([]);
    expect(state.activeTabIndex).toBeNull();
  });

  it('closeTab on inactive tab preserves active tab', () => {
    useTabStore.getState().openTab(1, 'A');
    useTabStore.getState().openTab(2, 'B');
    useTabStore.getState().openTab(3, 'C');
    useTabStore.getState().switchTab(0); // A is active

    useTabStore.getState().closeTab(2); // close C (inactive, after active)
    const state = useTabStore.getState();
    expect(state.tabs).toHaveLength(2);
    expect(state.activeTabIndex).toBe(0);
    expect(state.tabs[0].noteId).toBe(1);
  });

  it('closeTab on inactive tab before active shifts active index', () => {
    useTabStore.getState().openTab(1, 'A');
    useTabStore.getState().openTab(2, 'B');
    useTabStore.getState().openTab(3, 'C');
    // C is active at index 2

    useTabStore.getState().closeTab(0); // close A (before active)
    const state = useTabStore.getState();
    expect(state.tabs).toHaveLength(2);
    expect(state.activeTabIndex).toBe(1); // C shifted from 2 to 1
    expect(state.tabs[state.activeTabIndex!].noteId).toBe(3);
  });

  it('closeTab with out-of-range index does nothing', () => {
    useTabStore.getState().openTab(1, 'A');
    useTabStore.getState().closeTab(5);
    useTabStore.getState().closeTab(-1);
    expect(useTabStore.getState().tabs).toHaveLength(1);
  });

  // --- switchTab ---

  it('switchTab sets activeTabIndex', () => {
    useTabStore.getState().openTab(1, 'A');
    useTabStore.getState().openTab(2, 'B');

    useTabStore.getState().switchTab(0);
    expect(useTabStore.getState().activeTabIndex).toBe(0);

    useTabStore.getState().switchTab(1);
    expect(useTabStore.getState().activeTabIndex).toBe(1);
  });

  it('switchTab ignores out-of-range index', () => {
    useTabStore.getState().openTab(1, 'A');
    useTabStore.getState().switchTab(5);
    expect(useTabStore.getState().activeTabIndex).toBe(0);
  });

  // --- reorderTabs ---

  it('reorderTabs moves tab and active follows', () => {
    useTabStore.getState().openTab(1, 'A');
    useTabStore.getState().openTab(2, 'B');
    useTabStore.getState().openTab(3, 'C');
    useTabStore.getState().switchTab(0); // A is active

    useTabStore.getState().reorderTabs(0, 2); // move A to end
    const state = useTabStore.getState();
    expect(state.tabs.map((t) => t.noteId)).toEqual([2, 3, 1]);
    expect(state.activeTabIndex).toBe(2); // A is now at index 2
  });

  it('reorderTabs preserves active when non-active tab moves', () => {
    useTabStore.getState().openTab(1, 'A');
    useTabStore.getState().openTab(2, 'B');
    useTabStore.getState().openTab(3, 'C');
    useTabStore.getState().switchTab(1); // B is active

    useTabStore.getState().reorderTabs(0, 2); // move A to end
    const state = useTabStore.getState();
    expect(state.tabs.map((t) => t.noteId)).toEqual([2, 3, 1]);
    expect(state.activeTabIndex).toBe(0); // B shifted from 1 to 0
    expect(state.tabs[state.activeTabIndex!].noteId).toBe(2);
  });

  it('reorderTabs does nothing for same index', () => {
    useTabStore.getState().openTab(1, 'A');
    useTabStore.getState().openTab(2, 'B');
    useTabStore.getState().reorderTabs(0, 0);
    expect(useTabStore.getState().tabs.map((t) => t.noteId)).toEqual([1, 2]);
  });

  it('reorderTabs ignores out-of-range indices', () => {
    useTabStore.getState().openTab(1, 'A');
    useTabStore.getState().reorderTabs(-1, 0);
    useTabStore.getState().reorderTabs(0, 5);
    expect(useTabStore.getState().tabs).toHaveLength(1);
  });

  // --- updateTabTitle ---

  it('updateTabTitle updates the correct tab', () => {
    useTabStore.getState().openTab(1, 'Old Title');
    useTabStore.getState().updateTabTitle(0, 'New Title');
    expect(useTabStore.getState().tabs[0].title).toBe('New Title');
  });

  it('updateTabTitle ignores out-of-range index', () => {
    useTabStore.getState().openTab(1, 'A');
    useTabStore.getState().updateTabTitle(5, 'Nope');
    expect(useTabStore.getState().tabs[0].title).toBe('A');
  });

  // --- reset ---

  it('reset clears all state', () => {
    useTabStore.getState().openTab(1, 'A');
    useTabStore.getState().openTab(2, 'B');
    useTabStore.getState().reset();

    const state = useTabStore.getState();
    expect(state.tabs).toEqual([]);
    expect(state.activeTabIndex).toBeNull();
  });
});
