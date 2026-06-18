# Security Policy

## Supported versions

Notey is in active early development. Security fixes are applied to the latest
released version and `main`.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅        |
| < 0.1   | ❌        |

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, report privately through either of:

- GitHub's [private vulnerability reporting](https://github.com/pbean/notey/security/advisories/new)
  ("Report a vulnerability" under the Security tab), or
- Email **pinkyd@luckytick.net** with the details.

Please include:

- A description of the issue and its impact.
- Steps to reproduce (a proof of concept if possible).
- Affected version(s) and platform(s).

You can expect an acknowledgement within a few days. We'll keep you updated on
progress and coordinate a disclosure timeline with you once a fix is ready.

## Scope notes

Notey is a **local-first desktop application**. It stores notes in a local SQLite
database and exposes a **local IPC socket** (Unix domain socket / named pipe) so the
`notey` CLI can talk to the running app. It does not run a network server and does not
transmit your notes anywhere.

Reports of particular interest include:

- Issues with the local IPC socket (e.g. unauthorized local access, input handling).
- Path-traversal or injection issues in workspace/path handling, search, or export.
- Anything that could lead to data loss or corruption of the notes database.

Thank you for helping keep Notey and its users safe.
