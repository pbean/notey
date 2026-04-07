import { useEffect } from 'react';
import { EditorPane } from './EditorPane';
import { StatusBar } from './StatusBar';
import { SearchOverlay } from '../../search/components/SearchOverlay';
import { useSearchStore } from '../../search/store';

/**
 * Root application shell. Full-screen flex column containing
 * the editor pane, search overlay, and status bar.
 */
export function CaptureWindow() {
  const isSearchOpen = useSearchStore((s) => s.isOpen);

  // Register Ctrl/Cmd+F to open search overlay
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        useSearchStore.getState().openSearch();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--bg-primary)]">
      <div className="relative flex-1 min-h-0">
        <EditorPane className="h-full" />
        {isSearchOpen && <SearchOverlay />}
      </div>
      <StatusBar />
    </div>
  );
}
