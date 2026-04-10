---
title: 'CodeMirror 6 Multi-Instance Research Document'
type: 'chore'
created: '2026-04-09'
status: 'done'
route: 'one-shot'
---

# CodeMirror 6 Multi-Instance Research Document

## Intent

**Problem:** Story 4.4 (Editor-Tab Integration) is the highest-risk story in Epic 4. Multi-instance CodeMirror involves architectural decisions around state management, auto-save integration, and scroll/cursor preservation that cannot be safely improvised during implementation.

**Approach:** Produce a research document (following the FTS5 research precedent from Epic 3) that covers: strategy selection (single view + setState vs multiple views), EditorState lifecycle, serialization, extension management, auto-save integration, scroll preservation, and gotchas — grounded in the current codebase and official CodeMirror 6 documentation.

## Suggested Review Order

1. [codemirror-multi-instance-research.md](codemirror-multi-instance-research.md) -- The research document. Start with Section 1 (architectural decision) for the core recommendation, then Section 9 (integration with notey) for codebase impact.
2. [deferred-work.md](deferred-work.md) -- Two pre-existing issues surfaced by adversarial review: missing `history()` extension, `sharedDebounceRef` strict mode fragility.
