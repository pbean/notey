import { create } from 'zustand';
import type { EditorState as CMEditorState } from '@codemirror/state';
import type { Compartment } from '@codemirror/state';

/** A single open tab in the tab bar. */
export interface Tab {
  /** ID of the note this tab displays. */
  noteId: number;
  /** Display title derived from note content. */
  title: string;
  /** CodeMirror editor state snapshot, saved on tab switch. */
  editorState?: CMEditorState;
  /** Scroll position saved on tab switch. */
  scrollTop?: number;
  /** Per-tab language compartment for format switching. */
  langCompartment?: Compartment;
  /** Content format for this tab's note. */
  format?: 'markdown' | 'plaintext';
}

interface TabState {
  /** Ordered list of open tabs. */
  tabs: Tab[];
  /** Index of the currently active tab, or null when no tabs are open. */
  activeTabIndex: number | null;
}

interface TabActions {
  /**
   * Open a tab for the given note. If a tab with this noteId already exists,
   * activates it instead of creating a duplicate.
   */
  openTab: (noteId: number, title: string) => void;
  /**
   * Close the tab at the given index. When closing the active tab, selects
   * the right neighbor (or left if rightmost). Closing the last tab sets
   * activeTabIndex to null.
   */
  closeTab: (index: number) => void;
  /** Activate the tab at the given index. */
  switchTab: (index: number) => void;
  /**
   * Move the tab at fromIndex to toIndex. The active tab follows its content
   * so the same note stays active after reorder.
   */
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  /** Update the display title of the tab at the given index. */
  updateTabTitle: (index: number, title: string) => void;
  /** Save CodeMirror state and scroll position for a tab. */
  saveTabState: (index: number, editorState: CMEditorState, scrollTop: number, langCompartment?: Compartment) => void;
  /** Get the currently active tab, or null. */
  getActiveTab: () => Tab | null;
  /** Reset all tab state to initial values. */
  reset: () => void;
}

const initialState: TabState = {
  tabs: [],
  activeTabIndex: null,
};

/** Per-feature Zustand store for multi-tab state management. */
export const useTabStore = create<TabState & TabActions>((set, get) => ({
  ...initialState,

  openTab: (noteId, title) => {
    const { tabs } = get();
    const existingIndex = tabs.findIndex((t) => t.noteId === noteId);
    if (existingIndex !== -1) {
      const existing = tabs[existingIndex];
      if (existing.title !== title) {
        const newTabs = [...tabs];
        newTabs[existingIndex] = { ...existing, title };
        set({ tabs: newTabs, activeTabIndex: existingIndex });
      } else {
        set({ activeTabIndex: existingIndex });
      }
      return;
    }
    set({
      tabs: [...tabs, { noteId, title }],
      activeTabIndex: tabs.length,
    });
  },

  closeTab: (index) => {
    const { tabs, activeTabIndex } = get();
    if (index < 0 || index >= tabs.length) return;

    const newTabs = tabs.filter((_, i) => i !== index);

    if (newTabs.length === 0) {
      set({ tabs: [], activeTabIndex: null });
      return;
    }

    let newActiveIndex: number;
    if (activeTabIndex === null) {
      newActiveIndex = Math.min(index, newTabs.length - 1);
    } else if (index === activeTabIndex) {
      // Closing the active tab: prefer right neighbor, fall back to left
      newActiveIndex = index < newTabs.length ? index : newTabs.length - 1;
    } else if (index < activeTabIndex) {
      // Closing a tab before the active one: shift index left
      newActiveIndex = activeTabIndex - 1;
    } else {
      // Closing a tab after the active one: no change
      newActiveIndex = activeTabIndex;
    }

    set({ tabs: newTabs, activeTabIndex: newActiveIndex });
  },

  switchTab: (index) => {
    const { tabs } = get();
    if (index >= 0 && index < tabs.length) {
      set({ activeTabIndex: index });
    }
  },

  reorderTabs: (fromIndex, toIndex) => {
    const { tabs, activeTabIndex } = get();
    if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return;
    if (
      fromIndex < 0 ||
      fromIndex >= tabs.length ||
      toIndex < 0 ||
      toIndex >= tabs.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    const newTabs = [...tabs];
    const [moved] = newTabs.splice(fromIndex, 1);
    newTabs.splice(toIndex, 0, moved);

    // Track the active tab through the reorder
    let newActiveIndex = activeTabIndex;
    if (activeTabIndex !== null) {
      if (activeTabIndex === fromIndex) {
        newActiveIndex = toIndex;
      } else {
        // Recompute: the active tab's noteId hasn't changed, find its new position
        const activeNoteId = tabs[activeTabIndex].noteId;
        newActiveIndex = newTabs.findIndex((t) => t.noteId === activeNoteId);
      }
    }

    set({ tabs: newTabs, activeTabIndex: newActiveIndex });
  },

  updateTabTitle: (index, title) => {
    const { tabs } = get();
    if (index < 0 || index >= tabs.length) return;
    const newTabs = [...tabs];
    newTabs[index] = { ...newTabs[index], title };
    set({ tabs: newTabs });
  },

  saveTabState: (index, editorState, scrollTop, langCompartment) => {
    const { tabs } = get();
    if (index < 0 || index >= tabs.length) return;
    const newTabs = [...tabs];
    newTabs[index] = { ...newTabs[index], editorState, scrollTop, langCompartment };
    set({ tabs: newTabs });
  },

  getActiveTab: () => {
    const { tabs, activeTabIndex } = get();
    if (activeTabIndex === null || activeTabIndex >= tabs.length) return null;
    return tabs[activeTabIndex];
  },

  reset: () => set(initialState),
}));
