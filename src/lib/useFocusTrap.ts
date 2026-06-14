import { useEffect, type RefObject } from 'react';

/**
 * Selector matching elements that participate in the Tab sequence. Mirrors the
 * set the overlays previously queried inline, plus links and textareas. Elements
 * with `tabindex="-1"` are programmatically focusable but excluded from Tab.
 */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Trap keyboard focus within the element referenced by `ref` while `active` is
 * true. A `keydown` listener on the container intercepts Tab / Shift+Tab and
 * cycles focus among the container's focusable descendants — wrapping from the
 * last element back to the first (and vice versa) and pulling focus back inside
 * if it has strayed out — so focus never reaches content behind the overlay. If
 * the container has no Tab-focusable descendants, Tab is suppressed so focus
 * parks on the container itself.
 *
 * This hook handles trapping only. It does not move initial focus or restore
 * focus on teardown — callers retain their existing auto-focus-on-open and
 * editor-refocus-on-close behavior.
 *
 * @param ref - Ref to the overlay container that should retain focus.
 * @param active - Whether the trap is engaged (typically the overlay's open state).
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      // Nothing tabbable inside — keep focus parked on the container.
      if (focusables.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      const activeIndex = activeEl === null ? -1 : focusables.indexOf(activeEl);
      if (e.shiftKey) {
        if (activeIndex <= 0) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (activeIndex === -1 || activeIndex === focusables.length - 1) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [active, ref]);
}
