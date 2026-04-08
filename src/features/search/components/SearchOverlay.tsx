import { useCallback, useEffect, useRef, useState } from 'react';
import { commands } from '../../../generated/bindings';
import { useEditorStore } from '../../editor/store';
import { useSearchStore } from '../store';
import { SearchResultItem } from './SearchResultItem';

/**
 * Full-width search overlay that renders over the editor content.
 * Displays search input, result count, and result list with keyboard navigation.
 */
export function SearchOverlay() {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);
  const openingRef = useRef(false);
  const query = useSearchStore((s) => s.query);
  const results = useSearchStore((s) => s.results);
  const selectedIndex = useSearchStore((s) => s.selectedIndex);
  const [openError, setOpenError] = useState<string | null>(null);

  /** Opens a note in the editor, closes the search overlay, and returns focus to the editor. */
  const openNote = useCallback(async (noteId: number) => {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpenError(null);
    try {
      await useEditorStore.getState().loadNote(noteId);
      useSearchStore.getState().closeSearch();
      const editor = document.querySelector<HTMLElement>('.cm-content');
      editor?.focus();
    } catch (err) {
      console.error('openNote failed:', err);
      setOpenError('Unable to open note. Choose another or press Esc to close.');
    } finally {
      openingRef.current = false;
    }
  }, []);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle keyboard events on the overlay
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        useSearchStore.getState().closeSearch();
        // Return focus to the editor (AC 8)
        const editor = document.querySelector<HTMLElement>('.cm-content');
        editor?.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        useSearchStore.getState().selectNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        useSearchStore.getState().selectPrev();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const { results: r, selectedIndex: idx } = useSearchStore.getState();
        if (r.length === 0) return;
        const selected = r[idx];
        if (!selected) return;
        openNote(selected.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openNote]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current || results.length === 0 || selectedIndex < 0) return;
    const selected = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedIndex, results.length]);

  /** Trap focus within the overlay — Tab cycles, Esc is the only way out. */
  const handleOverlayKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const overlay = e.currentTarget;
    const focusable = overlay.querySelectorAll<HTMLElement>(
      'input, button, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  /** Handle input changes — search immediately, no debounce. */
  const handleInput = async (value: string) => {
    const requestId = ++requestIdRef.current;
    useSearchStore.getState().setQuery(value);
    if (value === '') {
      useSearchStore.getState().setResults([]);
      return;
    }
    try {
      const result = await commands.searchNotes(value, null);
      // Guard against stale results from earlier requests
      if (requestIdRef.current !== requestId) return;
      if (result.status === 'ok') {
        useSearchStore.getState().setResults(result.data);
      } else {
        console.error('searchNotes failed:', result.error);
        useSearchStore.getState().setResults([]);
      }
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      console.error('searchNotes exception:', err);
      useSearchStore.getState().setResults([]);
    }
  };

  return (
    <div
      data-testid="search-overlay"
      role="search"
      onKeyDown={handleOverlayKeyDown}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--bg-primary)',
          opacity: 0.8,
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: 'var(--space-6)',
          background: 'var(--bg-elevated)',
        }}
      >
        {/* Search input */}
        <input
          ref={inputRef}
          data-testid="search-input"
          aria-label="Search notes"
          type="text"
          placeholder="Search notes..."
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          style={{
            fontSize: 'var(--text-base)',
            fontFamily: 'var(--font-mono)',
            lineHeight: '22px',
            padding: '12px 8px',
            background: 'transparent',
            border: '1px solid var(--border-default)',
            borderRadius: '4px',
            color: 'var(--text-primary)',
            outline: '2px solid transparent',
            outlineOffset: '2px',
            width: '100%',
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = '2px solid var(--focus-ring)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = '2px solid transparent';
          }}
        />

        {/* Result count header */}
        {query !== '' && results.length > 0 && (
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              marginTop: 'var(--space-2)',
            }}
          >
            {results.length} {results.length === 1 ? 'result' : 'results'} &middot; &uarr;&darr; navigate &middot; Enter open
          </div>
        )}

        {/* Error notice */}
        {openError && (
          <div
            data-testid="search-open-error"
            role="alert"
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-error, #ef4444)',
              marginTop: 'var(--space-2)',
            }}
          >
            {openError}
          </div>
        )}

        {/* Empty state */}
        {query !== '' && results.length === 0 && (
          <div
            data-testid="search-empty-state"
            style={{
              fontSize: 'var(--text-base)',
              color: 'var(--text-muted)',
              marginTop: 'var(--space-4)',
            }}
          >
            No notes matching &apos;{query}&apos;
          </div>
        )}

        {/* Results list */}
        {results.length > 0 && (
          <div
            ref={listRef}
            role="listbox"
            style={{
              marginTop: 'var(--space-3)',
              overflowY: 'auto',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            {results.map((result, index) => (
              <SearchResultItem
                key={result.id}
                result={result}
                isSelected={index === selectedIndex}
                onSelect={openNote}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
