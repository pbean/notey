# Command-line interface

Notey ships a companion `notey` command-line tool that talks to the **running**
desktop app over a local IPC socket. Notes you add from the terminal appear in the
app immediately (live sync).

> The CLI is under active development; the command surface below reflects the
> current implementation.

## How it works

The desktop app exposes a per-user local socket (a Unix domain socket, or a named
pipe on Windows). The `notey` CLI connects to it, sends a request, and prints the
response. Because both talk to the same database through the app, the CLI and the
desktop UI always agree — and the app's note list refreshes the moment the CLI adds
a note.

The desktop app must be **running** for the CLI to work. If it isn't, the CLI exits
with a non-zero status indicating the app is not running.

## Commands

### `notey add`

Create a note.

```sh
notey add "Pick up milk"                 # quick note
notey add "## TODO\n- ship docs" --format markdown
echo "piped content" | notey add --stdin # read the body from stdin
```

- `--stdin` — read the note content from standard input instead of an argument.
- `--format <markdown|plaintext>` — note format (defaults to `markdown`).

### `notey list`

List notes, most recently updated first.

```sh
notey list
notey list --workspace my-project        # filter to a workspace
```

### `notey search`

Full-text search across your notes.

```sh
notey search "release checklist"
notey search "fts5" --workspace notey
```

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | The app returned an error |
| `2` | The app is not running, or the request timed out |

## Building the CLI

The CLI is a standalone crate:

```sh
cd notey-cli
cargo build           # debug binary at notey-cli/target/debug/notey
cargo build --release # optimized binary
```
