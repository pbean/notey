import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Type-scale proportionality audit for the editor font configuration (Story 7.3,
 * epic AC: the type scale must scale proportionally from the chosen base rather
 * than only changing one element).
 *
 * The `--text-*` ramp in `src/index.css` is read at test time — the single
 * source of truth — and the test asserts every step is anchored to
 * `--editor-font-size` (the user-configurable base) with the expected ratio.
 * jsdom does not resolve `calc()` or the CSS cascade, so this checks the algebra
 * of the declarations rather than a computed layout: it fails loudly if a token
 * is reverted to a fixed px or given the wrong ratio (drifting off the base).
 *
 * `index.css` is loaded the same way as `contrast.test.ts`: file-read when the
 * test module has a `file:` URL, or fetched from the Vite test server otherwise.
 */
const moduleUrl = new URL(import.meta.url);
const CSS =
  moduleUrl.protocol === 'file:'
    ? readFileSync(new URL('../../index.css', moduleUrl), 'utf-8')
    : await fetch(new URL('/src/index.css?raw', moduleUrl)).then(async (response) => {
        if (!response.ok) {
          throw new Error(`failed to load index.css for type-scale audit: ${response.status}`);
        }
        return response.text();
      });

/** Normalize insignificant CSS whitespace for exact-shape comparisons. */
function normalizeCssValue(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Extract a single stylesheet block body; these blocks contain no nested braces. */
function extractBlock(css: string, pattern: RegExp, label: string): string {
  const match = css.match(pattern);
  if (!match) throw new Error(`${label} block not found in index.css`);
  return match[1];
}

/** Parse `--name: <value>;` declarations from a block, keeping the effective last value. */
function parseDeclarations(block: string): Record<string, string> {
  const declarations: Record<string, string> = {};
  const re = /--([\w-]+):\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(block)) !== null) declarations[match[1]] = normalizeCssValue(match[2]);
  return declarations;
}

/** Return every stylesheet declaration body for a given custom property, in source order. */
function allDeclarationValues(name: string): string[] {
  return [...CSS.matchAll(new RegExp(`--${name}:\\s*([^;]+);`, 'g'))].map((match) => normalizeCssValue(match[1]));
}

const THEME_INLINE = extractBlock(CSS, /@theme\s+inline\s*\{([\s\S]*?)\}/, '@theme inline');
const ROOT_BLOCK = extractBlock(CSS, /:root\s*\{([\s\S]*?)\}/, ':root');
const THEME_TOKENS = parseDeclarations(THEME_INLINE);
const ROOT_TOKENS = parseDeclarations(ROOT_BLOCK);

/** The base the runtime sets live via `applyFontSize` / `--editor-font-size`. */
const BASE_VAR = 'var(--editor-font-size)';
/** Default base font size; the ramp is authored as proportions of 14. */
const DEFAULT_BASE = 14;

/** The exact authored declarations required by Story 7.3's frozen contract. */
const EXPECTED_DECLARATIONS: Record<string, string> = {
  'text-xs': 'calc(var(--editor-font-size) * 11 / 14)',
  'text-sm': 'calc(var(--editor-font-size) * 13 / 14)',
  'text-base': BASE_VAR,
  'text-lg': 'calc(var(--editor-font-size) * 16 / 14)',
  'text-xl': 'calc(var(--editor-font-size) * 18 / 14)',
  'text-2xl': 'calc(var(--editor-font-size) * 22 / 14)',
};

/** Each type-scale token mapped to its numerator over the /14 anchor. */
const EXPECTED_RATIOS: Record<string, number> = {
  'text-xs': 11,
  'text-sm': 13,
  'text-base': 14,
  'text-lg': 16,
  'text-xl': 18,
  'text-2xl': 22,
};

/** Extract a single `--name: <value>;` declaration body from the stylesheet. */
function declarationValue(name: string): string {
  const value = THEME_TOKENS[name];
  if (!value) throw new Error(`--${name} not found in the @theme inline block`);
  return value;
}

/**
 * Resolve a type-scale token to a px number for a given base, by parsing its
 * anchoring: `var(--editor-font-size)` → the base itself; otherwise
 * `calc(var(--editor-font-size) * N / 14)` → base * N / 14. Throws if the
 * declaration is not anchored to `--editor-font-size` (i.e. a hard-coded px).
 */
function resolve(name: string, base: number): number {
  const value = declarationValue(name);
  if (value === BASE_VAR) return base;
  const calc = value.match(/^calc\(var\(--editor-font-size\) \* (\d+(?:\.\d+)?) \/ 14\)$/);
  if (!calc) {
    throw new Error(`--${name} is not anchored to --editor-font-size: "${value}"`);
  }
  return (base * Number(calc[1])) / DEFAULT_BASE;
}

describe('editor type scale (Story 7.3)', () => {
  it('keeps the six audited tokens uniquely authored in @theme inline', () => {
    for (const [name, expected] of Object.entries(EXPECTED_DECLARATIONS)) {
      expect(allDeclarationValues(name), `all stylesheet declarations for --${name}`).toEqual([expected]);
      expect(declarationValue(name), `@theme inline declaration for --${name}`).toBe(expected);
    }
  });

  it('keeps the default CSS base at 14px for pre-config paint', () => {
    expect(ROOT_TOKENS['editor-font-size']).toBe('14px');
  });

  it('reproduces the original px values at the default 14px base (no regression)', () => {
    for (const [name, numerator] of Object.entries(EXPECTED_RATIOS)) {
      expect(resolve(name, DEFAULT_BASE)).toBeCloseTo(numerator, 5);
    }
  });

  it('scales the whole ramp proportionally when the base changes', () => {
    const base = 20;
    for (const [name, numerator] of Object.entries(EXPECTED_RATIOS)) {
      expect(resolve(name, base)).toBeCloseTo((base * numerator) / DEFAULT_BASE, 5);
    }
    // The base step equals the chosen base exactly, keeping editor body and
    // app chrome consistent.
    expect(resolve('text-base', base)).toBe(base);
  });
});
