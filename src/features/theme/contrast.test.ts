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
 * Story 7.8 extends this audit to the shadcn `oklch(...)` tokens that render the
 * real dialog / menu / command-palette text, in BOTH themes (see the second
 * describe block below). An in-repo `oklch`→sRGB converter is used so no
 * third-party color dependency is added. Purely decorative tokens are documented
 * as exempt rather than asserted — see the EXEMPTIONS block.
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

/** Parse `--name: oklch(...);` custom-property declarations from a rule body. */
function parseOklchTokens(block: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  const re = /--([\w-]+):\s*(oklch\([^)]*\))\s*;/g;
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

/** WCAG 2.1 contrast ratio between two (already-parsed) opaque-or-alpha colors. */
function wcagRatio(fgRaw: Rgba, bg: Rgba): number {
  const fg = fgRaw.a < 1 ? blend(fgRaw, bg) : fgRaw;
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG 2.1 contrast ratio between a foreground and background hex token. */
function contrast(fgHex: string, bgHex: string): number {
  return wcagRatio(parseHex(fgHex), parseHex(bgHex));
}

/**
 * Convert an `oklch(L C H [/ A])` string to an sRGB {@link Rgba} (0–255 channels,
 * 0–1 alpha). Implements the OKLCH→OKLab→linear-sRGB→gamma pipeline (Björn
 * Ottosson) in-repo so the audit adds no color-conversion dependency. For a
 * pure-gray `oklch(L 0 0)` the linear channels collapse to `L³` (the matrix rows
 * sum to 1), so relative luminance is exactly `L³` — matching the spec note.
 */
function oklchToRgba(str: string): Rgba {
  const m = str.match(
    /oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)(%?))?\s*\)/,
  );
  if (!m) throw new Error(`unparseable oklch token: ${str}`);
  const L = m[2] === '%' ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  const C = parseFloat(m[3]);
  const H = parseFloat(m[4]);
  const a = m[5] === undefined ? 1 : m[6] === '%' ? parseFloat(m[5]) / 100 : parseFloat(m[5]);

  const hRad = (H * Math.PI) / 180;
  const oa = C * Math.cos(hRad);
  const ob = C * Math.sin(hRad);

  const l_ = L + 0.3963377774 * oa + 0.2158037573 * ob;
  const m_ = L - 0.1055613458 * oa - 0.0638541728 * ob;
  const s_ = L - 0.0894841775 * oa - 1.291485548 * ob;

  const l = l_ * l_ * l_;
  const mm = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const rLin = 4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s;

  /** Gamma-encode a linear sRGB channel, clamped to the [0,1] gamut, to 0–255. */
  const encode = (c: number): number => {
    const clamped = Math.min(1, Math.max(0, c));
    const v = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
    return v * 255;
  };

  return { r: encode(rLin), g: encode(gLin), b: encode(bLin), a };
}

/** WCAG 2.1 contrast ratio between two `oklch(...)` token strings. */
function contrastOklch(fg: string, bg: string): number {
  return wcagRatio(oklchToRgba(fg), oklchToRgba(bg));
}

// Final rendered token values = `:root` with the active theme class layered on
// top — the app toggles `.dark` / `.light` on <html> (see applyThemeClass). We
// MUST apply those overrides rather than reading the shadowed `:root` values, or
// the audit could pass on values the user never actually sees. (Review patch.)
const rootHex = parseHexTokens(extractBlock(CSS, ':root'));
const darkTokens = { ...rootHex, ...parseHexTokens(extractBlock(CSS, '\\.dark')) };
const lightTokens = { ...rootHex, ...parseHexTokens(extractBlock(CSS, '\\.light')) };

// shadcn `oklch(...)` tokens follow the inverse layering of the Notey hex tokens:
// `:root` defines the LIGHT values and `.dark` overrides for dark. Resolve each
// theme's final value the same way the browser cascade would.
const rootOklch = parseOklchTokens(extractBlock(CSS, ':root'));
const darkOklch = { ...rootOklch, ...parseOklchTokens(extractBlock(CSS, '\\.dark')) };
const lightOklch = { ...rootOklch, ...parseOklchTokens(extractBlock(CSS, '\\.light')) };

const OKLCH_THEMES = [
  { name: 'dark', tokens: darkOklch },
  { name: 'light', tokens: lightOklch },
] as const;

