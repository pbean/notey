// Shared integration-test helpers. Each test binary that includes this module
// uses a different subset of the factory API, so suppress dead-code warnings for
// the helpers a given binary doesn't happen to touch (e.g. `ipc_tests` needs
// only `create_temp_db`).
#[allow(dead_code)]
pub mod factories;
