//! `notey` CLI binary entrypoint (Story 6.1 red-phase ATDD scaffold).
//!
//! All logic lives in the `notey_cli` library so it is unit-testable without the
//! binary. RED phase: [`notey_cli::run`] is a `todo!()` stub, so executing the
//! binary panics until Story 6.1 is implemented.

use std::process::ExitCode;

fn main() -> ExitCode {
    let code = notey_cli::run(std::env::args_os());
    // Exit codes are constrained to 0/1/2 by `exit_code_for`; clamp defensively.
    ExitCode::from(u8::try_from(code).unwrap_or(2))
}
