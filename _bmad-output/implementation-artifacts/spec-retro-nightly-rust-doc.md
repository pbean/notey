---
title: 'Document nightly Rust requirement and Specta RC pins in project-context'
type: 'chore'
created: '2026-04-04'
status: 'done'
route: 'one-shot'
---

# Document nightly Rust requirement and Specta RC pins in project-context

## Intent

**Problem:** `project-context.md` stated "Rust stable" but the project actually requires `nightly-2026-04-03` (pinned in `rust-toolchain.toml`) due to `specta =2.0.0-rc.24` depending on `fmt::from_fn` behind the `debug_closure_helpers` feature gate. The error variants list was also stale (5 instead of 6, missing `Config`). AI agents reading this file would make wrong toolchain and error-handling assumptions.

**Approach:** Update the Technology Stack section to reflect the nightly pin with rationale, add explicit version pins for `specta` and `specta-typescript` crates, and fix the error variants list.

## Suggested Review Order

1. [project-context.md — Rust toolchain change](../../_bmad-output/project-context.md:24) — Core change: "Rust stable" → "Rust nightly-2026-04-03" with rationale
2. [project-context.md — tauri-specta version pin](../../_bmad-output/project-context.md:30) — Explicit RC version + nightly note
3. [project-context.md — specta crates added](../../_bmad-output/project-context.md:31) — New line: `specta` + `specta-typescript` pins
4. [project-context.md — Config error variant](../../_bmad-output/project-context.md:73) — Pre-existing fix: 6th variant `Config` added
5. [project-context.md — frontmatter + footer dates](../../_bmad-output/project-context.md:3) — Bookkeeping: date updated to 2026-04-04
6. [deferred-work.md — retro deferrals](../../_bmad-output/implementation-artifacts/deferred-work.md:42) — 7 retro action items deferred for future specs
