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

### Opening an unsigned build

Release artifacts are currently **unsigned**, so your OS warns you the first time
you launch. This is expected — follow your platform's "open anyway" flow once and
the app runs normally thereafter:

- **macOS** — Gatekeeper shows *"Notey can't be opened because it is from an
  unidentified developer."* Either **right-click (or Control-click) the app →
  Open → Open**, or clear the quarantine flag from a terminal:

  ```sh
  xattr -dr com.apple.quarantine /Applications/Notey.app
  ```

- **Windows** — SmartScreen shows *"Windows protected your PC."* Click
  **More info → Run anyway**.

- **Linux** — make the AppImage executable, then run it:

  ```sh
  chmod +x Notey_*.AppImage
  ./Notey_*.AppImage
  ```

  Or install the Debian package: `sudo dpkg -i Notey_*.deb` (or
  `sudo apt install ./Notey_*.deb` to pull in dependencies).

### Updates

Once installed, Notey checks for new releases on startup and shows an **in-app
banner** offering to install and restart when a newer version is published — no
manual re-download needed.

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
