# Contributing to Notey

Thanks for your interest in improving Notey! This guide covers how to set up a
development environment, build and test the app, and submit changes.

By participating you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Prerequisites

- **Node.js** 20+ (CI uses 22) and **npm**.
- **Rust** — the toolchain is pinned in [`rust-toolchain.toml`](rust-toolchain.toml)
  (`nightly-2026-04-03`); install [rustup](https://rustup.rs) and it will be selected
  automatically.
- **Tauri system dependencies** for your OS — see the official
  [Tauri prerequisites](https://tauri.app/start/prerequisites/).

### Linux system packages

The CI image installs these (Debian/Ubuntu names); install the equivalents for your
distribution:

```sh
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev \
  patchelf libxdo-dev webkit2gtk-driver
```

`webkit2gtk-driver` and `tauri-driver` (`cargo install --locked tauri-driver`) are
only needed to run the end-to-end suite and the screenshot capture.

## Running the app

```sh
npm install            # install front-end dependencies
npm run tauri dev      # run with hot-reload (Vite dev server + Rust watch)
```

The window starts hidden; summon it with the global hotkey (`Ctrl+Shift+N`) or from
the system tray.

## Building

```sh
npm run build                       # type-check + build the front end (dist/)
npx tauri build --debug --no-bundle # debug binary at src-tauri/target/debug/notey
npx tauri build                     # release bundles for your platform
```

## Testing

```sh
npm test               # front-end unit tests (Vitest)
cargo test             # Rust unit + integration tests (run in src-tauri/)
node e2e/run.mjs       # end-to-end tests via tauri-driver (needs a debug build)
```

On a headless Linux box, wrap GUI-driven commands with `xvfb-run` and the WebKitGTK
software-rendering flags (the E2E runner sets these automatically).

## Regenerating screenshots

Documentation screenshots in `docs/images/` are produced from the live app:

```sh
npx tauri build --debug --no-bundle   # ensure the debug binary is current
npm run screenshots                    # drives the app and writes docs/images/*.png
# headless: xvfb-run -a npm run screenshots
```

## Type-safe IPC bindings

Rust commands and events are exposed to TypeScript via
[tauri-specta](https://github.com/oscartbeaumont/tauri-specta). The generated file
`src/generated/bindings.ts` is committed; it is regenerated when the app builds in
debug. After changing a `#[tauri::command]` / `#[specta::specta]` signature, rebuild
so the bindings stay in sync, and commit the result.

## Project layout

```
src/                  React 19 + TypeScript front end, organized by feature
  features/<name>/     each feature owns its store, components, and API calls
  components/ui/        shared UI primitives
  generated/            tauri-specta TypeScript bindings (generated)
src-tauri/            Rust back end
  src/commands/         Tauri IPC command handlers
  src/services/         business logic
  src/db/               SQLite schema + migrations (FTS5)
  src/ipc/              local socket server for the CLI
  src/platform/         OS abstraction (macOS / Linux / Windows)
notey-cli/            standalone `notey` CLI (talks to the app over the socket)
e2e/                  tauri-driver E2E suite + screenshot capture
docs/                 user-facing documentation
```

See [docs/architecture.md](docs/architecture.md) for a deeper overview.

## Pull requests

1. Fork and create a feature branch off `main`.
2. Keep changes focused; match the conventions of the surrounding code.
3. Add or update tests for behavioral changes.
4. Make sure `npm test`, `cargo test`, `npm run build`, and (where relevant)
   `node e2e/run.mjs` pass.
5. Update `CHANGELOG.md` under **Unreleased** and any affected docs.
6. Open a PR describing the change and linking any related issue.

## Reporting bugs and requesting features

Use the [issue templates](https://github.com/pbean/notey/issues/new/choose). For
security issues, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
