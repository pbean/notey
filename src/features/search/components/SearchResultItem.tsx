import { useState } from 'react';
import type { SearchResult } from '../../../generated/bindings';
import { formatRelativeDate } from '../../../lib/format-relative-date';
import { HighlightedSnippet } from './HighlightedSnippet';

interface SearchResultItemProps {
  /** The search result to display. */
  result: SearchResult;
  /** Whether this item is currently selected/highlighted. */
  isSelected: boolean;
  /** Callback when user selects this result (click or Enter). */
  onSelect: (id: number) => void;
}

/**
 * Displays a single search result with title, workspace, date, and snippet.
 * Uses role="option" and aria-selected for listbox accessibility.
 */
export function SearchResultItem({ result, isSelected, onSelect }: SearchResultItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const highlighted = isSelected || isHovered;

  return (
    <div
      data-testid={`search-result-${result.id}`}
      role="option"
      aria-selected={isSelected}
      onClick={() => onSelect(result.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: 'var(--space-3)',
        background: highlighted ? 'var(--accent-muted)' : 'transparent',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span
          style={{
            fontSize: 'var(--text-base)',
            fontWeight: 400,
            color: 'var(--text-primary)',
          }}
        >
          {result.title}
        </span>
        <span
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            flexShrink: 0,
            marginLeft: 'var(--space-2)',
          }}
        >
          {formatRelativeDate(result.updatedAt)}
        </span>
      </div>
      <div
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
          marginTop: 'var(--space-1)',
        }}
      >
        {result.workspaceName ?? 'No workspace'}
      </div>
      <div
        style={{
          fontSize: 'var(--text-base)',
          color: 'var(--text-primary)',
          marginTop: 'var(--space-1)',
        }}
      >
        <HighlightedSnippet snippet={result.snippet} />
      </div>
    </div>
  );
}

