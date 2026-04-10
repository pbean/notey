---
title: 'Deferred search display fixes — whitespace query & XSS verification'
type: 'bugfix'
created: '2026-04-09'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** Two deferred items from Epic 3 code reviews remained open: (1) whitespace-only search queries displayed "No notes matching '   '" because JSX checked `query !== ''` instead of trimming, and (2) the snippet `<mark>` XSS risk was unverified.

**Approach:** Fixed the whitespace display by switching JSX conditions to `query.trim()` checks. Verified the XSS item is already safe — `HighlightedSnippet` parses `<mark>` tags via regex and renders only extracted text as React text nodes, with an explicit XSS test.

## Suggested Review Order

1. [SearchOverlay.tsx](../../../src/features/search/components/SearchOverlay.tsx) — Lines 254, 282, 291: three `.trim()` additions that gate result count header, empty state visibility, and display text
2. [SearchOverlay.test.tsx](../../../src/features/search/components/SearchOverlay.test.tsx) — Line 193: added assertion that whitespace-only input hides empty-state message
3. [deferred-work.md](./deferred-work.md) — Closed both deferred items with resolution notes
