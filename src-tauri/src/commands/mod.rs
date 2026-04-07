pub mod config;
pub mod notes;
pub mod system;
pub mod window;
pub mod workspace;

use std::sync::{MutexGuard, PoisonError};

use rusqlite::Connection;

/// Recover a poisoned database mutex by extracting the inner guard and
/// issuing a `ROLLBACK` to clear any transaction left open by the panic.
/// The `ROLLBACK` is fire-and-forget — it errors harmlessly in autocommit.
pub(crate) fn recover_poisoned_db<'a>(
    e: PoisonError<MutexGuard<'a, Connection>>,
) -> MutexGuard<'a, Connection> {
    eprintln!("warning: database mutex poisoned, recovering: {e}");
    let guard = e.into_inner();
    let _ = guard.execute_batch("ROLLBACK;");
    guard
}
