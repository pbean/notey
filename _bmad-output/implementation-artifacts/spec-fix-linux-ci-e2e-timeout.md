---
title: 'Fix Linux CI E2E tauri-driver timeout'
type: 'bugfix'
created: '2026-04-05'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** Linux CI E2E tests have never passed — `tauri-driver` times out after 15 seconds because the `webkit2gtk-driver` package (providing the `WebKitWebDriver` binary) was never installed. Additionally, driver stderr was silently discarded, making failures opaque.

**Approach:** Install `webkit2gtk-driver` in CI apt-get, capture driver stderr for diagnostics, fix the spawn error handler to not crash the process before diagnostics can log, and ignore unused stdout to avoid backpressure hangs.

## Suggested Review Order

1. [ci.yml:42](../../.github/workflows/ci.yml) — added `webkit2gtk-driver` to apt-get install (root cause fix)
2. [e2e/run.mjs:57-78](../../e2e/run.mjs) — reworked `startDriver()`: stderr capture, graceful error handling, stdout set to `'ignore'`
