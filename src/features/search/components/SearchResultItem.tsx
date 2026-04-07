import type { SearchResult } from '../../../generated/bindings';
import { HighlightedSnippet } from './HighlightedSnippet';

interface SearchResultItemProps {
  /** The search result to display. */
  result: SearchResult;
  /** Whether this item is currently selected/highlighted. */
  isSelected: boolean;
}

/**
 * Displays a single search result with title, workspace, date, and snippet.
 * Uses role="option" and aria-selected for listbox accessibility.
 */
export function SearchResultItem({ result, isSelected }: SearchResultItemProps) {
  return (
    <div
      data-testid={`search-result-${result.id}`}
      role="option"
      aria-selected={isSelected}
      style={{
        padding: 'var(--space-3)',
        background: isSelected ? 'var(--bg-surface)' : 'transparent',
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

/**
 * Formats an ISO 8601 timestamp as a human-readable relative date.
 * Uses Intl.DateTimeFormat for dates older than 7 days per project conventions.
 */
function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}
