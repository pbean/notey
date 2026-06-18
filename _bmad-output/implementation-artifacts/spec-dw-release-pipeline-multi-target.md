---
title: "Release pipeline producing artifacts for all five targets (DW-98)"
type: "chore"
created: "2026-06-17"
status: "done"
baseline_commit: "46ea161dbcb1c7ff3227f266af09d09157b0da7f"
context: ["{project-root}/_bmad-output/project-context.md"]
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** AC4 of story 8.6 requires distributable build artifacts for five
targets — Windows x64, macOS x64, macOS ARM64, Linux x64, Linux ARM64 — but the
repo has no release workflow. `ci.yml` only runs tests plus a Linux debug build,
so tagging a release produces nothing.

**Approach:** Add a net-new `.github/workflows/release.yml` that fires on a
release tag push and uses `tauri-apps/tauri-action` with a five-entry runner
matrix to build and upload bundles for all five targets to a GitHub Release.

## Boundaries & Constraints

**Always:** Match this repo's existing CI conventions (npm + `npm ci`, Node 22,
the pinned `nightly-2026-04-03` toolchain, the same Linux apt dependency set as
`ci.yml`). Use the Tauri-recommended macOS split (one matrix entry per arch via
`--target`) and native `ubuntu-22.04-arm` runner for Linux ARM64. Pin
third-party actions to the same major versions already used in `ci.yml`.
Release must be created as a **draft** (artifacts are unsigned per project
context — a human publishes after review).

**Ask First:** Switching Linux ARM64 from a native ARM runner to
cross-compilation/emulation. Adding code-signing or notarization secrets.
Changing the tag trigger pattern.

**Never:** Modify `ci.yml` or any existing workflow. Touch application code,
`tauri.conf.json`, `package.json`, or Rust sources. Add network/telemetry to the
app. Introduce auto-update infrastructure. Rename the product (`productName` is
out of scope for this deliverable).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| -------- | ------------- | -------------------------- | -------------- |
| Tag push | `git push` of a tag matching `v*` | Workflow triggers; five matrix jobs run; bundles uploaded to a draft GitHub Release for that tag | `fail-fast: false` so one target's failure does not cancel the others |
| Manual run | `workflow_dispatch` from the Actions UI | Same five-job matrix executes | N/A |
| Non-tag push | push to a branch | Workflow does NOT trigger | N/A |

</frozen-after-approval>

## Code Map

- `.github/workflows/release.yml` -- NEW. The entire deliverable.
- `.github/workflows/ci.yml` -- REFERENCE ONLY. Source of repo conventions
  (toolchain pin, apt deps, Node version, action major versions). Do not edit.
- `src-tauri/tauri.conf.json` -- REFERENCE ONLY. `bundle.active: true`,
  `bundle.targets: "all"` — confirms tauri-action will produce platform bundles.
- `rust-toolchain.toml` -- REFERENCE ONLY. Pins `nightly-2026-04-03` (required by
  specta); the workflow must install this exact toolchain, not `stable`.

## Tasks & Acceptance

**Execution:**

- [x] `.github/workflows/release.yml` -- Create the release workflow:
  - Trigger: `on: push: tags: ['v*']` plus `workflow_dispatch`.
  - `permissions: contents: write` (needed to create the Release).
  - Matrix (`fail-fast: false`) of five entries:
    - `macos-latest` + `args: --target aarch64-apple-darwin` (macOS ARM64)
    - `macos-15-intel` + `args: --target x86_64-apple-darwin` (macOS x64)
    - `ubuntu-22.04` + `args: ''` (Linux x64)
    - `ubuntu-22.04-arm` + `args: ''` (Linux ARM64)
    - `windows-latest` + `args: ''` (Windows x64)
  - Steps: `actions/checkout@v6`; install Linux apt deps (same list as `ci.yml`:
    `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libxdo-dev`)
    on both ubuntu runners; `actions/setup-node@v6` (Node 22, `cache: npm`);
    `dtolnay/rust-toolchain@master` with `toolchain: nightly-2026-04-03` and macOS
    `targets: aarch64-apple-darwin,x86_64-apple-darwin`; `swatinem/rust-cache@v2`
    scoped to `./src-tauri -> target`; `npm ci`; then `tauri-apps/tauri-action@v0`
    with `GITHUB_TOKEN`, tag push/manual-dispatch-safe `tagName`,
    matching `releaseName`, `releaseDraft: true`, `prerelease: false`,
    `args: ${{ matrix.args }}`.

