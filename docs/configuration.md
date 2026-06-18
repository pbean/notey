# Configuration

Notey stores its settings as TOML in a per-user config file. Most options are
editable from **Settings** (`Ctrl+,`); advanced users can edit the file directly.

## Where the config lives

| Platform | Path |
| --- | --- |
| Linux | `$XDG_CONFIG_HOME/notey/config.toml` (usually `~/.config/notey/config.toml`) |
| macOS | `~/Library/Application Support/notey/config.toml` |
| Windows | `%APPDATA%\notey\config.toml` |

Your notes database is stored separately in the platform **data** directory
(e.g. `~/.local/share/notey/notey.db` on Linux).

## Options

The file is divided into sections. All keys have sensible defaults, so a missing
key or section falls back to the shipped value.

```toml
[general]
theme = "system"        # "system" | "dark" | "light"  (default: system)
layoutMode = "floating" # "floating" | "halfScreen" | "fullScreen" (default: floating)
autoStart = false       # launch Notey on login (default: false)

[editor]
fontSize = 14           # editor font size in px (default: 14)
fontFamily = "mono"     # "mono" | "sans" (default: mono)

[hotkey]
globalShortcut = "Ctrl+Shift+N"  # global capture hotkey (macOS default: Cmd+Shift+N)

[shortcuts]
commandPalette = "Ctrl+P"
search = "Ctrl+F"
newNote = "Ctrl+N"
toggleNoteList = "Ctrl+B"
toggleTheme = "Ctrl+Shift+T"
closeTab = "Ctrl+W"

[trash]
retentionDays = 30      # days a trashed note is kept before auto-purge (default: 30)
```

### Notes on values

- **theme** — `system` follows your OS appearance until you pick `dark` or `light`;
  an explicit choice persists across restarts.
- **globalShortcut** / **[shortcuts]** — canonical form is
  `[Ctrl|Cmd]+[Shift]+[Alt]+KEY` where `KEY` is a letter or number. The in-app
  shortcuts treat `Ctrl` and `Cmd` interchangeably and display `⌘` on macOS.
- **retentionDays** — trashed notes older than this are purged automatically on
  startup.

Settings changed in the UI are written back to this file. If you edit the file by
hand, restart Notey to be sure changes are picked up cleanly.
