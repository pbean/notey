import { useState, useRef, useEffect, useCallback } from 'react';
import { useTabStore } from '../store';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../../../components/ui/dropdown-menu';

/** Compute the drop target index from cursor position relative to tab elements. */
function getDropIndex(
  container: HTMLDivElement,
  clientX: number,
  tabCount: number,
): number | null {
  const tabElements = container.querySelectorAll<HTMLElement>('[role="tab"]');
  for (let i = 0; i < tabElements.length; i++) {
    const rect = tabElements[i].getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    if (clientX < midX) return i;
  }
  return tabCount;
}

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
  const reorderTabs = useTabStore((s) => s.reorderTabs);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [focusedTabIndex, setFocusedTabIndex] = useState<number>(activeTabIndex ?? 0);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Set after a keyboard close so focus follows the closed tab's adjacent peer.
  const refocusTabIndexRef = useRef<number | null>(null);

  const focusVisibleTab = useCallback((index: number) => {
    setFocusedTabIndex(index);
    const target = tabRefs.current[index];
    target?.focus();
    target?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, []);

  // Sync the roving tabindex anchor to the active tab when activation changes
  // outside the arrow-key roving flow (click, Ctrl/Cmd+Tab, overflow menu).
  useEffect(() => {
    if (tabs.length === 0 || refocusTabIndexRef.current !== null) return;
    setFocusedTabIndex(activeTabIndex ?? 0);
  }, [activeTabIndex, tabs.length]);

  // After a keyboard-initiated close, move focus to the closed tab's adjacent
  // neighbor so the user keeps a keyboard foothold in the tablist.
  useEffect(() => {
    if (refocusTabIndexRef.current === null || tabs.length === 0) return;
    const targetIndex = Math.min(refocusTabIndexRef.current, tabs.length - 1);
    refocusTabIndexRef.current = null;
    focusVisibleTab(targetIndex);
  }, [focusVisibleTab, tabs.length]);

  // Roving tabindex anchor — the single tab stop for the tablist. Falls back to
  // the first tab if no tab is active so the tablist always has one Tab stop.
  const rovingIndex = focusedTabIndex;

  /** ARIA tablist keyboard navigation: arrows move focus, Enter/Space activate,
   * Delete/Backspace close the focused tab. */
  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const count = tabs.length;
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          focusVisibleTab((index + 1) % count);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          focusVisibleTab((index - 1 + count) % count);
          break;
        case 'Home':
          e.preventDefault();
          focusVisibleTab(0);
          break;
        case 'End':
          e.preventDefault();
          focusVisibleTab(count - 1);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          setFocusedTabIndex(index);
          switchTab(index);
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          refocusTabIndexRef.current = count > 1 ? Math.min(index, count - 2) : null;
          closeTab(index);
          break;
        default:
          break;
      }
    },
    [closeTab, focusVisibleTab, switchTab, tabs.length],
  );

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

  const isDraggable = tabs.length > 1;

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
      setDragFromIndex(index);
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (dragFromIndex === null) return; // ignore external drags
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const container = tabsContainerRef.current;
      if (!container) return;
      const targetIndex = getDropIndex(container, e.clientX, tabs.length);
      setDropTargetIndex(targetIndex);
    },
    [dragFromIndex, tabs.length],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const container = tabsContainerRef.current;
      if (!Number.isNaN(fromIndex) && container) {
        const rawTarget = getDropIndex(container, e.clientX, tabs.length);
        const targetIdx = Math.min(rawTarget ?? fromIndex, tabs.length - 1);
        if (fromIndex !== targetIdx) {
          reorderTabs(fromIndex, targetIdx);
        }
      }
      setDragFromIndex(null);
      setDropTargetIndex(null);
    },
    [reorderTabs, tabs.length],
  );

  const handleDragEnd = useCallback(() => {
    setDragFromIndex(null);
    setDropTargetIndex(null);
  }, []);

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
        onDragOver={isDraggable ? handleDragOver : undefined}
        onDrop={isDraggable ? handleDrop : undefined}
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          alignItems: 'stretch',
          position: 'relative',
        }}
      >
        {tabs.map((tab, index) => {
          const isActive = index === activeTabIndex;
          const isDragging = dragFromIndex === index;
          return (
            <div
              key={tab.noteId}
              data-testid={`tab-${tab.noteId}`}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              role="tab"
              aria-selected={isActive}
              tabIndex={index === rovingIndex ? 0 : -1}
              draggable={isDraggable}
              onClick={() => {
                setFocusedTabIndex(index);
                switchTab(index);
              }}
              onFocus={() => setFocusedTabIndex(index)}
              onKeyDown={(e) => handleTabKeyDown(e, index)}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  closeTab(index);
                }
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onDragStart={isDraggable ? (e) => handleDragStart(e, index) : undefined}
              onDragEnd={isDraggable ? handleDragEnd : undefined}
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
                opacity: isDragging ? 0.5 : 1,
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
                tabIndex={-1}
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
                  visibility:
                    hoveredIndex === index || isActive ? 'visible' : 'hidden',
                }}
              >
                ×
              </button>
            </div>
          );
        })}
        {dragFromIndex !== null && dropTargetIndex !== null && (
          <div
            data-testid="tab-drop-indicator"
            style={{
              position: 'absolute',
              top: '15%',
              height: '70%',
              width: '2px',
              background: 'var(--accent)',
              pointerEvents: 'none',
              zIndex: 1,
            }}
            ref={(el) => {
              if (!el || !tabsContainerRef.current) return;
              const tabElements = tabsContainerRef.current.querySelectorAll<HTMLElement>('[role="tab"]');
              if (tabElements.length === 0) return;
              const containerRect = tabsContainerRef.current.getBoundingClientRect();
              if (dropTargetIndex < tabElements.length) {
                const tabRect = tabElements[dropTargetIndex].getBoundingClientRect();
                el.style.left = `${tabRect.left - containerRect.left}px`;
              } else {
                const lastRect = tabElements[tabElements.length - 1].getBoundingClientRect();
                el.style.left = `${lastRect.right - containerRect.left}px`;
              }
            }}
          />
        )}
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
                onClick={() => {
                  setFocusedTabIndex(index);
                  switchTab(index);
                }}
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
