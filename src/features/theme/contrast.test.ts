import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * WCAG 2.1 AA contrast audit for the Notey theme design tokens (Story 7.2,
 * AC: NFR23). The token values are read from `src/index.css` at test time — the
 * single source of truth — so the audit cannot drift from the stylesheet: edit a
 * token and this test re-checks it automatically.
 *
 * Scope is the Notey hex design tokens (the app's own chrome) for BOTH themes:
 * - text that conveys information (`text-primary`, `text-secondary`) must reach
 *   the AA normal-text ratio of 4.5:1 on every surface;
 * - supporting chrome tokens used in the current app shell (`text-muted`,
 *   `border-default`) must reach the AA non-text / incidental-text floor of 3:1
 *   on each surface they appear against;
 * - semantic / focus indicators (`accent`, status colors, `focus-ring`) must
 *   reach the AA non-text ratio of 3:1 against the primary background.
 *
 * Border-subtle and shadcn `oklch(...)` tokens are still out of scope here; the
 * comprehensive, per-component accessibility audit lands in Story 7.8.
 *
 * `index.css` is loaded directly from the module graph: file-read when the test
 * module has a `file:` URL, or fetched from the Vite test server otherwise.
 */
const moduleUrl = new URL(import.meta.url);
const CSS =
  moduleUrl.protocol === 'file:'
    ? readFileSync(new URL('../../index.css', moduleUrl), 'utf-8')
    : await fetch(new URL('/src/index.css?raw', moduleUrl)).then(async (response) => {
        if (!response.ok) {
          throw new Error(`failed to load index.css for contrast audit: ${response.status}`);
        }
        return response.text();
      });

/** Extract the body of a single CSS rule block (no nested braces in these blocks). */
function extractBlock(css: string, escapedSelector: string): string {
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  return match ? match[1] : '';
}

/** Parse `--name: #hex;` custom-property declarations from a rule body. */
function parseHexTokens(block: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  const re = /--([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) tokens[m[1]] = m[2];
  return tokens;
}

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Parse a #rgb / #rrggbb / #rrggbbaa hex string into 0–255 channels + 0–1 alpha. */
function parseHex(hex: string): Rgba {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
  };
}

/** Composite a (possibly translucent) foreground over an opaque background. */
function blend(fg: Rgba, bg: Rgba): Rgba {
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  };
}

/** sRGB relative luminance per WCAG 2.1. */
function luminance({ r, g, b }: Rgba): number {
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2.1 contrast ratio between a foreground and background hex token. */
function contrast(fgHex: string, bgHex: string): number {
  const bg = parseHex(bgHex);
  const fgRaw = parseHex(fgHex);
  const fg = fgRaw.a < 1 ? blend(fgRaw, bg) : fgRaw;
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const darkTokens = parseHexTokens(extractBlock(CSS, ':root'));
const lightTokens = { ...darkTokens, ...parseHexTokens(extractBlock(CSS, '\\.light')) };

const THEMES = [
  { name: 'dark', tokens: darkTokens },
  { name: 'light', tokens: lightTokens },
] as const;

const SURFACES = ['bg-primary', 'bg-elevated', 'bg-surface'] as const;
const AA_TEXT = ['text-primary', 'text-secondary'] as const;
const AA_SUPPORTING_CHROME = ['text-muted', 'border-default'] as const;
const AA_NON_TEXT = ['accent', 'success', 'warning', 'error', 'focus-ring'] as const;

describe('theme token contrast (WCAG 2.1 AA)', () => {
  it.each(THEMES)('$name theme defines all audited tokens as hex', ({ tokens }) => {
    for (const name of [...SURFACES, ...AA_TEXT, ...AA_SUPPORTING_CHROME, ...AA_NON_TEXT]) {
      expect(tokens[name], `missing hex token --${name}`).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    }
  });

  describe.each(THEMES)('$name theme', ({ name, tokens }) => {
    for (const text of AA_TEXT) {
      for (const surface of SURFACES) {
        it(`${text} on ${surface} meets 4.5:1`, () => {
          const ratio = contrast(tokens[text], tokens[surface]);
          expect(ratio, `${name}: --${text} on --${surface} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
        });
      }
    }

    for (const token of AA_SUPPORTING_CHROME) {
      for (const surface of SURFACES) {
        it(`${token} on ${surface} meets 3:1`, () => {
          const ratio = contrast(tokens[token], tokens[surface]);
          expect(ratio, `${name}: --${token} on --${surface} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
        });
      }
    }

    for (const token of AA_NON_TEXT) {
      it(`${token} on bg-primary meets 3:1`, () => {
        const ratio = contrast(tokens[token], tokens['bg-primary']);
        expect(ratio, `${name}: --${token} on --bg-primary = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
      });
    }
  });
});