**Acceptance Criteria:**

- Given a tag matching `v*` is pushed, when the workflow runs, then exactly five
  matrix jobs execute covering Windows x64, macOS x64, macOS ARM64, Linux x64,
  and Linux ARM64.
- Given the macOS jobs, when they build, then each targets a single architecture
  via its `--target` arg and the toolchain has both apple-darwin targets added.
- Given any single target's build fails, when the matrix runs, then the remaining
  targets still build (`fail-fast: false`).
- Given the workflow file, when linted/parsed as YAML and GitHub Actions syntax,
  then it is valid with no syntax or schema errors.

### Review Findings

- [x] [Review][Patch] macOS x64 job used ARM64 `macos-latest` runner
  [.github/workflows/release.yml:25]
- [x] [Review][Patch] manual dispatch could create branch-named releases
  [.github/workflows/release.yml:10]
- [x] [Review][Patch] deferred-work resolution overstated `actionlint`
  validation and named the stale macOS matrix
  [_bmad-output/implementation-artifacts/deferred-work.md:777]

#### Review Ledger (2026-06-17)

- patch: macOS x64 job used ARM64 `macos-latest` runner
  [.github/workflows/release.yml:25] — changed the x64 matrix row to
  `macos-15-intel` and broadened macOS Rust target installation to all
  `macos-*` matrix labels.
- patch: manual dispatch could create branch-named releases
  [.github/workflows/release.yml:10] — added a required `releaseTag` input,
  checks out that tag on manual runs, validates the `v*` pattern, and uses that
  tag for the release name/tag.
- patch: deferred-work resolution overstated `actionlint` validation and named
  the stale macOS matrix [_bmad-output/implementation-artifacts/deferred-work.md:777]
  — updated the closeout text to match the corrected matrix and actual
  verification result.
- dismiss: Linux ARM64 depends on a runner label that may not exist
  [.github/workflows/release.yml:29] — current GitHub-hosted runner docs list
  `ubuntu-22.04-arm`, and the current Tauri pipeline guide uses it for Linux
  ARM64.
- dismiss: release action runs concurrently against the same release
  [.github/workflows/release.yml:69] — the current Tauri pipeline guide uses
  the same matrix pattern with `tauri-apps/tauri-action` creating/updating one
  draft release across matrix jobs.
- dismiss: prerelease-looking tags are always marked stable
  [.github/workflows/release.yml:78] — the approved execution checklist
  explicitly requires `prerelease: false`, and releases remain draft for human
  review before publication.

## Design Notes

Tag-push releases use the pushed tag itself, and manual dispatch uses the
required `releaseTag` input for checkout plus release naming. This attaches the
Release to an explicit version tag rather than the docs' branch-push +
`__VERSION__` pattern, because the intent specifies a release-tag workflow.

Toolchain deviates from the Tauri docs (which use `@stable`): this repo is pinned
to `nightly-2026-04-03` in `rust-toolchain.toml` (specta RC requirement), so the
release build must install that exact nightly or it will not compile.

Linux ARM64 uses the GitHub-hosted native `ubuntu-22.04-arm` runner (the current
Tauri-recommended approach, free on public repos) — far simpler and more reliable
than cross-compilation or QEMU emulation.

Manual dispatch requires an explicit existing `releaseTag` input and checks out
that tag before building, so a run from `main` or a feature branch cannot create
a branch-named draft release.

## Spec Change Log

- 2026-06-17 review: amended the non-frozen matrix checklist from
  `macos-latest` to `macos-15-intel` for the macOS x64 job. Current GitHub
  runner docs map `macos-latest` to ARM64, so retaining `macos-latest` for the
  x64 row risked producing only ARM-hosted macOS artifacts while claiming Intel
  coverage.

## Verification

This workflow only runs on a real release tag push and cannot be exercised by the
local cargo/vitest gate. Verification is config-correctness review.

**Commands:**

- `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/release.yml'))"` -- expected: exits 0 (valid YAML).
- `actionlint .github/workflows/release.yml` -- expected: no errors (if `actionlint` is available; skip if not installed).

**Manual checks:**

- Confirm five matrix entries map 1:1 to the five required targets.
- Confirm action versions match `ci.yml` majors (`checkout@v6`, `setup-node@v6`,
  `dtolnay/rust-toolchain@master`) and `tauri-action@v0`.
- Confirm `releaseDraft: true` and `permissions: contents: write` are present.
