import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { useFocusTrap } from './useFocusTrap';

/**
 * Build a container with `n` focusable buttons (plus optional extra markup),
 * attach it to the document, and return a ref-like object pointing at it.
 */
function mountContainer(html: string): {
  container: HTMLDivElement;
  ref: { current: HTMLDivElement };
} {
  const container = document.createElement('div');
  container.tabIndex = -1;
  container.innerHTML = html;
  document.body.appendChild(container);
  return { container, ref: { current: container } };
}

describe('useFocusTrap', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('wraps Tab from the last focusable back to the first', () => {
    const { container, ref } = mountContainer(
      '<button id="a">A</button><button id="b">B</button>',
    );
    renderHook(() => useFocusTrap(ref, true));
    const last = container.querySelector<HTMLButtonElement>('#b')!;
    last.focus();
    const evt = fireEvent.keyDown(last, { key: 'Tab' });
    expect(evt).toBe(false); // preventDefault was called
    expect(document.activeElement?.id).toBe('a');
  });

  it('wraps Shift+Tab from the first focusable back to the last', () => {
    const { container, ref } = mountContainer(
      '<button id="a">A</button><button id="b">B</button>',
    );
    renderHook(() => useFocusTrap(ref, true));
    const first = container.querySelector<HTMLButtonElement>('#a')!;
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement?.id).toBe('b');
  });

  it('does not redirect Tab in the middle of the sequence', () => {
    const { container, ref } = mountContainer(
      '<button id="a">A</button><button id="b">B</button><button id="c">C</button>',
    );
    renderHook(() => useFocusTrap(ref, true));
    const first = container.querySelector<HTMLButtonElement>('#a')!;
    first.focus();
    const evt = fireEvent.keyDown(first, { key: 'Tab' });
    expect(evt).toBe(true); // not prevented — browser advances normally
    expect(document.activeElement?.id).toBe('a');
  });

  it('parks focus on the container when there are no focusable children', () => {
    const { container, ref } = mountContainer('<p>no controls here</p>');
    renderHook(() => useFocusTrap(ref, true));
    container.focus();
    const evt = fireEvent.keyDown(container, { key: 'Tab' });
    expect(evt).toBe(false); // preventDefault, focus stays put
    expect(document.activeElement).toBe(container);
  });

  it('is a no-op while inactive', () => {
    const { container, ref } = mountContainer(
      '<button id="a">A</button><button id="b">B</button>',
    );
    renderHook(() => useFocusTrap(ref, false));
    const last = container.querySelector<HTMLButtonElement>('#b')!;
    last.focus();
    const evt = fireEvent.keyDown(last, { key: 'Tab' });
    expect(evt).toBe(true); // listener never attached
    expect(document.activeElement?.id).toBe('b');
  });

  it('ignores non-Tab keys', () => {
    const { container, ref } = mountContainer('<button id="a">A</button>');
    renderHook(() => useFocusTrap(ref, true));
    const a = container.querySelector<HTMLButtonElement>('#a')!;
    a.focus();
    const evt = fireEvent.keyDown(a, { key: 'Enter' });
    expect(evt).toBe(true);
  });

  it('moves focus into the first tabbable control when the container itself is focused', () => {
    const { container, ref } = mountContainer(
      '<button id="a">A</button><button id="b">B</button>',
    );
    renderHook(() => useFocusTrap(ref, true));
    container.focus();
    const evt = fireEvent.keyDown(container, { key: 'Tab' });
    expect(evt).toBe(false);
    expect(document.activeElement?.id).toBe('a');
  });

  it('wraps Shift+Tab from a non-tabbable child to the last focusable control', () => {
    const { container, ref } = mountContainer(
      '<div id="row" tabindex="-1">Row</div><button id="a">A</button><button id="b">B</button>',
    );
    renderHook(() => useFocusTrap(ref, true));
    const row = container.querySelector<HTMLElement>('#row')!;
    row.focus();
    const evt = fireEvent.keyDown(row, { key: 'Tab', shiftKey: true });
    expect(evt).toBe(false);
    expect(document.activeElement?.id).toBe('b');
  });

  it('reclaims escaped focus on the next Tab keypress', () => {
    const { ref } = mountContainer(
      '<button id="a">A</button><button id="b">B</button>',
    );
    const outside = document.createElement('button');
    outside.id = 'outside';
    document.body.appendChild(outside);
    renderHook(() => useFocusTrap(ref, true));
    outside.focus();
    const evt = fireEvent.keyDown(outside, { key: 'Tab' });
    expect(evt).toBe(false);
    expect(document.activeElement?.id).toBe('a');
  });
});
