import { useEffect } from 'react';
import { useTabStore } from '../store';
import { useSearchStore } from '../../search/store';
import { useCommandPaletteStore } from '../../command-palette/store';

/**
 * Registers global keyboard shortcuts for tab navigation.
 * Ctrl+Tab/Ctrl+Shift+Tab cycle tabs, Ctrl+1-9 jump, Ctrl+W closes.
 * All shortcuts are suppressed when search overlay or command palette is open, or no tabs exist.
 */
export function useTabKeyboardNav(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Guard: no-op when an overlay is open
      if (useSearchStore.getState().isOpen) return;
      if (useCommandPaletteStore.getState().isOpen) return;

      const { tabs, activeTabIndex, switchTab, closeTab } = useTabStore.getState();

      // Guard: no-op when no tabs are open
      if (tabs.length === 0) return;

      // Ctrl+Tab / Ctrl+Shift+Tab — cycle tabs
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        if (activeTabIndex === null) return;
        if (e.shiftKey) {
          // Previous tab (wrap)
          const prev = activeTabIndex === 0 ? tabs.length - 1 : activeTabIndex - 1;
          switchTab(prev);
        } else {
          // Next tab (wrap)
          const next = (activeTabIndex + 1) % tabs.length;
          switchTab(next);
        }
        return;
      }

      // Ctrl+W — close active tab
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        if (activeTabIndex !== null) {
          closeTab(activeTabIndex);
        }
        return;
      }

      // Ctrl+1-9 — jump to Nth tab
      if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const n = parseInt(e.key, 10);
        if (n === 9) {
          // Ctrl+9 always jumps to last tab
          switchTab(tabs.length - 1);
        } else if (n <= tabs.length) {
          switchTab(n - 1);
        }
        // Out of range: no-op
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
