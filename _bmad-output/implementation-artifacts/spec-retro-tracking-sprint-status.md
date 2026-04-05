---
title: 'Add Retro Action Item Tracking to sprint-status.yaml'
type: 'chore'
created: '2026-04-05'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** Retrospective action items had zero visibility after creation — commitments lived in a markdown file nobody checked again. Epic 1 produced 8 action items with no tracking mechanism, and Epic 2 adds 9 more.

**Approach:** Add a `retro_action_items` section to `sprint-status.yaml` with all Epic 1 and Epic 2 items, status definitions in the header, and consistent status tracking (`backlog | in-progress | done`).

## Suggested Review Order

1. [sprint-status.yaml](sprint-status.yaml) lines 30–35 — New "Retro Action Item Status" definitions added to the STATUS DEFINITIONS header block
2. [sprint-status.yaml](sprint-status.yaml) lines 143–173 — The new retro action items section with Epic 1 (7/8 resolved) and Epic 2 (1/9 done) entries
