import { useEffect, useRef } from 'react';
import { commands } from '../../../generated/bindings';
import { useSearchStore } from '../store';
import { SearchResultItem } from './SearchResultItem';

/**
 * Full-width search overlay that renders over the editor content.
 * Displays search input, result count, and result list with keyboard navigation.
 */
export function SearchOverlay() {
  const inputRef = useRef<HTMLInputElement>(null);
  const query = useSearchStore((s) => s.query);
  const results = useSearchStore((s) => s.results);
  const selectedIndex = useSearchStore((s) => s.selectedIndex);

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
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        useSearchStore.getState().selectNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        useSearchStore.getState().selectPrev();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  /** Handle input changes — search immediately, no debounce. */
  const handleInput = async (value: string) => {
    useSearchStore.getState().setQuery(value);
    if (value === '') {
      useSearchStore.getState().setResults([]);
      return;
    }
    const result = await commands.searchNotes(value, null);
    if (result.status === 'ok') {
      useSearchStore.getState().setResults(result.data);
    } else {
      console.error('searchNotes failed:', result.error);
      useSearchStore.getState().setResults([]);
    }
  };

  return (
    <div
      data-testid="search-overlay"
      role="search"
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
            outline: 'none',
            width: '100%',
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
