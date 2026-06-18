# Installation

Notey runs natively on macOS, Linux, and Windows.

## Download a release

The easiest way to install Notey is to grab a prebuilt bundle from the
[Releases page](https://github.com/pbean/notey/releases). Release builds are
produced for:

- **macOS** — Apple Silicon (arm64) and Intel (x64)
- **Linux** — x64 and arm64
- **Windows** — x64

Download the artifact for your platform and install it the usual way for your OS
(open the `.dmg` on macOS, the `.AppImage`/`.deb` on Linux, or the installer on
Windows).

> Release artifacts are currently unsigned. Your OS may warn you on first launch;
> allow the app to run via your platform's standard "open anyway" flow.

## First launch

Notey starts **hidden** in the system tray — there is no window on screen at
first. To open it:

- Press the global capture hotkey: **`Ctrl+Shift+N`** (**`Cmd+Shift+N`** on macOS), or
- Click the Notey tray icon and choose **Open Notey**.

On first run you'll see a short onboarding overlay showing the capture hotkey,
which you can customize. On macOS you may be prompted to grant Accessibility
permission so the global hotkey can work.

See the [user guide](user-guide.md) to learn your way around.

## Auto-start on login

To have Notey launch automatically when you log in, open **Settings**
(`Ctrl+,`) and enable **Start on login**.

## Build from source

You'll need:

- **Node.js** 20+ and **npm**
- **Rust** via [rustup](https://rustup.rs) (the pinned toolchain in
  `rust-toolchain.toml` is selected automatically)
- The [Tauri system dependencies](https://tauri.app/start/prerequisites/) for your OS

On Debian/Ubuntu Linux:

```sh
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libxdo-dev
```

Then:

```sh
git clone https://github.com/pbean/notey.git
cd notey
npm install

# Run in development (hot-reload):
npm run tauri dev

# Or produce an optimized build for your platform:
npx tauri build
```

The bundled installers/binaries are written under `src-tauri/target/release/bundle/`.

For the full contributor setup, see [CONTRIBUTING.md](../CONTRIBUTING.md).
