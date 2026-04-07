import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HighlightedSnippet } from './HighlightedSnippet';

// COMP-3.3-06: Match highlighting renders safely (no dangerouslySetInnerHTML)
describe('HighlightedSnippet', () => {
  it('renders plain text when no mark tags present', () => {
    render(<HighlightedSnippet snippet="hello world" />);
    expect(screen.getByTestId('highlighted-snippet')).toHaveTextContent('hello world');
  });

  it('highlights text inside <mark> tags', () => {
    render(<HighlightedSnippet snippet="hello <mark>world</mark> foo" />);
    const container = screen.getByTestId('highlighted-snippet');
    expect(container).toHaveTextContent('hello world foo');

    // The highlighted span should have accent styling
    const spans = container.querySelectorAll('span > span');
    const highlighted = Array.from(spans).find(
      (s) => (s as HTMLElement).style.color === 'var(--accent)',
    );
    expect(highlighted).toBeDefined();
    expect(highlighted!.textContent).toBe('world');
    expect((highlighted as HTMLElement).style.fontWeight).toBe('600');
    expect((highlighted as HTMLElement).style.background).toBe('var(--accent-muted)');
  });

  it('handles multiple mark tags', () => {
    render(
      <HighlightedSnippet snippet="<mark>foo</mark> bar <mark>baz</mark>" />,
    );
    const container = screen.getByTestId('highlighted-snippet');
    expect(container).toHaveTextContent('foo bar baz');

    const highlighted = Array.from(container.querySelectorAll('span > span')).filter(
      (s) => (s as HTMLElement).style.color === 'var(--accent)',
    );
    expect(highlighted).toHaveLength(2);
    expect(highlighted[0].textContent).toBe('foo');
    expect(highlighted[1].textContent).toBe('baz');
  });

  it('does not use dangerouslySetInnerHTML', () => {
    // If dangerouslySetInnerHTML were used, injected script tags would render as DOM
    render(
      <HighlightedSnippet snippet='<script>alert("xss")</script> safe text' />,
    );
    const container = screen.getByTestId('highlighted-snippet');
    // Script tag should appear as text content, not as a DOM element
    expect(container.querySelector('script')).toBeNull();
    expect(container).toHaveTextContent('<script>alert("xss")</script> safe text');
  });

  it('renders empty string without error', () => {
    render(<HighlightedSnippet snippet="" />);
    expect(screen.getByTestId('highlighted-snippet')).toHaveTextContent('');
  });
});
