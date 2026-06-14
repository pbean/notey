//! Local IPC (CLI ↔ desktop app) socket server.
//!
//! Story 6.2 introduces a per-user, owner-only local socket that the standalone
//! `notey` CLI (Stories 6.3–6.7) connects to. [`protocol`] defines the JSON
//! request/response envelope and a pure, socket-agnostic dispatcher;
//! [`socket_server`] owns the `interprocess` listener, framing, lifecycle, and
//! Unix `0600` permissions.
//!
//! The protocol structs are deliberately self-contained here and duplicated on
//! the CLI side (no shared crate) per Story 6.1's AC6.

pub mod events;
pub mod protocol;
pub mod socket_server;
