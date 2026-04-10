import { useState, useRef, useEffect, useCallback } from 'react';
import { useTabStore } from '../store';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../../../components/ui/dropdown-menu';

/** Truncate title to ~20 chars with ellipsis, or show "New note" for empty. */
function displayTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return 'New note';
  return trimmed.length > 20 ? trimmed.slice(0, 20) + '...' : trimmed;
}

/**
 * Horizontal tab bar rendered above the editor. Consumes useTabStore
 * for tab state. Hidden when no tabs are open.
 */
export function TabBar() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabIndex = useTabStore((s) => s.activeTabIndex);
  const switchTab = useTabStore((s) => s.switchTab);
  const closeTab = useTabStore((s) => s.closeTab);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const checkOverflow = useCallback(() => {
    const el = tabsContainerRef.current;
    if (el) {
      setHasOverflow(el.scrollWidth > el.clientWidth);
    }
  }, []);

  useEffect(() => {
    const el = tabsContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  }, [checkOverflow]);

  // Recheck overflow when tabs change
  useEffect(checkOverflow, [tabs, checkOverflow]);

  if (tabs.length === 0) return null;

  return (
    <div
      data-testid="tab-bar"
      role="tablist"
      style={{
        height: '32px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'stretch',
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      <div
        ref={tabsContainerRef}
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          alignItems: 'stretch',
        }}
      >
        {tabs.map((tab, index) => {
          const isActive = index === activeTabIndex;
          return (
            <div
              key={tab.noteId}
              data-testid={`tab-${tab.noteId}`}
              role="tab"
              aria-selected={isActive}
              onClick={() => switchTab(index)}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  closeTab(index);
                }
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                padding: '0 var(--space-2)',
                cursor: 'pointer',
                flexShrink: 0,
                maxWidth: '180px',
                borderBottom: isActive
                  ? '2px solid var(--accent)'
                  : '2px solid transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                userSelect: 'none',
              }}
            >
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
              >
                {displayTitle(tab.title)}
              </span>
              <button
                aria-label={`Close ${displayTitle(tab.title)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(index);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  fontSize: '14px',
                  lineHeight: 1,
                  padding: '0 2px',
                  visibility: hoveredIndex === index ? 'visible' : 'hidden',
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      {hasOverflow && (
        <DropdownMenu>
          <DropdownMenuTrigger
            data-testid="tab-overflow"
            style={{
              background: 'none',
              border: 'none',
              borderLeft: '1px solid var(--border-default)',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: '14px',
              padding: '0 var(--space-2)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            ···
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {tabs.map((tab, index) => (
              <DropdownMenuItem
                key={tab.noteId}
                onClick={() => switchTab(index)}
              >
                {displayTitle(tab.title)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
