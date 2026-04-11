import { useEffect } from 'react';
import { EditorPane } from './EditorPane';
import { StatusBar } from './StatusBar';
import { TabBar } from '../../tabs/components/TabBar';
import { useTabKeyboardNav } from '../../tabs/hooks/useTabKeyboardNav';
import { SearchOverlay } from '../../search/components/SearchOverlay';
import { useSearchStore } from '../../search/store';
import { CommandPalette } from '../../command-palette/components/CommandPalette';
import { useCommandPaletteStore } from '../../command-palette/store';
import { createNewNote, toggleTheme } from '../../command-palette/actions';

/**
 * Root application shell. Full-screen flex column containing
 * the editor pane, search overlay, command palette, and status bar.
 */
export function CaptureWindow() {
  const isSearchOpen = useSearchStore((s) => s.isOpen);
  useTabKeyboardNav();

  // Register Ctrl/Cmd+F to open search overlay (closes command palette)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        useCommandPaletteStore.getState().close();
        useSearchStore.getState().openSearch();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Register Ctrl/Cmd+P to toggle command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        useCommandPaletteStore.getState().toggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Register Ctrl/Cmd+N to create a new note (guarded against overlays and key repeat)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (useCommandPaletteStore.getState().isOpen || useSearchStore.getState().isOpen) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        void createNewNote();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Register Ctrl/Cmd+Shift+T to toggle theme (guarded against overlays)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (useCommandPaletteStore.getState().isOpen || useSearchStore.getState().isOpen) return;
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        void toggleTheme();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--bg-primary)]">
      <TabBar />
      <div className="relative flex-1 min-h-0">
        <EditorPane className="h-full" />
        {isSearchOpen && <SearchOverlay />}
      </div>
      <CommandPalette />
      <StatusBar />
    </div>
  );
}
