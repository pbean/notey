pub mod config;
pub mod notes;
pub mod search;
pub mod system;
pub mod window;
pub mod workspace;

use std::sync::{MutexGuard, PoisonError};

use rusqlite::Connection;

use crate::models::config::AppConfig;

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

/// Recover a poisoned config mutex. No transaction cleanup needed —
/// AppConfig is an in-memory struct with no transactional state.
pub(crate) fn recover_poisoned_config<'a>(
    e: PoisonError<MutexGuard<'a, AppConfig>>,
) -> MutexGuard<'a, AppConfig> {
    eprintln!("warning: config mutex poisoned, recovering: {e}");
    e.into_inner()
}
