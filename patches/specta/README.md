# patches/specta — Stable Rust Fallback Fork

## Purpose

This is a local fork of `specta =2.0.0-rc.24` modified to compile on stable Rust
by replacing `fmt::from_fn` (gated behind the nightly `debug_closure_helpers` feature)
with a wrapper struct pattern.

## Current Status

**Not wired into the build.** The root `Cargo.toml` has no `[patch]` section pointing
here. The project currently uses nightly Rust (`nightly-2026-04-03`) pinned in
`rust-toolchain.toml`, which supports `fmt::from_fn` natively.

## Disposition

Retained as a **fallback plan** in case:

- The nightly pin becomes untenable (breakage, CI instability)
- The project needs to move back to stable Rust before specta ships a stable release

If specta releases a stable version that doesn't require nightly, this directory
can be safely deleted.

## How to Activate

Add a `[patch.crates-io]` section to `src-tauri/Cargo.toml`:

```toml
[patch.crates-io]
specta = { path = "../patches/specta" }
```

Then switch `rust-toolchain.toml` to a stable channel.
