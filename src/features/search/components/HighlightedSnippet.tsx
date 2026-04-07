import type { ReactNode } from 'react';

interface HighlightedSnippetProps {
  /** Snippet string potentially containing <mark>...</mark> tags from FTS5. */
  snippet: string;
}

/**
 * Renders a search snippet with highlighted matches.
 * Parses `<mark>` tags from FTS5 into styled React elements.
 * No dangerouslySetInnerHTML — all content is treated as plain text.
 */
export function HighlightedSnippet({ snippet }: HighlightedSnippetProps) {
  return <span data-testid="highlighted-snippet">{parseSnippet(snippet)}</span>;
}

/**
 * Split a snippet on `<mark>...</mark>` boundaries and return
 * React elements with highlighted spans for matched segments.
 */
function parseSnippet(snippet: string): ReactNode[] {
  const parts = snippet.split(/(<mark>.*?<\/mark>)/g);
  return parts.map((part, i) => {
    const match = part.match(/^<mark>(.*)<\/mark>$/);
    if (match) {
      return (
        <span
          key={i}
          style={{
            color: 'var(--accent)',
            background: 'var(--accent-muted)',
            fontWeight: 600,
          }}
        >
          {match[1]}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