// The shadcn foreground-on-surface TEXT pairs that render real UI copy (dialogs,
// menus, command palette). Each foreground is audited against the surface it
// actually paints on — NOT against a non-text fill token.
const SHADCN_TEXT_PAIRS = [
  ['foreground', 'background'],
  ['foreground', 'muted'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['accent-foreground', 'accent'],
] as const;

// `--muted-foreground` is secondary text (menu shortcuts, group headings,
// descriptions, empty states) rendered on popover/card/background surfaces — NOT
// on the `--muted` fill. (`muted-foreground` on `--muted` is ~4.34:1 in light,
// but `--muted` is a non-text fill, not a text surface.)
const SHADCN_MUTED_SURFACES = ['background', 'card', 'popover'] as const;

/*
 * EXEMPTIONS — tokens deliberately NOT asserted, with rationale:
 * - `--border-subtle` and the translucent `--border` / `--input` (10–15% alpha):
 *   purely decorative separators. WCAG 1.4.11 governs meaningful UI components,
 *   not decoration; Notey controls are identified by fill + label + focus ring,
 *   so these dividers carry no contrast requirement.
 * - `--ring` (`--color-ring`): NOT a rendered focus indicator in Notey. It only
 *   appears as a no-width 50%-alpha default `outline-color` (`* { outline-ring/50 }`)
 *   that the app-wide `:focus-visible { outline: 2px solid var(--focus-ring) }`
 *   rule overrides for every keyboard focus. The real, visible focus indicator is
 *   `--focus-ring` (asserted ≥3:1 in both themes by AA_NON_TEXT above). Do not
 *   assert a 3:1 floor on `--ring` and do not change its value. (Resolved
 *   2026-06-14 via bmad-auto-resolve.)
 * - `--destructive`: not a required text/surface pair in this audit's scope.
 */

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

/**
 * Story 7.8 — shadcn `oklch(...)` token audit. These tokens render the real text
 * of dialogs, dropdown menus, and the command palette, so their foreground/
 * surface pairs must reach AA normal-text 4.5:1 in BOTH themes. Values are read
 * from `index.css` (single source of truth) and converted in-repo via
 * {@link oklchToRgba}; the `--ring` and decorative-separator EXEMPTIONS above are
 * intentionally NOT asserted here.
 */
describe('shadcn oklch token contrast (WCAG 2.1 AA)', () => {
  it.each(OKLCH_THEMES)('$name theme defines all audited oklch tokens', ({ tokens }) => {
    const needed = new Set<string>(SHADCN_MUTED_SURFACES);
    needed.add('muted-foreground');
    for (const [fg, bg] of SHADCN_TEXT_PAIRS) {
      needed.add(fg);
      needed.add(bg);
    }
    for (const name of needed) {
      expect(tokens[name], `missing oklch token --${name}`).toMatch(/^oklch\(/);
    }
  });

  describe.each(OKLCH_THEMES)('$name theme', ({ name, tokens }) => {
    for (const [fg, bg] of SHADCN_TEXT_PAIRS) {
      it(`${fg} on ${bg} meets 4.5:1`, () => {
        const r = contrastOklch(tokens[fg], tokens[bg]);
        expect(r, `${name}: --${fg} on --${bg} = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      });
    }

    for (const surface of SHADCN_MUTED_SURFACES) {
      it(`muted-foreground on ${surface} meets 4.5:1`, () => {
        const r = contrastOklch(tokens['muted-foreground'], tokens[surface]);
        expect(
          r,
          `${name}: --muted-foreground on --${surface} = ${r.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
  });
});

/**
 * Guards the oklch converter itself: a pure-gray `oklch(L 0 0)` must yield sRGB
 * relative luminance exactly `L³`, so a known pair resolves to the hand-computed
 * ratio. This pins the converter so a regression in the color math can't silently
 * weaken the audit above.
 */
describe('oklchToRgba converter', () => {
  it('treats pure-gray oklch as luminance L³ (white-on-black ≈ 21:1)', () => {
    // L=1 → Y=1; L=0 → Y=0 → ratio (1+0.05)/(0+0.05) = 21.
    const r = contrastOklch('oklch(1 0 0)', 'oklch(0 0 0)');
    expect(r).toBeCloseTo(21, 1);
  });

  it('matches the WCAG luminance of an equivalent hex for mid-gray', () => {
    // oklch(0.5 0 0) → Y = 0.125; sRGB gamma-encode → ~0.604 → #9a9a9a-ish.
    const grayLum = luminance(oklchToRgba('oklch(0.5 0 0)'));
    expect(grayLum).toBeCloseTo(0.125, 2);
  });
});
